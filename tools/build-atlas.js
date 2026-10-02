// Reconstruye desde la ROM todos los gráficos del juego en un único atlas.
//
// Lee de tools/smb.nes (ROM, no se versiona) los tiles de 8x8 del CHR y de tools/smbdis.asm
// (tampoco se versiona) las tablas que dicen cómo se componen: metatiles del fondo, cuadros de
// Mario y de los enemigos, paletas por área y datos de la pantalla de título.
//
// Salidas:
//   assets/images/atlas.png   el atlas con todas las hojas
//   atlas.js                  const ATLAS = { image: <data URL>, sheets: { Nombre: { x, y, w, h, tw, th } } }
//
// Cada hoja es una grilla de celdas de tw x th píxeles; el motor la recorta del atlas y la registra
// como tileset con el mismo nombre, así que los sprites se definen con (columna, fila) como siempre.
//
// Uso:  node tools/build-atlas.js [--debug carpeta]
//   --debug vuelca PNG ampliados de las hojas y de todos los metatiles para revisarlos a ojo.

const fs = require('fs');
const path = require('path');
const { loadRom, tile, Canvas } = require('./smb-chr.js');

const ROOT = path.join(__dirname, '..');
const ASM_PATH = path.join(__dirname, 'smbdis.asm');
const OUT_PNG = path.join(ROOT, 'assets/images/atlas.png');
const OUT_JS = path.join(ROOT, 'atlas.js');

// Los sprites salen del banco 0 del CHR y el fondo del banco 1.
const SPR = 0, BG = 1;

// Paleta del NES (RGB). Sólo los colores que usan las paletas de este juego.
const NES_RGB = {
	0x00: 0x666666, 0x09: 0x0b4800, 0x0c: 0x00404d, 0x0f: 0x000000,
	0x10: 0xadadad, 0x12: 0x4240ff, 0x15: 0xb71e7b, 0x16: 0xb53120, 0x17: 0x994e00, 0x18: 0x6b6d00,
	0x19: 0x388700, 0x1a: 0x0d9300, 0x1c: 0x007c8d,
	0x21: 0x64b0ff, 0x22: 0x6b88ff, 0x25: 0xfe6ecc, 0x27: 0xea9e22, 0x29: 0x88d800, 0x2d: 0x4f4f4f,
	0x30: 0xfffeff, 0x36: 0xfeccc5, 0x37: 0xf7d8a5, 0x3a: 0xbdf4ab, 0x3c: 0xb5ebf2,
};
const rgb = n => {
	if (!(n in NES_RGB)) throw new Error(`Falta el color NES $${n.toString(16)}`);
	const v = NES_RGB[n];
	return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
};

// ---------------------------------------------------------------------------------------------
// Lectura del desensamblado
// ---------------------------------------------------------------------------------------------

const asmLines = fs.readFileSync(ASM_PATH, 'utf8').split('\n');

function asmBytes(label) {
	const start = asmLines.findIndex(l => l.startsWith(label + ':'));
	if (start < 0) throw new Error(`Etiqueta no encontrada: ${label}`);
	const out = [];
	for (let i = start; i < asmLines.length; i++) {
		let l = asmLines[i].replace(/;.*/, '');
		if (i === start) l = l.slice(l.indexOf(':') + 1);
		else if (/^[A-Za-z_]\w*:/.test(l.trim())) break;
		l = l.trim();
		if (!l) continue;
		const m = l.match(/^dc\.b\s+(.*)$/);
		if (!m) break;
		for (const tok of m[1].split(',')) if (tok.trim()) out.push(parseInt(tok.trim().replace('$', ''), 16));
	}
	return out;
}

// Paletas de un área: 16 bytes de fondo y 16 de sprites tras el encabezado de 3 bytes
function areaPalettes(label) {
	const b = asmBytes(label).slice(3, 3 + 32);
	const split = off => [0, 1, 2, 3].map(g => b.slice(off + g * 4, off + g * 4 + 4));
	return { bg: split(0), spr: split(16) };
}

const { chr } = loadRom();

const metatiles = (() => {
	// id de metatile -> [TL, BL, TR, BR] (tiles del banco de fondo) y su grupo de paleta
	const map = new Map();
	const ids = [0x00, 0x40, 0x80, 0xc0];
	for (let g = 0; g < 4; g++) {
		const b = asmBytes(`Palette${g}_MTiles`);
		for (let i = 0; i < b.length; i += 4) map.set(ids[g] + i / 4, { tiles: b.slice(i, i + 4), group: g });
	}
	return map;
})();

