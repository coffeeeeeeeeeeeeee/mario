// Servidor local para que un agente juegue: abre el juego en un Chrome sin ventana (index.html?api) y lo expone por HTTP.
//
//   cd tools/ai && npm install && node server.js        (CHROME_PATH si Chrome no está en /usr/bin/google-chrome)
//
//   GET  /api/info                       -> acciones y niveles
//   POST /api/reset  {world, seed, size, hard, env}      -> observación
//   POST /api/step   {action, repeat, env}               -> { obs, reward, done, info }
//   GET  /api/observe?env=0              -> observación actual
//   GET  /api/pixels?w=84&h=84&env=0     -> cuadro en grises
//
// "env" elige una partida independiente (cada una abre su propia página); sin él, la 0. Sólo escucha en 127.0.0.1.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
	if (process.env.PLAYWRIGHT_CORE) ({ chromium } = require(process.env.PLAYWRIGHT_CORE));
	else { console.error('Falta playwright-core: corré "npm install" en tools/ai (o poné PLAYWRIGHT_CORE con su ruta).'); process.exit(1); }
}

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = +(process.env.PORT || process.argv[2] || 8777);
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json' };

let browser;
const pages = new Map();
let queue = Promise.resolve();   // un pedido a la vez: las páginas no son reentrantes

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

async function handleApi(req, url, body) {
	const env = String(body.env ?? url.searchParams.get('env') ?? 0);
	const page = await pageFor(env);
	switch (url.pathname) {
		case '/api/info': return page.evaluate(() => ({ actions: smbApi.ACTIONS, buttons: smbApi.KEYS, worlds: smbApi.worlds() }));
		case '/api/reset': return page.evaluate(o => smbApi.reset(o), body);
		case '/api/step': return page.evaluate(({ action, repeat, left, right }) => smbApi.step(action ?? 0, repeat ?? 4, { left, right }), body);
		case '/api/observe': return page.evaluate(() => smbApi.observe());
		case '/api/pixels': return page.evaluate(([w, h]) => smbApi.pixels(w, h), [+(url.searchParams.get('w') || 84), +(url.searchParams.get('h') || 84)]);
		default: return null;
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
		queue = queue.then(async () => {
			try {
				const body = raw ? JSON.parse(raw) : {};
				const out = await handleApi(req, url, body);
				if (out === null) { res.writeHead(404); res.end('{"error":"ruta desconocida"}'); return; }
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(out));
			} catch (e) {
				res.writeHead(500, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: String(e.message || e) }));
			}
		});
	});
});

(async () => {
	browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });
	server.listen(PORT, '127.0.0.1', () => console.log(`Servidor listo en http://127.0.0.1:${PORT}  (POST /api/reset, POST /api/step)`));
})();

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { try { await browser.close(); } catch (e) {} process.exit(0); });
