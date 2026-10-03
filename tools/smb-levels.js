// Decodificador de los niveles originales de Super Mario Bros.
//
// Lee tools/smbdis.asm (el desensamblado, que no se versiona) y reproduce el algoritmo de
// DecodeAreaData / ProcessAreaData del juego original para generar los mapas en el formato de
// levels_smb.js: una grilla de metatiles y una lista de enemigos por nivel.
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
// CastleMetatiles: 11 filas de 5 columnas (el castillo del final del nivel)
const CASTLE_METATILES = [
	0x00, 0x45, 0x45, 0x45, 0x00,  0x00, 0x48, 0x47, 0x46, 0x00,  0x45, 0x49, 0x49, 0x49, 0x45,
	0x47, 0x47, 0x4a, 0x47, 0x47,  0x47, 0x47, 0x4b, 0x47, 0x47,  0x49, 0x49, 0x49, 0x49, 0x49,
	0x47, 0x4a, 0x47, 0x4a, 0x47,  0x47, 0x4b, 0x47, 0x4b, 0x47,  0x47, 0x47, 0x47, 0x47, 0x47,
	0x4a, 0x47, 0x4a, 0x47, 0x4a,  0x4b, 0x47, 0x4b, 0x47, 0x4b,
];
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
});

// Enemigo del original -> enemigo del motor (null si no existe y se descarta)
const ENEMY_TO_ENTITY = {
	0x00: { type: 'Koopa', color: 'Green' },
	0x02: { type: 'Koopa', color: 'Buzzy' },
	0x03: { type: 'Koopa', color: 'Red' },
	0x05: { type: 'HammerBro' },
	0x11: { type: 'Lakitu' },
	0x06: { type: 'Goomba' },
	0x07: { type: 'Bloober' },
	0x0a: { type: 'Cheep', color: 'Grey' },
	0x0b: { type: 'Cheep', color: 'Red' },
	0x0c: { type: 'Podoboo' },
	0x0e: { type: 'Koopa_Winged', color: 'Green' },
	0x0f: { type: 'Koopa_Winged', color: 'Red' },
	0x10: { type: 'Koopa_Winged', color: 'Green' },
	0x12: { type: 'Spiny' },
	0x2d: { type: 'Bowser' },
	0x35: { type: 'Toad' },
};

// ---------------------------------------------------------------------------------------------
// Decodificador de un área
// ---------------------------------------------------------------------------------------------

