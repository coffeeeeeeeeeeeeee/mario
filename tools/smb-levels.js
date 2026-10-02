// Decodificador de los niveles originales de Super Mario Bros.
//
// Lee tools/smbdis.asm (el desensamblado, que no se versiona) y reproduce el algoritmo de
// DecodeAreaData / ProcessAreaData del juego original para generar los mapas en el formato de
// assets.js: una grilla de metatiles y una lista de enemigos por nivel.
//
// Uso:  node tools/smb-levels.js [--ascii] [--out levels_smb.js]
//
// Los mapas guardan los números de metatile originales. Los objetos del original que el motor no
// tiene se reemplazan por algo equivalente; ver METATILE_NOTES y ENEMY_TO_ENTITY. Al final se
// imprime un informe de qué se reemplazó o descartó.

const fs = require('fs');
const path = require('path');

const ASM_PATH = path.join(__dirname, 'smbdis.asm');

// ---------------------------------------------------------------------------------------------
// Lectura del desensamblado
// ---------------------------------------------------------------------------------------------

function loadAsm() {
	if (!fs.existsSync(ASM_PATH)) {
		throw new Error(`No se encontró ${ASM_PATH}. Bajalo de https://github.com/abnuo/smbdis-dasm (src/smbdis.asm).`);
	}
	return fs.readFileSync(ASM_PATH, 'utf8').split('\n');
}

function parseByte(tok) {
	tok = tok.trim();
	if (tok.startsWith('$')) return parseInt(tok.slice(1), 16);
	if (tok.startsWith('%')) return parseInt(tok.slice(1), 2);
	return parseInt(tok, 10);
}

// Bytes de un bloque `Etiqueta:` seguido de líneas dc.b (también acepta dc.b en la misma línea).
function readBlock(lines, label) {
	const start = lines.findIndex(l => l.startsWith(label + ':'));
	if (start < 0) throw new Error(`Etiqueta no encontrada: ${label}`);
	const out = [];
	for (let i = start; i < lines.length; i++) {
		let l = lines[i].replace(/;.*/, '');
		if (i === start) l = l.slice(l.indexOf(':') + 1);
		else if (/^[A-Za-z_]\w*:/.test(l.trim())) break;
		l = l.trim();
		if (!l) continue;
		const m = l.match(/^dc\.b\s+(.*)$/);
		if (!m) break;
		for (const tok of m[1].split(',')) if (tok.trim()) out.push(parseByte(tok));
	}
	return out;
}

// Nombres de etiqueta, en orden, de una tabla como `dc.b <L_WaterArea1, <L_WaterArea2, ...`.
function readLabelTable(lines, label) {
	const start = lines.findIndex(l => l.startsWith(label + ':'));
	const out = [];
	for (let i = start + 1; i < lines.length; i++) {
		const l = lines[i].replace(/;.*/, '').trim();
		if (!l) break;
		const m = l.match(/^dc\.b\s+(.*)$/);
		if (!m) break;
		for (const tok of m[1].split(',')) out.push(tok.trim().replace(/^[<>]/, ''));
	}
	return out;
}

// ---------------------------------------------------------------------------------------------
// Tablas del juego original (copiadas de SMBDIS.ASM; las de datos grandes se leen del archivo)
// ---------------------------------------------------------------------------------------------

const AREA_TYPE = { Water: 0, Ground: 1, Underground: 2, Castle: 3 };

const ENEMY_ADDR_H_OFFSETS = [0x1f, 0x06, 0x1c, 0x00];
const AREA_DATA_H_OFFSETS = [0x00, 0x03, 0x19, 0x1c];

const SOLID_BLOCK_METATILES = [0x69, 0x61, 0x61, 0x62];
const BRICK_METATILES = [0x22, 0x51, 0x52, 0x52, 0x88];
const COIN_METATILE_DATA = [0xc3, 0xc2, 0xc2, 0xc2];
const HOLE_METATILES = [0x87, 0x00, 0x00, 0x00];
const TERRAIN_METATILES = [0x69, 0x54, 0x52, 0x62];
const BRICK_Q_BLOCK_METATILES = [0xc1, 0xc0, 0x5f, 0x60, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e];
const VERTICAL_PIPE_DATA = [0x11, 0x10, 0x15, 0x14, 0x13, 0x12, 0x15, 0x14];
const SIDE_PIPE_SHAFT_DATA = [0x15, 0x14, 0x00, 0x00];
const SIDE_PIPE_TOP_PART = [0x15, 0x1e, 0x1d, 0x1c];
const SIDE_PIPE_BOTTOM_PART = [0x15, 0x21, 0x20, 0x1f];
const STAIRCASE_HEIGHT_DATA = [0x07, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01, 0x00];
const STAIRCASE_ROW_DATA = [0x03, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a];
const C_OBJECT_ROW = [0x06, 0x07, 0x08];
const C_OBJECT_METATILE = [0xc5, 0x0c, 0x89];
const BSCENE_DATA_OFFSETS = [0x00, 0x30, 0x60];
const FSCENE_DATA_OFFSETS = [0x00, 0x0d, 0x1a];
const TERRAIN_RENDER_BITS = [
	0b00000000, 0b00000000, 0b00000000, 0b00011000, 0b00000001, 0b00011000, 0b00000111, 0b00011000,
	0b00001111, 0b00011000, 0b11111111, 0b00011000, 0b00000001, 0b00011111, 0b00000111, 0b00011111,
	0b00001111, 0b00011111, 0b10000001, 0b00011111, 0b00000001, 0b00000000, 0b10001111, 0b00011111,
	0b11110001, 0b00011111, 0b11111001, 0b00011000, 0b11110001, 0b00011000, 0b11111111, 0b00011111,
];
const BLOCK_BUFF_LOW_BOUNDS = [0x10, 0x51, 0x88, 0xc0];

