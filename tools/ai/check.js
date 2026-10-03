// Comprueba que el modo sin navegador no cambia lo que pasa en el juego: corre cada nivel con acciones sembradas, con y sin
// dibujo, y compara cuadro por cuadro. Conviene correrlo después de tocar mario.js (si alguna función de dibujo empieza a
// mover algo, las trazas dejan de coincidir).   node check.js [pasos por nivel]
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const STEPS = +(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a)) || 250);

async function run(render) {
	const { createGame } = require('./headless');
	const api = await createGame({ render });
	let seed = 12345;
	const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
	const out = {};
	for (const w of api.worlds()) {
		const h = crypto.createHash('md5');
		api.reset({ world: w, seed: 3 });
		for (let i = 0; i < STEPS; i++) {
			const a = [1, 2, 2, 3, 4, 4, 4, 5, 0, 6, 11, 12, 13][Math.floor(rnd() * 13)];
			const r = api.step(a, 4);
			h.update(JSON.stringify(r));
			if (r.done) api.reset({ world: w, seed: i });
		}
		out[w] = h.digest('hex').slice(0, 12);
	}
	process.stdout.write(JSON.stringify(out));
}

if (process.argv[2] === '--run') {
	run(process.argv[3] === 'render').catch(e => { console.error(e); process.exit(1); });
} else {
	const trace = mode => JSON.parse(execFileSync(process.execPath, [__filename, '--run', mode, String(STEPS)], { maxBuffer: 1 << 26 }).toString());
	const a = trace('render'), b = trace('norender');
	const bad = Object.keys(a).filter(w => a[w] !== b[w]);
	console.log(`${Object.keys(a).length} niveles x ${STEPS} pasos: ${bad.length ? 'DIFERENCIAS en ' + bad.join(', ') : 'iguales con y sin dibujo'}`);
	process.exit(bad.length ? 1 : 0);
}
