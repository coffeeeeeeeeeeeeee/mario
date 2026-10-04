// El juego sin navegador: carga js2d.js, mario.js y compañía en un contexto de Node con un DOM de mentira (un canvas que no
// dibuja, audio y fuentes de mentira) y deja a mano la misma API que en el navegador (api.js). Sirve para correr el juego
// mucho más rápido y en muchos procesos a la vez. Lo que sale es lo mismo que en el navegador, cuadro por cuadro, salvo
// las imágenes (smbApi.pixels no está disponible).
//
//   const { createGame } = require('./headless');
//   const api = await createGame();
//   api.reset({ world: '1-1', seed: 7 });
//   api.step(2, 4);
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS = ['js2d.js', null, 'atlas.js', 'levels_smb.js', 'mario.js', 'ia.js', 'game.js', 'api.js'];   // null: lo que index.html escribe en línea
// Funciones que sólo dibujan (no mueven ni deciden nada)
const PURE_DRAW = ['drawBlocks', 'drawForegroundBlocks', 'drawBackground', 'drawScenery', 'drawUI', 'drawWarpZoneText'];
const INLINE = 'const canvas = document.getElementById("game"); const js2d = new Js2d(canvas);';

function pngSize(file) {
	const b = fs.readFileSync(file);
	return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// Contexto 2D que no dibuja nada pero contesta lo que el juego le pregunta
function fakeContext(canvas) {
	const noop = () => {};
	const base = {
		canvas,
		measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }),
		getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
		createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
		createLinearGradient: () => ({ addColorStop: noop }),
		createRadialGradient: () => ({ addColorStop: noop }),
		createPattern: () => ({}),
	};
	return new Proxy(base, {
		get: (t, k) => (k in t ? t[k] : (t[k] = noop)),
		set: (t, k, v) => { t[k] = v; return true; },
	});
}

class FakeCanvas {
	constructor() { this.width = 300; this.height = 150; this.style = {}; this._ctx = null; }
	getContext() { return this._ctx || (this._ctx = fakeContext(this)); }
	toDataURL() { return `data:fake;${this.width}x${this.height}`; }
	getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
	addEventListener() {}
	removeEventListener() {}
}

class FakeImage {
	constructor() { this.width = 0; this.height = 0; this.naturalWidth = 0; this.naturalHeight = 0; this.onload = null; this.onerror = null; this._src = ''; }
	get src() { return this._src; }
	set src(v) {
		this._src = v;
		const m = /^data:fake;(\d+)x(\d+)$/.exec(v);
		let size = { w: 16, h: 16 };
		try { size = m ? { w: +m[1], h: +m[2] } : pngSize(path.join(ROOT, v)); } catch (e) { /* queda 16x16 */ }
		this.width = this.naturalWidth = size.w;
		this.height = this.naturalHeight = size.h;
		setImmediate(() => this.onload && this.onload());
	}
}

class FakeAudio {
	constructor(src) { this.src = src; this.paused = true; this.ended = false; this.volume = 1; this.loop = false; this.currentTime = 0; }
	play() { this.paused = false; return Promise.resolve(); }
	pause() { this.paused = true; }
	cloneNode() { return new FakeAudio(this.src); }
	addEventListener() {}
	removeEventListener() {}
}

function makeSandbox() {
	const jar = {}, store = {};
	const document = {
		createElement: tag => (tag === 'canvas' ? new FakeCanvas() : { style: {}, addEventListener() {}, removeEventListener() {} }),
		getElementById: () => new FakeCanvas(),
		addEventListener() {}, removeEventListener() {},
		fonts: { add() {} },
		body: { appendChild() {}, removeChild() {} },
		get cookie() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); },
		set cookie(s) { const [pair] = String(s).split(';'); const i = pair.indexOf('='); jar[pair.slice(0, i).trim()] = pair.slice(i + 1); },
	};
	const sb = {
		console: { log() {}, info() {}, warn() {}, error: (...a) => console.error(...a) },
		setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, queueMicrotask, performance,
		document,
		navigator: { maxTouchPoints: 0, userAgent: 'node' },
		location: { search: '?api', href: 'http://localhost/index.html?api' },
		localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
		innerWidth: 640, innerHeight: 480, devicePixelRatio: 1,
		addEventListener() {}, removeEventListener() {},
		requestAnimationFrame: () => 0, cancelAnimationFrame() {},
		Image: FakeImage, HTMLImageElement: FakeImage, HTMLCanvasElement: FakeCanvas, Audio: FakeAudio,
		FontFace: class { constructor(n, u) { this.family = n; } load() { return Promise.resolve(this); } },
	};
	return sb;
}

let created = false;

// Corre en el contexto global de este proceso (o hilo): así los accesos a las variables globales del juego son rápidos, y
// por eso hay un solo juego por proceso o por hilo (para varios, ver worker.js)
async function createGame({ quiet = true, render = false } = {}) {
	if (created) throw new Error('Ya hay un juego cargado en este hilo: usá un hilo (worker) por partida');
	created = true;
	const sandbox = makeSandbox();
	for (const [k, v] of Object.entries(sandbox)) {
		if (k === 'console' || k === 'performance' || typeof globalThis[k] === 'function' && /^(setTimeout|clearTimeout|setInterval|clearInterval|setImmediate|queueMicrotask)$/.test(k)) continue;
		Object.defineProperty(globalThis, k, { value: v, writable: true, configurable: true, enumerable: true });
	}
	globalThis.window = globalThis; globalThis.self = globalThis;
	// El juego cuenta cada mapa que carga; con quiet (lo normal) esos mensajes no salen
	if (quiet) globalThis.console = { ...console, log() {}, info() {}, warn() {} };
	for (const file of SCRIPTS) {
		const code = file ? fs.readFileSync(path.join(ROOT, file), 'utf8') : INLINE;
		vm.runInThisContext(code, { filename: file || 'index.html' });
	}
	// game.js carga la fuente y el atlas de forma asíncrona
	for (let i = 0; i < 2000; i++) {
		if (globalThis.smbApi && globalThis.smbApi.ready()) {
			// Dibujar el mapa entero en cada cuadro es lo que más tarda y no cambia nada de lo que pasa: sin render se saltea
			if (!render) vm.runInThisContext(`for (const f of ${JSON.stringify(PURE_DRAW)}) smb[f] = () => {}; js2d.drawSprite = () => {};`);
			return globalThis.smbApi;
		}
		await new Promise(r => setTimeout(r, 5));
	}
	throw new Error('El juego no terminó de cargar');
}

module.exports = { createGame };
