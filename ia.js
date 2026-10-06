// La IA entrenada dentro del juego: calcula, con los pesos que exporta tools/ai/export_model.py (assets/ia/), qué botones apretar.
// El título la usa cuando pasó mucho tiempo sin que nadie toque nada (mario.js, startDemo). Hace lo mismo que en el entrenamiento
// (tools/ai/smb_sb3.py): mira la grilla de celdas alrededor de Mario, su estado y los enemigos más cercanos, y una red de dos capas
// escondidas con tanh elige entre 14 combinaciones de botones.
//
// Los modelos nuevos tienen además memoria (19 entradas más, ver Memory más abajo); los viejos, entrenados sin ella, siguen andando.
//
// La observación tiene que ser idéntica a la de api.js (observeCompact) y smb_sb3.featurize: tools/ai/check.js lo comprueba.
const SmbIA = (() => {
	const ACTIONS = [
		[], ['right'], ['right', 'jump'], ['right', 'run'], ['right', 'run', 'jump'], ['jump'], ['left'],
		['left', 'jump'], ['left', 'run'], ['left', 'run', 'jump'], ['down'], ['fire'], ['right', 'run', 'fire'], ['right', 'run', 'jump', 'fire'],
	];
	const KEYS = { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', jump: 'ArrowUp', run: 'ShiftLeft', fire: 'Space' };
	const COLS = 16, LEFT = 5, ROWS = 13, N_ENEMIES = 6;
	const BASE_DIM = 5 * ROWS * COLS + 8 + N_ENEMIES * 4, MEM_DIM = ACTIONS.length + 5;
	const round2 = v => Math.round(v * 100) / 100;

	let net = null;   // { layers: [{ nIn, nOut, act, w: Float32Array, b: Float32Array }], obsDim, meta }

	// Pesos: modelo.json (la forma) y modelo.bin (los números, float32 en orden: pesos y sesgos de cada capa)
	function setWeights(meta, buffer) {
		const all = new Float32Array(buffer);
		let at = 0;
		const layers = meta.layers.map(l => {
			const w = all.subarray(at, at += l.in * l.out), b = all.subarray(at, at += l.out);
			return { nIn: l.in, nOut: l.out, act: l.act, w, b };
		});
		if (at !== all.length) throw new Error(`modelo.bin no coincide con modelo.json (${all.length} números, se esperaban ${at})`);
		if (meta.obsDim !== BASE_DIM && meta.obsDim !== BASE_DIM + MEM_DIM) throw new Error(`la red espera ${meta.obsDim} entradas y ia.js arma ${BASE_DIM} (o ${BASE_DIM + MEM_DIM} con memoria)`);
		net = { layers, obsDim: meta.obsDim, meta };
	}

	// Los pesos vienen en assets/ia/modelo.js (un script con SMB_IA_MODEL, en base64): un script se puede cargar aunque el juego se abra
	// directamente desde la carpeta (file://), donde el navegador no deja leer archivos con fetch. Si no está, se prueba con modelo.json y
	// modelo.bin (sólo sirve con un servidor). Cualquier falla queda en `error` y en la consola, y el título usa el demo grabado.
	let error = null;
	async function load(base = 'assets/ia/') {
		try {
			if (typeof SMB_IA_MODEL !== 'undefined') {
				const text = atob(SMB_IA_MODEL.data), bytes = new Uint8Array(text.length);
				for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
				setWeights(SMB_IA_MODEL.meta, bytes.buffer);
			} else {
				const probe = await fetch(base + 'modelo.json');
				if (!probe.ok) throw new Error('falta assets/ia/modelo.js (se genera con ./entrenar.sh exportar)');
				const [meta, bin] = await Promise.all([probe.json(), fetch(base + 'modelo.bin').then(r => r.arrayBuffer())]);
				setWeights(meta, bin);
			}
			error = null;
			return net.meta;
		} catch (e) {
			error = String(e.message || e);
			console.warn('[IA] No se pudieron cargar los pesos de la IA; el título usa el demo grabado. Motivo: ' + error);
			throw e;
		}
	}

	// Qué hay en cada celda: 0 vacío, 1 sólido, 2 bloque que se golpea, 3 moneda, 4 meta (mástil, hacha o boca de un caño que lleva
	// a otro nivel). Los bloques ocultos no se ven.
	function cellCode(id) {
		if (!id || HIDDEN_BLOCKS.has(id)) return 0;
		if (isCoinMetatile(id)) return 3;
		if (id === MT.Flagpole || id === MT.FlagpoleTop || id === MT.Axe) return 4;
		if (isBumpableMetatile(id)) return 2;
		return isSolidMetatile(id) ? 1 : 0;
	}

	// Celdas de la boca de los caños que llevan a otro de los 32 niveles (distinto del nivel principal en que está Mario)
	let goalCache = { map: null, mainWorld: null, cells: null, mazeKey: null };
	function goalCells(smb, mainWorld) {
		const m = smb.currentMap, mz = smb.mazeGoal();
		if (goalCache.map !== m || goalCache.mainWorld !== mainWorld || goalCache.mazeKey !== (mz ? mz.key : null)) {
			const w = m.dimensions.width, cells = new Set();
			for (const wp of m.warps || []) {
				if (!(smb.availableWorlds.includes(wp.to) && wp.to !== '0-0' && wp.to !== mainWorld)) continue;
				if (wp.type === 'right') { cells.add(wp.y * w + wp.x); cells.add((wp.y + 1) * w + wp.x); }
				else if (wp.type === 'down') { cells.add(wp.y * w + wp.x); cells.add(wp.y * w + wp.x + 1); }
			}
			if (mz) for (const c of mz.cells) cells.add(c);   // los niveles con laberinto suman lo que marca el motor (ver smb.mazeGoal)
			goalCache = { map: m, mainWorld, cells, mazeKey: mz ? mz.key : null };
		}
		return goalCache.cells;
	}

	// Lo que la red recuerda de un episodio: la última acción que eligió, hace cuánto no avanza, cuánto retrocedió respecto de lo más
	// lejos que llegó y cuánto se movió en los últimos 8 y 32 pasos. Es la misma cuenta que Memory de tools/ai/smb_sb3.py. Se llama a
	// see() en cada decisión, antes de calcular las entradas, y a choose() con la acción elegida. Al cambiar de nivel se olvida la
	// posición, no la última acción.
	class Memory {
		constructor() { this.prev = null; this.world = null; this.best = 0; this.since = 0; this.hist = []; }
		see(x, world) {
			if (world !== this.world) { this.world = world; this.best = x; this.since = 0; this.hist = [x]; return; }
			this.hist.push(x);
			if (this.hist.length > 33) this.hist.shift();
			if (x > this.best + 0.5) { this.best = x; this.since = 0; } else this.since++;
		}
		choose(action) { this.prev = action; }
		features() {
			const out = new Float32Array(MEM_DIM), h = this.hist, x = h[h.length - 1], clip = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
			if (this.prev !== null) out[this.prev] = 1;
			const n = ACTIONS.length;
			out[n] = Math.min(this.since / 32, 1); out[n + 1] = Math.min(this.since / 200, 1); out[n + 2] = clip((this.best - x) / 64, 0, 2);
			out[n + 3] = clip((x - h[Math.max(0, h.length - 9)]) / 32, -2, 2); out[n + 4] = clip((x - h[Math.max(0, h.length - 33)]) / 64, -2, 2);
			return out;
		}
	}

	// Mira dónde está Mario y lo anota en la memoria (lo mismo que ve el entrenamiento: la x redondeada de la observación)
	function remember(smb, memory) {
		const p = smb.engine.animatedSprites[smb.currentPlayerSpriteName()];
		memory.see(round2((p.position.x - smb.mapOffset.x) / smb.tileScale), smb.currentMap.world);
	}

	// El vector que entra a la red (1072 números, o 1091 con memoria): la grilla en one-hot por clase (5 x 13 x 16), el estado de Mario (8) y los 6
	// enemigos más cercanos (4 cada uno). Igual que api.js (observeCompact) más smb_sb3.featurize.
	function features(smb, mainWorld, memory = null) {
		const k = smb.tileScale, top = smb.tileToScreen(0, 0).y;
		const p = smb.engine.animatedSprites[smb.currentPlayerSpriteName()];
		const m = smb.currentMap, w = m.dimensions.width;
		const x = (p.position.x - smb.mapOffset.x) / k;
		const col0 = Math.floor((x + 8) / 16) - LEFT;
		const goal = goalCells(smb, mainWorld);
		const out = new Float32Array(BASE_DIM + (memory ? MEM_DIM : 0));
		for (let r = 2; r < 2 + ROWS; r++) {
			for (let c = col0; c < col0 + COLS; c++) {
				const code = c < 0 || c >= w ? 0 : goal.has(r * w + c) ? 4 : cellCode(m.map[r * w + c]);
				out[code * ROWS * COLS + (r - 2) * COLS + (c - col0)] = 1;
			}
		}
		const mx = round2(x), my = round2((p.position.y - top) / k), mh = smb.playerHeightPx() / k;
		const vx = round2(smb.xSpeed / 4096), vy = round2(smb.velocityY / k);
		const size = smb.playerSize, facing = smb.facingDir;
		let i = 5 * ROWS * COLS;
		out[i++] = vx / 4; out[i++] = vy / 4; out[i++] = smb.isOnGround ? 1 : 0; out[i++] = size === 1 ? 1 : 0; out[i++] = size === 2 ? 1 : 0;
		out[i++] = facing; out[i++] = my / 240; out[i++] = mh / 32;
		const cx = mx + 16 / 2, cy = my + mh / 2;
		const near = [];
		for (const e of smb.enemies || []) {
			if (e.dead || e.active === false) continue;
			const rect = smb.enemyScreenRect(e);
			if (!rect) continue;
			const ex = (rect.x - smb.mapOffset.x) / k;
			if (ex + rect.w / k < x - 16 * (LEFT + 2) || ex > x + 16 * (10 + 2)) continue;
			near.push([round2(ex), round2((rect.y - top) / k), round2(rect.w / k), round2(rect.h / k)]);
		}
		near.sort((a, b) => Math.abs(a[0] + a[2] / 2 - cx) - Math.abs(b[0] + b[2] / 2 - cx));
		for (const [ex, ey, ew, eh] of near.slice(0, N_ENEMIES)) {
			out[i++] = (ex + ew / 2 - cx) / 128; out[i++] = (ey + eh / 2 - cy) / 128; out[i++] = ew / 16; out[i++] = 1;
		}
		if (memory) out.set(memory.features(), BASE_DIM);
		return out;
	}

	// La red: capa tras capa, y al final los 14 valores (uno por combinación de botones)
	function logits(x) {
		let cur = x;
		for (const L of net.layers) {
			const y = new Float32Array(L.nOut);
			for (let o = 0; o < L.nOut; o++) {
				let s = L.b[o];
				const base = o * L.nIn;
				for (let j = 0; j < L.nIn; j++) s += L.w[base + j] * cur[j];
				y[o] = L.act === 'tanh' ? Math.tanh(s) : s;
			}
			cur = y;
		}
		return cur;
	}

	// Elige una combinación de botones. Como en el entrenamiento, se sortea según las probabilidades que da la red (con temperature
	// menor que 1 se parece más a elegir siempre la mejor); sin sortear (random = null) elige la de mayor valor
	function pick(lg, random = Math.random, temperature = 1) {
		if (!random) { let best = 0; for (let i = 1; i < lg.length; i++) if (lg[i] > lg[best]) best = i; return best; }
		let mx = -Infinity; for (const v of lg) mx = Math.max(mx, v);
		const pr = Array.from(lg, v => Math.exp((v - mx) / temperature)), sum = pr.reduce((a, b) => a + b, 0);
		let r = random() * sum;
		for (let i = 0; i < pr.length; i++) { r -= pr[i]; if (r <= 0) return i; }
		return pr.length - 1;
	}

	// Aprieta (en las teclas del motor) la combinación elegida
	function press(smb, action) {
		const on = new Set(ACTIONS[action]);
		for (const [name, code] of Object.entries(KEYS)) smb.engine.keysPressed[code] = on.has(name);
	}

	function release(smb) {
		for (const code of Object.values(KEYS)) smb.engine.keysPressed[code] = false;
	}

	return {
		ACTIONS, KEYS, load, setWeights, features, logits, pick, press, release, remember,
		newMemory: () => new Memory(),
		get ready() { return !!net; }, get meta() { return net && net.meta; }, get error() { return error; },
		// Un paso completo: mira, calcula y aprieta. Si la red tiene memoria hay que pasar opts.memory (SmbIA.newMemory(), uno por episodio)
		act(smb, mainWorld, opts = {}) {
			const mem = net.obsDim > BASE_DIM ? opts.memory : null;
			if (net.obsDim > BASE_DIM) {
				if (!mem) throw new Error('esta red tiene memoria: falta opts.memory (SmbIA.newMemory())');
				remember(smb, mem);
			}
			const a = pick(logits(features(smb, mainWorld, mem)), opts.deterministic ? null : Math.random, opts.temperature ?? 1);
			if (mem) mem.choose(a);
			press(smb, a);
			return a;
		},
	};
})();