// ---------------------------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------------------------

// Un tile de 8x8 con una paleta de 4 colores NES; el índice 0 es transparente salvo que se pida lo contrario
function putTile(cv, x, y, bank, index, nesPal, opts = {}) {
	const pal = nesPal.map(rgb);
	cv.tile(tile(chr, bank, index), x, y, pal, opts);
}

function clearCell(cv, x, y, w, h) {
	for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cv.set(x + i, y + j, [0, 0, 0, 0]);
}

function putMetatile(cv, x, y, id, nesBgPals, nesPalOverride) {
	const mt = metatiles.get(id);
	if (!mt) throw new Error(`Metatile $${id.toString(16)} fuera de las tablas`);
	const pal = nesPalOverride || nesBgPals[mt.group];
	const pos = [[0, 0], [0, 8], [8, 0], [8, 8]];
	mt.tiles.forEach((t, k) => putTile(cv, x + pos[k][0], y + pos[k][1], BG, t, pal));
}

// Espeja horizontalmente una región del lienzo
function mirrorRegion(cv, x, y, w, h) {
	for (let j = 0; j < h; j++) for (let i = 0; i < Math.floor(w / 2); i++) {
		const a = ((y + j) * cv.w + x + i) * 4, b = ((y + j) * cv.w + x + w - 1 - i) * 4;
		for (let k = 0; k < 4; k++) { const t = cv.data[a + k]; cv.data[a + k] = cv.data[b + k]; cv.data[b + k] = t; }
	}
}

// Filas de tiles [izq, der] de sprites. 0xfc es un hueco. Si los dos tiles de una fila son iguales,
// el derecho va espejado (así dibuja el juego las piezas simétricas). facingLeft espeja toda la celda:
// el original guarda a los personajes mirando a la derecha.
function putSprite(cv, x, y, rows, nesPal, { facingLeft = false, rowOffset = 0 } = {}) {
	rows.forEach((r, j) => {
		const [l, rr] = r;
		const yy = y + (j + rowOffset) * 8;
		if (l !== 0xfc) putTile(cv, x, yy, SPR, l, nesPal);
		if (rr !== 0xfc) putTile(cv, x + 8, yy, SPR, rr, nesPal, { flipX: l === rr });
	});
	if (facingLeft) mirrorRegion(cv, x, y, 16, rows.length * 8 + rowOffset * 8);
}

// ---------------------------------------------------------------------------------------------
// Hojas
// ---------------------------------------------------------------------------------------------

const sheets = [];   // { name, w, h, tw, th, draw(cv, ox, oy) }

function sheet(name, w, h, tw, th, draw) { sheets.push({ name, w, h, tw, th, draw }); }

const cell = (ox, oy, tw, th, c, r) => [ox + c * tw, oy + r * th];

// Rotación de color de los bloques de pregunta y las monedas del fondo (ColorRotatePalette)
const QUESTION_COLORS = [0x27, 0x17, 0x0f];