// ---------------------------------------------------------------------------------------------
// Metatiles y enemigos
// ---------------------------------------------------------------------------------------------
// Los mapas usan los números de metatile originales del juego de NES, tal cual (sólo se guardan los
// que el original guarda en su búfer de bloques: los de decoración, como nubes, arbustos o árboles
// de fondo, no figuran y el juego dibuja su propio fondo con parallax). El motor decide cómo
// dibuja y qué hace cada metatile; acá sólo se anotan, para el informe, los que el motor
// aproxima con otra cosa.

const MT = {
	PipeTopLeft: 0x10, PipeTopRight: 0x11, DecoPipeTopLeft: 0x12, DecoPipeTopRight: 0x13,
	FlagpoleTop: 0x24, Flagpole: 0x25, Hard: 0x61, Axe: 0xc5,
};

const METATILE_NOTES = {};
for (let i = 0x16; i <= 0x1b; i++) METATILE_NOTES[i] = 'plataforma de árbol u hongo (se dibuja como bloque duro)';
Object.assign(METATILE_NOTES, {
	0x56: 'ladrillo con enredadera (el motor lo trata como hongo)', 0x5b: 'ladrillo con enredadera (el motor lo trata como hongo)',
	0x57: 'ladrillo con estrella (el motor lo trata como hongo)', 0x5c: 'ladrillo con estrella (el motor lo trata como hongo)',
	0x62: 'ladrillo de castillo (se dibuja como bloque duro)',
	0x63: 'puente (se dibuja como bloque duro)', 0x89: 'puente (se dibuja como bloque duro)',
	0x64: 'cañón de Bullet Bill (bloque duro, sin disparos)', 0x65: 'cañón de Bullet Bill (bloque duro, sin disparos)', 0x66: 'cañón de Bullet Bill (bloque duro, sin disparos)',
	0x67: 'resorte (bloque duro)', 0x68: 'resorte (bloque duro)',
	0xc5: 'hacha del castillo',
});

// Enemigo del original -> enemigo del motor (null si no existe y se descarta)
const ENEMY_TO_ENTITY = {
	0x00: { type: 'Koopa', color: 'Green' },
	0x02: { type: 'Goomba', note: 'Buzzy Beetle -> Goomba' },
	0x03: { type: 'Koopa', color: 'Red' },
	0x05: { type: 'Koopa', color: 'Red', note: 'Hammer Bro -> Koopa rojo' },
	0x06: { type: 'Goomba' },
	0x0e: { type: 'Koopa_Winged', color: 'Green' },
	0x0f: { type: 'Koopa_Winged', color: 'Red' },
	0x10: { type: 'Koopa_Winged', color: 'Green' },
	0x12: { type: 'Goomba', note: 'Spiny -> Goomba' },
	0x2d: { type: 'Koopa', color: 'Red', note: 'Bowser -> Koopa rojo' },
};

// ---------------------------------------------------------------------------------------------
// Decodificador de un área
// ---------------------------------------------------------------------------------------------

class AreaDecoder {
	constructor({ lines, areaPointer, worldNumber, areaNumber, report }) {
		this.report = report;
		this.worldNumber = worldNumber;
		this.areaNumber = areaNumber;
		this.areaPointer = areaPointer;
		this.areaType = (areaPointer >> 5) & 3;
		const idx = areaPointer & 0x1f;

		const areaLabels = readLabelTable(lines, 'AreaDataAddrLow');
		const enemyLabels = readLabelTable(lines, 'EnemyDataAddrLow');
		this.areaLabel = areaLabels[AREA_DATA_H_OFFSETS[this.areaType] + idx].replace(/^</, '');
		this.enemyLabel = enemyLabels[ENEMY_ADDR_H_OFFSETS[this.areaType] + idx].replace(/^</, '');
		const areaBytes = readBlock(lines, this.areaLabel);
		this.enemyBytes = readBlock(lines, this.enemyLabel);

		// Cabecera de dos bytes
		const h0 = areaBytes[0], h1 = areaBytes[1];
		this.foregroundScenery = (h0 & 7) < 4 ? (h0 & 7) : 0;
		this.backgroundColorCtrl = (h0 & 7) >= 4 ? (h0 & 7) : 0;
		this.playerEntranceCtrl = (h0 >> 3) & 7;
		this.gameTimerSetting = (h0 >> 6) & 3;
		this.terrainControl = h1 & 0x0f;
		this.backgroundScenery = (h1 >> 4) & 3;
		const style = (h1 >> 6) & 3;
		this.cloudTypeOverride = style === 3 ? 3 : 0;
		this.areaStyle = style === 3 ? 0 : style;
		this.data = areaBytes.slice(2);

		// Memoria del motor original
		this.mt = new Array(13).fill(0);
		this.areaObjectLength = [-1, -1, -1];
		this.areaObjOffsetBuffer = [0, 0, 0];
		this.areaDataOffset = 0;
		this.areaObjectPageLoc = 0;
		this.areaObjectPageSel = 0;
		this.currentPageLoc = 0;
		this.currentColumnPos = 0;
		this.staircaseControl = 0;
		this.mushroomLedgeHalfLen = [0, 0, 0];
		this.objectOffset = 0;
		this.d00 = 0;
		this.d06 = 0;
		this.d07 = 0;
		this.columns = [];
		this.pipeTops = [];      // caños que llevan a algún lado (extremo superior izquierdo)
		this.exitPipes = [];     // caños laterales de salida (boca a la izquierda)
		this.piranhas = [];
		this.flagpole = null;

		const sceneData = readBlock(lines, 'BackSceneryData');
		const sceneMT = readBlock(lines, 'BackSceneryMetatiles');
		const foreData = readBlock(lines, 'ForeSceneryData');
		this.sceneData = sceneData;
		this.sceneMT = sceneMT;
		this.foreData = foreData;
	}

