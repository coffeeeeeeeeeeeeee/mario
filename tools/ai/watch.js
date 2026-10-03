// Reproductor de una partida (se carga dentro de /watch?api&env=N, que es index.html más este archivo): pide al servidor lo que
// jugó esa partida (cómo arrancó cada episodio y sus acciones) y lo repite cuadro a cuadro a la velocidad pedida. Como el juego es
// determinista, sale la misma partida que vio el agente, con un pequeño retraso. Al terminar un episodio salta al más nuevo.
(() => {
	const params = new URLSearchParams(location.search);
	const env = params.get('env') || '0';
	let speed = +(params.get('speed') || 1);
	window.addEventListener('message', e => { if (e.data && e.data.speed) speed = e.data.speed; });

	const hud = document.createElement('div');
	hud.style.cssText = 'position:fixed;left:6px;top:4px;z-index:10;font:12px monospace;color:#fff;text-shadow:1px 1px 2px #000;pointer-events:none;white-space:pre';
	document.body.appendChild(hud);
	// Aviso grande para las pantallas que no tienen partida (si se pide ver más pantallas que partidas hay en el entrenamiento)
	const empty = document.createElement('div');
	empty.style.cssText = 'position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;text-align:center;background:#1a1a1a;color:#bbb;font:22px monospace;padding:30px;line-height:1.5';
	document.body.appendChild(empty);

	const FRAME = 1000 / 60;
	const HOLD_FRAMES = 90;   // pausa al final de cada episodio
	let envs = 0, ep = null, stepIdx = 0, sub = 0, ended = false, hold = 0, needNext = false, polling = false, last = null, status = '';

	function begin(next) {
		ep = next;
		stepIdx = 0; sub = 0; ended = false; hold = 0; needNext = false; last = null; status = '';
		smbApi.reset({ ...ep.opts, obs: 'none' });
	}

	async function poll() {
		if (polling || !window.smbApi || !smbApi.ready()) return;
		polling = true;
		try {
			const cur = ep && !needNext ? ep.id : -1;
			const r = await (await fetch(`/api/watch?env=${env}&ep=${cur}&from=${ep && !needNext ? ep.actions.length : 0}`)).json();
			envs = r.envs;
			if (!ep || needNext) {
				if (r.ep && (!ep || r.ep.id !== ep.id)) begin(r.ep);
			} else if (r.ep && r.ep.id === ep.id) {
				ep.actions.push(...r.ep.actions);
				ep.repeats.push(...r.ep.repeats);
				ep.done = r.ep.done;
				ep.final = r.ep.final;
			} else if (!r.ep) {
				ep.done = true;   // ya no está en el registro: se sigue con lo que hay
			}
		} catch (e) { /* el servidor no contesta: se reintenta */ }
		polling = false;
	}

	function finish() {
		ended = true; hold = HOLD_FRAMES;
		const ok = last && ep.final && Math.abs(last.info.x - ep.final.x) < 0.01;
		status = ok ? `listo (${ep.final.reason ?? 'cortado'})` : 'DESINCRONIZADO';
	}

	function frame() {
		if (!ep) return;
		if (ended) {
			smbApi.step(0, 1, { obs: 'none' });   // la animación de la muerte o del mástil sigue
			if (--hold <= 0) needNext = true;
			return;
		}
		if (stepIdx >= ep.actions.length) {
			if (ep.done) finish();   // si no, se espera a que lleguen más acciones
			return;
		}
		last = smbApi.step(ep.actions[stepIdx], 1, { obs: 'none' });
		if (++sub >= ep.repeats[stepIdx]) { stepIdx++; sub = 0; }
		if (last.done) finish();
	}

	let prev = performance.now(), acc = 0;
	function loop(t) {
		requestAnimationFrame(loop);
		if (!window.smbApi || !smbApi.ready()) { prev = t; return; }
		acc += (t - prev) * speed;
		prev = t;
		for (let n = 0; acc >= FRAME && n < 16; n++, acc -= FRAME) frame();
		if (acc > FRAME * 16) acc = 0;
		const noData = !ep && envs > 0 && +env >= envs;
		empty.style.display = noData ? 'flex' : 'none';
		if (noData) empty.textContent = `Sin partida para la pantalla ${+env + 1}: el entrenamiento tiene ${envs}. Para ver más pantallas, entrená con --envs ${+env + 1} o más.`;
		hud.textContent = ep
			? `partida ${env} · episodio ${ep.id} · ${ep.opts.world} · paso ${stepIdx}/${ep.actions.length}${ep.done ? '' : '+'} · x ${last ? Math.round(last.info.x) : 0}${status ? ' · ' + status : ''}${needNext ? ' · esperando el siguiente' : ''}`
			: `partida ${env} · esperando datos del entrenamiento`;
	}

	setInterval(poll, 250);
	requestAnimationFrame(loop);
})();
