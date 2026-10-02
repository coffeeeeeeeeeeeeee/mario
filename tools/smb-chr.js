// Lectura de los gráficos (CHR-ROM) de Super Mario Bros desde tools/smb.nes y utilidades para
// armar spritesheets PNG. La ROM no se versiona (ver .gitignore); este script sólo la lee.
//
// El CHR tiene dos tablas de patrones de 256 tiles de 8x8 píxeles a 2 bits:
//   banco 0 ($0000): fondo (bloques, caños, nubes, fuente de texto)
//   banco 1 ($1000): sprites (Mario, enemigos, objetos)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROM_PATH = path.join(__dirname, 'smb.nes');

function loadRom() {
	if (!fs.existsSync(ROM_PATH)) throw new Error(`Falta ${ROM_PATH}`);
	const d = fs.readFileSync(ROM_PATH);
	if (d.toString('latin1', 0, 3) !== 'NES' || d[3] !== 0x1a) throw new Error('No es una ROM iNES');
	const prgSize = d[4] * 16384, chrSize = d[5] * 8192;
	return { prg: d.subarray(16, 16 + prgSize), chr: d.subarray(16 + prgSize, 16 + prgSize + chrSize) };
}

// Tile de 8x8 con valores 0..3. bank: 0 o 1; index: 0..255.
function tile(chr, bank, index) {
	const base = bank * 4096 + index * 16;
	const px = new Uint8Array(64);
	for (let y = 0; y < 8; y++) {
		const lo = chr[base + y], hi = chr[base + 8 + y];
		for (let x = 0; x < 8; x++) {
			const bit = 7 - x;
			px[y * 8 + x] = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
		}
	}
	return px;
}

// ---------------------------------------------------------------------------------------------
// PNG (RGBA 8 bits) sin dependencias
// ---------------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
	const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
}

function encodePng(width, height, rgba) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
	const raw = Buffer.alloc((width * 4 + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (width * 4 + 1)] = 0;
		Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
	]);
}

// Lienzo RGBA simple
class Canvas {
	constructor(w, h) { this.w = w; this.h = h; this.data = new Uint8Array(w * h * 4); }
	set(x, y, rgba) {
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
		const i = (y * this.w + x) * 4;
		this.data[i] = rgba[0]; this.data[i + 1] = rgba[1]; this.data[i + 2] = rgba[2]; this.data[i + 3] = rgba[3];
	}
	// Dibuja un tile de 8x8 en (x, y). palette: 4 colores RGBA; el índice 0 es transparente si
	// transparent0 es true. flipX/flipY espejan el tile.
	tile(px, x, y, palette, { flipX = false, flipY = false, transparent0 = true } = {}) {
		for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
			const sx = flipX ? 7 - i : i, sy = flipY ? 7 - j : j;
			const v = px[sy * 8 + sx];
			if (v === 0 && transparent0) continue;
			this.set(x + i, y + j, palette[v]);
		}
	}
	png() { return encodePng(this.w, this.h, this.data); }
}

module.exports = { loadRom, tile, Canvas, encodePng, ROM_PATH };

// ---------------------------------------------------------------------------------------------
// CLI: volcado de las tablas de patrones para inspeccionarlas
// ---------------------------------------------------------------------------------------------

if (require.main === module) {
	const outDir = path.resolve(process.argv[2] || '.');
	fs.mkdirSync(outDir, { recursive: true });
	const { chr } = loadRom();
	const scale = 4;
	const grey = [[0, 0, 0, 255], [110, 110, 110, 255], [190, 190, 190, 255], [255, 255, 255, 255]];
	for (const bank of [0, 1]) {
		const cv = new Canvas(16 * 8, 16 * 8);
		for (let i = 0; i < 256; i++) cv.tile(tile(chr, bank, i), (i % 16) * 8, Math.floor(i / 16) * 8, grey, { transparent0: false });
		fs.writeFileSync(path.join(outDir, `chr_bank${bank}.png`), cv.png());
	}
	console.log(`Volcado en ${outDir}`);
}
