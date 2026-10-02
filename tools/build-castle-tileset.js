// Genera assets/images/tileset_castle.png a partir de los gráficos originales de Super Mario Bros.
//
// Lee de tools/smb.nes (ROM, no se versiona) los tiles del fondo y de tools/smbdis.asm (tampoco
// se versiona) las definiciones de metatiles y la paleta del área de castillo. El layout de la hoja
// es el del tileset exterior, así el motor usa las mismas coordenadas para todos los mundos; las
// piezas que no cambian con la paleta (bloques de pregunta, monedas, nubes) se copian de esa hoja.
//
// Uso:  node tools/build-castle-tileset.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { loadRom, tile, Canvas, encodePng } = require('./smb-chr.js');

const ROOT = path.join(__dirname, '..');
const OVERWORLD_PNG = path.join(ROOT, 'assets/images/tileset_overworld.png');
const OUT_PNG = path.join(ROOT, 'assets/images/tileset_castle.png');
const ASSETS_JS = path.join(ROOT, 'assets.js');
const ASM_PATH = path.join(__dirname, 'smbdis.asm');

// Paleta del NES (RGB). Sólo los colores que usan las paletas de fondo del juego.
const NES_RGB = {
	0x00: 0x666666, 0x09: 0x0b4800, 0x0c: 0x00404d, 0x0f: 0x000000,
	0x10: 0xadadad, 0x12: 0x4240ff, 0x15: 0xb71e7b, 0x16: 0xb53120, 0x17: 0x994e00, 0x18: 0x6b6d00,
	0x19: 0x388700, 0x1a: 0x0d9300, 0x1c: 0x007c8d,
	0x21: 0x64b0ff, 0x25: 0xfe6ecc, 0x27: 0xea9e22, 0x29: 0x88d800, 0x2d: 0x4f4f4f,
	0x30: 0xfffeff, 0x36: 0xfeccc5, 0x37: 0xf7d8a5, 0x3a: 0xbdf4ab, 0x3c: 0xb5ebf2,
};
const rgba = n => [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];

// Qué metatile va en cada celda de 16x16 de la hoja, con las coordenadas del tileset exterior.
// El castillo cambia el ladrillo del terreno ($62) y pinta todo con su paleta.
const LAYOUT = {
	'1,0': 0x62,   // terreno: ladrillo de castillo
	'2,0': 0x61,   // bloque duro
	'3,0': 0x51,   // ladrillo
	'4,0': 0x52,   // ladrillo del medio
	'5,0': 0x45, '6,0': 0x49, '7,0': 0x4a,   // piezas del castillo
	'0,2': 0x10, '1,2': 0x11, '2,2': 0x14, '3,2': 0x15,   // caño vertical
	'4,2': 0x1c, '5,2': 0x1f, '6,2': 0x1e, '7,2': 0x21, '8,2': 0x1d, '9,2': 0x20,   // caño lateral
	'10,2': 0x64, '11,2': 0x65,   // cañón
};

// ---------------------------------------------------------------------------------------------

function readAsmBlock(lines, label) {
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
		for (const tok of m[1].split(',')) if (tok.trim()) out.push(parseInt(tok.trim().replace('$', ''), 16));
	}
	return out;
}

function decodePng(file) {
	const d = fs.readFileSync(file);
	let o = 8, width = 0, height = 0;
	const idat = [];
	while (o < d.length) {
		const len = d.readUInt32BE(o), type = d.toString('latin1', o + 4, o + 8);
		const data = d.subarray(o + 8, o + 8 + len);
		if (type === 'IHDR') {
			width = data.readUInt32BE(0); height = data.readUInt32BE(4);
			if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('Se espera PNG RGBA de 8 bits sin entrelazado');
		} else if (type === 'IDAT') idat.push(data);
		o += 12 + len;
	}
	const raw = zlib.inflateSync(Buffer.concat(idat));
	const stride = width * 4, out = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y++) {
		const f = raw[y * (stride + 1)];
		for (let x = 0; x < stride; x++) {
			const v = raw[y * (stride + 1) + 1 + x];
			const a = x >= 4 ? out[y * stride + x - 4] : 0;
			const b = y > 0 ? out[(y - 1) * stride + x] : 0;
			const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
			let r;
			switch (f) {
				case 0: r = v; break;
				case 1: r = v + a; break;
				case 2: r = v + b; break;
				case 3: r = v + ((a + b) >> 1); break;
				case 4: { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break; }
				default: throw new Error('Filtro PNG desconocido');
			}
			out[y * stride + x] = r & 255;
		}
	}
	return { width, height, data: out };
}

function main() {
	const { chr } = loadRom();
	const lines = fs.readFileSync(ASM_PATH, 'utf8').split('\n');

	// Metatiles: 4 tiles del banco de fondo por metatile, en orden arriba-izq, abajo-izq, arriba-der, abajo-der
	const mtiles = [0, 1, 2, 3].map(g => {
		const b = readAsmBlock(lines, `Palette${g}_MTiles`);
		const list = [];
		for (let i = 0; i < b.length; i += 4) list.push(b.slice(i, i + 4));
		return list;
	});

	// Paleta de fondo del castillo: 16 bytes tras los 3 del encabezado de CastlePaletteData
	const pal = readAsmBlock(lines, 'CastlePaletteData').slice(3, 3 + 16);
	const palettes = [0, 1, 2, 3].map(g => pal.slice(g * 4, g * 4 + 4).map(n => {
		if (!(n in NES_RGB)) throw new Error(`Falta el color NES $${n.toString(16)}`);
		return rgba(NES_RGB[n]);
	}));

	const base = decodePng(OVERWORLD_PNG);
	const cv = new Canvas(base.width, base.height);
	cv.data.set(base.data);

	for (const [coord, id] of Object.entries(LAYOUT)) {
		const [cx, cy] = coord.split(',').map(Number);
		const group = id >> 6, entry = mtiles[group][id & 63];
		if (!entry) throw new Error(`Metatile $${id.toString(16)} fuera de la tabla`);
		// Se limpia la celda y se dibujan los 4 tiles: [TL, BL, TR, BR]
		for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) cv.set(cx * 16 + x, cy * 16 + y, [0, 0, 0, 0]);
		const pos = [[0, 0], [0, 8], [8, 0], [8, 8]];
		entry.forEach((t, k) => cv.tile(tile(chr, 1, t), cx * 16 + pos[k][0], cy * 16 + pos[k][1], palettes[group]));
	}

	fs.writeFileSync(OUT_PNG, cv.png());
	console.log(`Escrito ${path.relative(ROOT, OUT_PNG)} (${Object.keys(LAYOUT).length} piezas desde la ROM)`);

	// assets.js: constante con la imagen embebida, justo después del tileset subterráneo
	const b64 = fs.readFileSync(OUT_PNG).toString('base64');
	const line = `const castleTileset = "data:image/png;base64,${b64}";`;
	let js = fs.readFileSync(ASSETS_JS, 'utf8');
	if (/^const castleTileset = .*$/m.test(js)) js = js.replace(/^const castleTileset = .*$/m, () => line);
	else js = js.replace(/^(const undergroundTileset = .*)$/m, (m) => m + '\n' + line);
	fs.writeFileSync(ASSETS_JS, js);
	console.log('assets.js actualizado (castleTileset)');
}

main();