	get dataEnded() { return this.data[this.areaDataOffset] === 0xfd; }

	// --- utilidades de objetos -----------------------------------------------------------------

	getLrgObjAttrib(x) {
		const y = this.areaObjOffsetBuffer[x];
		this.d07 = this.data[y] & 0x0f;
		return this.data[y + 1] & 0x0f;
	}

	chkLrgObjFixedLength(x, y) {
		if (this.areaObjectLength[x] >= 0) return false;
		this.areaObjectLength[x] = y;
		return true;
	}

	chkLrgObjLength(x) {
		const y = this.getLrgObjAttrib(x);
		const started = this.chkLrgObjFixedLength(x, y);
		return { y, started };
	}

	renderUnderPart(x, h, a) {
		for (;;) {
			const cur = this.mt[x];
			let draw = true;
			if (cur !== 0) {
				if (cur === 0x17 || cur === 0x1a) draw = false;
				else if (cur === 0xc0) draw = true;
				else if (cur > 0xc0) draw = false;
				else if (cur === 0x54 && a === 0x50) draw = false;
			}
			if (draw) this.mt[x] = a;
			x++;
			if (x >= 0x0d) return;
			h--;
			if (h < 0) return;
		}
	}

	get areaObjXPos() { return this.currentColumnPos * 16; }

	// --- objetos -------------------------------------------------------------------------------

	verticalPipe(x) {
		this.chkLrgObjFixedLength(x, 1);
		const attr = this.getLrgObjAttrib(x);
		const height = attr & 7;
		let y = this.areaObjectLength[x];
		if (this.d00 !== 0) y += 4;

		const first = this.areaObjectLength[x] !== 0;
		if (first && (this.areaNumber | this.worldNumber) !== 0) {
			this.piranhas.push({ col: this.currentPageLoc * 16 + this.currentColumnPos, row: this.d07 });
		}
		const row = this.d07;
		this.mt[row] = VERTICAL_PIPE_DATA[y];
		if (y < 4 && this.areaObjectLength[x] === 1) {
			this.pipeTops.push({ col: this.currentPageLoc * 16 + this.currentColumnPos, row });
		}
		this.renderUnderPart(row + 1, height - 1, VERTICAL_PIPE_DATA[y + 2]);
	}

	areaStyleObject(x) {
		if (this.areaStyle === 0) this.treeLedge(x);
		else if (this.areaStyle === 1) this.mushroomLedge(x);
		else this.bulletBillCannon(x);
	}

	treeLedge(x) {
		const y = this.getLrgObjAttrib(x);
		const len = this.areaObjectLength[x];
		let a, mid = false;
		if (len === 0) {
			a = 0x18;
		} else if (len > 0) {
			mid = true;
		} else {
			this.areaObjectLength[x] = y;
			if ((this.currentPageLoc | this.currentColumnPos) === 0) mid = true;
			else a = 0x16;
		}
		if (mid) {
			this.mt[this.d07] = 0x17;
			this.renderUnderPart(this.d07 + 1, 0x0f, 0x4c);
		} else {
			this.renderUnderPart(this.d07, 0, a);
		}
	}

	mushroomLedge(x) {
		const { y, started } = this.chkLrgObjLength(x);
		this.d06 = y;
		if (started) {
			this.mushroomLedgeHalfLen[x] = this.areaObjectLength[x] >> 1;
			this.renderUnderPart(this.d07, 0, 0x19);
			return;
		}
		const len = this.areaObjectLength[x];
		if (len === 0) {
			this.renderUnderPart(this.d07, 0, 0x1b);
			return;
		}
		this.d06 = this.mushroomLedgeHalfLen[x];
		this.mt[this.d07] = 0x1a;
		if (len !== this.d06) return;
		this.mt[this.d07 + 1] = 0x4f;
		this.renderUnderPart(this.d07 + 2, 0x0f, 0x50);
	}

	bulletBillCannon(x) {
		let y = this.getLrgObjAttrib(x);
		let r = this.d07;
		this.mt[r++] = 0x64;
		if (--y < 0) return;
		this.mt[r++] = 0x65;
		if (--y < 0) return;
		this.renderUnderPart(r, y, 0x66);
	}

	rowOfBricks(x) {
		const t = this.cloudTypeOverride ? 4 : this.areaType;
		this.getRow(x, BRICK_METATILES[t]);
	}
	rowOfSolidBlocks(x) { this.getRow(x, SOLID_BLOCK_METATILES[this.areaType]); }
	rowOfCoins(x) { this.getRow(x, COIN_METATILE_DATA[this.areaType]); }
	getRow(x, a) {
		this.chkLrgObjLength(x);
		this.renderUnderPart(this.d07, 0, a);
	}
	columnOfBricks(x) { this.getRow2(x, BRICK_METATILES[this.areaType]); }
	columnOfSolidBlocks(x) { this.getRow2(x, SOLID_BLOCK_METATILES[this.areaType]); }
	getRow2(x, a) {
		const y = this.getLrgObjAttrib(x);
		this.renderUnderPart(this.d07, y, a);
	}

	holeEmpty(x) {
		this.chkLrgObjLength(x);
		this.renderUnderPart(8, 0x0f, HOLE_METATILES[this.areaType]);
	}

	questionBlockRow(x, row) {
		this.chkLrgObjLength(x);
		this.mt[row] = 0xc0;
	}

	bridge(x, row) {
		this.chkLrgObjLength(x);
		this.mt[row] = 0x0b;
		this.renderUnderPart(row + 1, 0, 0x63);
	}

