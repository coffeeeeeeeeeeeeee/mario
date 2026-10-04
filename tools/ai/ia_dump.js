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
	let seed = 31;
	const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
	const samples = [];
	for (const w of api.worlds()) {
		api.reset({ world: w, seed: 3, size: samples.length % 3 === 2 ? 'big' : 'small', obs: 'none' });
		for (let i = 0; i < 260; i++) {
			const r = api.step([1, 2, 2, 3, 4, 4, 5, 0, 6, 11, 13][Math.floor(rnd() * 11)], 4, { obs: 'compact' });
			if (r.done) break;
			if (i % 13 === 5) {
				const f = vm.runInThisContext(`SmbIA.features(smb, ${JSON.stringify(w)})`);
				const lg = vm.runInThisContext(`Array.from(SmbIA.logits(SmbIA.features(smb, ${JSON.stringify(w)})))`);
				samples.push({ world: w, obs: r.obs, js: Array.from(f), logits: lg });
			}
		}
	}
	const actionsOk = JSON.stringify(vm.runInThisContext('SmbIA.ACTIONS')) === JSON.stringify(api.ACTIONS);
	fs.writeFileSync(process.argv[3] || path.join(dir, 'paridad.json'), JSON.stringify({ samples, actionsOk }));
})().catch(e => { console.error(e); process.exit(1); });
