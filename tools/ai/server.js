// Servidor local para que un agente juegue; expone el juego por HTTP. Hay dos formas de correrlo:
//
//   node server.js              sin navegador (lo normal): cada partida corre en un hilo de Node con headless.js, a unos
//                               14.000 cuadros por segundo por hilo y sin instalar nada más que playwright-core
//   node server.js --browser    en un Chrome sin ventana (index.html?api); más lento, pero da imágenes (CHROME_PATH si
//                               no está en /usr/bin/google-chrome)
//
//   GET  /api/info                       -> acciones y niveles
//   POST /api/reset  {world, seed, size, hard, obs, env} -> observación (obs: "full", "compact" o "none"; ver README)
//   POST /api/step   {action, repeat, obs, env}          -> { obs, reward, done, info }
//   GET  /api/observe?env=0              -> observación actual
//   GET  /api/pixels?w=84&h=84&env=0     -> cuadro en grises (sólo con --browser)
//
// Para entrenar con muchas partidas a la vez (cada una en su hilo, en paralelo):
//   POST /api/vreset {n, worlds, seeds, size, hard, obs}  -> lista de observaciones de las partidas 0 a n-1
//   POST /api/vstep  {actions, repeat, autoreset, obs}    -> lista de { obs, reward, done, info }, una por acción
//
// "env" elige una partida independiente; sin él, la 0. Sólo escucha en 127.0.0.1.
const http = require('http');
const fs = require('fs');
const path = require('path');

const { Worker } = require('worker_threads');

const BROWSER = process.argv.includes('--browser');
let chromium;
if (BROWSER) {
	try { ({ chromium } = require('playwright-core')); }
	catch (e) {
		if (process.env.PLAYWRIGHT_CORE) ({ chromium } = require(process.env.PLAYWRIGHT_CORE));
		else { console.error('Falta playwright-core: corré "npm install" en tools/ai (o poné PLAYWRIGHT_CORE con su ruta).'); process.exit(1); }
	}
}

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = +(process.env.PORT || process.argv.find(a => /^\d+$/.test(a)) || 8777);
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json' };

// Un backend ejecuta un método de la API (info, reset, step, observe, pixels) sobre una partida
let browser;
const pages = new Map();

async function pageFor(env) {
	if (pages.has(env)) return pages.get(env);
	const p = (async () => {
		const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
		page.on('pageerror', e => console.error(`[env ${env}] error de página:`, e.message));
		await page.goto(`http://127.0.0.1:${PORT}/index.html?api`);
		await page.waitForFunction(() => window.smbApi && window.smbApi.ready(), null, { timeout: 30000 });
		return page;
	})();
	pages.set(env, p);
	return p;
}

const browserBackend = {
	async start() { browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] }); },
	async stop() { await browser.close(); },
	async call(env, method, args) {
		const page = await pageFor(env);
		switch (method) {
			case 'info': return page.evaluate(() => ({ actions: smbApi.ACTIONS, buttons: smbApi.KEYS, worlds: smbApi.worlds() }));
			case 'reset': return page.evaluate(o => smbApi.reset(o), args[0]);
			case 'step': return page.evaluate(([action, repeat, opts]) => smbApi.step(action, repeat, opts), args);
			case 'observe': return page.evaluate(o => smbApi.observe(o), args[0] || {});
			case 'pixels': return page.evaluate(([w, h]) => smbApi.pixels(w, h), args);
		}
		throw new Error(`método desconocido: ${method}`);
	},
};

const workers = new Map(), pending = new Map();
let nextId = 1;

function workerFor(env) {
	if (workers.has(env)) return workers.get(env);
	const w = new Worker(path.join(__dirname, 'worker.js'));
	w.on('message', ({ id, result, error }) => {
		const p = pending.get(id);
		pending.delete(id);
		if (error) p.reject(new Error(error)); else p.resolve(result);
	});
	w.on('error', e => console.error(`[env ${env}] error del hilo:`, e));
	workers.set(env, w);
	return w;
}