	staircaseObject(x) {
		const { started } = this.chkLrgObjLength(x);
		if (started) this.staircaseControl = 9;
		this.staircaseControl--;
		const y = this.staircaseControl;
		this.renderUnderPart(STAIRCASE_ROW_DATA[y], STAIRCASE_HEIGHT_DATA[y], 0x61);
	}

	renderSidewaysPipe(x, yv) {
		yv -= 2;
		const d05 = yv;
		const y = this.areaObjectLength[x];
		const d06 = y;
		let xx = d05 + 1;
		const shaft = SIDE_PIPE_SHAFT_DATA[y];
		let carry = true;
		if (shaft !== 0) {
			this.renderUnderPart(0, d05, shaft);
			carry = false;
		}
		this.mt[xx] = SIDE_PIPE_TOP_PART[d06];
		this.mt[xx + 1] = SIDE_PIPE_BOTTOM_PART[d06];
		return { carry, y: d06, row: xx };
	}

	exitPipe(x) {
		const starting = this.chkLrgObjFixedLength(x, 3);
		const y = this.getLrgObjAttrib(x);
		const r = this.renderSidewaysPipe(x, y);
		if (starting) this.exitPipes.push({ col: this.currentPageLoc * 16 + this.currentColumnPos, row: r.row });
	}

	introPipe(x) {
		this.chkLrgObjFixedLength(x, 3);
		const { carry, y } = this.renderSidewaysPipe(x, 0x0a);
		if (!carry) {
			for (let i = 6; i >= 0; i--) this.mt[i] = 0;
			this.mt[7] = VERTICAL_PIPE_DATA[y];
		}
	}

	flagpoleObject() {
		this.mt[0] = 0x24;
		this.renderUnderPart(1, 8, 0x25);
		this.mt[10] = 0x61;
		this.flagpole = { col: this.currentPageLoc * 16 + this.currentColumnPos };
	}

	emptyBlock(x) {
		this.getLrgObjAttrib(x);
		this.renderUnderPart(this.d07, 0, 0xc4);
	}

	jumpspring(x) {
		this.getLrgObjAttrib(x);
		this.mt[this.d07] = 0x67;
		this.mt[this.d07 + 1] = 0x68;
	}

	questionBlock(x) {
		this.drawQBlk(x, BRICK_Q_BLOCK_METATILES[this.d00]);
	}
	hidden1UpBlock(x) {
		// En el original sólo aparece si Hidden1UpFlag está activo; acá se deja siempre.
		this.brickWithItem(x);
	}
	brickWithItem(x) {
		let adder = this.areaType - 1 === 0 ? 0 : 5;
		this.drawQBlk(x, BRICK_Q_BLOCK_METATILES[this.d00 + adder]);
	}
	drawQBlk(x, a) {
		this.getLrgObjAttrib(x);
		this.renderUnderPart(this.d07, 0, a);
	}

	castleObjectRow(x, idx) {
		if (idx === 4) this.chkLrgObjFixedLength(x, 0x0c);
		const row = C_OBJECT_ROW[idx - 2];
		this.renderUnderPart(row, 0, C_OBJECT_METATILE[idx - 2]);
		if (idx === 2) this.axe = { col: this.currentPageLoc * 16 + this.currentColumnPos, row };
	}

	alterAreaAttributes(x) {
		const b = this.data[this.areaObjOffsetBuffer[x] + 1];
		if ((b & 0x40) === 0) {
			this.terrainControl = b & 0x0f;
			this.backgroundScenery = (b & 0x30) >> 4;
		} else {
			const v = b & 7;
			if (v >= 4) { this.backgroundColorCtrl = v; this.foregroundScenery = 0; }
			else this.foregroundScenery = v;
		}
	}

	runObject(x, index) {
		switch (index) {
			case 0: case 7: return this.verticalPipe(x);
			case 1: return this.areaStyleObject(x);
			case 2: return this.rowOfBricks(x);
			case 3: return this.rowOfSolidBlocks(x);
			case 4: return this.rowOfCoins(x);
			case 5: return this.columnOfBricks(x);
			case 6: return this.columnOfSolidBlocks(x);
			case 8: return this.holeEmpty(x);
			case 9: return this.chkLrgObjLength(x);              // polea (decoración)
			case 10: return this.bridge(x, 6);
			case 11: return this.bridge(x, 7);
			case 12: return this.bridge(x, 9);
			case 13: this.chkLrgObjLength(x); this.mt[10] = 0x86; return this.renderUnderPart(0x0b, 1, 0x87);
			case 14: return this.questionBlockRow(x, 3);
			case 15: return this.questionBlockRow(x, 7);
			case 0x10: return this.renderUnderPart(0, 0x0f, 0x40); // soga
			case 0x11: return this.renderUnderPart(1, 0x0f, 0x44);
			case 0x12: return this.chkLrgObjFixedLength(x, 4);     // castillo (decoración)
			case 0x13: return this.staircaseObject(x);
			case 0x14: return this.exitPipe(x);
			case 0x15: return;
			case 0x16: case 0x17: case 0x18: return this.questionBlock(x);
			case 0x19: return this.hidden1UpBlock(x);
			case 0x1a: case 0x1b: case 0x1c: case 0x1d: case 0x1e: return this.brickWithItem(x);
			case 0x1f: return;                                     // caño de agua
			case 0x20: return this.emptyBlock(x);
			case 0x21: return this.jumpspring(x);
			case 0x22: return this.introPipe(x);
			case 0x23: return this.flagpoleObject();
			case 0x24: case 0x25: case 0x26: return this.castleObjectRow(x, index - 0x22);
			case 0x27: case 0x28: case 0x29: case 0x2a: case 0x2b: case 0x2c: case 0x2d: return;
			case 0x2e: return this.alterAreaAttributes(x);
			default: throw new Error(`Objeto desconocido ${index.toString(16)}`);
		}
	}