// Hojas de fondo, una por área. Las filas 0 a 5 son iguales en todas; la del exterior suma además
// objetos (hongos, flor, estrella, moneda) en las filas 6 a 9.
function backgroundSheet(name, paletteLabel, { groundId, extras }) {
	const { bg, spr } = areaPalettes(paletteLabel);
	const withQuestion = g3 => [bg[0], bg[1], bg[2], g3];
	sheet(name, 256, extras ? 160 : 96, 16, 16, (cv, ox, oy) => {
		const put = (c, r, id, pal) => { const [x, y] = cell(ox, oy, 16, 16, c, r); putMetatile(cv, x, y, id, bg, pal); };

		// Fila 0: bloques
		{ const [x, y] = cell(ox, oy, 16, 16, 0, 0); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) cv.set(x + i, y + j, rgb(0x0f)); }
		put(1, 0, groundId); put(2, 0, 0x61); put(3, 0, 0x51); put(4, 0, 0x52); put(5, 0, 0x69);   // 0x69: coral del fondo de las áreas de agua

		// Fila 1: pregunta (3 colores), bloque vacío, moneda del fondo (3 colores)
		QUESTION_COLORS.forEach((c, k) => {
			const pal = [bg[3][0], c, bg[3][2], bg[3][3]];
			put(k, 1, 0xc0, pal);
			put(7 + k, 1, 0xc2, pal);
		});
		put(3, 1, 0xc4);

		// Fila 2: caños
		put(0, 2, 0x10); put(1, 2, 0x11); put(2, 2, 0x14); put(3, 2, 0x15);
		put(4, 2, 0x1c); put(5, 2, 0x1f); put(6, 2, 0x1e); put(7, 2, 0x21); put(8, 2, 0x1d); put(9, 2, 0x20);
		put(10, 2, 0x64); put(11, 2, 0x65); put(12, 2, 0x66);   // cañón
		put(13, 2, 0xc5); put(14, 2, 0x0c); put(15, 2, 0x89);   // hacha, cadena y puente del castillo de Bowser

		// Fila 3: mástil y bandera
		put(0, 3, 0x24); put(1, 3, 0x25);
		put(3, 3, 0x63); put(4, 3, 0x0b);   // puente de cuerda y su baranda
		put(5, 3, 0x88);                      // plataforma de nube de los niveles de nubes
		{
			// La bandera son tres sprites (triángulo, calavera, triángulo) con la paleta 1 de sprites
			const [x, y] = cell(ox, oy, 16, 16, 2, 3);
			putTile(cv, x, y, SPR, 0x7e, spr[1]); putTile(cv, x + 8, y, SPR, 0x7f, spr[1]); putTile(cv, x + 8, y + 8, SPR, 0x7e, spr[1]);
		}

		// Fila 5: piezas del castillo del final del nivel (0x45 a 0x4b)
		for (let id = 0x45; id <= 0x4b; id++) put(id - 0x45, 5, id);
		// ...y el resto de la escenografía de fondo: valla, tronco, árboles, ola y relleno de agua
		[0x4d, 0x4e, 0x0d, 0x0e, 0x0f, 0x86, 0x87].forEach((id, k) => put(7 + k, 5, id));

		// Fila 4: nubes, colina y arbustos (sólo tienen sentido en el exterior, pero ocupan lo mismo)
		[0x80, 0x81, 0x82, 0x83, 0x84, 0x85].forEach((id, k) => put(k, 4, id));
		[0x05, 0x06, 0x0a, 0x09, 0x08, 0x07].forEach((id, k) => put(6 + k, 4, id));
		put(12, 4, 0x02); put(13, 4, 0x03); put(14, 4, 0x04);

		if (!extras) return;

		// Filas 6 a 9: objetos. Los de las filas 7 y 8 rotan de paleta (atributo 0 a 3) en cada cuadro.
		const pu = (c, r, rows, pal, opts) => { const [x, y] = cell(ox, oy, 16, 16, c, r); putSprite(cv, x, y, rows, pal, opts); };
		const powerUps = asmBytes('PowerUpGfxTable');
		const pair = (t, k) => [[t[k * 4], t[k * 4 + 1]], [t[k * 4 + 2], t[k * 4 + 3]]];
		pu(0, 6, pair(powerUps, 0), spr[2]);                       // hongo
		pu(1, 6, pair(powerUps, 3), spr[1]);                       // hongo de vida
		for (let f = 0; f < 4; f++) {
			pu(f, 7, pair(powerUps, 1), spr[f]);                    // flor
			pu(f, 8, pair(powerUps, 2), spr[f]);                    // estrella
		}
		// Moneda que salta de un bloque: 2 tiles apilados (el de abajo espejado en vertical), paleta 2
		const coinTiles = asmBytes('JumpingCoinTiles');
		coinTiles.forEach((t, f) => {
			const [x, y] = cell(ox, oy, 16, 16, f, 9);
			putTile(cv, x + 4, y, SPR, t, spr[2]);
			putTile(cv, x + 4, y + 8, SPR, t, spr[2], { flipY: true });
		});
	});
}

backgroundSheet('Overworld_Tiles', 'GroundPaletteData', { groundId: 0x54, extras: true });
backgroundSheet('Underground_Tiles', 'UndergroundPaletteData', { groundId: 0x54, extras: false });
backgroundSheet('Castle_Tiles', 'CastlePaletteData', { groundId: 0x62, extras: false });
backgroundSheet('Water_Tiles', 'WaterPaletteData', { groundId: 0x54, extras: false });

// --- Jugadores ---------------------------------------------------------------------------------

const PLAYER_COLORS = asmBytes('PlayerColors');   // 3 paletas de 4: Mario, Luigi y fuego
const playerPal = k => PLAYER_COLORS.slice(k * 4, k * 4 + 4);
const gfx = asmBytes('PlayerGraphicsTable');
const gfxRow = n => [0, 1, 2, 3].map(j => [gfx[n * 8 + j * 2], gfx[n * 8 + j * 2 + 1]]);