class AreaDecoder {
	constructor({ lines, areaPointer, worldNumber, areaNumber, levelNumber = 0, report }) {
		this.levelNumber = levelNumber;
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
		this.night = this.backgroundColorCtrl !== 0 && this.backgroundColorCtrl !== 5;   // 4, 6 y 7: fondo negro
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
		this.sceneryCol = new Array(13).fill(0);
		this.frenzy = [];
		this.sceneryColumns = [];   // escenografía de fondo (nubes, colinas, arbustos, árboles...) por columna
		this.mtKeep = new Array(13).fill(false);   // filas con piezas decorativas que igual se guardan (castillo)
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
		this.warpZoneCol = null; // columna donde empieza la zona de atajos, si el área la tiene
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
		this.mtKeep[row] = true;   // baranda del puente
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

	// Boca de caño de los niveles de agua: dos celdas (0x6b, 0x6c); entrar por ella termina el nivel
	// CastleObject: una columna del castillo por vez, de la fila inicial hasta el piso. El ladrillo que
	// el original pone en la puerta para frenar a Mario y la bandera estrella no hacen falta acá.
	castleObject(x) {
		const startRow = this.getLrgObjAttrib(x);
		this.chkLrgObjFixedLength(x, 4);
		let y = this.areaObjectLength[x], row = startRow, limit = 0x0b;
		do {
			this.mt[row] = CASTLE_METATILES[y];
			this.mtKeep[row] = true;
			row++;
			if (limit !== 0) { y += 5; limit--; }
		} while (row !== 0x0b);
	}

	waterPipe(x) {
		this.getLrgObjAttrib(x);
		this.mt[this.d07] = 0x6b;
		this.mt[this.d07 + 1] = 0x6c;
		this.exitPipes.push({ col: this.currentPageLoc * 16 + this.currentColumnPos, row: this.d07 });
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
		this.mtKeep[row] = true;   // hacha, cadena y puente del castillo de Bowser
		if (idx === 2) this.axe = { col: this.currentPageLoc * 16 + this.currentColumnPos, row };
	}

	alterAreaAttributes(x) {
		const b = this.data[this.areaObjOffsetBuffer[x] + 1];
		if ((b & 0x40) === 0) {
			this.terrainControl = b & 0x0f;
			this.backgroundScenery = (b & 0x30) >> 4;
		} else {
			const v = b & 7;
			if (v >= 4) { this.backgroundColorCtrl = v; this.foregroundScenery = 0; if (v !== 5) this.night = true; }
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
			case 0x12: return this.castleObject(x);
			case 0x13: return this.staircaseObject(x);
			case 0x14: return this.exitPipe(x);
			case 0x15: return;
			case 0x16: case 0x17: case 0x18: return this.questionBlock(x);
			case 0x19: return this.hidden1UpBlock(x);
			case 0x1a: case 0x1b: case 0x1c: case 0x1d: case 0x1e: return this.brickWithItem(x);
			case 0x1f: return this.waterPipe(x);
			case 0x20: return this.emptyBlock(x);
			case 0x21: return this.jumpspring(x);
			case 0x22: return this.introPipe(x);
			case 0x23: return this.flagpoleObject();
			case 0x24: case 0x25: case 0x26: return this.castleObjectRow(x, index - 0x22);
			case 0x27: this.warpZoneCol = this.currentPageLoc * 16 + this.currentColumnPos; return;   // ScrollLockObject_Warp
			case 0x28: case 0x29: return;   // ScrollLockObject: frena el scroll
			case 0x2a: case 0x2b: case 0x2c:
				// AreaFrenzy: cambia el ataque continuo (cheep-cheeps voladores, Bullet Bills o cheep-cheeps nadando, o parar)
				this.frenzy.push({ x: this.currentPageLoc * 16 + this.currentColumnPos, kind: ['fly', 'bill', 'stop'][index - 0x2a] });
				return;
			case 0x2d: return;
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
		this.mtKeep.fill(false);
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
		this.sceneryCol = this.mt.slice();
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
			col[i] = (mt >= BLOCK_BUFF_LOW_BOUNDS[grp] || this.mtKeep[i]) ? mt : 0;
		}
		this.columns.push(col);
		this.sceneryColumns.push(this.sceneryCol);
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

	// Los enemigos con el bit 6 sólo existen en el "modo difícil secundario": a partir del 5-3.
	get secondaryHard() { return this.worldNumber > 4 || (this.worldNumber === 4 && this.levelNumber >= 2); }

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
				warps.push({ x: page * 16 + col, pointer: b1, world: b2 >> 5, entrancePage: b2 & 0x1f });
				o += 3; sel = 0; continue;
			}
			const id = b1 & 0x3f;
			if (!(b1 & 0x40) || this.secondaryHard) enemies.push({ x: page * 16 + col, row, id });
			o += 2; sel = 0;
		}
		this.enemies = enemies;
		this.allWarpEntries = warps;
		this.warpEntries = this.warpEntriesFor(this.worldNumber);
	}

	// Las entradas de cambio de área valen sólo para el mundo que indica su tercer byte; así una
	// misma sala de bonus sirve a varios mundos.
	warpEntriesFor(world) { return this.allWarpEntries.filter(e => e.world === world); }
}