	// --- ProcessAreaData / DecodeAreaData ------------------------------------------------------

	incAreaObjOffset() {
		this.areaDataOffset += 2;
		this.areaObjectPageSel = 0;
	}

	processAreaData() {
		for (;;) {
			let behind = false;
			for (let x = 2; x >= 0; x--) {
				this.objectOffset = x;
				behind = false;
				const y = this.areaDataOffset;
				const first = this.data[y];
				let action = 'decode';
				if (first !== 0xfd && this.areaObjectLength[x] < 0) {
					const second = this.data[y + 1];
					if ((second & 0x80) && this.areaObjectPageSel === 0) {
						this.areaObjectPageSel = 1;
						this.areaObjectPageLoc++;
					}
					const row = first & 0x0f;
					let checkRear = true;
					if (row === 0x0d && (second & 0x40) === 0 && this.areaObjectPageSel === 0) {
						// objeto de control de página
						this.areaObjectPageLoc = second & 0x1f;
						this.areaObjectPageSel = 1;
						action = 'next';
						checkRear = false;
					}
					if (checkRear) {
						if (this.areaObjectPageLoc < this.currentPageLoc) { behind = true; action = 'next'; }
					}
				}
				if (action === 'decode') this.decodeAreaData(x);
				else this.incAreaObjOffset();
				if (this.areaObjectLength[x] >= 0) this.areaObjectLength[x]--;
			}
			if (!behind) return;
		}
	}

	decodeAreaData(x) {
		let y;
		if (this.areaObjectLength[x] >= 0) y = this.areaObjOffsetBuffer[x];
		else y = this.areaDataOffset;
		const first = this.data[y];
		if (first === 0xfd) return;
		const row = first & 0x0f;
		let off07 = row === 0x0f ? 0x10 : row === 0x0c ? 0x08 : 0x00;
		let a;
		if (row === 0x0e) {
			off07 = 0;
			a = 0x2e;
		} else if (row === 0x0d) {
			off07 = 0x22;
			const b = this.data[y + 1];
			if ((b & 0x40) === 0) return;
			a = (b & 0x7f) & 0x3f;
		} else if (row >= 0x0c) {
			const b = this.data[y + 1];
			a = (b & 0x70) >> 4;
		} else {
			const b = this.data[y + 1];
			const t = b & 0x70;
			if (t !== 0) {
				let v = t;
				if (v === 0x70 && (b & 0x08)) v = 0;
				a = v >> 4;
			} else {
				off07 = 0x16;
				a = b & 0x0f;
			}
		}
		this.d00 = a;
		this.d07 = off07;
		if (this.areaObjectLength[x] < 0) {
			if (this.areaObjectPageLoc !== this.currentPageLoc) {
				const f = this.data[this.areaDataOffset];
				if ((f & 0x0f) !== 0x0e) return;
				return;
			}
			const hi = this.data[this.areaDataOffset] >> 4;
			if (hi !== this.currentColumnPos) return;
			this.areaObjOffsetBuffer[x] = this.areaDataOffset;
			this.incAreaObjOffset();
		}
		this.runObject(x, this.d00 + off07);
	}

	// --- Terreno y escenografía de cada columna ------------------------------------------------

	renderSceneryTerrain() {
		this.mt.fill(0);
		if (this.backgroundScenery !== 0) {
			let p = this.currentPageLoc;
			while (p >= 3) p -= 3;
			const tx = p * 16 + BSCENE_DATA_OFFSETS[this.backgroundScenery - 1] + this.currentColumnPos;
			const v = this.sceneData[tx];
			if (v) {
				let off = ((v & 0x0f) - 1) * 3;
				let y = v >> 4;
				for (let n = 0; n < 3; n++) {
					this.mt[y] = this.sceneMT[off];
					off++; y++;
					if (y === 0x0b) break;
				}
			}
		}
		if (this.foregroundScenery !== 0) {
			let y = FSCENE_DATA_OFFSETS[this.foregroundScenery - 1];
			for (let xx = 0; xx < 13; xx++, y++) {
				if (this.foreData[y]) this.mt[xx] = this.foreData[y];
			}
		}
		let terrain = this.areaType === AREA_TYPE.Water && this.worldNumber === 7 ? 0x62 : TERRAIN_METATILES[this.areaType];
		if (this.cloudTypeOverride) terrain = 0x88;
		let rx = 0;
		let by = this.terrainControl * 2;
		outer:
		for (;;) {
			let bits = TERRAIN_RENDER_BITS[by++];
			if (this.cloudTypeOverride && rx !== 0) bits &= 0x08;
			for (let bit = 0; bit < 8; bit++) {
				if (bits & (1 << bit)) this.mt[rx] = terrain;
				rx++;
				if (rx === 0x0d) break outer;
				if (this.areaType === AREA_TYPE.Underground && rx === 0x0b) terrain = 0x54;
			}
		}
	}

	renderColumn() {
		this.renderSceneryTerrain();
		this.processAreaData();
		const col = new Array(13);
		for (let i = 0; i < 13; i++) {
			const mt = this.mt[i];
			const grp = (mt & 0xc0) >> 6;
			col[i] = mt >= BLOCK_BUFF_LOW_BOUNDS[grp] ? mt : 0;
		}
		this.columns.push(col);
	}

	run() {
		let guard = 0;
		for (;;) {
			for (let c = 0; c < 16; c++) {
				this.currentColumnPos = c;
				this.renderColumn();
			}
			this.currentPageLoc++;
			guard++;
			const objectsPending = this.areaObjectLength.some(l => l >= 0);
			if (this.dataEnded && !objectsPending) break;
			if (guard > 40) throw new Error(`${this.areaLabel}: no termina`);
		}
	}