// Filas de PlayerGraphicsTable: grande 0-11, chico 12-22, y tres cuadros comunes (chico parado,
// intermedio de crecimiento y grande parado) en 23-25.
const BIG = { walk1: 0, walk2: 1, walk3: 2, skid: 3, jump: 4, swim1: 5, swim2: 6, swim3: 7, climb1: 8, climb2: 9, crouch: 10, shoot: 11 };
const SMALL = { walk1: 12, walk2: 13, walk3: 14, skid: 15, jump: 16, swim1: 17, swim2: 18, swim3: 19, climb1: 20, climb2: 21, killed: 22 };
const STAND_SMALL = 23, GROW_MID = 24, STAND_BIG = 25;

const BIG_FRAMES = [STAND_BIG, BIG.walk1, BIG.walk2, BIG.walk3, BIG.skid, BIG.jump, BIG.crouch, BIG.climb1, BIG.climb2,
	BIG.swim1, BIG.swim2, BIG.swim3, BIG.swim2, BIG.swim1, BIG.swim2];
const SMALL_FRAMES = [STAND_SMALL, SMALL.walk1, SMALL.walk2, SMALL.walk3, SMALL.skid, SMALL.jump, SMALL.killed, SMALL.climb1, SMALL.climb2,
	SMALL.swim1, SMALL.swim2, SMALL.swim3, SMALL.swim2, SMALL.swim1];

function playerSheets(prefix, pal) {
	sheet(`Player_${prefix}_Tiles`, SMALL_FRAMES.length * 16, 16, 16, 16, (cv, ox, oy) => {
		SMALL_FRAMES.forEach((n, f) => putSprite(cv, ox + f * 16, oy, gfxRow(n).slice(2), pal));
	});
	sheet(`Player_${prefix}_Big_Tiles`, BIG_FRAMES.length * 16, 32, 16, 32, (cv, ox, oy) => {
		BIG_FRAMES.forEach((n, f) => putSprite(cv, ox + f * 16, oy, gfxRow(n), pal));
	});
	sheet(`Player_${prefix}_Grow_Tiles`, 48, 32, 16, 32, (cv, ox, oy) => {
		[STAND_SMALL, GROW_MID, STAND_BIG].forEach((n, f) => putSprite(cv, ox + f * 16, oy, gfxRow(n), pal));
	});
}
function fireSheet(prefix) {
	const pal = playerPal(2);
	const frames = [...BIG_FRAMES, BIG.shoot];
	sheet(`Player_${prefix}_Fire_Tiles`, frames.length * 16, 32, 16, 32, (cv, ox, oy) => {
		frames.forEach((n, f) => putSprite(cv, ox + f * 16, oy, gfxRow(n), pal));
	});
}
playerSheets('Mario', playerPal(0));
playerSheets('Luigi', playerPal(1));
fireSheet('Mario');
fireSheet('Luigi');

// --- Enemigos ----------------------------------------------------------------------------------

const GROUND = areaPalettes('GroundPaletteData');
const eg = asmBytes('EnemyGraphicsTable');
// Cada cuadro son 3 filas de [izq, der]; los cuadros están numerados en el orden de la tabla
const ENEMY = { spring1: 40, spring2: 41, spring3: 42, buzzy1: 0, buzzy2: 1, spiny1: 6, spiny2: 7, egg1: 8, egg2: 9, buzzyShellUp1: 21, buzzyShellUp2: 22, lakitu1: 24, lakitu2: 25, hammer1: 28, hammer2: 29, hammer3: 30, hammer4: 31, princess: 26, retainer: 27, bowserFront1: 35, bowserRear1: 36, bowserFront2: 37, bowserRear2: 38, bulletBill: 39, bloober1: 10, bloober2: 11, cheep1: 12, cheep2: 13, koopa1: 2, koopa2: 3, para1: 4, para2: 5, goomba: 14, shellUp1: 15, shellUp2: 16, shell1: 17, shell2: 18, goombaFlat: 23, piranha1: 32, piranha2: 33 };
const BOWSER_PAL = asmBytes('BowserPaletteData').slice(3, 7);   // verde, blanco y naranja
const ENEMY_PODOBOO = 34;   // posición de "podoboo" en EnemyGraphicsTable
const enemyRows = n => [0, 1, 2].map(j => [eg[n * 6 + j * 2], eg[n * 6 + j * 2 + 1]]);