const workerBackend = {
	async start() {},
	async stop() { await Promise.all([...workers.values()].map(w => w.terminate())); },
	call(env, method, args) {
		return new Promise((resolve, reject) => {
			const id = nextId++;
			pending.set(id, { resolve, reject });
			workerFor(env).postMessage({ id, method, args });
		});
	},
};

const backend = BROWSER ? browserBackend : workerBackend;

// Cada partida atiende un pedido a la vez, en orden; las distintas partidas corren en paralelo
const chains = new Map();
function onEnv(env, fn) {
	const run = (chains.get(env) || Promise.resolve()).then(fn, fn);
	chains.set(env, run.catch(() => {}));
	return run;
}

const lastReset = new Map();   // cómo se reinició cada partida, para el autoreset

function resetEnv(env, opts) {
	lastReset.set(env, opts);
	return onEnv(env, () => backend.call(env, 'reset', [opts]));
}

async function stepEnv(env, action, repeat, extra, autoreset) {
	const out = await onEnv(env, () => backend.call(env, 'step', [action ?? 0, repeat ?? 4, extra]));
	if (autoreset && out.done) {
		const opts = { ...(lastReset.get(env) || {}) };
		opts.seed = (opts.seed ?? 0) + 1;
		out.info.terminal_obs = out.obs;
		out.obs = await resetEnv(env, opts);
	}
	return out;
}

async function handleApi(url, body) {
	const env = String(body.env ?? url.searchParams.get('env') ?? 0);
	switch (url.pathname) {
		case '/api/info': return onEnv(env, () => backend.call(env, 'info', []));
		case '/api/reset': return resetEnv(env, body);
		case '/api/step': return stepEnv(env, body.action, body.repeat, { left: body.left, right: body.right, obs: body.obs }, body.autoreset);
		case '/api/observe': return onEnv(env, () => backend.call(env, 'observe', [{ obs: url.searchParams.get('obs') || body.obs }]));
		case '/api/pixels': return onEnv(env, () => backend.call(env, 'pixels', [+(url.searchParams.get('w') || 84), +(url.searchParams.get('h') || 84)]));
		case '/api/vreset': {
			const worlds = [].concat(body.worlds ?? body.world ?? '1-1');
			return Promise.all(Array.from({ length: body.n || 1 }, (_, i) =>
				resetEnv(String(i), { world: worlds[i % worlds.length], seed: body.seeds ? body.seeds[i] : (body.seed ?? 0) + i, size: body.size, hard: body.hard, obs: body.obs })));
		}
		case '/api/vstep':
			return Promise.all(body.actions.map((a, i) => stepEnv(String(i), a, body.repeat, { obs: body.obs }, body.autoreset)));
		default: return undefined;   // ruta desconocida (null es una respuesta válida: obs "none")
	}
}

function serveStatic(url, res) {
	let rel = decodeURIComponent(url.pathname);
	if (rel === '/') rel = '/index.html';
	const file = path.join(ROOT, rel);
	// Nada fuera del juego, y la carpeta tools (con la ROM y el desensamblado) no se sirve
	if (!file.startsWith(ROOT + path.sep) || rel.startsWith('/tools/') || rel.startsWith('/.git') || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
		res.writeHead(404); res.end('no encontrado'); return;
	}
	res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
	fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
	const url = new URL(req.url, 'http://127.0.0.1');
	if (!url.pathname.startsWith('/api/')) return serveStatic(url, res);
	let raw = '';
	req.on('data', c => { raw += c; });
	req.on('end', () => {
		(async () => {
			try {
				const body = raw ? JSON.parse(raw) : {};
				const out = await handleApi(url, body);
				if (out === undefined) { res.writeHead(404); res.end('{"error":"ruta desconocida"}'); return; }
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(out));
			} catch (e) {
				res.writeHead(500, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: String(e.message || e) }));
			}
		})();
	});
});

(async () => {
	await backend.start();
	server.listen(PORT, '127.0.0.1', () => console.log(`Servidor listo en http://127.0.0.1:${PORT} (${BROWSER ? 'con navegador' : 'sin navegador'}; POST /api/reset, POST /api/step)`));
})();

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { try { await backend.stop(); } catch (e) {} process.exit(0); });
