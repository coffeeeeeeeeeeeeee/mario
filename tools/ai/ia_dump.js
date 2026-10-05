// Vuelca, en varias situaciones de los 32 niveles, la observación compacta (api.js) y lo que calcula ia.js con los pesos de una
// carpeta (modelo.json y modelo.bin), para que check_ia.py lo compare con Python.   node ia_dump.js <carpeta> [salida.json]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createGame } = require('./headless');

(async () => {
	const api = await createGame();
	const dir = process.argv[2];
	const meta = JSON.parse(fs.readFileSync(path.join(dir, 'modelo.json'), 'utf8'));
	const bin = fs.readFileSync(path.join(dir, 'modelo.bin'));
	globalThis.__meta = meta;
	globalThis.__buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
	vm.runInThisContext('SmbIA.setWeights(__meta, __buf)');
	const withMemory = meta.obsDim > 1072;
	let seed = 31;
	const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
	const episodes = [];
	for (const w of api.worlds()) {
		const r0 = api.reset({ world: w, seed: 3, size: episodes.length % 3 === 2 ? 'big' : 'small', obs: 'compact' });
		const ep = { world: w, x0: r0.m[0], w0: r0.w, steps: [], samples: [] };
		vm.runInThisContext('globalThis.__mem = SmbIA.newMemory()');
		let cur = r0;
		for (let i = 0; i < 260; i++) {
			// Igual que SmbIA.act: se mira (la memoria anota dónde está Mario), se calculan las entradas y se elige la acción
			vm.runInThisContext('SmbIA.remember(smb, __mem)');
			const a = [1, 2, 2, 3, 4, 4, 5, 0, 6, 11, 13][Math.floor(rnd() * 11)];
			if (i % 13 === 5) {
				const call = `SmbIA.features(smb, ${JSON.stringify(w)}${withMemory ? ', __mem' : ''})`;
				const f = vm.runInThisContext(call);
				const lg = vm.runInThisContext(`Array.from(SmbIA.logits(${call}))`);
				ep.samples.push({ t: i, obs: cur, js: Array.from(f), logits: lg });
			}
			vm.runInThisContext(`__mem.choose(${a})`);
			const r = api.step(a, 4, { obs: 'compact' });
			if (r.done) break;
			ep.steps.push([a, r.obs.m[0], r.obs.w]);
			cur = r.obs;
		}
		episodes.push(ep);
	}
	const actionsOk = JSON.stringify(vm.runInThisContext('SmbIA.ACTIONS')) === JSON.stringify(api.ACTIONS);
	fs.writeFileSync(process.argv[3] || path.join(dir, 'paridad.json'), JSON.stringify({ episodes, withMemory, actionsOk }));
})().catch(e => { console.error(e); process.exit(1); });