sheet('Enemy_Short_Tiles', 256, 16, 16, 16, (cv, ox, oy) => {
	const at = f => [ox + f * 16, oy];
	// Goomba: dos cuadros, el segundo espejado; y aplastado
	putSprite(cv, ...at(0), enemyRows(ENEMY.goomba).slice(1), GROUND.spr[3]);
	putSprite(cv, ...at(1), enemyRows(ENEMY.goomba).slice(1), GROUND.spr[3], { facingLeft: true });
	putSprite(cv, ...at(2), enemyRows(ENEMY.goombaFlat).slice(1), GROUND.spr[3]);
	// Caparazones: verde (paleta 1) y rojo (paleta 2), dos cuadros cada uno. El original los llama "al revés"
	// (filas 6e/6d arriba y 6f abajo) porque el juego los voltea para el caparazón patas arriba; así, sin
	// voltear, forman el caparazón normal
	putSprite(cv, ...at(3), enemyRows(ENEMY.shellUp1).slice(1), GROUND.spr[1]);
	putSprite(cv, ...at(4), enemyRows(ENEMY.shellUp2).slice(1), GROUND.spr[1]);
	putSprite(cv, ...at(5), enemyRows(ENEMY.shellUp1).slice(1), GROUND.spr[2]);
	putSprite(cv, ...at(6), enemyRows(ENEMY.shellUp2).slice(1), GROUND.spr[2]);
	// Bullet Bill, mirando a la izquierda, con la paleta 3 de sprites del agua (negro, blanco y gris)
	putSprite(cv, ...at(7), enemyRows(ENEMY.bulletBill).slice(1), areaPalettes('WaterPaletteData').spr[3], { facingLeft: true });
});

sheet('Enemy_Tall_Tiles', 192, 24, 16, 24, (cv, ox, oy) => {
	const at = f => [ox + f * 16, oy];
	const left = { facingLeft: true };
	// Koopa verde y rojo, y paratroopa verde y rojo (miran a la izquierda)
	[[0, ENEMY.koopa1, 1], [1, ENEMY.koopa2, 1], [2, ENEMY.koopa1, 2], [3, ENEMY.koopa2, 2],
	 [4, ENEMY.para1, 1], [5, ENEMY.para2, 1], [6, ENEMY.para1, 2], [7, ENEMY.para2, 2]]
		.forEach(([f, n, p]) => putSprite(cv, ...at(f), enemyRows(n), GROUND.spr[p], left));
	// Planta piraña verde y roja
	[[8, ENEMY.piranha1, 1], [9, ENEMY.piranha2, 1], [10, ENEMY.piranha1, 2], [11, ENEMY.piranha2, 2]]
		.forEach(([f, n, p]) => putSprite(cv, ...at(f), enemyRows(n), GROUND.spr[p]));
});

// Peces de las áreas de agua: Bloober (paleta 3) y cheep-cheep gris (paleta 1) y rojo (paleta 2),
// con la paleta de sprites del agua; los cheep-cheep miran a la izquierda
const WATER = areaPalettes('WaterPaletteData');
sheet('Enemy_Water_Tiles', 96, 24, 16, 24, (cv, ox, oy) => {
	const at = f => [ox + f * 16, oy];
	putSprite(cv, ...at(0), enemyRows(ENEMY.bloober1), WATER.spr[3]);
	putSprite(cv, ...at(1), enemyRows(ENEMY.bloober2), WATER.spr[3]);
	[[2, 1], [4, 2]].forEach(([f, p]) => {
		putSprite(cv, ...at(f), enemyRows(ENEMY.cheep1), WATER.spr[p], { facingLeft: true });
		putSprite(cv, ...at(f + 1), enemyRows(ENEMY.cheep2), WATER.spr[p], { facingLeft: true });
	});
});

// Podoboo (paleta 2 de sprites del castillo): subiendo y, para la caída, volteado en vertical
{
	const CASTLE = areaPalettes('CastlePaletteData');
	sheet('Enemy_Fire_Tiles', 32, 16, 16, 16, (cv, ox, oy) => {
		const [a, b] = [eg[ENEMY_PODOBOO * 6 + 2], eg[ENEMY_PODOBOO * 6 + 4]];
		const put = (x, top, bottom, flipY) => {
			[[top, 0], [bottom, 8]].forEach(([t, y]) => {
				putTile(cv, x, oy + y, SPR, t, CASTLE.spr[2], { flipY });
				putTile(cv, x + 8, oy + y, SPR, t, CASTLE.spr[2], { flipX: true, flipY });
			});
		};
		put(ox, a, b, false);
		put(ox + 16, b, a, true);
	});
}