// Caños de la zona de atajos: la pantalla que se bloquea al llegar al objeto de zona. Se toman los
// caños que llevan a algún lado cerca del objeto y se agrupan por página (la de más caños).
function warpZonePipes(dec) {
	if (dec.warpZoneCol === null) return [];
	const near = dec.pipeTops.filter(p => Math.abs(p.col - dec.warpZoneCol) <= 24);
	const pages = {};
	for (const p of near) (pages[Math.floor(p.col / 16)] ||= []).push(p);
	const best = Object.values(pages).sort((a, b) => b.length - a.length)[0];
	return best || [];
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
	const platforms = [];   // plataformas móviles; x, y en px del NES (y desde la fila 0 del nivel)
	const set = (x, y, id) => { if (x >= 0 && x < width && y >= 0 && y < MAP_HEIGHT) map[y * width + x] = id; };
	const note = (txt) => { report[txt] = (report[txt] || 0) + 1; };

	for (let x = 0; x < width; x++) {
		for (let r = 0; r < 13; r++) {
			const mt = dec.columns[x][r];
			if (!mt) continue;
			if (METATILE_NOTES[mt]) note(`${label}: ${METATILE_NOTES[mt]}`);
			set(x, r + TOP_ROWS, mt);
		}
	}

	// Plantas piraña: arriba de la boca del caño, en la columna izquierda
	const pakkunColor = dec.areaType === AREA_TYPE.Underground ? 'Red' : 'Green';
	// (en la zona de atajos el original quita las plantas)
	const zoneCols = new Set(warpZonePipes(dec).map(p => p.col));
	for (const p of dec.piranhas) {
		if (zoneCols.has(p.col)) continue;
		enemies.push({ type: 'Pakkun', color: pakkunColor, x: p.col, y: p.row - 1 + TOP_ROWS });
	}

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
		if (e.id >= 0x1b && e.id <= 0x1f) {
			// Barras de fuego: $1b y $1c giran a la derecha (lenta y rápida), $1d y $1e a la izquierda, $1f es la larga.
			// El centro es el bloque de la fila e.row - 2 (donde el original deja su bloque de apoyo)
			enemies.push({ type: 'Firebar', fast: e.id === 0x1c || e.id === 0x1e, ccw: e.id === 0x1d || e.id === 0x1e, long: e.id === 0x1f, x: e.x, y: e.row - 2 + TOP_ROWS });
			continue;
		}
		const m = ENEMY_TO_ENTITY[e.id];
		if (m) {
			if (m.note) note(`${label}: ${m.note}`);
			const ent = { type: m.type };
			if (e.id === 0x35 && dec.worldNumber === 7) ent.type = 'Princess';   // en el 8-4 espera la princesa
			if (m.color) ent.color = m.color;
			enemies.push({ ...ent, x: e.x, y: cellRow });
		} else if (e.id >= 0x24 && e.id <= 0x2c) {
			// 24 balancín, 25 sube y baja, 26/2b suben, 27/2c bajan, 28 va y viene, 29 cae al pisarla, 2a se va a la derecha.
			// Las grandes miden 48 px (32 en los castillos) y las chicas 24. En el original, a los enemigos con id menor a $15 se
			// les suman 8 px de altura y a los demás (plataformas, barras de fuego, Bowser) no, y la pantalla tiene 32 px de barra de
			// arriba: la superficie queda en y = fila * 16 - 32 desde la fila 0 del nivel
			const KINDS = { 0x24: 'balance', 0x25: 'vert', 0x26: 'lift', 0x27: 'lift', 0x28: 'hori', 0x29: 'drop', 0x2a: 'right', 0x2b: 'lift', 0x2c: 'lift' };
			const small = e.id >= 0x2b;
			platforms.push({ kind: KINDS[e.id], x: e.x * 16, y: e.row * 16 - 32, w: small ? 24 : (dec.areaType === AREA_TYPE.Castle ? 32 : 48), dir: e.id === 0x26 || e.id === 0x2b ? -1 : 1, small });
		} else {
			unsupported[e.id] = (unsupported[e.id] || 0) + 1;
		}
	}
	for (const [id, n] of Object.entries(unsupported)) note(`${label}: enemigo $${Number(id).toString(16)} sin equivalente, descartado (x${n})`);

	// Escenografía de fondo: lo que el original dibuja en su búfer pero no guarda como bloque. Va en una
	// lista plana x, y, id, y no se repite donde ya hay un bloque.
	const scenery = [];
	for (let x = 0; x < width; x++) {
		for (let r = 0; r < 13; r++) {
			const id = dec.sceneryColumns[x][r];
			if (!id || dec.columns[x][r]) continue;
			scenery.push(x, r + TOP_ROWS, id);
		}
	}

	// Balancines: se aparean de a dos, de izquierda a derecha
	const bal = platforms.filter(p => p.kind === 'balance').sort((a, b) => a.x - b.x);
	for (let i = 0; i + 1 < bal.length; i += 2) { bal[i].pair = platforms.indexOf(bal[i + 1]); bal[i + 1].pair = platforms.indexOf(bal[i]); }

	enemies.sort((a, b) => a.x - b.x || a.y - b.y);
	return { width, map, enemies, scenery, platforms };
}

