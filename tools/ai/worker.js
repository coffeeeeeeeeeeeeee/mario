// Un hilo con su propio juego (headless.js): el servidor le manda { id, method, args } y devuelve { id, result | error }
const { parentPort } = require('worker_threads');
const { createGame } = require('./headless');

const ready = createGame({ render: false });

parentPort.on('message', async ({ id, method, args }) => {
	try {
		const api = await ready;
		let result;
		switch (method) {
			case 'info': result = { actions: api.ACTIONS, buttons: api.KEYS, worlds: api.worlds() }; break;
			case 'reset': result = api.reset(args[0]); break;
			case 'step': result = api.step(...args); break;
			case 'observe': result = api.observe(); break;
			case 'pixels': throw new Error('smbApi.pixels no está en el modo sin navegador: arrancá el servidor con --browser');
			default: throw new Error(`método desconocido: ${method}`);
		}
		parentPort.postMessage({ id, result });
	} catch (e) {
		parentPort.postMessage({ id, error: String(e.message || e) });
	}
});