// Bowser: 4 cuadros de 32x24 (boca cerrada o abierta, pies de un lado o del otro), mirando a la izquierda.
// El original guarda la mitad trasera a la izquierda y la delantera a la derecha, y lo espeja al mirar a la izquierda.
sheet('Enemy_Bowser_Tiles', 128, 24, 32, 24, (cv, ox, oy) => {
	const pal = BOWSER_PAL;
	[[ENEMY.bowserFront1, ENEMY.bowserRear1], [ENEMY.bowserFront1, ENEMY.bowserRear2],
	 [ENEMY.bowserFront2, ENEMY.bowserRear1], [ENEMY.bowserFront2, ENEMY.bowserRear2]].forEach(([front, rear], f) => {
		const x = ox + f * 32;
		putSprite(cv, x, oy, enemyRows(rear), pal);
		putSprite(cv, x + 16, oy, enemyRows(front), pal);
		mirrorRegion(cv, x, oy, 32, 24);
	});
});

// Llama de Bowser: 3 tiles ($51 a $53) de 8x8 en fila, y la misma volteada en vertical
sheet('Enemy_Flame_Tiles', 48, 8, 24, 8, (cv, ox, oy) => {
	const pal = areaPalettes('CastlePaletteData').spr[2];
	[false, true].forEach((flipY, f) => [0x51, 0x52, 0x53].forEach((t, i) => putTile(cv, ox + f * 24 + i * 8, oy, SPR, t, pal, { flipY })));
});

// Toad y la princesa (celdas de 16x24)
sheet('Enemy_Npc_Tiles', 32, 24, 16, 24, (cv, ox, oy) => {
	putSprite(cv, ox, oy, enemyRows(ENEMY.retainer), GROUND.spr[2]);
	putSprite(cv, ox + 16, oy, enemyRows(ENEMY.princess), GROUND.spr[2]);
});

// Plataformas móviles: un tile de viga ($5b) por tipo de área (exterior, subterráneo, agua y castillo),
// con la paleta 2 de sprites de cada una; el motor lo repite a lo ancho
sheet('Platform_Tiles', 32, 8, 8, 8, (cv, ox, oy) => {
	['GroundPaletteData', 'UndergroundPaletteData', 'WaterPaletteData', 'CastlePaletteData'].forEach((label, i) =>
		putTile(cv, ox + i * 8, oy, SPR, 0x5b, areaPalettes(label).spr[2]));
});

