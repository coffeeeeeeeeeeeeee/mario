// API para que un agente (una IA) juegue. Se activa con ?api en la URL (index.html?api) y no hace nada si no está.
//
// En este modo el juego no corre solo: cada llamada a step() avanza cuadros de 1/60 s exactos, así que la partida es
// determinista (mismo nivel, misma semilla y mismas acciones dan siempre lo mismo) y puede ir más rápido que el tiempo real.
// El sonido se apaga. Todas las posiciones están en píxeles lógicos (16 px = una celda), con y = 0 en el borde de arriba del
// mapa (las dos primeras filas son la barra de estado; el juego se ve de la fila 2 a la 14).
//
//   smbApi.reset({ world: '1-1', seed: 7, size: 'small' })  -> observación inicial
//   smbApi.step(2, 4)                                         -> { obs, reward, done, info } tras 4 cuadros con la acción 2
//
// Acciones: un número de smbApi.ACTIONS, una lista de botones (['right', 'jump']) o un objeto ({ right: true, jump: true }).
// Botones: left, right, down, jump, run, fire.
(() => {
	if (!/[?&]api(&|=|$)/.test(location.search)) return;
	window.smbManual = true;   // game.js deja de llamar a update() por su cuenta

	// El sonido no sirve acá y los jingles con callback atarían la partida al tiempo real
	js2d.playAudio = () => {};
	js2d.playAudioOverlap = () => {};

	const FRAME = PHYSICS_STEP_MS;
	const KEYS = { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', jump: 'ArrowUp', run: 'ShiftLeft', fire: 'Space' };
	const ACTIONS = [
		[],                                  // 0 nada
		['right'],                           // 1
		['right', 'jump'],                   // 2
		['right', 'run'],                    // 3
		['right', 'run', 'jump'],            // 4
		['jump'],                            // 5
		['left'],                            // 6
		['left', 'jump'],                    // 7
		['left', 'run'],                     // 8
		['left', 'run', 'jump'],             // 9
		['down'],                            // 10 (agacharse y entrar a los caños)
		['fire'],                            // 11
		['right', 'run', 'fire'],            // 12
		['right', 'run', 'jump', 'fire'],    // 13
	];

	const SIZES = { small: Player_Size.Small, big: Player_Size.Big, fire: Player_Size.Fire };
	const SIZE_NAME = { [Player_Size.Small]: 'small', [Player_Size.Big]: 'big', [Player_Size.Fire]: 'fire' };

	const sprite = () => js2d.animatedSprites[smb.currentPlayerSpriteName()];
	const worldTop = () => smb.tileToScreen(0, 0).y;
	const round = v => Math.round(v * 100) / 100;

	// Mismo generador que usa el juego para el azar, sembrado a partir de un número
	function seedRandom(seed) {
		if (seed === undefined) { smb.lfsr.set([0xa5, 0, 0, 0, 0, 0, 0]); return; }   // el estado de arranque del juego
		let a = seed >>> 0;
		const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) & 0xff; };
		for (let i = 0; i < 7; i++) smb.lfsr[i] = next();
		if (!smb.lfsr.some(b => b)) smb.lfsr[0] = 0xa5;
	}

	function pressed(action) {
		let names;
		if (typeof action === 'number') names = ACTIONS[action] ?? [];
		else if (Array.isArray(action)) names = action;
		else names = Object.keys(action || {}).filter(n => action[n]);
		const on = new Set(names);
		for (const [name, code] of Object.entries(KEYS)) js2d.keysPressed[code] = on.has(name);
	}

	// Qué hay en cada celda, para el agente: 0 vacío, 1 sólido (suelo, bloque duro, caño, bloque usado), 2 bloque que se golpea
	// (ladrillo o de interrogación), 3 moneda, 4 meta (el mástil, el hacha o la boca del caño que lleva a otro nivel; tocarla
	// completa el nivel). Los bloques ocultos no se ven, como para el jugador.
	function cellCode(id) {
		if (!id || HIDDEN_BLOCKS.has(id)) return 0;
		if (isCoinMetatile(id)) return 3;
		if (id === MT.Flagpole || id === MT.FlagpoleTop || id === MT.Axe) return 4;
		if (isBumpableMetatile(id)) return 2;
		return isSolidMetatile(id) ? 1 : 0;
	}

	// Lo que el agente ve alrededor de Mario: la grilla de celdas (13 filas, de la 2 a la 14 del mapa) y los enemigos cercanos
	function nearbyEnemies(x, left, right, top) {
		const k = smb.tileScale, out = [];
		for (const e of smb.enemies || []) {
			if (e.dead || e.active === false) continue;
			const rect = smb.enemyScreenRect(e);
			if (!rect) continue;
			const ex = (rect.x - smb.mapOffset.x) / k;
			if (ex + rect.w / k < x - 16 * (left + 2) || ex > x + 16 * (right + 2)) continue;
			out.push([e, round(ex), round((rect.y - top) / k), round(rect.w / k), round(rect.h / k)]);
		}
		return out;
	}

	// Un caño que lleva a otro de los 32 niveles (el del final de los niveles de agua y del 1-2, las zonas de atajos) completa el
	// nivel actual; las salas secretas, y volver de ellas, no
	const leadsToNextLevel = wp => !!wp && mainLevels.has(wp.to) && wp.to !== mainWorld;

	// Celdas de la boca de esos caños (arriba, de 2 de ancho, si se entra por arriba; a la izquierda, de 2 de alto, si se entra de lado)
	// y, para la recompensa por acercarse, los puntos (centro de cada celda, en px lógicos) de todas las metas del nivel: esos
	// caños, el mástil y el hacha
	let goalCache = { map: null, mainWorld: null, cells: null, points: null };
	function goalData() {
		const m = smb.currentMap;
		if (goalCache.map !== m || goalCache.mainWorld !== mainWorld) {
			const w = m.dimensions.width, cells = new Set(), points = [];
			for (const wp of m.warps || []) {
				if (!leadsToNextLevel(wp)) continue;
				if (wp.type === 'right') { cells.add(wp.y * w + wp.x); cells.add((wp.y + 1) * w + wp.x); }
				else if (wp.type === 'down') { cells.add(wp.y * w + wp.x); cells.add(wp.y * w + wp.x + 1); }
			}
			for (const i of cells) points.push([(i % w) * 16 + 8, Math.floor(i / w) * 16 + 8]);
			for (let i = 0; i < m.map.length; i++) {
				if (m.map[i] === MT.Flagpole || m.map[i] === MT.FlagpoleTop) points.push([(i % w) * 16 + 8, Math.floor(i / w) * 16 + 8]);
			}
			if (m.axe) points.push([m.axe.x * 16 + 8, m.axe.y * 16 + 8]);
			goalCache = { map: m, mainWorld, cells, points };
		}
		return goalCache;
	}
	// En los niveles con laberinto se suman las celdas que marca el motor (smb.mazeGoal): el suelo del próximo punto y los caños que adelantan
	function goalCells() {
		const d = goalData(), mz = smb.mazeGoal();
		if (!mz) return d.cells;
		if (d.mazeKey !== mz.key) { d.mazeKey = mz.key; d.withMaze = new Set([...d.cells, ...mz.cells]); }
		return d.withMaze;
	}

	function observeFull(opts) {
		const k = smb.tileScale, top = worldTop();
		const p = sprite();
		const m = smb.currentMap;
		const w = m.dimensions.width;
		const left = opts.left ?? 5, right = opts.right ?? 10;
		const x = (p.position.x - smb.mapOffset.x) / k;
		const col0 = Math.floor((x + 8) / 16) - left;
		const goal = goalCells();
		const grid = [];
		for (let r = 2; r < 15; r++) {
			const row = [];
			for (let c = col0; c <= col0 + left + right; c++) row.push(c < 0 || c >= w ? 0 : goal.has(r * w + c) ? 4 : cellCode(m.map[r * w + c]));
			grid.push(row);
		}
		const enemies = nearbyEnemies(x, left, right, top).map(([e, ex, ey, ew, eh]) => ({ type: e.type, color: e.color ?? null, state: e.state ?? null, x: ex, y: ey, w: ew, h: eh, dir: e.dir ?? e.vx ?? 0 }));
		const platforms = (smb.platforms || []).map(pl => ({ x: round(pl.x), y: round(pl.y + 32), w: round(pl.w), kind: pl.kind }))
			.filter(pl => pl.x + pl.w >= x - 16 * (left + 2) && pl.x <= x + 16 * (right + 2));
		const powerups = (smb.activePowerups || []).map(u => ({ type: u.type, x: round(u.x / k), y: round((u.y - top) / k) }));
		return {
			world: m.world, frame: smb.frameCount, time: smb.time, state: smb.state, coins: smb.coins, score: smb.score, lives: smb.lives,
			mario: {
				x: round(x), y: round((p.position.y - top) / k), w: 16, h: smb.playerHeightPx() / k,
				vx: round(smb.xSpeed / 4096), vy: round(smb.velocityY / k),
				onGround: !!smb.isOnGround, size: SIZE_NAME[smb.playerSize], facing: smb.facingDir, climbing: !!smb.climbVine,
				water: !!smb.isWater, star: smb.starTimer > 0,
			},
			camera: round(-smb.mapOffset.x / k),
			grid: { left, right, col: col0, row: 2, cells: grid },
			enemies, platforms, powerups,
		};
	}

	// Lo mismo en arreglos, que pesan mucho menos al pasar por JSON (ver README):
	//   w nivel, f cuadro, t tiempo, s puntos, c monedas, l vidas, st estado del juego, cam cámara
	//   m  [x, y, ancho, alto, vx, vy, suelo (0/1), tamaño (0 chico, 1 grande, 2 fuego), mira a (1 o -1), banderas (1 trepa, 2 agua, 4 estrella)]
	//   g  la grilla como texto de 13 x (left + right + 1) dígitos, fila por fila, y gc la columna de la primera celda
	//   e  enemigos [tipo, color, x, y, ancho, alto, dir, estado]    p  plataformas [x, y, ancho, tipo]    u  hongos y flores [tipo, x, y]
	function observeCompact(opts) {
		const k = smb.tileScale, top = worldTop();
		const p = sprite();
		const m = smb.currentMap;
		const w = m.dimensions.width;
		const left = opts.left ?? 5, right = opts.right ?? 10;
		const x = (p.position.x - smb.mapOffset.x) / k;
		const col0 = Math.floor((x + 8) / 16) - left;
		const goal = goalCells();
		let g = '';
		for (let r = 2; r < 15; r++) {
			for (let c = col0; c <= col0 + left + right; c++) g += c < 0 || c >= w ? '0' : goal.has(r * w + c) ? 4 : cellCode(m.map[r * w + c]);
		}
		const e = nearbyEnemies(x, left, right, top).map(([en, ex, ey, ew, eh]) => [en.type, en.color ?? null, ex, ey, ew, eh, en.dir ?? en.vx ?? 0, en.state ?? null]);
		const pl = [];
		for (const q of smb.platforms || []) if (q.x + q.w >= x - 16 * (left + 2) && q.x <= x + 16 * (right + 2)) pl.push([round(q.x), round(q.y + 32), round(q.w), q.kind]);
		const u = (smb.activePowerups || []).map(o => [o.type, round(o.x / k), round((o.y - top) / k)]);
		return {
			w: m.world, f: smb.frameCount, t: smb.time, s: smb.score, c: smb.coins, l: smb.lives, st: smb.state, cam: round(-smb.mapOffset.x / k),
			m: [round(x), round((p.position.y - top) / k), 16, smb.playerHeightPx() / k, round(smb.xSpeed / 4096), round(smb.velocityY / k),
				smb.isOnGround ? 1 : 0, smb.playerSize, smb.facingDir, (smb.climbVine ? 1 : 0) | (smb.isWater ? 2 : 0) | (smb.starTimer > 0 ? 4 : 0)],
			g, gc: col0, e, p: pl, u,
		};
	}

	// opts.obs: 'full' (lo normal), 'compact' (arreglos, mucho más liviano) o 'none' (sólo recompensa y fin, lo más rápido)
	function observe(opts = {}) {
		if (opts.obs === 'none') return null;
		return opts.obs === 'compact' ? observeCompact(opts) : observeFull(opts);
	}

	function tick(n) {
		for (let i = 0; i < n; i++) update(FRAME);
	}

	let last = null;   // lo que se mide para la recompensa
	let shapingWeight = 0;   // peso de la recompensa por acercarse a la meta (opts.shaping de reset); 0: sin ella
	// opts.reward de reset: 'signed' (lo de siempre: cada px que avanza suma y cada px que retrocede resta) o 'best' (sólo suma lo que
	// pasa de lo más lejos que llegó, y de lo más cerca de la meta). Con 'best' retroceder para tomar carrera cuesta sólo el reloj
	let rewardBest = false, bestX = 0, bestD = Infinity, mazeKey = null;   // mazeKey: cuál es la meta del laberinto de ahora (si cambia, la distancia deja de ser comparable)
	let mainWorld = null;   // el último de los 32 niveles en que estuvo (las salas secretas no cuentan)
	let mainLevels = new Set();

	// Distancia (px lógicos) del centro de Mario a la meta más cercana; Infinity si el nivel no tiene ninguna a la vista
	function goalDistance(x, y) {
		let pts = goalData().points;
		const cx = x + 8, cy = y + smb.playerHeightPx() / smb.tileScale / 2;
		const mz = smb.mazeGoal();
		// En el laberinto sólo cuentan las metas que están por delante: los caños que ya pasó no son un destino
		if (mz) pts = pts.concat(mz.points).filter(([gx]) => gx >= cx - 8);
		if (!pts.length) return Infinity;
		let best = Infinity;
		for (const [gx, gy] of pts) best = Math.min(best, Math.hypot(gx - cx, gy - cy));
		return best;
	}

	function snapshot() {
		const p = sprite();
		const x = (p.position.x - smb.mapOffset.x) / smb.tileScale, y = (p.position.y - worldTop()) / smb.tileScale;
		return { world: smb.currentMap.world, x, time: smb.time, score: smb.score, d: goalDistance(x, y) };
	}

	function reset(opts = {}) {
		const idx = smb.availableWorlds.indexOf(opts.world ?? '1-1');
		if (idx < 0) throw new Error(`No existe el nivel ${opts.world}`);
		pressed([]);
		smb.difficulty = opts.hard ? 'HARD' : 'NORMAL';
		// El generador de azar se siembra antes de cargar el nivel: algunos enemigos (los paratroopas que saltan) toman de él su
		// primer tiempo al crearse, y si no el episodio dependería de lo que se jugó antes
		seedRandom(opts.seed);
		smb.currentWorldIndex = idx;
		mainLevels = new Set(smb.availableWorlds.filter(n => n !== '0-0'));
		mainWorld = opts.world ?? '1-1';
		shapingWeight = opts.shaping ?? 0;
		rewardBest = opts.reward === 'best';
		smb.selectPlayer(opts.player ?? 0);
		// La pantalla negra del principio no se espera
		for (let i = 0; i < 600 && smb.state !== Game_State.Playing; i++) {
			if (smb.state === Game_State.Black_Screen) smb.screenTimer = smb.screenDuration + 1;
			tick(1);
		}
		if (smb.state !== Game_State.Playing) throw new Error(`No se pudo empezar el nivel (estado ${smb.state})`);
		// Los contadores de cuadros y de tiempo siguen de un episodio al siguiente; en cero, el episodio sólo depende de cómo se
		// reinició (el juego usa la paridad del contador para, por ejemplo, la dirección con que aparecen algunos enemigos)
		smb.growTimer = 0; smb.invincibleTimer = 0; smb.deathTimer = 0; smb.jumpOriginY = 0; smb.frameCount = 0; smb.intervalCtl = 0; smb.intervalTicks = 0; smb.clockMs = 0; smb.physicsAccumulator = 0; smb.coinAnimAcc = 0; smb.pakkunAnimAcc = 0; smb.musicResumeAt = 0;
		if (opts.size && opts.size !== 'small') {
			smb.playerSize = SIZES[opts.size] ?? Player_Size.Small;
			if (smb.playerSize > Player_Size.Small) {
				// Mario grande nace un cuadro más alto: se lo apoya donde estaba parado
				const small = js2d.animatedSprites[PlayerName[smb.player]], big = sprite();
				big.position.x = small.position.x; big.position.y = small.position.y - smb.tileSize;
			}
		}
		if (opts.startFrac > 0) startMidLevel(opts.startFrac);
		tick(1);
		last = snapshot();
		bestX = last.x; bestD = last.d; mazeKey = smb.mazeGoal()?.key ?? null;
		return observe(opts);
	}

	// Empieza en el medio del nivel: se busca, desde la fracción pedida (0 a 1) del largo hacia adelante, la primera página donde
	// Mario puede caer al suelo desde arriba sin atravesar nada ni caer a un pozo. Así los episodios también pasan por lugares que
	// piden retroceder para tomar carrera, que desde el principio casi no se ven
	function startMidLevel(frac) {
		const m = smb.currentMap, w = m.dimensions.width, pages = Math.floor(w / 16);
		const solid = (c, r) => isSolidMetatile(m.map[r * w + c]);
		const k = smb.tileScale, ts = smb.tileSize;
		for (let page = Math.min(pages - 3, Math.max(1, Math.floor(pages * frac))); page < pages - 3; page++) {
			const col = page * 16 + 2;   // donde cae Mario: a 2,5 celdas del borde izquierdo de la pantalla
			let ground = -1;
			for (let r = 3; r < 14 && ground < 0; r++) if (solid(col, r) || solid(col + 1, r)) ground = r;
			// Libre de cabeza a pies (filas 3 a la del suelo) y con suelo firme debajo de las dos celdas
			if (ground < 8 || ground > 13 || !solid(col, ground) || !solid(col + 1, ground)) continue;
			let free = true;
			for (let r = 3; r < ground; r++) if (solid(col, r) || solid(col + 1, r) || isHazard(m.map[r * w + col])) free = false;
			if (!free) continue;
			smb.mapOffset.x = -(page * 16 * ts); smb.maxMapOffsetX = smb.mapOffset.x;
			sprite().position.x = 2.5 * ts;
			return page;
		}
		return 0;
	}
	const isHazard = id => id === MT.Flagpole || id === MT.FlagpoleTop;

	function step(action, repeat = 4, opts = {}) {
		if (!last) throw new Error('Falta llamar a reset()');
		let reward = 0, shaped = 0, done = false, reason = null, flag = false;
		const startTime = last.time;
		for (let i = 0; i < repeat; i++) {
			pressed(action);
			tick(1);
			const now = snapshot();
			const st = smb.state;
			// Avanzar en x es lo que se premia; un salto de más de 48 px en un paso (el laberinto que devuelve a Mario, un caño) no cuenta
			const dx = now.x - last.x;
			// Al cambiar la meta del laberinto (pasó un punto, o lo devolvieron) la distancia salta: ese cuadro no suma por acercarse
			const mk = smb.mazeGoal()?.key ?? null, mazeChanged = mk !== mazeKey;
			mazeKey = mk;
			if (mazeChanged) bestD = now.d;
			if (now.world === last.world && Math.abs(dx) <= 48) {
				if (rewardBest) { if (now.x > bestX) { reward += now.x - bestX; bestX = now.x; } }
				else reward += dx;
				// Recompensa por acercarse a la meta (distancia en x e y): guía también al llegar a un caño de lado o a un hacha
				if (shapingWeight && !mazeChanged && Number.isFinite(last.d) && Number.isFinite(now.d)) {
					if (rewardBest) { if (now.d < bestD) { shaped += shapingWeight * (bestD - now.d); bestD = now.d; } }
					else shaped += shapingWeight * (last.d - now.d);
				}
			} else if (now.world !== last.world || dx > 48) { bestX = now.x; bestD = now.d; }   // otro nivel o un salto hacia adelante (un caño): se cuenta de nuevo desde ahí
			// Un salto hacia atrás en el mismo nivel (el laberinto devuelve a Mario cuatro páginas) no reinicia el récord: volver a recorrer
			// lo que ya recorrió no suma, y así fallar el cruce cuesta lo que se tarda en recuperarlo
			// Pasar a otro nivel de los 32 (el caño del final de los niveles de agua, una zona de atajos) cuenta como completar el
			// actual; entrar a una sala secreta, o volver de ella, no
			const nextMain = now.world !== last.world && mainLevels.has(now.world) && now.world !== mainWorld;
			// Entrar a uno de esos caños cuenta desde que Mario empieza a bajar o a meterse, no recién cuando carga el otro nivel
			const intoExit = st === Game_State.Pipe_Transition && smb.pipeTransition && smb.pipeTransition.phase === 'enter' && leadsToNextLevel(smb.pipeTransition.warp);
			if (mainLevels.has(now.world)) mainWorld = now.world;
			last = now;
			if (st === Game_State.Player_Dying) { done = true; reason = 'dead'; break; }
			if (st === Game_State.Level_Complete || nextMain || intoExit) { done = true; reason = 'clear'; flag = true; break; }
			// Fuera del final del mapa (nadando, en un nivel de agua) no hay nada más: se da por perdido
			if (now.x > smb.currentMap.dimensions.width * 16 + 16) { done = true; reason = 'out'; break; }
			if (st === Game_State.Title_Menu || st === Game_State.Black_Screen && smb.screenType === Black_Screen_Type.Game_Over) { done = true; reason = 'over'; break; }
		}
		const clockPenalty = Math.min(0, last.time - startTime) * 0.1;   // el reloj del juego corre: apurarse rinde
		reward = round(reward + shaped + clockPenalty - (reason === 'dead' || reason === 'out' ? 15 : 0) + (flag ? 50 : 0));
		const obs = observe(opts);
		return { obs, reward, done, info: { reason, x: last.x, time: last.time, score: last.score, world: last.world, width: smb.currentMap.dimensions.width * 16, shaping: round(shaped), goal_distance: Number.isFinite(last.d) ? round(last.d) : null } };
	}

	// Cuadro actual achicado, en grises (0 a 255), por si se prefiere aprender de la imagen
	function pixels(width = 84, height = 84) {
		const c = document.createElement('canvas');
		c.width = width; c.height = height;
		const ctx = c.getContext('2d');
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(js2d.canvas ?? document.getElementById('game'), 0, 0, width, height);
		const d = ctx.getImageData(0, 0, width, height).data;
		const out = new Array(width * height);
		for (let i = 0; i < out.length; i++) out[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
		return { width, height, data: out };
	}

	window.smbApi = {
		ACTIONS, KEYS: Object.keys(KEYS),
		ready: () => typeof smb !== 'undefined' && !!smb && !!smb.currentMap,
		worlds: () => smb.availableWorlds.filter(n => n !== '0-0'),
		// Los 32 niveles con su tipo (overworld, underground, water, castle) y su ancho en px
		levels: () => smb.availableWorlds.filter(n => n !== '0-0').map(n => {
			const m = map.find(x => x.world === n);
			return { name: n, type: ['overworld', 'underground', 'water', 'castle'][m.type] ?? 'overworld', width: m.dimensions.width * 16 };
		}),
		reset, step, observe, pixels,
	};
})();
