// Dos comprobaciones de que la partida sólo depende de cómo se la arranca y de las acciones:
//  1. el modo sin navegador no cambia nada: cada nivel con acciones sembradas, con y sin dibujo, cuadro por cuadro;
//  2. no hay estado que pase de un episodio al siguiente: se graban episodios en los 32 niveles y se repiten, en orden inverso,
//     en una instancia nueva, y tienen que dar lo mismo.
// Conviene correrlo después de tocar mario.js o api.js (si alguna función de dibujo empieza a mover algo, o algo no se reinicia
// al empezar un nivel, las trazas dejan de coincidir).   node check.js [pasos por nivel]
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

// Grabar (record) o repetir (replay) episodios: 32 niveles, uno de ellos con Mario grande
async function history(mode) {
	const { createGame } = require('./headless');
	const api = await createGame();
	if (mode === 'record') {
		let seed = 99;
		const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
		const eps = [];
		for (const [i, w] of api.worlds().entries()) {
			const opts = { world: w, seed: i + 1, size: i % 3 === 2 ? 'big' : 'small' };
			api.reset({ ...opts, obs: 'none' });
			const actions = [];
			let last;
			for (let n = 0; n < Math.min(STEPS, 400); n++) {
				actions.push([1, 2, 2, 3, 4, 4, 4, 5, 0, 6, 10, 11, 13][Math.floor(rnd() * 13)]);
				last = api.step(actions[n], 4, { obs: 'none' });
				if (last.done) break;
			}
			eps.push({ opts, actions, x: last.info.x, reason: last.info.reason });
		}
		process.stdout.write(JSON.stringify(eps));
	} else {
		const eps = JSON.parse(require('fs').readFileSync(process.argv[5], 'utf8'));
		const bad = [];
		for (const e of [...eps].reverse()) {
			api.reset({ ...e.opts, obs: 'none' });
			let last;
			for (const a of e.actions) last = api.step(a, 4, { obs: 'none' });
			if (Math.abs(last.info.x - e.x) > 0.01 || last.info.reason !== e.reason) bad.push(e.opts.world);
		}
		process.stdout.write(JSON.stringify(bad));
	}
}

if (process.argv[2] === '--run') {
	run(process.argv[3] === 'render').catch(e => { console.error(e); process.exit(1); });
} else if (process.argv[2] === '--history') {
	history(process.argv[3]).catch(e => { console.error(e); process.exit(1); });
} else {
	const trace = mode => JSON.parse(execFileSync(process.execPath, [__filename, '--run', mode, String(STEPS)], { maxBuffer: 1 << 26 }).toString());
	const a = trace('render'), b = trace('norender');
	const bad = Object.keys(a).filter(w => a[w] !== b[w]);
	console.log(`${Object.keys(a).length} niveles x ${STEPS} pasos: ${bad.length ? 'DIFERENCIAS en ' + bad.join(', ') : 'iguales con y sin dibujo'}`);

	const file = require('path').join(require('os').tmpdir(), `smb-check-${process.pid}.json`);
	const recorded = execFileSync(process.execPath, [__filename, '--history', 'record', String(STEPS)], { maxBuffer: 1 << 26 });
	require('fs').writeFileSync(file, recorded);
	const diff = JSON.parse(execFileSync(process.execPath, [__filename, '--history', 'replay', String(STEPS), file], { maxBuffer: 1 << 26 }).toString());
	require('fs').unlinkSync(file);
	console.log(`32 episodios repetidos en otro orden: ${diff.length ? 'DIFERENCIAS en ' + diff.join(', ') : 'iguales (nada pasa de un episodio al siguiente)'}`);
	process.exit(bad.length || diff.length ? 1 : 0);
}