	// --- Enemigos ------------------------------------------------------------------------------

	decodeEnemies() {
		const d = this.enemyBytes;
		let o = 0, page = 0, sel = 0;
		const enemies = [], warps = [];
		while (o < d.length && d[o] !== 0xff) {
			const b0 = d[o], b1 = d[o + 1];
			if ((b1 & 0x80) && !sel) { sel = 1; page++; }
			const row = b0 & 0x0f;
			if (row === 0x0f && !sel) { page = b1 & 0x3f; o += 2; sel = 1; continue; }
			const col = b0 >> 4;
			if (row === 0x0e) {
				const b2 = d[o + 2];
				if ((b2 >> 5) === this.worldNumber) {
					warps.push({ x: page * 16 + col, pointer: b1, entrancePage: b2 & 0x1f });
				}
				o += 3; sel = 0; continue;
			}
			const id = b1 & 0x3f;
			if (!(b1 & 0x40)) enemies.push({ x: page * 16 + col, row, id });
			o += 2; sel = 0;
		}
		this.enemies = enemies;
		this.warpEntries = warps;
	}
}

// ---------------------------------------------------------------------------------------------
// Armado del mapa del juego
// ---------------------------------------------------------------------------------------------

const TOP_ROWS = 2;        // dos filas vacías arriba: la pantalla del NES tiene 13 filas de nivel
const MAP_HEIGHT = 13 + TOP_ROWS;

function buildMap(dec, report, label) {
	const width = dec.columns.length;
	const map = new Array(width * MAP_HEIGHT).fill(0);
	const enemies = [];
	const set = (x, y, id) => { if (x >= 0 && x < width && y >= 0 && y < MAP_HEIGHT) map[y * width + x] = id; };
	const note = (txt) => { report[txt] = (report[txt] || 0) + 1; };

	for (let x = 0; x < width; x++) {
		for (let r = 0; r < 13; r++) {
			const mt = dec.columns[x][r];
			if (!mt) continue;
			if (METATILE_NOTES[mt]) note(`${label}: ${METATILE_NOTES[mt]}`);
			if (mt === MT.Axe) continue;
			set(x, r + TOP_ROWS, mt);
		}
	}

	// Plantas piraña: arriba de la boca del caño, en la columna izquierda
	const pakkunColor = dec.areaType === AREA_TYPE.Underground ? 'Red' : 'Green';
	for (const p of dec.piranhas) enemies.push({ type: 'Pakkun', color: pakkunColor, x: p.col, y: p.row - 1 + TOP_ROWS });

	// Enemigos. En el original una fila de datos r deja al enemigo parado sobre la fila r del
	// terreno, o sea que ocupa la celda de arriba (r - 1).
	const unsupported = {};
	for (const e of dec.enemies) {
		const cellRow = e.row - 1 + TOP_ROWS;
		if (e.id >= 0x37 && e.id <= 0x3e) {
			// Grupos de 2 o 3, separados 24 px, que el original genera al borde derecho de la pantalla
			const v = e.id - 0x37;
			const ent = v < 4 ? { type: 'Goomba' } : { type: 'Koopa', color: 'Green' };
			const row = (v & 2) ? 7 : 11;
			const count = (v & 1) ? 3 : 2;
			for (let n = 0; n < count; n++) enemies.push({ ...ent, x: e.x - 3 + Math.round(n * 1.5), y: row - 1 + TOP_ROWS });
			continue;
		}
		const m = ENEMY_TO_ENTITY[e.id];
		if (m) {
			if (m.note) note(`${label}: ${m.note}`);
			const ent = { type: m.type };
			if (m.color) ent.color = m.color;
			enemies.push({ ...ent, x: e.x, y: cellRow });
		} else if (e.id >= 0x24 && e.id <= 0x2c) {
			note(`${label}: plataforma móvil -> fila de bloques duros fija`);
			for (let n = 0; n < 3; n++) set(e.x + n, e.row + TOP_ROWS, MT.Hard);
		} else {
			unsupported[e.id] = (unsupported[e.id] || 0) + 1;
		}
	}
	for (const [id, n] of Object.entries(unsupported)) note(`${label}: enemigo $${Number(id).toString(16)} sin equivalente, descartado (x${n})`);

	enemies.sort((a, b) => a.x - b.x || a.y - b.y);
	return { width, map, enemies };
}

const WORLD_AREAS = {
	'1-1': { pointer: 0x25, areaNumber: 0, next: '1-2' },
	'1-2': { pointer: 0xc0, areaNumber: 2, next: '1-3' },
	'1-3': { pointer: 0x26, areaNumber: 3, next: '1-4' },
	'1-4': { pointer: 0x60, areaNumber: 4, next: null },
};

// Salas de bonus: una misma área del original (L_UndergroundArea3) tiene varias salas, una por
// cada página de entrada. Cada subnivel es una ventana de dos páginas de esa área.
const SUBLEVELS = {
	'1-1b': { pointer: 0xc2, entrancePage: 0, parent: '1-1' },
	'1-2b': { pointer: 0xc2, entrancePage: 2, parent: '1-2' },
};

// Puntero de área del original -> nombre del nivel del juego
const POINTER_TO_LEVEL = { '1:5': '1-1', '2:0': '1-2', '1:6': '1-3', '3:0': '1-4' };
const pointerKey = p => `${(p >> 5) & 3}:${p & 0x1f}`;