// Enemigos extra de 16x16: Buzzy Beetle (andando y caparazón), Spiny (andando y huevo) y las 4 poses del martillo.
// Todos miran a la izquierda. El Buzzy usa la paleta 3 del subterráneo, el Spiny la 2 del exterior.
{
	const UG = areaPalettes('UndergroundPaletteData');
	sheet('Enemy_Extra_Tiles', 192, 16, 16, 16, (cv, ox, oy) => {
		const at = f => [ox + f * 16, oy];
		const cut = n => enemyRows(n).slice(1);
		putSprite(cv, ...at(0), cut(ENEMY.buzzy1), UG.spr[3], { facingLeft: true });
		putSprite(cv, ...at(1), cut(ENEMY.buzzy2), UG.spr[3], { facingLeft: true });
		putSprite(cv, ...at(2), cut(ENEMY.buzzyShellUp1), UG.spr[3]);
		putSprite(cv, ...at(3), cut(ENEMY.buzzyShellUp2), UG.spr[3]);
		putSprite(cv, ...at(4), cut(ENEMY.spiny1), GROUND.spr[2], { facingLeft: true });
		putSprite(cv, ...at(5), cut(ENEMY.spiny2), GROUND.spr[2], { facingLeft: true });
		// Huevo: cada fila repite un tile y lo espeja a la derecha; la de abajo va volteada en vertical
		[[0x8f, 0x8e], [0x95, 0x94]].forEach(([top, bottom], f) => {
			const [x, y] = at(6 + f);
			putTile(cv, x, y, SPR, top, GROUND.spr[2]); putTile(cv, x + 8, y, SPR, top, GROUND.spr[2], { flipX: true });
			putTile(cv, x, y + 8, SPR, bottom, GROUND.spr[2], { flipY: true }); putTile(cv, x + 8, y + 8, SPR, bottom, GROUND.spr[2], { flipX: true, flipY: true });
		});
		// Martillo en cuatro poses (tiles $80 a $83, paleta 3): dos sprites de 8x8 por pose, posiciones y espejos de DrawHammer
		const pal = GROUND.spr[3];
		[[0x80, 0x81, [4, 0], [4, 8], false], [0x82, 0x83, [0, 4], [8, 4], false], [0x81, 0x80, [4, 0], [4, 8], true], [0x83, 0x82, [0, 4], [8, 4], true]].forEach(([t1, t2, p1, p2, flip], i) => {
			const [x, y] = at(8 + i);
			putTile(cv, x + p1[0], y + p1[1], SPR, t1, pal, { flipX: flip, flipY: flip });
			putTile(cv, x + p2[0], y + p2[1], SPR, t2, pal, { flipX: flip, flipY: flip });
		});
	});
	// Lakitu y el Hammer Bro (celdas de 16x24)
	sheet('Enemy_Tall2_Tiles', 96, 24, 16, 24, (cv, ox, oy) => {
		const at = f => [ox + f * 16, oy];
		putSprite(cv, ...at(0), enemyRows(ENEMY.lakitu1), GROUND.spr[1], { facingLeft: true });
		putSprite(cv, ...at(1), enemyRows(ENEMY.lakitu2), GROUND.spr[1], { facingLeft: true });
		[ENEMY.hammer1, ENEMY.hammer2, ENEMY.hammer3, ENEMY.hammer4].forEach((n, i) => putSprite(cv, ...at(2 + i), enemyRows(n), GROUND.spr[1], { facingLeft: true }));
	});
}

// Resorte: 3 cuadros de 16x24 (extendido, a medias y comprimido), con la paleta 1 de sprites del exterior
sheet('Spring_Tiles', 48, 24, 16, 24, (cv, ox, oy) => {
	[ENEMY.spring1, ENEMY.spring2, ENEMY.spring3].forEach((n, i) => putSprite(cv, ox + i * 16, oy, enemyRows(n), GROUND.spr[1]));
});

// Enredadera: un tramo (dos tiles $e1, el segundo espejado y corrido 6 px, que dan la forma de hojas alternadas)
// y la punta ($e0), con la paleta 1 de sprites del exterior
sheet('Vine_Tiles', 32, 8, 16, 8, (cv, ox, oy) => {
	const pal = GROUND.spr[1];
	putTile(cv, ox, oy, SPR, 0xe1, pal);
	putTile(cv, ox + 6, oy, SPR, 0xe1, pal, { flipX: true });
	putTile(cv, ox + 16, oy, SPR, 0xe0, pal);
	putTile(cv, ox + 22, oy, SPR, 0xe1, pal, { flipX: true });
});

// Burbuja de Mario bajo el agua: tile $74 de sprites con la paleta 2 del agua
sheet('Bubble_Tiles', 8, 8, 8, 8, (cv, ox, oy) => putTile(cv, ox, oy, SPR, 0x74, WATER.spr[2]));

// --- Bolas de fuego ----------------------------------------------------------------------------

sheet('Fireball_Spin_Tiles', 32, 8, 8, 8, (cv, ox, oy) => {
	// Tile $64 girando: sin espejar, espejado en V, en HV y en H
	const flips = [{}, { flipY: true }, { flipX: true, flipY: true }, { flipX: true }];
	flips.forEach((o, f) => putTile(cv, ox + f * 8, oy, SPR, 0x64, GROUND.spr[2], o));
});
sheet('Fireball_Explosion_Tiles', 48, 16, 16, 16, (cv, ox, oy) => {
	// Explosión: 3 tiles ($68, $67, $66), cada uno en un cuadrado de 2x2 espejado
	const tiles = asmBytes('ExplosionTiles');
	tiles.forEach((t, f) => {
		const x = ox + f * 16, y = oy;
		putTile(cv, x, y, SPR, t, GROUND.spr[2]);
		putTile(cv, x + 8, y, SPR, t, GROUND.spr[2], { flipX: true });
		putTile(cv, x, y + 8, SPR, t, GROUND.spr[2], { flipY: true });
		putTile(cv, x + 8, y + 8, SPR, t, GROUND.spr[2], { flipX: true, flipY: true });
	});
});