// ---------------------------------------------------------------------------------------------
// Los 8 mundos
// ---------------------------------------------------------------------------------------------

// Puntero de área del original -> clave "tipo:índice" (ver pointerKey)
const pointerKey = p => `${(p >> 5) & 3}:${p & 0x1f}`;
const KEY_BONUS_ROOM = '2:2';    // L_UndergroundArea3: salas de bonus
const KEY_WARP_ZONE = '1:15';    // L_GroundArea16: zona de atajos del 4-2
const AREA_KEY_NOTES = { '1:11': 'nivel de nubes (se entra por enredadera)', '1:20': 'nivel de nubes (se entra por enredadera)' };
// Áreas enteras a las que se entra por un caño y se generan como subnivel: letra del nombre
// (w = zona de atajos del 4-2, s = salas de agua de 5-2, 6-2 y 8-4)
const AREA_SUBS = { [KEY_WARP_ZONE]: 'w', '0:0': 's', '0:2': 's', '1:11': 'c', '1:20': 'c' };
// Niveles de nubes: se entran trepando una enredadera (c = nubes)
const CLOUD_KEYS = new Set(['1:11', '1:20']);

// Lee World{n}Areas y le da a cada área su nombre de nivel según el comentario de su etiqueta
// (";level 1-3/5-3" sirve para el 1-3 y el 5-3). Las áreas sin nivel (pantalla del caño
// de entrada, salas de bonus) no se generan como niveles.
function discoverLevels(lines) {
	const areaLabels = readLabelTable(lines, 'AreaDataAddrLow');
	const commentOf = label => {
		let j = lines.findIndex(l => l.startsWith(label + ':')) - 1;
		while (j > 0 && !lines[j].startsWith(';')) j--;
		return lines[j];
	};
	const levels = [];
	for (let w = 0; w < 8; w++) {
		const line = lines.find(l => l.startsWith(`World${w + 1}Areas:`));
		const pointers = [...line.matchAll(/\$([0-9a-f]{2})/gi)].map(m => parseInt(m[1], 16));
		pointers.forEach((p, i) => {
			const label = areaLabels[AREA_DATA_H_OFFSETS[(p >> 5) & 3] + (p & 0x1f)];
			const m = [...commentOf(label).matchAll(/(\d)-(\d)/g)].find(t => Number(t[1]) === w + 1);
			if (m) levels.push({ name: `${w + 1}-${m[2]}`, world: w, level: Number(m[2]) - 1, pointer: p, areaNumber: i });
		});
	}
	levels.forEach((lv, i) => { lv.next = levels[i + 1]?.name ?? null; });
	return levels;
}

// Tiempo con que arranca un nivel, según los 2 bits de la cabecera (GameTimerData: 400, 300 o 200)
const GAME_TIMER_BY_SETTING = [400, 400, 300, 200];

// Página desde la que se reinicia un nivel si Mario muere después de pasarla (HalfwayPageNybbles).
// Hay un byte por cada par de niveles: -1 y -2 en el byte 2*mundo, -3 y -4 en el siguiente; los
// niveles pares (-1, -3) usan el nibble alto y los impares (-2, -4) el bajo.
function halfwayPage(lines, world, level) {
	const bytes = readBlock(lines, 'HalfwayPageNybbles');
	const b = bytes[2 * world + ((level & 2) ? 1 : 0)];
	return (level & 1) ? (b & 0x0f) : (b >> 4);
}