function decodeLevel(lines, name, spec, report) {
	const dec = new AreaDecoder({ lines, areaPointer: spec.pointer, worldNumber: 0, areaNumber: spec.areaNumber, report });
	dec.run();
	dec.decodeEnemies();
	const built = buildMap(dec, report, name);
	// El hacha del castillo se reemplaza por un mástil de bandera para poder terminar el nivel.
	if (dec.axe && !dec.flagpole) {
		const { width, map } = built;
		const c = dec.axe.col;
		const put = (row, id) => { map[(row + TOP_ROWS) * width + c] = id; };
		for (let r = 0; r < 13; r++) put(r, 0);
		put(0, MT.FlagpoleTop);
		for (let r = 1; r <= 8; r++) put(r, MT.Flagpole);
		put(10, MT.Hard);
		dec.flagpole = { col: c };
		report[`${name}: hacha del castillo -> mástil de bandera (x1)`] = 1;
		delete report[`${name}: ${METATILE_NOTES[MT.Axe]}`];
	}
	return { name, dec, ...built };
}

// Recorta una ventana de columnas [x0, x1] de un nivel ya armado.
function sliceLevel(level, x0, x1) {
	const width = x1 - x0 + 1;
	const map = new Array(width * MAP_HEIGHT);
	for (let r = 0; r < MAP_HEIGHT; r++) for (let x = 0; x < width; x++) map[r * width + x] = level.map[r * level.width + x0 + x];
	return { width, map, enemies: [] };
}

// Primer caño (de cualquier tipo) dentro de una página: es por donde el original hace salir a Mario.
function findPipeInPage(level, page) {
	for (let x = page * 16; x < Math.min(level.width, page * 16 + 16); x++) {
		for (let r = 0; r < MAP_HEIGHT; r++) { const id = level.map[r * level.width + x]; if (id === MT.PipeTopLeft || id === MT.DecoPipeTopLeft) return { x, y: r }; }
	}
	return null;
}

function toWorldType(areaType) {
	return { [AREA_TYPE.Ground]: 0, [AREA_TYPE.Underground]: 1, [AREA_TYPE.Water]: 2, [AREA_TYPE.Castle]: 3 }[areaType];
}

// Asocia cada entrada de "fila 0e" del original (cambio de área) con el caño más cercano.
function linkWarps(entries, candidates) {
	const used = new Set();
	const links = [];
	for (const e of entries) {
		let best = null, bestD = Infinity;
		for (const c of candidates) {
			if (used.has(c) || c.x < e.x - 12) continue;
			const d = Math.abs(c.x - e.x);
			if (d < bestD) { bestD = d; best = c; }
		}
		if (best) { used.add(best); links.push({ entry: e, pipe: best }); }
	}
	return links;
}

function generate(lines, report) {
	const levels = {};
	for (const [name, spec] of Object.entries(WORLD_AREAS)) levels[name] = decodeLevel(lines, name, spec, report);

	const bonus = decodeLevel(lines, 'bonus', { pointer: 0xc2, areaNumber: 0 }, {});
	const subs = {};
	for (const [name, spec] of Object.entries(SUBLEVELS)) {
		const x0 = spec.entrancePage * 16, x1 = x0 + 32;
		const sl = sliceLevel(bonus, x0, x1);
		const dec = bonus.dec;
		const inWin = x => x >= x0 && x <= x1;
		subs[name] = {
			name, ...sl, x0, spec, areaType: dec.areaType,
			exitPipes: dec.exitPipes.filter(p => inWin(p.col)).map(p => ({ x: p.col - x0, y: p.row + TOP_ROWS, abs: p.col })),
			entries: dec.warpEntries.filter(e => inWin(e.x)),
		};
	}

	const warpsOf = {};
	const addWarp = (levelName, w) => { (warpsOf[levelName] ||= []).push(w); };

	// Entrada y salida de cada nivel principal
	for (const [name, lv] of Object.entries(levels)) {
		const cands = [
			...lv.dec.pipeTops.map(p => ({ x: p.col, y: p.row + TOP_ROWS, type: 'down' })),
			...lv.dec.exitPipes.map(p => ({ x: p.col, y: p.row + TOP_ROWS, type: 'right' })),
		];
		for (const { entry, pipe } of linkWarps(lv.dec.warpEntries, cands)) {
			const key = pointerKey(entry.pointer);
			if (key === '2:2') {
				const sub = Object.entries(subs).find(([, s]) => s.spec.entrancePage === entry.entrancePage && s.spec.parent === name);
				if (!sub) { report[`${name}: caño hacia una sala de bonus sin subnivel -> sin warp`] = 1; continue; }
				addWarp(name, { type: pipe.type, x: pipe.x, y: pipe.y, to: sub[0], spawn: { x: 2, y: 3, emerge: 'drop' } });
			} else if (POINTER_TO_LEVEL[key]) {
				const target = POINTER_TO_LEVEL[key];
				const p = findPipeInPage(levels[target], entry.entrancePage);
				const spawn = p ? { x: p.x, y: p.y, emerge: 'up' } : { x: entry.entrancePage * 16 + 2, y: 3, emerge: 'drop' };
				if (WORLD_AREAS[target].next !== WORLD_AREAS[name].next && target !== name) spawn.then = WORLD_AREAS[name].next;
				addWarp(name, { type: pipe.type, x: pipe.x, y: pipe.y, to: target, spawn });
			}
		}
	}

	// Salida de cada sala de bonus
	for (const [name, sub] of Object.entries(subs)) {
		const cands = sub.exitPipes.map(p => ({ x: p.abs, y: p.y, type: 'right', rel: p.x }));
		for (const { entry, pipe } of linkWarps(sub.entries, cands)) {
			const target = POINTER_TO_LEVEL[pointerKey(entry.pointer)];
			if (!target) continue;
			const p = findPipeInPage(levels[target], entry.entrancePage);
			const spawn = p ? { x: p.x, y: p.y, emerge: 'up' } : { x: entry.entrancePage * 16 + 2, y: 3, emerge: 'drop' };
			addWarp(name, { type: 'right', x: pipe.rel, y: pipe.y, to: target, spawn });
		}
	}

	const out = [];
	for (const [name, lv] of Object.entries(levels)) {
		out.push({ world: name, nextWorld: WORLD_AREAS[name].next, hidden: false, type: toWorldType(lv.dec.areaType), width: lv.width, map: lv.map, enemies: lv.enemies, warps: warpsOf[name] || [] });
	}
	for (const [name, sub] of Object.entries(subs)) {
		out.push({ world: name, nextWorld: sub.spec.parent, hidden: true, type: toWorldType(sub.areaType), width: sub.width, map: sub.map, enemies: sub.enemies, warps: warpsOf[name] || [] });
	}
	return { out, levels, subs };
}