// --- Interfaz ----------------------------------------------------------------------------------

sheet('UI_Tiles', 16, 8, 8, 8, (cv, ox, oy) => {
	// Moneda del marcador (tile $2e del fondo) e ícono de hongo del menú ($ce)
	putTile(cv, ox, oy, BG, 0x2e, GROUND.bg[3]);
	putTile(cv, ox + 8, oy, BG, 0xce, asmBytes('MushroomPaletteData').slice(3, 7));
});

// Logo del título: la pantalla se guarda en el CHR como una lista de escrituras al nametable
// (dirección alta y baja, cantidad, datos), incluida la tabla de atributos.
function decodeTitle() {
	const nt = new Uint8Array(0x400).fill(0x24);
	let o = 0x1ec0;
	while (chr[o] !== 0 && o < chr.length) {
		const addr = (chr[o] << 8) | chr[o + 1], ctl = chr[o + 2];
		const n = ctl & 0x3f, repeat = ctl & 0x40, vertical = ctl & 0x80;
		o += 3;
		for (let i = 0; i < n; i++) {
			const a = addr + (vertical ? i * 32 : i);
			const v = chr[o + (repeat ? 0 : i)];
			if (a >= 0x2000 && a < 0x2400) nt[a - 0x2000] = v;
		}
		o += repeat ? 1 : n;
	}
	return nt;
}
{
	const nt = decodeTitle();
	// Sólo el cartel: filas 4 a 14 (11 filas de 22 tiles), con la paleta de fondo de los bloques
	const cols = 22, rows = 11, c0 = 5, r0 = 4;
	sheet('Title_Image', cols * 8, rows * 8, cols * 8, rows * 8, (cv, ox, oy) => {
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
			const t = nt[(r0 + r) * 32 + c0 + c];
			if (t === 0x24) continue;
			const attr = nt[0x3c0 + Math.floor((r0 + r) / 4) * 8 + Math.floor((c0 + c) / 4)];
			const q = (((r0 + r) >> 1) & 1) * 2 + (((c0 + c) >> 1) & 1);
			putTile(cv, ox + c * 8, oy + r * 8, BG, t, GROUND.bg[(attr >> (q * 2)) & 3]);
		}
	});
}

// ---------------------------------------------------------------------------------------------
// Empaquetado
// ---------------------------------------------------------------------------------------------

function main() {
	const argv = process.argv.slice(2);
	const dbgIdx = argv.indexOf('--debug');
	const debugDir = dbgIdx >= 0 ? path.resolve(argv[dbgIdx + 1] || '.') : null;

	// Apila las hojas en vertical, con 1 px de separación transparente
	const width = Math.max(...sheets.map(s => s.w));
	let height = 0;
	const placed = sheets.map(s => { const p = { s, y: height }; height += s.h + 1; return p; });
	const atlas = new Canvas(width, height);
	const manifest = {};
	for (const { s, y } of placed) {
		s.draw(atlas, 0, y);
		manifest[s.name] = { x: 0, y, w: s.w, h: s.h, tw: s.tw, th: s.th };
	}

	fs.writeFileSync(OUT_PNG, atlas.png());
	const b64 = fs.readFileSync(OUT_PNG).toString('base64');
	fs.writeFileSync(OUT_JS,
		'// Generado por tools/build-atlas.js desde la ROM. No editar a mano.\n' +
		`const ATLAS = {\n\timage: "data:image/png;base64,${b64}",\n\tsheets: ${JSON.stringify(manifest, null, 1).replace(/\n\s*/g, ' ')},\n};\n`);
	console.log(`Escrito ${path.relative(ROOT, OUT_PNG)} (${width}x${height}, ${sheets.length} hojas) y ${path.relative(ROOT, OUT_JS)}`);

	if (debugDir) {
		fs.mkdirSync(debugDir, { recursive: true });
		fs.writeFileSync(path.join(debugDir, 'atlas.png'), atlas.png());
		// Todos los metatiles con su id, en una grilla de 16 columnas (id = fila*16 + columna dentro del bloque de 256)
		const big = new Canvas(16 * 16, 16 * 16);
		for (const [id] of metatiles) putMetatile(big, (id % 16) * 16, Math.floor(id / 16) * 16, id, GROUND.bg);
		fs.writeFileSync(path.join(debugDir, 'metatiles_ground.png'), big.png());
		console.log(`Volcado de revisión en ${debugDir}`);
	}
}

main();