function decodeLevel(lines, spec, report) {
	const name = spec.name;
	const dec = new AreaDecoder({ lines, areaPointer: spec.pointer, worldNumber: spec.world, areaNumber: spec.areaNumber, levelNumber: spec.level, report });
	dec.run();
	dec.decodeEnemies();
	const built = buildMap(dec, report, name);
	// Castillo de Bowser: el hacha queda en el mapa y el motor termina el nivel al tocarla
	if (dec.axe) built.axe = { x: dec.axe.col, y: dec.axe.row + TOP_ROWS };
	built.frenzy = dec.frenzy;
	if (LEVEL_LOOPS[name]) { built.loops = LEVEL_LOOPS[name].loops.map(([page, y]) => ({ page, y })); if (LEVEL_LOOPS[name].multi) built.multi = true; }
	return { name, dec, time: GAME_TIMER_BY_SETTING[dec.gameTimerSetting], halfway: halfwayPage(lines, spec.world, spec.level), ...built };
}

// Recorta una ventana de columnas [x0, x1] de un nivel ya armado.
function sliceLevel(level, x0, x1) {
	const width = x1 - x0 + 1;
	const map = new Array(width * MAP_HEIGHT);
	for (let r = 0; r < MAP_HEIGHT; r++) for (let x = 0; x < width; x++) map[r * width + x] = level.map[r * level.width + x0 + x];
	const scenery = [];
	for (let i = 0; i < level.scenery.length; i += 3) {
		const x = level.scenery[i];
		if (x >= x0 && x <= x1) scenery.push(x - x0, level.scenery[i + 1], level.scenery[i + 2]);
	}
	return { width, map, enemies: [], scenery, platforms: [] };
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

// Laberintos de los castillos (LoopCmdWorldNumber, LoopCmdPageNumber y LoopCmdYPosition): al llegar la pantalla a
// esa página, Mario tiene que estar parado en el suelo a esa altura (la y del NES de su parte de arriba, de un
// Mario chico); si no, vuelve cuatro páginas atrás. En el 7-4 se juntan de a tres y se vuelve si falla alguno.
const LEVEL_LOOPS = {
	'4-4': { loops: [[5, 0x40], [9, 0xb0]] },
	'7-4': { loops: [[4, 0xb0], [5, 0x80], [6, 0x40], [8, 0x40], [9, 0x80], [10, 0x40]], multi: true },
	'8-4': { loops: [[6, 0xf0], [0xb, 0xf0], [0x10, 0xf0]] },
};

// Mundos a los que llevan los tres caños de una zona de atajos (WarpZoneNumbers en el original);
// 0x24 y 0 son casilleros sin caño.
const WARP_ZONE_NUMBERS = [[4, 3, 2, 0], [0x24, 5, 0x24, 0], [8, 7, 6, 0]];

function zoneWarps(dec) {
	const pipes = warpZonePipes(dec);
	if (!pipes.length) return [];
	const row = dec.worldNumber === 0 ? 0 : (dec.areaType === AREA_TYPE.Ground ? 2 : 1);
	const out = [];
	for (const p of pipes) {
		const c = p.col % 16;
		const dest = WARP_ZONE_NUMBERS[row][c < 6 ? 0 : c < 10 ? 1 : 2];
		if (dest === 0 || dest === 0x24) continue;
		out.push({ type: 'down', x: p.col, y: p.row + TOP_ROWS, to: `${dest}-1`, spawn: { start: true } });
	}
	return out;
}

function generate(lines, report) {
	const info = discoverLevels(lines);
	const infoByName = Object.fromEntries(info.map(l => [l.name, l]));
	const levelOf = {};                                   // `${mundo}|${clave}` -> nombre
	for (const l of info) levelOf[`${l.world}|${pointerKey(l.pointer)}`] = l.name;

	const levels = {};
	for (const spec of info) levels[spec.name] = decodeLevel(lines, spec, report);
	const bonus = decodeLevel(lines, { name: 'bonus', pointer: 0xc2, world: 0, level: 0, areaNumber: 0 }, {});

	const subs = {};                                      // nombre -> subnivel
	const warpsOf = {};
	const addWarp = (levelName, w) => { (warpsOf[levelName] ||= []).push(w); };
	const subNames = {};                                  // `${padre}|${página}` -> nombre
	// (varios niveles terminan en el tramo final del 1-1, área $25: si el mundo no tiene un nivel con ese
	// puntero, se usa el de cualquier otro mundo)
	const anyLevelOf = key => info.find(l => pointerKey(l.pointer) === key)?.name;
	const mainTarget = (world, entry) => levelOf[`${world}|${pointerKey(entry.pointer)}`] ?? anyLevelOf(pointerKey(entry.pointer));

	// Destino de un caño que lleva a un nivel principal: aparece saliendo del primer caño de la página
	const spawnInto = (target, entry, sourceLevelName) => {
		const p = findPipeInPage(levels[target], entry.entrancePage);
		const spawn = p ? { x: p.x, y: p.y, emerge: 'up' } : { x: entry.entrancePage * 16 + 2, y: 3, emerge: 'drop' };
		const src = infoByName[sourceLevelName];
		if (src && src.next !== infoByName[target].next && target !== sourceLevelName) spawn.then = src.next;
		return spawn;
	};

	// 1. Entradas y salidas de cada nivel principal
	for (const [name, lv] of Object.entries(levels)) {
		const dec = lv.dec;
		const zone = new Set(warpZonePipes(dec).map(p => p.col));
		const inZone = p => zone.has(p.col);
		const cands = [
			...dec.pipeTops.filter(p => !inZone(p)).map(p => ({ x: p.col, y: p.row + TOP_ROWS, type: 'down' })),
			...dec.exitPipes.map(p => ({ x: p.col, y: p.row + TOP_ROWS, type: 'right' })),
		];
		for (const w of zoneWarps(dec)) addWarp(name, w);
		// Las entradas a niveles de nubes se enlazan con ladrillos con enredadera (0x56 y 0x5b), no con caños
		const vineCands = [];
		lv.map.forEach((id, i) => { if (id === 0x56 || id === 0x5b) vineCands.push({ x: i % lv.width, y: Math.floor(i / lv.width), type: 'vine' }); });
		const cloudEntries = dec.warpEntries.filter(e => CLOUD_KEYS.has(pointerKey(e.pointer)));
		const pipeEntries = dec.warpEntries.filter(e => !CLOUD_KEYS.has(pointerKey(e.pointer)));
		for (const { entry, pipe } of linkWarps(cloudEntries, vineCands)) {
			const sn = name + AREA_SUBS[pointerKey(entry.pointer)];
			subs[sn] = { kind: 'area', parent: name, world: dec.worldNumber, pointer: entry.pointer & 0x7f, returnX: pipe.x };
			addWarp(name, { type: 'vine', x: pipe.x, y: pipe.y, to: sn, spawn: { x: 2, y: 3, emerge: 'drop' } });
		}
		for (const { entry, pipe } of linkWarps(pipeEntries, cands)) {
			const key = pointerKey(entry.pointer);
			if (key === KEY_BONUS_ROOM) {
				const sk = `${name}|${entry.entrancePage}`;
				if (!subNames[sk]) {
					const taken = Object.keys(subNames).filter(k => k.startsWith(name + '|')).length;
					subNames[sk] = name + 'bcdefg'[taken];
					subs[subNames[sk]] = { kind: 'window', parent: name, world: dec.worldNumber, entrancePage: entry.entrancePage };
				}
				addWarp(name, { type: pipe.type, x: pipe.x, y: pipe.y, to: subNames[sk], spawn: { x: 2, y: 3, emerge: 'drop' } });
			} else if (AREA_SUBS[key]) {
				const sn = name + AREA_SUBS[key];
				subs[sn] = { kind: 'area', parent: name, world: dec.worldNumber, pointer: entry.pointer & 0x7f };
				addWarp(name, { type: pipe.type, x: pipe.x, y: pipe.y, to: sn, spawn: { x: 2, y: 3, emerge: 'drop' } });
			} else if (mainTarget(dec.worldNumber, entry)) {
				const target = mainTarget(dec.worldNumber, entry);
				addWarp(name, { type: pipe.type, x: pipe.x, y: pipe.y, to: target, spawn: spawnInto(target, entry, name) });
			} else {
				report[`${name}: caño hacia ${AREA_KEY_NOTES[key] || 'un área sin soporte'}, queda como decoración (x1)`] = 1;
			}
		}
	}

	// 2. Subniveles: ventanas de la sala de bonus y áreas completas (zona de atajos del 4-2)
	for (const [name, sub] of Object.entries(subs)) {
		if (sub.kind === 'window') {
			const x0 = sub.entrancePage * 16, x1 = x0 + 32;
			const inWin = x => x >= x0 && x <= x1;
			Object.assign(sub, sliceLevel(bonus, x0, x1), {
				areaType: bonus.dec.areaType, night: false, x0,
				exitPipes: bonus.dec.exitPipes.filter(p => inWin(p.col)).map(p => ({ x: p.col - x0, y: p.row + TOP_ROWS, abs: p.col })),
				entries: bonus.dec.warpEntriesFor(sub.world).filter(e => inWin(e.x)),
			});
			const cands = sub.exitPipes.map(p => ({ x: p.abs, y: p.y, type: 'right', rel: p.x }));
			for (const { entry, pipe } of linkWarps(sub.entries, cands)) {
				const target = mainTarget(sub.world, entry);
				if (!target) continue;
				addWarp(name, { type: 'right', x: pipe.rel, y: pipe.y, to: target, spawn: spawnInto(target, entry, sub.parent) });
			}
		} else {
			const spec = { name, pointer: sub.pointer, world: sub.world, level: infoByName[sub.parent].level, areaNumber: 0 };
			const lv = decodeLevel(lines, spec, report);
			if (sub.returnX !== undefined) sub.exit = { to: sub.parent, spawn: { x: Math.max(0, sub.returnX - 1), y: 3, emerge: 'drop' } };
			Object.assign(sub, { frenzy: lv.frenzy, width: lv.width, map: lv.map, enemies: lv.enemies, scenery: lv.scenery, platforms: lv.platforms, areaType: lv.dec.areaType, night: lv.dec.night });
			for (const w of zoneWarps(lv.dec)) addWarp(name, w);
			// Las salidas de la sala: sus propias entradas de cambio de área
			const cands = [
				...lv.dec.pipeTops.map(p => ({ x: p.col, y: p.row + TOP_ROWS, type: 'down' })),
				...lv.dec.exitPipes.map(p => ({ x: p.col, y: p.row + TOP_ROWS, type: 'right' })),
			];
			for (const { entry, pipe } of linkWarps(lv.dec.warpEntries, cands)) {
				const target = mainTarget(sub.world, entry);
				if (target) addWarp(name, { type: pipe.type, x: pipe.x, y: pipe.y, to: target, spawn: spawnInto(target, entry, sub.parent) });
			}
		}
	}

	const out = [];
	for (const [name, lv] of Object.entries(levels)) {
		out.push({ world: name, nextWorld: infoByName[name].next, hidden: false, type: toWorldType(lv.dec.areaType), night: lv.dec.night, time: lv.time, halfway: lv.halfway, width: lv.width, map: lv.map, enemies: lv.enemies, scenery: lv.scenery, platforms: lv.platforms, frenzy: lv.frenzy, loops: lv.loops, multi: lv.multi, axe: lv.axe, warps: warpsOf[name] || [] });
	}
	for (const name of Object.keys(subs).sort()) {
		const sub = subs[name];
		out.push({ world: name, nextWorld: sub.parent, hidden: true, type: toWorldType(sub.areaType), night: sub.night, width: sub.width, map: sub.map, enemies: sub.enemies, scenery: sub.scenery, platforms: sub.platforms, frenzy: sub.frenzy, exit: sub.exit, warps: warpsOf[name] || [] });
	}
	// El 0-0 es el fondo del menú y de los ajustes: un piso liso de una fila y nada más (con los cerros y arbustos del
	// fondo con parallax apoyados encima)
	const TITLE_W = 30;
	const titleMap = new Array(TITLE_W * MAP_HEIGHT).fill(0).map((_, i) => (i >= TITLE_W * (MAP_HEIGHT - 1) ? TERRAIN_METATILES[AREA_TYPE.Ground] : 0));
	out.unshift({ world: '0-0', nextWorld: out[0].world, hidden: false, type: toWorldType(AREA_TYPE.Ground), night: false, width: TITLE_W, map: titleMap, enemies: [], platforms: [], warps: [] });   // sin scenery: el menú dibuja su propio fondo con parallax
	return { out, levels, subs };
}

function formatLevels(out) {
	const L = [];
	L.push('// Generado por tools/smb-levels.js a partir del desensamblado de Super Mario Bros.');
	L.push('// No editar a mano: volver a correr `node tools/smb-levels.js --out levels_smb.js`.');
	L.push('//');
	L.push('// map: grilla de números de metatile originales (0 = vacío), fila por fila, con 2 filas vacías');
	L.push('// arriba. scenery: lista plana x, y, id de la escenografía de fondo (nubes, colinas, arbustos,');
	L.push('// árboles, vallas), que no es sólida y va detrás de los bloques. enemies: { type, color, x, y }, con x, y la celda que ocupa el enemigo; las plantas');
	L.push('// piraña van sobre la boca del caño.');
	L.push('//');
	L.push('// warps: caños que llevan a otro nivel. type "down" se entra parado sobre el caño apretando');
	L.push('// abajo; type "right" se entra caminando a la derecha contra la boca de un caño lateral.');
	L.push('// x, y es la celda superior izquierda del caño. spawn indica dónde aparece Mario en el destino:');
	L.push('// emerge "up" (sale de un caño) o "drop" (cae); then reemplaza el nextWorld del destino.');
	L.push('');
	L.push('const map = [];');
	L.push('map.push(');
	out.forEach((lv, i) => {
		L.push('\t{');
		L.push(`\t\tworld: ${JSON.stringify(lv.world)},`);
		L.push(`\t\tnextWorld: ${JSON.stringify(lv.nextWorld)},`);
		if (lv.hidden) L.push('\t\thidden: true,');
		L.push(`\t\ttype: ${lv.type},`);
		if (lv.night) L.push('\t\tnight: true,');
		if (lv.time !== undefined) L.push(`\t\ttime: ${lv.time},`);
		if (lv.halfway) L.push(`\t\thalfway: ${lv.halfway},`);
		L.push(`\t\tdimensions: { width: ${lv.width}, height: ${MAP_HEIGHT} },`);
		if (lv.axe) L.push(`\t\taxe: ${JSON.stringify(lv.axe)},`);
		if (lv.loops) L.push(`\t\tloops: ${JSON.stringify(lv.loops)},`);
		if (lv.multi) L.push('\t\tmulti: true,');
		if (lv.exit) L.push(`\t\texit: ${JSON.stringify(lv.exit)},`);
		if (lv.frenzy && lv.frenzy.length) L.push(`\t\tfrenzy: ${JSON.stringify(lv.frenzy)},`);
		L.push(`\t\twarps: ${JSON.stringify(lv.warps)},`);
		L.push('\t\tenemies: [');
		for (const e of lv.enemies) L.push('\t\t\t' + JSON.stringify(e) + ',');
		L.push('\t\t],');
		L.push('\t\tplatforms: [');
		for (const p of lv.platforms || []) L.push('\t\t\t' + JSON.stringify(p) + ',');
		L.push('\t\t],');
		if (lv.scenery) {
			L.push('\t\tscenery: [');
			for (let i = 0; i < lv.scenery.length; i += 30) L.push('\t\t\t' + lv.scenery.slice(i, i + 30).join(',') + ',');
			L.push('\t\t],');
		}
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

module.exports = { loadAsm, AreaDecoder, buildMap, decodeLevel, generate, formatLevels, ascii, AREA_TYPE, MAP_HEIGHT, TOP_ROWS, MT };