function formatLevels(out) {
	const L = [];
	L.push('// Generado por tools/smb-levels.js a partir del desensamblado de Super Mario Bros.');
	L.push('// No editar a mano: volver a correr `node tools/smb-levels.js --out levels_smb.js`.');
	L.push('//');
	L.push('// map: grilla de números de metatile originales (0 = vacío), fila por fila, con 2 filas vacías');
	L.push('// arriba. enemies: { type, color, x, y }, con x, y la celda que ocupa el enemigo; las plantas');
	L.push('// piraña van sobre la boca del caño.');
	L.push('//');
	L.push('// warps: caños que llevan a otro nivel. type "down" se entra parado sobre el caño apretando');
	L.push('// abajo; type "right" se entra caminando a la derecha contra la boca de un caño lateral.');
	L.push('// x, y es la celda superior izquierda del caño. spawn indica dónde aparece Mario en el destino:');
	L.push('// emerge "up" (sale de un caño) o "drop" (cae); then reemplaza el nextWorld del destino.');
	L.push('');
	L.push('map.push(');
	out.forEach((lv, i) => {
		L.push('\t{');
		L.push(`\t\tworld: ${JSON.stringify(lv.world)},`);
		L.push(`\t\tnextWorld: ${JSON.stringify(lv.nextWorld)},`);
		if (lv.hidden) L.push('\t\thidden: true,');
		L.push(`\t\ttype: ${lv.type},`);
		L.push(`\t\tdimensions: { width: ${lv.width}, height: ${MAP_HEIGHT} },`);
		L.push(`\t\twarps: ${JSON.stringify(lv.warps)},`);
		L.push('\t\tenemies: [');
		for (const e of lv.enemies) L.push('\t\t\t' + JSON.stringify(e) + ',');
		L.push('\t\t],');
		L.push('\t\tmap: [');
		for (let r = 0; r < MAP_HEIGHT; r++) {
			L.push('\t\t\t' + lv.map.slice(r * lv.width, (r + 1) * lv.width).join(',') + ',');
		}
		L.push('\t\t],');
		L.push(i === out.length - 1 ? '\t}' : '\t},');
	});
	L.push(');');
	L.push('');
	return L.join('\n');
}

function ascii(level) {
	// Leyenda: . vacío; P/p caño; = caño lateral; # bloque duro y terreno; B ladrillo; ? bloques de
	// pregunta o con contenido; C moneda; F bandera; ~ el resto
	const ch = v => {
		if (v === 0) return '.';
		if (v === 0x10 || v === 0x12) return 'P';
		if (v === 0x11 || v === 0x13) return 'p';
		if (v === 0x14 || v === 0x15) return '|';
		if (v >= 0x1c && v <= 0x21) return '=';
		if (v === 0x24 || v === 0x25) return 'F';
		if (v === 0x51 || v === 0x52) return 'B';
		if (v === 0x54 || v === 0x61 || v === 0x62) return '#';
		if (v === 0xc2 || v === 0xc3) return 'C';
		if ((v >= 0x55 && v <= 0x60) || v === 0xc0 || v === 0xc1 || v === 0xc4) return '?';
		return '~';
	};
	const grid = Array.from({ length: MAP_HEIGHT }, (_, r) => Array.from({ length: level.width }, (_, x) => ch(level.map[r * level.width + x])));
	for (const e of level.enemies || []) {
		const c = { Goomba: 'g', Koopa: 'k', Koopa_Winged: 'w', Pakkun: 'v' }[e.type] || 'e';
		if (grid[e.y] && grid[e.y][e.x] !== undefined) grid[e.y][e.x] = c;
	}
	return grid.map((row, r) => String(r).padStart(2) + ' ' + row.join('')).join('\n');
}

if (require.main === module) {
	const lines = loadAsm();
	const report = {};
	const { out, levels, subs } = generate(lines, report);
	if (process.argv.includes('--ascii')) {
		for (const lv of out) {
			const src = levels[lv.world] || subs[lv.world];
			console.log(`\n== ${lv.world}  ${lv.width}x${MAP_HEIGHT}  type=${lv.type}${lv.hidden ? ' (subnivel)' : ''}`);
			console.log(ascii(lv));
			console.log('warps', JSON.stringify(lv.warps));
		}
	}
	const outIdx = process.argv.indexOf('--out');
	if (outIdx > 0) {
		const file = path.resolve(process.argv[outIdx + 1]);
		fs.writeFileSync(file, formatLevels(out));
		console.log(`Escrito ${file} (${out.length} niveles)`);
	}
	console.log('\nInforme de reemplazos:');
	for (const [k, v] of Object.entries(report)) console.log(`  ${k}${/\(x\d+\)$/.test(k) ? '' : ` (x${v})`}`);
}

module.exports = { loadAsm, AreaDecoder, buildMap, decodeLevel, generate, formatLevels, ascii, WORLD_AREAS, AREA_TYPE, MAP_HEIGHT, TOP_ROWS, MT };
