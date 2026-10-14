// js2d.js — motor de canvas 2D genérico, versión 1.11

const Color = {
	WHITE:   "#ffffff",
	BLACK:   "#000000",
	GRAY:    "#f1f1f1",

	RED:     "#ff0000",
	GREEN:   "#00ff00",
	BLUE:    "#0000ff",

	MAGENTA: "#ff00ff",
	CYAN:    "#00ffff",
	YELLOW:  "#ffff00",

	Black:			'rgba(0, 0, 0, 1)',
	Transparent:	'rgba(255, 255, 255, 0)',

	rgbToHsl(r, g, b) {
		r /= 255; g /= 255; b /= 255;
		const max = Math.max(r, g, b), min = Math.min(r, g, b);
		let h, s, l = (max + min) / 2;

		if (max === min) {
			h = s = 0;
		} else {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
				case g: h = ((b - r) / d + 2) / 6; break;
				case b: h = ((r - g) / d + 4) / 6; break;
			}
		}
		return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
	},

	hslToRgb(h, s, l) {
		h /= 360; s /= 100; l /= 100;
		let r, g, b;

		if (s === 0) {
			r = g = b = l;
		} else {
			const hue2rgb = (p, q, t) => {
				if (t < 0) t += 1;
				if (t > 1) t -= 1;
				if (t < 1/6) return p + (q - p) * 6 * t;
				if (t < 1/2) return q;
				if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
				return p;
			};
			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			const p = 2 * l - q;
			r = hue2rgb(p, q, h + 1/3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1/3);
		}
		return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
	},

	hexToRgb(hex) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
		if (!result) return null;
		return {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16),
			a: result[4] ? parseInt(result[4], 16) : 255
		};
	},

	rgbToHex(r, g, b, a) {
		const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
		return a !== undefined ? `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}` : `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	},

	toRGBAString(r, g, b, a = 255) {
		return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;
	},

	toHSLString(h, s, l) {
		return `hsl(${h}, ${s}%, ${l}%)`;
	},

	blend(color1, color2, t) {
		const c1 = this.hexToRgb(color1);
		const c2 = this.hexToRgb(color2);
		if (!c1 || !c2) return color1;
		
		const r = Math.round(c1.r + (c2.r - c1.r) * t);
		const g = Math.round(c1.g + (c2.g - c1.g) * t);
		const b = Math.round(c1.b + (c2.b - c1.b) * t);
		
		return this.rgbToHex(r, g, b);
	},

	lighten(hex, amount) {
		const rgb = this.hexToRgb(hex);
		if (!rgb) return hex;
		const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
		hsl.l = Math.min(100, hsl.l + amount);
		const result = this.hslToRgb(hsl.h, hsl.s, hsl.l);
		return this.rgbToHex(result.r, result.g, result.b);
	},

	darken(hex, amount) {
		const rgb = this.hexToRgb(hex);
		if (!rgb) return hex;
		const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
		hsl.l = Math.max(0, hsl.l - amount);
		const result = this.hslToRgb(hsl.h, hsl.s, hsl.l);
		return this.rgbToHex(result.r, result.g, result.b);
	},

	withAlpha(hex, alpha) {
		const rgb = this.hexToRgb(hex);
		if (!rgb) return hex;
		return this.toRGBAString(rgb.r, rgb.g, rgb.b, Math.round(alpha * 255));
	}
}

const Line_Cap = {
	Butt: "butt",
	Round: "round",
	Square: "square"

}

const Pivot = {
	Top_Left:      0,
	Top_Center:    1,
	Top_Right:     2,
	Center_Left:   3,
	Center:        4,
	Center_Right:  5,
	Bottom_Left:   6,
	Bottom_Center: 7,
	Bottom_Right:  8
}

const IMAGE_SMOOTHING = false;

// --- Easing y tweens ---------------------------------------------------------------------

// Curvas de suavizado: cada una recibe t en [0, 1] y devuelve el progreso (0 en t=0, 1 en t=1;
// "back" y "elastic" se pasan de rango en el medio a propósito). Nombres: 'linear' y, para el
// resto, 'in' / 'out' / 'inOut' + familia: Quad, Cubic, Quart, Quint, Sine, Expo, Circ, Back,
// Elastic, Bounce. Ejemplo: Ease.outCubic(0.5), o el nombre como texto en js.tween(..., 'outCubic').
const Ease = (() => {
	const c1 = 1.70158;
	const c2 = c1 * 1.525;
	const c3 = c1 + 1;
	const c4 = (2 * Math.PI) / 3;
	const c5 = (2 * Math.PI) / 4.5;

	const outBounce = t => {
		const n1 = 7.5625, d1 = 2.75;
		if (t < 1 / d1) return n1 * t * t;
		if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
		if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
		return n1 * (t -= 2.625 / d1) * t + 0.984375;
	};

	// Las curvas "in" de las familias simétricas; "out" e "inOut" se derivan espejándolas.
	const inFns = {
		Quad:  t => t * t,
		Cubic: t => t * t * t,
		Quart: t => t * t * t * t,
		Quint: t => t * t * t * t * t,
		Sine:  t => 1 - Math.cos((t * Math.PI) / 2),
		Expo:  t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
		Circ:  t => 1 - Math.sqrt(1 - t * t),
	};

	const ease = { linear: t => t };
	for (const [name, fn] of Object.entries(inFns)) {
		ease['in' + name] = fn;
		ease['out' + name] = t => 1 - fn(1 - t);
		ease['inOut' + name] = t => t < 0.5 ? fn(2 * t) / 2 : 1 - fn(2 - 2 * t) / 2;
	}

	ease.inBack = t => c3 * t * t * t - c1 * t * t;
	ease.outBack = t => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
	ease.inOutBack = t => t < 0.5
		? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
		: (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;

	ease.inElastic = t => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
	ease.outElastic = t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
	ease.inOutElastic = t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5
		? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
		: (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;

	ease.outBounce = outBounce;
	ease.inBounce = t => 1 - outBounce(1 - t);
	ease.inOutBounce = t => t < 0.5 ? (1 - outBounce(1 - 2 * t)) / 2 : (1 + outBounce(2 * t - 1)) / 2;

	// Acepta una función (se usa tal cual), un nombre ('outCubic') o nada (linear). Un nombre
	// que no existe es un error de tipeo: se avisa en vez de animar en silencio con otra curva.
	ease.get = (e) => {
		if (typeof e === 'function') return e;
		if (e == null) return ease.linear;
		const fn = ease[e];
		if (typeof fn !== 'function' || e === 'get') throw new Error(`[Js2d] Ease desconocido: "${e}"`);
		return fn;
	};

	return ease;
})();

// Una animación de propiedades numéricas de un objeto. No se crea a mano: la devuelve
// Js2d.tween() / Js2d.after(). `finished` es una promesa (true si terminó, false si se
// cancelo) para encadenar con await.
class Tween {
	constructor(target, to, duration, opts) {
		this.target = target;
		this.to = to;
		this.from = null;
		this.duration = Math.max(0, duration);
		this.delay = Math.max(0, opts.delay || 0);
		this.ease = Ease.get(opts.ease);
		this.repeatsLeft = opts.repeat === true ? Infinity : (opts.repeat || 0);
		this.yoyo = !!opts.yoyo;
		this.onStart = opts.onStart || null;
		this.onUpdate = opts.onUpdate || null;
		this.onComplete = opts.onComplete || null;
		this.startFrom = opts.from || null;
		this.elapsed = 0;
		this.reversed = false;
		this.state = 'pending';   // pending -> running -> done | cancelled
		this._resolve = null;
		this._promise = null;
	}

	get active() {
		return this.state === 'pending' || this.state === 'running';
	}

	get finished() {
		if (!this._promise) {
			this._promise = new Promise(resolve => { this._resolve = resolve; });
			if (!this.active) this._resolve(this.state === 'done');
		}
		return this._promise;
	}

	// Corta la animación donde está, sin llamar a onComplete.
	cancel() {
		if (!this.active) return;
		this.state = 'cancelled';
		if (this._resolve) this._resolve(false);
	}

	// Salta al valor final (o al inicial, si va de vuelta en un yoyo) y llama a onComplete.
	finish() {
		if (!this.active) return;
		this._begin();
		this._apply(this.yoyo && this.reversed ? 0 : 1);
		this._complete();
	}

	_begin() {
		if (this.state !== 'pending') return;
		this.state = 'running';
		if (this.startFrom) Object.assign(this.target, this.startFrom);
		this.from = {};
		for (const key of Object.keys(this.to)) this.from[key] = this.target[key];
		if (this.onStart) this.onStart(this.target);
	}

	_apply(p) {
		const e = this.ease(p);
		for (const key of Object.keys(this.to)) {
			const a = this.from[key];
			this.target[key] = a + (this.to[key] - a) * e;
		}
		if (this.onUpdate) this.onUpdate(this.target, p);
	}

	_complete() {
		this.state = 'done';
		if (this.onComplete) this.onComplete(this.target);
		if (this._resolve) this._resolve(true);
	}

	_step(dt) {
		if (this.state === 'pending') {
			if (this.delay > 0) {
				this.delay -= dt;
				if (this.delay > 0) return;
				dt = -this.delay;   // lo que sobró del cuadro después de la espera
				this.delay = 0;
			}
			this._begin();
		}
		if (this.state !== 'running') return;

		this.elapsed += dt;
		if (this.elapsed >= this.duration && this.repeatsLeft > 0) {
			// Termina una vuelta y queda otra: la sobra de tiempo pasa a la siguiente.
			this._apply(this.reversed ? 0 : 1);
			this.repeatsLeft--;
			this.elapsed = this.duration > 0 ? this.elapsed % this.duration : 0;
			this.reversed = this.yoyo ? !this.reversed : false;
			if (!this.active) return;   // un callback pudo cancelarla
		}

		const t = this.duration > 0 ? Math.min(1, this.elapsed / this.duration) : 1;
		const p = this.reversed ? 1 - t : t;
		this._apply(p);
		if (this.active && t >= 1) this._complete();
	}
}

// Lista de tweens activos. Js2d tiene una (`js.tweens`) y la avanza sola en tick().
class TweenManager {
	#list = [];
	#updating = false;

	get count() {
		return this.#list.filter(t => t.active).length;
	}

	// opts: ease, delay, repeat (n veces más, o true = infinito), yoyo, from, onStart,
	// onUpdate(target, p), onComplete(target), overwrite (por defecto true).
	add(target, to, duration, opts = {}) {
		if (target == null || typeof target !== 'object') {
			throw new Error('[Js2d] tween: el objetivo tiene que ser un objeto (ej. { x: 0 })');
		}
		const tween = new Tween(target, to, duration, opts);
		// Dos tweens sobre la misma propiedad del mismo objeto se pelearían cada cuadro:
		// el nuevo le saca la propiedad al viejo (y si el viejo se queda sin nada, se cancela).
		if (opts.overwrite !== false) this.kill(target, Object.keys(to));
		this.#list.push(tween);
		return tween;
	}

	// Cancela los tweens de `target` (todos, o sólo lo que toquen de `keys`).
	kill(target, keys = null) {
		for (const tween of this.#list) {
			if (tween.target !== target || !tween.active) continue;
			if (keys) for (const key of keys) delete tween.to[key];
			if (!keys || Object.keys(tween.to).length === 0) tween.cancel();
		}
		this.#compact();
	}

	clear() {
		for (const tween of this.#list) tween.cancel();
		this.#compact();
	}

	update(dt) {
		const list = this.#list;
		const n = list.length;   // los creados durante este update arrancan en el cuadro siguiente
		this.#updating = true;
		try {
			for (let i = 0; i < n; i++) list[i]._step(dt);
		} finally {
			this.#updating = false;
		}
		this.#compact();
	}

	// Saca los terminados, en el lugar. Durante update() no se toca la lista: un callback que
	// cancele o cree tweens movería los índices del recorrido.
	#compact() {
		if (this.#updating) return;
		const list = this.#list;
		let j = 0;
		for (let i = 0; i < list.length; i++) if (list[i].active) list[j++] = list[i];
		list.length = j;
	}
}

// --- Escenas -----------------------------------------------------------------------------

// Pila de escenas (menú, partida, pausa, ...). Js2d tiene una (`js.scenes`); el juego la
// alimenta desde su loop, en el orden que ya usa:
//
//   js.scenes.add('menu', { enter(params) {...}, update(dt) {...}, draw() {...}, exit() {...} });
//   js.scenes.switch('menu');                          // reemplaza todo lo que haya
//   js.scenes.switch('juego', { nivel: 3 }, { fade: 0.4 });   // con fundido a negro
//   js.scenes.push('pausa');  js.scenes.pop();         // una encima de otra
//   ...
//   js.scenes.update(js.getFrameTime());   // en el update del juego
//   js.scenes.draw();                      // en el draw, después de clearBg()
//
// Una escena es un objeto (o una instancia de clase) con los métodos que necesite, todos
// opcionales: enter(params, from), exit(to), pause(), resume(), update(dt), draw().
// `overlay: true` en la escena hace que también se dibuje la que tiene debajo (un menú de
// pausa sobre la partida). Sólo recibe update() la de arriba de todo.
class SceneManager {
	#js;
	#defs = new Map();
	#stack = [];   // [{ name, scene }]
	// Transición con fundido: 'out' (se oscurece), 'in' (se aclara) o null.
	#fade = null;

	constructor(js) {
		this.#js = js;
	}

	add(name, scene) {
		if (scene == null || typeof scene !== 'object') {
			throw new Error(`[Js2d] escena "${name}": tiene que ser un objeto con enter/update/draw`);
		}
		this.#defs.set(name, scene);
	}

	has(name) {
		return this.#defs.has(name);
	}

	// Nombre de la escena de arriba (o null) y de toda la pila, de abajo hacia arriba.
	get current() {
		return this.#stack.length ? this.#stack[this.#stack.length - 1].name : null;
	}

	get stack() {
		return this.#stack.map(e => e.name);
	}

	get transitioning() {
		return this.#fade !== null;
	}

	#find(name) {
		const scene = this.#defs.get(name);
		if (!scene) throw new Error(`[Js2d] escena desconocida: "${name}"`);
		return scene;
	}

	// Reemplaza toda la pila por `name`. Con { fade: segundos, color } oscurece, cambia y aclara.
	// Durante un fundido las escenas no reciben update(), para que no entre input a medias.
	switch(name, params = {}, opts = {}) {
		this.#find(name);
		const half = (opts.fade || 0) / 2;
		// sin escena previa no hay nada que oscurecer: entra directo
		if (half > 0 && (this.#stack.length || this.#fade)) {
			const color = opts.color || Color.BLACK;
			if (this.#fade && this.#fade.phase === 'out') {
				// ya se estaba oscureciendo hacia otra escena: gana la última pedida
				Object.assign(this.#fade, { name, params, half, color });
			} else {
				const alpha = this.#fade ? this.#fade.alpha : 0;
				this.#fade = { phase: 'out', t: alpha * half, half, alpha, name, params, color };
			}
			return;
		}
		this.#fade = null;
		this.#swap(name, params);
	}

	#swap(name, params) {
		const from = this.current;
		while (this.#stack.length) {
			const top = this.#stack.pop();
			if (top.scene.exit) top.scene.exit(name);
		}
		const scene = this.#find(name);
		this.#stack.push({ name, scene });
		if (scene.enter) scene.enter(params, from);
	}

	// Apila `name` encima de la actual, que queda en pausa.
	push(name, params = {}) {
		const scene = this.#find(name);
		const from = this.current;
		const top = this.#stack[this.#stack.length - 1];
		if (top && top.scene.pause) top.scene.pause();
		this.#stack.push({ name, scene });
		if (scene.enter) scene.enter(params, from);
	}

	// Saca la de arriba y retoma la de abajo. No hace nada si es la única.
	pop() {
		if (this.#stack.length < 2) return;
		const top = this.#stack.pop();
		const now = this.#stack[this.#stack.length - 1];
		if (top.scene.exit) top.scene.exit(now.name);
		if (now.scene.resume) now.scene.resume();
	}

	update(dt) {
		if (this.#fade) this.#advanceFade(dt);
		if (this.#fade) return;
		const top = this.#stack[this.#stack.length - 1];
		if (top && top.scene.update) top.scene.update(dt);
	}

	#advanceFade(dt) {
		const f = this.#fade;
		f.t += dt;
		if (f.phase === 'out') {
			f.alpha = Math.min(1, f.t / f.half);
			if (f.alpha >= 1) {
				this.#swap(f.name, f.params);
				f.phase = 'in';
				f.t = 0;
			}
		} else {
			f.alpha = Math.max(0, 1 - f.t / f.half);
			if (f.alpha <= 0) this.#fade = null;
		}
	}

	draw() {
		let first = this.#stack.length - 1;
		while (first > 0 && this.#stack[first].scene.overlay) first--;
		for (let i = Math.max(first, 0); i < this.#stack.length; i++) {
			const scene = this.#stack[i].scene;
			if (scene.draw) scene.draw();
		}
		if (this.#fade && this.#fade.alpha > 0) {
			const js = this.#js;
			js.withoutShake(() => {
				js.ctx.save();
				js.ctx.globalAlpha = this.#fade.alpha;
				js.ctx.fillStyle = this.#fade.color;
				js.ctx.fillRect(0, 0, js.getCanvasWidth(), js.getCanvasHeight());
				js.ctx.restore();
			});
		}
	}
}

// --- Partículas --------------------------------------------------------------------------

// Sistema de partículas con pool (no crea objetos por cuadro). Js2d tiene uno (`js.particles`);
// se avanza solo en tick() y el juego lo dibuja donde quiera con js.particles.draw().
//
//   js.particles.emit(x, y, 30, 'sparks');                              // ráfaga con un preset
//   js.particles.emit(x, y, 20, { preset: 'confetti', gravity: 400 });  // preset + cambios
//   const humo = js.particles.stream(x, y, 'smoke', 25);                // 25 por segundo, sigue vivo
//   humo.x = nuevoX; humo.stop();
//
// Opciones (un número, o [mínimo, máximo] para sortear uno por partícula):
//   speed (px/s, 100)   angle (grados: 0 derecha, 90 abajo, -90 arriba)   spread (apertura
//   total del cono en grados; por defecto 360 si no hay angle y 0 si lo hay)   life (segundos, [0.4, 0.8])
//   size (px de radio o lado, 4)   endSize (al final de la vida; igual a size)   color ('#rrggbb',
//   '#rgb', '#rrggbbaa' o 'rgb()/rgba()', o una lista de la que se sortea una)   endColor
//   alpha (1)   endAlpha (0)   gravity (px/s² hacia abajo, o { x, y })   drag (frenado, 0)
//   spin (grados/s)   rotation (grados iniciales)   radius (nace dentro de un disco de ese radio)
//   shape ('circle' | 'square' | 'line' | 'image')   image (para shape 'image')   additive (true
//   suma luz: fuego, chispas)   ease (curva de Ease con que avanzan color, tamaño y alpha).
// Con el pool lleno (`max`, 2000) las partículas nuevas se descartan.
class ParticleSystem {
	static presets = {
		sparks:   { speed: [120, 320], spread: 360, life: [0.25, 0.6], size: [1.5, 3], endSize: 0, color: ['#fff3b0', '#ffd166', '#ff9f1c'], endColor: '#ff5400', alpha: 1, endAlpha: 0, drag: 2.5, additive: true },
		smoke:    { speed: [10, 40], angle: -90, spread: 40, life: [0.8, 1.6], size: [6, 10], endSize: [18, 28], color: '#8a8f98', alpha: 0.5, endAlpha: 0, gravity: { x: 0, y: -20 }, drag: 0.8 },
		confetti: { speed: [150, 420], angle: -90, spread: 120, life: [1.2, 2.2], size: [3, 5], color: ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b'], alpha: 1, endAlpha: 1, gravity: 520, drag: 1.2, spin: [-540, 540], rotation: [0, 360], shape: 'square' },
		explosion:{ speed: [80, 360], spread: 360, life: [0.3, 0.8], size: [3, 7], endSize: 0, color: ['#fff3b0', '#ffb703', '#fb8500'], endColor: '#d00000', alpha: 1, endAlpha: 0, drag: 3, additive: true },
	};

	#js;
	#list = [];       // partículas vivas
	#free = [];       // partículas reutilizables
	#streams = [];
	#colorCache = new Map();
	max = 2000;

	constructor(js) {
		this.#js = js;
	}

	get count() {
		return this.#list.length;
	}

	// Cada partícula nace con todo resuelto (rangos sorteados, colores en RGB), así que
	// update() y draw() sólo hacen cuentas.
	emit(x, y, count = 1, opts = 'sparks') {
		const o = this.#resolve(opts);
		const ease = Ease.get(o.ease);
		let made = 0;
		for (let i = 0; i < count && this.#list.length < this.max; i++) {
			const p = this.#free.pop() || {};
			const angle = (this.#range(o.angle, 0) + (Math.random() - 0.5) * (o.spread ?? (o.angle == null ? 360 : 0))) * Math.PI / 180;
			const speed = this.#range(o.speed, 100);
			const radius = o.radius ? Math.sqrt(Math.random()) * o.radius : 0;
			const where = Math.random() * Math.PI * 2;
			p.x = x + Math.cos(where) * radius;
			p.y = y + Math.sin(where) * radius;
			p.vx = Math.cos(angle) * speed;
			p.vy = Math.sin(angle) * speed;
			p.life = Math.max(0.001, this.#range(o.life, [0.4, 0.8]));
			p.age = 0;
			p.size0 = this.#range(o.size, 4);
			p.size1 = o.endSize == null ? p.size0 : this.#range(o.endSize, 0);
			const c0 = this.#color(Array.isArray(o.color) && typeof o.color[0] === 'string' ? o.color[Math.floor(Math.random() * o.color.length)] : o.color);
			p.c0 = c0;
			p.c1 = o.endColor == null ? c0 : this.#color(o.endColor);
			p.a0 = o.alpha ?? 1;
			p.a1 = o.endAlpha ?? 0;
			const g = typeof o.gravity === 'number' ? { x: 0, y: o.gravity } : (o.gravity || { x: 0, y: 0 });
			p.gx = g.x || 0;
			p.gy = g.y || 0;
			p.drag = o.drag || 0;
			p.rot = this.#range(o.rotation, 0) * Math.PI / 180;
			p.spin = this.#range(o.spin, 0) * Math.PI / 180;
			p.shape = o.shape || 'circle';
			p.image = o.image || null;
			p.additive = !!o.additive;
			p.ease = ease;
			this.#list.push(p);
			made++;
		}
		return made;
	}

	// Emisor continuo: `rate` partículas por segundo. Devuelve { x, y, rate, active, stop() };
	// se puede mover cambiando x/y o regular cambiando rate. `duration` lo apaga solo.
	stream(x, y, opts = 'sparks', rate = 20, duration = Infinity) {
		const s = { x, y, rate, opts: this.#resolve(opts), left: duration, acc: 0, active: true };
		s.stop = () => { s.active = false; };
		this.#streams.push(s);
		return s;
	}

	// Un preset por nombre, o un objeto { preset: 'nombre', ...cambios }, o las opciones sueltas.
	#resolve(opts) {
		if (typeof opts === 'string') opts = { preset: opts };
		opts = opts || {};
		if (!opts.preset) return opts;
		const base = ParticleSystem.presets[opts.preset];
		if (!base) throw new Error(`[Js2d] preset de partículas desconocido: "${opts.preset}"`);
		return { ...base, ...opts };
	}

	#range(v, fallback) {
		if (v == null) v = fallback;
		if (Array.isArray(v)) return v[0] + Math.random() * (v[1] - v[0]);
		return v;
	}

	// '#rgb', '#rrggbb', '#rrggbbaa', 'rgb(...)', 'rgba(...)' -> [r, g, b]. Lo que no se
	// entiende queda blanco. El alfa del color no se usa: va por `alpha` / `endAlpha`.
	#color(str) {
		if (typeof str !== 'string') return [255, 255, 255];
		let c = this.#colorCache.get(str);
		if (c) return c;
		c = [255, 255, 255];
		let m;
		if ((m = /^#([0-9a-f]{3})$/i.exec(str))) c = [...m[1]].map(h => parseInt(h + h, 16));
		else if ((m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(str))) c = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
		else if ((m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(str))) c = [+m[1], +m[2], +m[3]];
		this.#colorCache.set(str, c);
		return c;
	}

	update(dt) {
		for (const s of this.#streams) {
			if (!s.active) continue;
			s.left -= dt;
			if (s.left <= 0) { s.active = false; continue; }
			s.acc += s.rate * dt;
			const n = Math.floor(s.acc);
			if (n > 0) { s.acc -= n; this.emit(s.x, s.y, n, s.opts); }
		}
		this.#streams = this.#streams.filter(s => s.active);

		const list = this.#list;
		for (let i = list.length - 1; i >= 0; i--) {
			const p = list[i];
			p.age += dt;
			if (p.age >= p.life) {
				list[i] = list[list.length - 1];   // se saca sin mover al resto
				list.pop();
				this.#free.push(p);
				continue;
			}
			const k = Math.exp(-p.drag * dt);
			p.vx = (p.vx + p.gx * dt) * k;
			p.vy = (p.vy + p.gy * dt) * k;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.rot += p.spin * dt;
		}
	}

	clear() {
		for (const p of this.#list) this.#free.push(p);
		this.#list.length = 0;
		this.#streams.length = 0;
	}

	draw() {
		const ctx = this.#js.ctx;
		ctx.save();
		// primero las normales y después las que suman luz, para que el brillo quede encima
		for (const additive of [false, true]) {
			ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
			for (const p of this.#list) {
				if (p.additive !== additive) continue;
				const t = p.ease(p.age / p.life);
				const size = p.size0 + (p.size1 - p.size0) * t;
				const alpha = p.a0 + (p.a1 - p.a0) * t;
				if (size <= 0 || alpha <= 0) continue;
				const r = Math.round(p.c0[0] + (p.c1[0] - p.c0[0]) * t);
				const g = Math.round(p.c0[1] + (p.c1[1] - p.c0[1]) * t);
				const b = Math.round(p.c0[2] + (p.c1[2] - p.c0[2]) * t);
				ctx.globalAlpha = Math.min(1, alpha);
				ctx.fillStyle = ctx.strokeStyle = `rgb(${r},${g},${b})`;
				if (p.shape === 'circle') {
					ctx.beginPath();
					ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
					ctx.fill();
				} else if (p.shape === 'line') {
					// una estela en la dirección del movimiento
					ctx.lineWidth = Math.max(1, size * 0.5);
					ctx.beginPath();
					ctx.moveTo(p.x, p.y);
					ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
					ctx.stroke();
				} else {
					ctx.save();
					ctx.translate(p.x, p.y);
					ctx.rotate(p.rot);
					if (p.shape === 'image' && p.image) ctx.drawImage(p.image, -size, -size, size * 2, size * 2);
					else ctx.fillRect(-size, -size, size * 2, size * 2);
					ctx.restore();
				}
			}
		}
		ctx.restore();
	}
}

// --- Interfaz (widgets) ------------------------------------------------------------------

// Widgets en modo inmediato: en cada cuadro el juego los declara (y se dibujan en el acto) y
// cada uno devuelve lo que pasó. No hay objetos que crear ni destruir. Js2d tiene una
// instancia (`js.ui`).
//
//   js.ui.begin();                                  // una vez por cuadro, antes de los widgets
//   js.ui.panel(caja, { title: 'Opciones' });
//   if (js.ui.button('jugar', rBoton, 'Jugar', { primary: true })) empezar();
//   sonido = js.ui.toggle('sonido', rToggle, sonido, 'Sonido');
//   volumen = js.ui.slider('vol', rSlider, volumen, 0, 1);
//   const i = js.ui.list('niveles', rLista, ['Fácil', 'Normal', 'Difícil'], { selected: nivel });
//   if (i >= 0) nivel = i;
//
// Rectángulos: { x, y, width, height } (también vale w / h). Cada widget lleva un `id` único
// por pantalla. El puntero es el del motor (mouse o toque, sin distinguir). Un widget recién
// aparecido responde a partir del cuadro siguiente: la zona tocable se arma con lo que se
// declaró en el cuadro anterior, y gana el que se declaró último (el de más arriba).
//
// Para que el juego no use como propio un toque que cayó en la interfaz: `js.ui.wantsPointer`
// (el puntero está sobre la interfaz, o la apretó y sigue apretando).
//
// Apariencia: `js.ui.theme` (colores, fuente, radio) y `js.ui.scale` (multiplica tamaños,
// radios y márgenes; por ejemplo la unidad de interfaz del juego).
//
// Teclado y gamepad: con `js.ui.navigation = true` la interfaz se maneja sin puntero. Tab /
// Shift+Tab (o RB / LB) recorren los widgets en el orden en que se declararon; las flechas (o la
// cruceta y la palanca izquierda) saltan al widget más cercano en esa dirección; Enter o Espacio
// (o A) activan; Escape (o B) suelta el foco. En un slider las flechas izquierda y derecha
// cambian el valor; en una lista, arriba y abajo mueven la fila. El anillo de foco aparece con
// la primera tecla y se va con el primer clic. Los controles son las acciones `ui:next`,
// `ui:prev`, `ui:left`, `ui:right`, `ui:up`, `ui:down`, `ui:accept` y `ui:cancel`: si el juego
// ya las asignó con js.input.bind, se respetan. Ojo: mientras `js.ui.wantsKeyboard` es true
// esas teclas son de la interfaz, y el juego no debería usarlas para otra cosa.
class UI {
	static DRAG_THRESHOLD = 8;   // px que separan un toque de un arrastre

	#js;
	#prev = [];         // zonas del cuadro anterior: { id, x, y, w, h, interactive }
	#cur = [];
	#scroll = new Map();   // id de lista -> desplazamiento en px
	#lastPointer = null;
	#dragDist = 0;
	#nav = { dx: 0, dy: 0 };     // pasos de flecha de este cuadro para el widget con foco
	#navBound = false;
	#rep = new Map();            // repetición de las flechas mantenidas
	#acceptRow = null;           // lista a la que se le dio Enter en este cuadro
	#rowFocus = new Map();       // lista -> fila con el foco del teclado
	#open = null;                // id del dropdown abierto
	#openSeen = false;           // el dropdown abierto se declaró en este cuadro
	#openFresh = false;          // se acaba de abrir: la lista arranca centrada en lo elegido
	#dismiss = false;            // se apretó fuera del dropdown abierto
	#over = false;               // lo que se registra va por encima de todo lo demás (popups)
	#deferOverlays = false;      // el juego llama a end(): los popups se dibujan al final del cuadro
	#deferred = [];
	#pick = null;                // { id, index }: elección hecha en end(), la devuelve el dropdown en el cuadro siguiente

	scale = 1;
	cursor = true;      // cambiar el cursor a "pointer" sobre lo tocable
	theme = {
		font: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
		fontSize: 16,
		text: '#f4f6f8', textDisabled: 'rgba(244,246,248,0.4)',
		panel: 'rgba(14,24,38,0.92)', panelBorder: 'rgba(255,255,255,0.14)',
		button: 'rgba(255,255,255,0.14)', buttonHover: 'rgba(255,255,255,0.24)', buttonActive: 'rgba(255,255,255,0.34)',
		accent: '#ffb703', accentHover: '#ffc833', accentActive: '#e6a100', accentText: '#1b1400',
		track: 'rgba(255,255,255,0.18)', knob: '#f4f6f8',
		rowHover: 'rgba(255,255,255,0.10)', rowSelected: 'rgba(255,183,3,0.28)',
		focus: '#7cc4ff', focusRow: 'rgba(124,196,255,0.2)',
		shadow: 'rgba(0,0,0,0.4)',
		popup: '#16212f',      // fondo de la lista de un dropdown (sólido: se dibuja encima de otros widgets)
		radius: 10, padding: 12,
	};

	hot = null;         // id del widget bajo el puntero
	active = null;      // id del widget que el puntero tiene apretado
	clicked = null;     // id del widget que se tocó (apretar y soltar encima) en este cuadro
	clickAt = null;     // dónde se soltó ese toque
	clickDragged = false;   // true si el toque fue en realidad un arrastre
	pointerOver = false;

	navigation = false;     // true: la interfaz se maneja con teclado y gamepad (ver arriba)
	focused = null;         // id del widget con el foco
	focusVisible = false;   // true si se muestra el anillo (se usó el teclado o el gamepad)

	constructor(js) {
		this.#js = js;
	}

	get wantsPointer() {
		return this.pointerOver || this.active !== null;
	}

	// true si hay un widget con el foco a la vista: Tab, flechas, Enter, Espacio y Escape son de
	// la interfaz y el juego tiene que dejarlos pasar.
	get wantsKeyboard() {
		return this.navigation && this.focusVisible && this.focused !== null;
	}

	// Da el foco a un widget (y muestra el anillo), por ejemplo al abrir un menú.
	focus(id) {
		this.focused = id;
		this.focusVisible = true;
	}

	blur() {
		this.focused = null;
		this.focusVisible = false;
	}

	// Arma el estado del cuadro a partir del puntero. Llamar una vez por cuadro, antes de
	// declarar los widgets.
	begin() {
		const js = this.#js;
		const ev = js.consumePointerEvents();
		const mouse = js.getMousePosition();
		this.#prev = this.#cur;
		this.#cur = [];
		this.clicked = null;
		this.#deferred = [];
		if (this.#open && !this.#openSeen) this.#open = null;   // el dropdown ya no se declara
		this.#openSeen = false;
		this.#dismiss = false;

		const top = (x, y) => this.#topAt(x, y);

		if (ev.pressed) {
			const r = top(ev.pressX, ev.pressY);
			this.active = r && r.interactive ? r.id : null;
			this.#dragDist = 0;
			if (this.#open && !(r && r.id === this.#open + ':list')) this.#dismiss = true;   // apretó fuera del dropdown abierto
			this.#lastPointer = { x: ev.pressX, y: ev.pressY };   // el arrastre se mide desde donde se apretó
			this.focused = this.active;       // un clic da el foco, pero sin anillo
			this.focusVisible = false;
		}
		// el desplazamiento del puntero mientras está apretado (para arrastrar listas y sliders)
		if (this.#lastPointer && (js.mouseButtons[0] || ev.pressed)) {
			this.#dragDist += Math.hypot(mouse.x - this.#lastPointer.x, mouse.y - this.#lastPointer.y);
		}
		this.#lastPointer = mouse;

		if (ev.released) {
			const r = top(ev.releaseX, ev.releaseY);
			if (!ev.canceled && this.active !== null && r && r.id === this.active) {
				this.clicked = this.active;
				this.clickAt = { x: ev.releaseX, y: ev.releaseY };
				this.clickDragged = this.#dragDist > UI.DRAG_THRESHOLD;
			}
			this.active = null;
		} else if (this.active !== null && !js.mouseButtons[0] && !ev.pressed) {
			this.active = null;   // se soltó fuera del canvas: el motor no se enteró
		}

		const under = top(mouse.x, mouse.y);
		this.pointerOver = !!under;
		// Con un dedo no hay "pasar el puntero por encima": sin esto, el último botón tocado
		// quedaría resaltado hasta el próximo toque.
		const hover = js.pointerType !== 'touch' || js.mouseButtons[0] || ev.pressed;
		this.hot = hover && under && under.interactive ? under.id : null;
		if (this.cursor && js.canvas && js.canvas.style) js.canvas.style.cursor = this.hot !== null ? 'pointer' : '';

		this.#nav.dx = this.#nav.dy = 0;
		this.#acceptRow = null;
		if (this.navigation) this.#navigate();
		else this.focusVisible = false;
	}

	// Controles de navegación por defecto, sin pisar los que el juego ya haya asignado.
	#bindNav() {
		const inp = this.#js.input;
		const have = new Set(inp.actions);
		const defs = {
			'ui:next': ['Tab', 'pad:RB'], 'ui:prev': ['pad:LB'],
			'ui:left': ['ArrowLeft', 'pad:Left', 'pad:LStickLeft'], 'ui:right': ['ArrowRight', 'pad:Right', 'pad:LStickRight'],
			'ui:up': ['ArrowUp', 'pad:Up', 'pad:LStickUp'], 'ui:down': ['ArrowDown', 'pad:Down', 'pad:LStickDown'],
			'ui:accept': ['Enter', 'NumpadEnter', 'Space', 'pad:A'], 'ui:cancel': ['Escape', 'pad:B'],
		};
		for (const [action, sources] of Object.entries(defs)) if (!have.has(action)) inp.bind(action, sources);
		this.#navBound = true;
	}

	// Interpreta las teclas del cuadro: mueve el foco, activa el widget que lo tiene, o deja
	// los pasos de flecha para el widget que los usa (slider, lista).
	#navigate() {
		const js = this.#js, inp = js.input;
		if (!this.#navBound) this.#bindNav();
		const dt = js.getFrameTime();
		const bound = a => inp.bindings(a).length > 0;
		// una flecha mantenida repite: a los 0,4 s y después cada 0,06 s
		const steps = (a) => {
			if (!bound(a) || !inp.isDown(a)) { this.#rep.delete(a); return 0; }
			if (inp.pressed(a) || !this.#rep.has(a)) { this.#rep.set(a, 0.4); return 1; }
			let t = this.#rep.get(a) - dt, n = 0;
			while (t <= 0 && n < 3) { n++; t += 0.06; }
			this.#rep.set(a, t);
			return n;
		};
		const edge = a => bound(a) && inp.pressed(a);
		const left = steps('ui:left'), right = steps('ui:right'), up = steps('ui:up'), down = steps('ui:down');
		let next = edge('ui:next'), prev = edge('ui:prev');
		if (next && (js.keysPressed.ShiftLeft || js.keysPressed.ShiftRight)) { next = false; prev = true; }   // Shift+Tab
		const accept = edge('ui:accept'), cancel = edge('ui:cancel');
		if (!(left || right || up || down || next || prev || accept || cancel)) return;

		const zones = this.#prev.filter(z => z.interactive);
		if (this.focused !== null && !zones.some(z => z.id === this.focused)) this.focused = null;   // el widget ya no está

		if (cancel) {
			if (this.focusVisible) this.blur();
			return;
		}
		if (!this.focusVisible) {
			// con el foco oculto, Enter y Espacio son del juego; cualquier tecla de navegación lo muestra
			if (accept || !zones.length) return;
			this.focusVisible = true;
			if (this.focused === null) this.focused = (prev ? zones[zones.length - 1] : zones[0]).id;
			return;
		}
		if (this.focused === null) {
			if (zones.length) this.focused = (prev ? zones[zones.length - 1] : zones[0]).id;
			return;
		}

		const idx = zones.findIndex(z => z.id === this.focused), z = zones[idx];
		if (accept) {
			if (z.kind === 'button' || z.kind === 'toggle' || z.kind === 'dropdown') {
				this.clicked = z.id;
				this.clickAt = { x: z.x + z.w / 2, y: z.y + z.h / 2 };
				this.clickDragged = false;
			} else if (z.kind === 'list') {
				this.#acceptRow = z.id;
			}
		}
		if (next) { this.focused = zones[(idx + 1) % zones.length].id; return; }
		if (prev) { this.focused = zones[(idx - 1 + zones.length) % zones.length].id; return; }

		const dx = right - left, dy = down - up;
		if (dx !== 0) {
			if (z.kind === 'slider') this.#nav.dx = dx;
			else for (let k = 0; k < Math.abs(dx) && this.#spatial(dx > 0 ? 'right' : 'left'); k++);
		}
		if (dy !== 0) {
			if (z.kind === 'list' || z.kind === 'dropdown') this.#nav.dy = dy;
			else for (let k = 0; k < Math.abs(dy) && this.#spatial(dy > 0 ? 'down' : 'up'); k++);
		}
	}

	// Pasa el foco al widget más cercano en la dirección dada (según lo dibujado en el cuadro
	// anterior). Devuelve false si no hay ninguno de ese lado.
	#spatial(dir) {
		const zones = this.#prev.filter(z => z.interactive);
		const cur = zones.find(z => z.id === this.focused);
		if (!cur) return false;
		const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
		let best = null, bestScore = Infinity;
		for (const z of zones) {
			if (z.id === cur.id) continue;
			const dx = z.x + z.w / 2 - cx, dy = z.y + z.h / 2 - cy;
			const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
			if (along <= 0.5) continue;                       // tiene que estar del lado pedido
			const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
			const score = along + across * 2;                 // mejor el que está más derecho
			if (score < bestScore) { best = z; bestScore = score; }
		}
		if (!best) return false;
		this.focused = best.id;
		return true;
	}

	// Anillo de foco alrededor de un widget.
	#ring(r, radius) {
		const s = this.scale, o = 2 * s;
		this.#js.drawRectangleRoundedLines({ x: r.x - o, y: r.y - o, width: r.w + 2 * o, height: r.h + 2 * o }, radius + o, 2 * s, this.theme.focus);
	}

	#hasFocus(id) {
		return this.focusVisible && this.focused === id;
	}

	// Qué hay bajo el punto (x, y) según el último cuadro dibujado: { id, x, y, w, h,
	// interactive } o null. `id` es null en los paneles y bloqueos. Sirve para que el juego
	// decida si un toque era de la interfaz o de lo que hay detrás.
	hitTest(x, y) {
		const z = this.#topAt(x, y, this.#shown());
		return z ? { ...z } : null;
	}

	// Todas las zonas del último cuadro dibujado (copia). Pensado para pruebas y depuración.
	get zones() {
		return this.#shown().map(z => ({ ...z }));
	}

	// Entre dos cuadros (cuando llegan los toques) lo último dibujado está en #cur; entre
	// begin() y el dibujado todavía no hay nada ahí y lo último es lo del cuadro anterior.
	#shown() {
		return this.#cur.length ? this.#cur : this.#prev;
	}

	// Zona que tapa el puntero sin dibujar nada (un panel invisible, o el margen alrededor de
	// una tarjeta).
	block(rect) {
		this.#register(null, this.#rect(rect), false);
	}

	// Las zonas "por encima" (popups) ganan a todas las demás, sin importar el orden en que se declararon.
	#topAt(x, y, zones = this.#prev) {
		for (const over of [true, false]) {
			for (let i = zones.length - 1; i >= 0; i--) {
				const r = zones[i];
				if (r.over === over && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
			}
		}
		return null;
	}

	#rect(r) {
		return { x: r.x, y: r.y, w: r.width ?? r.w, h: r.height ?? r.h };
	}

	#register(id, r, interactive, kind = null) {
		this.#cur.push({ id, x: r.x, y: r.y, w: r.w, h: r.h, interactive, kind, over: this.#over });
	}

	#font(size, weight = 600) {
		return `${weight} ${size}px ${this.theme.font}`;
	}

	#text(str, x, y, size, color, align = 'left', weight = 600) {
		const ctx = this.#js.ctx;
		ctx.save();
		ctx.font = this.#font(size, weight);
		ctx.textAlign = align;
		ctx.textBaseline = 'middle';
		ctx.fillStyle = color;
		ctx.fillText(str, x, y);
		ctx.restore();
	}

	// Achica la letra hasta que el texto entre en `maxWidth` (sin bajar de `floor` x el tamaño).
	#fitSize(str, size, maxWidth, weight, floor = 0.6) {
		const ctx = this.#js.ctx;
		ctx.save();
		let s = size;
		ctx.font = this.#font(s, weight);
		while (s > size * floor && ctx.measureText(str).width > maxWidth) {
			s -= 1;
			ctx.font = this.#font(s, weight);
		}
		ctx.restore();
		return s;
	}

	// Rectángulo redondeado con sombra opcional (la sombra del canvas ignora la escala del
	// contexto: va en píxeles reales).
	#box(r, radius, color, shadow) {
		const js = this.#js, ctx = js.ctx;
		if (shadow) {
			const dpr = js.dpr || 1;
			const sh = shadow === true ? { blur: 18, y: 5 } : shadow;
			ctx.save();
			ctx.shadowColor = this.theme.shadow;
			ctx.shadowBlur = sh.blur * dpr;
			ctx.shadowOffsetY = sh.y * dpr;
			js.drawRectangleRounded({ x: r.x, y: r.y, width: r.w, height: r.h }, radius, color);
			ctx.restore();
		} else {
			js.drawRectangleRounded({ x: r.x, y: r.y, width: r.w, height: r.h }, radius, color);
		}
	}

	// Recuadro de fondo. Por defecto bloquea el puntero: lo que está debajo no recibe toques.
	// opts: title, blocks (true), radius, color, border (color del borde), shadow (true o { blur, y }).
	panel(rect, opts = {}) {
		const r = this.#rect(rect);
		const s = this.scale, th = this.theme;
		if (opts.blocks !== false) this.#register(null, r, false);
		const radius = (opts.radius ?? th.radius) * s;
		this.#box(r, radius, opts.color || th.panel, opts.shadow);
		this.#js.drawRectangleRoundedLines({ x: r.x + 0.5, y: r.y + 0.5, width: r.w - 1, height: r.h - 1 }, radius, 1, opts.border || th.panelBorder);
		if (opts.title) this.#text(opts.title, r.x + th.padding * s, r.y + th.padding * s + 9 * s, (th.fontSize + 2) * s, th.text, 'left', 700);
	}

	label(text, x, y, opts = {}) {
		const th = this.theme;
		this.#text(String(text), x, y, (opts.size ?? th.fontSize) * this.scale, opts.color || th.text, opts.align || 'left', opts.weight ?? 600);
	}

	// true en el cuadro en que se tocó (o mirar js.ui.clicked === id desde el update).
	// opts: primary, disabled, size, weight (700), radius, textColor,
	//   color: un color de relleno ('#rrggbb') -que se oscurece al apretar y se aclara al pasar
	//          el puntero- o { base, hover, active },
	//   border (color del borde), shadow (true o { blur, y }), gloss (brillo fino arriba),
	//   fit (achica la letra para que el texto entre en vez de recortarlo).
	button(id, rect, label, opts = {}) {
		const r = this.#rect(rect);
		const s = this.scale, th = this.theme;
		const size = (opts.size ?? th.fontSize) * s;
		const weight = opts.weight ?? 700;
		const radius = (opts.radius ?? th.radius) * s;
		const js = this.#js;
		if (opts.disabled) {
			this.#register(null, r, false);
			this.#box(r, radius, th.button, opts.shadow);
			this.#text(label, r.x + r.w / 2, r.y + r.h / 2, size, th.textDisabled, 'center', weight);
			return false;
		}
		this.#register(id, r, true, 'button');

		const focus = this.#hasFocus(id);
		const pressed = id === this.active && id === this.hot;
		const hovered = !pressed && (id === this.hot || id === this.active || focus);
		let fill, overlay = null;
		if (opts.color && typeof opts.color === 'object') {
			fill = pressed ? opts.color.active : hovered ? opts.color.hover : opts.color.base;
		} else if (opts.color) {
			fill = opts.color;
			overlay = pressed ? 'rgba(0,0,0,0.22)' : hovered ? 'rgba(255,255,255,0.08)' : null;
		} else {
			const c = opts.primary
				? { base: th.accent, hover: th.accentHover, active: th.accentActive }
				: { base: th.button, hover: th.buttonHover, active: th.buttonActive };
			fill = pressed ? c.active : hovered ? c.hover : c.base;
		}
		this.#box(r, radius, fill, opts.shadow);
		if (opts.gloss) js.drawRectangleRounded({ x: r.x + 2, y: r.y + 1, width: r.w - 4, height: r.h * 0.45 }, Math.max(0, radius - 2), 'rgba(255,255,255,0.08)');
		if (overlay) js.drawRectangleRounded({ x: r.x, y: r.y, width: r.w, height: r.h }, radius, overlay);
		if (opts.border) js.drawRectangleRoundedLines({ x: r.x + 0.5, y: r.y + 0.5, width: r.w - 1, height: r.h - 1 }, radius, 1, opts.border);
		if (focus) this.#ring(r, radius);

		const textColor = opts.textColor || (opts.primary ? th.accentText : th.text);
		const tsize = opts.fit ? this.#fitSize(label, size, r.w - 16 * s, weight) : size;
		js.beginClippingRect({ x: r.x, y: r.y, width: r.w, height: r.h });
		this.#text(label, r.x + r.w / 2, r.y + r.h / 2, tsize, textColor, 'center', weight);
		js.endClipping();
		return this.clicked === id;
	}

	// Interruptor con texto a la izquierda. Devuelve el valor nuevo (el mismo si no se tocó).
	toggle(id, rect, value, label, opts = {}) {
		const r = this.#rect(rect);
		const s = this.scale, th = this.theme;
		const size = (opts.size ?? th.fontSize) * s;
		const disabled = !!opts.disabled;
		this.#register(disabled ? null : id, r, !disabled, 'toggle');

		const ph = Math.min(r.h * 0.7, 28 * s), pw = ph * 1.8;
		const px = r.x + r.w - pw, py = r.y + (r.h - ph) / 2;
		const hover = !disabled && (this.hot === id || this.active === id || this.#hasFocus(id));
		this.#js.drawRectangleRounded({ x: px, y: py, width: pw, height: ph }, ph / 2, value ? (hover ? th.accentHover : th.accent) : (hover ? th.buttonHover : th.track));
		const kr = ph / 2 - 3 * s;
		const kx = value ? px + pw - ph / 2 : px + ph / 2;
		this.#js.drawCircle({ x: kx, y: py + ph / 2 }, kr, value ? th.accentText : th.knob);
		if (label) this.#text(label, r.x, r.y + r.h / 2, size, disabled ? th.textDisabled : th.text);
		if (!disabled && this.#hasFocus(id)) this.#ring(r, 6 * s);
		return !disabled && this.clicked === id ? !value : value;
	}

	// Barra deslizante horizontal. Devuelve el valor (entre min y max; con opts.step, múltiplo).
	slider(id, rect, value, min = 0, max = 1, opts = {}) {
		const r = this.#rect(rect);
		const s = this.scale, th = this.theme;
		this.#register(id, r, true, 'slider');
		const kr = Math.min(r.h / 2, 11 * s);
		const x0 = r.x + kr, x1 = r.x + r.w - kr, cy = r.y + r.h / 2;

		// un toque que empezó y terminó entre dos cuadros ya no está `active`, pero deja su posición
		const px = this.active === id ? this.#js.getMousePosition().x : this.clicked === id ? this.clickAt.x : null;
		if (px !== null) {
			const t = Math.max(0, Math.min(1, (px - x0) / Math.max(1, x1 - x0)));
			value = min + (max - min) * t;
			if (opts.step) value = Math.max(min, Math.min(max, min + Math.round((value - min) / opts.step) * opts.step));
		}
		// teclado: izquierda y derecha mueven de a un paso (o 1/20 del rango)
		if (this.#nav.dx !== 0 && this.#hasFocus(id)) {
			value = Math.max(min, Math.min(max, value + this.#nav.dx * (opts.step || (max - min) / 20)));
		}
		const t = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
		const th_ = 6 * s;
		this.#js.drawRectangleRounded({ x: x0, y: cy - th_ / 2, width: x1 - x0, height: th_ }, th_ / 2, th.track);
		this.#js.drawRectangleRounded({ x: x0, y: cy - th_ / 2, width: (x1 - x0) * t, height: th_ }, th_ / 2, th.accent);
		const hover = this.hot === id || this.active === id || this.#hasFocus(id);
		this.#js.drawCircle({ x: x0 + (x1 - x0) * t, y: cy }, kr * (hover ? 1 : 0.85), th.knob);
		if (this.#hasFocus(id)) this.#ring(r, Math.min(r.h / 2, 8 * s));
		return value;
	}

	// Lista con desplazamiento (rueda y arrastre). `items`: textos o { label, disabled }.
	// Devuelve el índice tocado, o -1. opts: rowHeight (36), selected (índice resaltado), size (tamaño de la letra).
	list(id, rect, items, opts = {}) {
		const r = this.#rect(rect);
		const s = this.scale, th = this.theme;
		const rowH = (opts.rowHeight ?? 36) * s;
		const total = items.length * rowH;
		const maxScroll = Math.max(0, total - r.h);
		this.#register(id, r, true, 'list');

		let scroll = this.#scroll.get(id) || 0;
		if (this.hot === id || this.active === id) {
			const wheel = this.#js.peekMouseWheelDelta();
			if (wheel && this.hot === id) { scroll += wheel * rowH; this.#js.consumeMouseWheelDelta(); }
		}
		if (this.active === id && this.#dragDist > UI.DRAG_THRESHOLD) {
			const p = this.#js.getMousePosition();
			scroll -= p.y - (this.#dragLastY ?? p.y);
		}
		this.#dragLastY = this.active === id ? this.#js.getMousePosition().y : null;

		// teclado: la fila con foco se mueve con arriba y abajo, salteando las deshabilitadas; al
		// llegar al borde el foco sigue hacia el widget de ese lado
		const focus = this.#hasFocus(id);
		const enabled = i => items[i] !== undefined && !(typeof items[i] === 'object' && items[i].disabled);
		let row = this.#rowFocus.get(id);
		if (row === undefined || row >= items.length || !enabled(row)) row = enabled(opts.selected) ? opts.selected : items.findIndex((_, i) => enabled(i));
		if (focus && this.#nav.dy !== 0) {
			const dir = Math.sign(this.#nav.dy);
			for (let k = 0; k < Math.abs(this.#nav.dy); k++) {
				let j = row + dir;
				while (j >= 0 && j < items.length && !enabled(j)) j += dir;
				if (j < 0 || j >= items.length) { this.#spatial(dir < 0 ? 'up' : 'down'); break; }
				row = j;
			}
			// que la fila se vea
			if (row * rowH < scroll) scroll = row * rowH;
			else if ((row + 1) * rowH > scroll + r.h) scroll = (row + 1) * rowH - r.h;
		}
		this.#rowFocus.set(id, row);
		scroll = Math.max(0, Math.min(maxScroll, scroll));
		this.#scroll.set(id, scroll);

		this.#js.beginClippingRect({ x: r.x, y: r.y, width: r.w, height: r.h });
		const first = Math.max(0, Math.floor(scroll / rowH));
		const last = Math.min(items.length - 1, Math.ceil((scroll + r.h) / rowH));
		const mouse = this.#js.getMousePosition();
		for (let i = first; i <= last; i++) {
			const item = items[i];
			const label = typeof item === 'string' ? item : item.label;
			const disabled = typeof item === 'object' && item.disabled;
			const y = r.y + i * rowH - scroll;
			const over = this.hot === id && mouse.y >= y && mouse.y < y + rowH && this.#dragDist <= UI.DRAG_THRESHOLD;
			if (i === opts.selected) this.#js.drawRectangle({ x: r.x, y, width: r.w, height: rowH }, th.rowSelected);
			if (focus && i === row) this.#js.drawRectangle({ x: r.x, y, width: r.w, height: rowH }, th.focusRow);
			else if (i !== opts.selected && over && !disabled) this.#js.drawRectangle({ x: r.x, y, width: r.w, height: rowH }, th.rowHover);
			this.#text(label, r.x + th.padding * s, y + rowH / 2, (opts.size ?? th.fontSize) * s, disabled ? th.textDisabled : th.text);
		}
		if (maxScroll > 0) {
			const bh = Math.max(20 * s, r.h * r.h / total), by = r.y + (r.h - bh) * (scroll / maxScroll);
			this.#js.drawRectangleRounded({ x: r.x + r.w - 5 * s, y: by, width: 3 * s, height: bh }, 2 * s, 'rgba(255,255,255,0.35)');
		}
		this.#js.endClipping();
		if (focus) this.#ring(r, 4 * s);

		if (this.#acceptRow === id && enabled(row)) return row;
		if (this.clicked === id && !this.clickDragged) {
			const i = Math.floor((this.clickAt.y - r.y + scroll) / rowH);
			const item = items[i];
			if (item && !(typeof item === 'object' && item.disabled)) { this.#rowFocus.set(id, i); return i; }
		}
		return -1;
	}
	#dragLastY = null;

	getScroll(id) {
		return this.#scroll.get(id) || 0;
	}

	setScroll(id, px) {
		this.#scroll.set(id, Math.max(0, px));
	}

	// Menú desplegable: un campo con lo elegido; al tocarlo se abre una lista debajo (o arriba, si
	// abajo no entra) y al elegir una fila se cierra. Devuelve el índice elegido (el mismo si no
	// cambió; -1 = nada elegido, y entonces se muestra `placeholder`). `items`: textos o
	// { label, disabled }. opts: size, radius, disabled, placeholder, rowHeight (32), maxRows (8, a
	// partir de ahí la lista se desplaza), popupWidth (por defecto el del campo), color (fondo de la lista).
	// Se cierra al elegir, con Escape o al apretar afuera (ese toque no llega a lo que haya debajo).
	// Teclado (con `navigation`): Enter o Espacio abren; con la lista abierta, arriba y abajo mueven la
	// fila y Enter elige; con el campo cerrado, arriba y abajo cambian la elección sin abrir.
	// La lista se dibuja en el momento: lo que se declare después encima de ella la tapa. Si el juego
	// llama a `end()` al final de cada cuadro, las listas abiertas se dibujan ahí, siempre encima.
	dropdown(id, rect, items, selected = -1, opts = {}) {
		const r = this.#rect(rect);
		const s = this.scale, th = this.theme, js = this.#js;
		const size = (opts.size ?? th.fontSize) * s;
		const radius = (opts.radius ?? th.radius) * s;
		const enabled = i => items[i] !== undefined && !(typeof items[i] === 'object' && items[i].disabled);
		const label = i => items[i] === undefined ? null : typeof items[i] === 'string' ? items[i] : items[i].label;
		const listId = id + ':list';

		if (opts.disabled) {
			if (this.#open === id) this.#open = null;
			this.#register(null, r, false);
			this.#box(r, radius, th.button);
			this.#dropdownText(r, label(selected) ?? opts.placeholder ?? '', size, th.textDisabled);
			this.#caret(r, th.textDisabled, false);
			return selected;
		}

		this.#register(id, r, true, 'dropdown');
		let isOpen = this.#open === id;
		let value = selected;

		// con el campo cerrado y con el foco, arriba y abajo cambian la elección
		if (!isOpen && this.#hasFocus(id) && this.#nav.dy !== 0) {
			const dir = Math.sign(this.#nav.dy);
			let j = (selected < 0 ? (dir > 0 ? -1 : items.length) : selected) + dir;
			while (j >= 0 && j < items.length && !enabled(j)) j += dir;
			if (j >= 0 && j < items.length) value = j;
		}

		const focus = this.#hasFocus(id);
		const pressed = id === this.active && id === this.hot;
		const hovered = !pressed && (id === this.hot || id === this.active || focus);
		this.#box(r, radius, isOpen || pressed ? th.buttonActive : hovered ? th.buttonHover : th.button);
		js.drawRectangleRoundedLines({ x: r.x + 0.5, y: r.y + 0.5, width: r.w - 1, height: r.h - 1 }, radius, 1, th.panelBorder);
		const text = label(value);
		this.#dropdownText(r, text ?? opts.placeholder ?? '', size, text === null ? th.textDisabled : th.text);
		this.#caret(r, th.text, isOpen);
		if (focus) this.#ring(r, radius);

		if (!isOpen && this.clicked === id) {
			this.#open = id;
			isOpen = true;
			this.#openFresh = true;
			const first = items.findIndex((_, i) => enabled(i));
			this.#rowFocus.set(listId, enabled(selected) ? selected : first);
			this.focused = listId;     // el teclado queda en la lista: arriba y abajo mueven la fila, Enter elige
		}

		if (isOpen) {
			this.#openSeen = true;
			const popup = () => this.#applyPopup(id, this.#drawPopup(id, r, items, selected, opts));
			if (this.#deferOverlays) this.#deferred.push(popup); else popup();
		}

		if (this.#pick && this.#pick.id === id) {
			value = this.#pick.index;
			this.#pick = null;
		}
		return value;
	}

	// Llamar una vez al final de cada cuadro (después de declarar todos los widgets): las listas de
	// los dropdown abiertos se dibujan ahí, encima de todo. La elección hecha en la lista llega al
	// dropdown en el cuadro siguiente. Sin llamarla, la lista se dibuja en el momento.
	end() {
		this.#deferOverlays = true;
		const list = this.#deferred;
		this.#deferred = [];
		for (const f of list) f();
	}

	// Texto del campo, recortado para no pisar la flecha.
	#dropdownText(r, str, size, color) {
		const s = this.scale, pad = this.theme.padding * s;
		this.#js.beginClippingRect({ x: r.x, y: r.y, width: Math.max(0, r.w - 26 * s), height: r.h });
		this.#text(str, r.x + pad, r.y + r.h / 2, size, color, 'left', 600);
		this.#js.endClipping();
	}

	#caret(r, color, up) {
		const ctx = this.#js.ctx, s = this.scale;
		const cx = r.x + r.w - 14 * s, cy = r.y + r.h / 2, w = 5 * s, h = 3 * s * (up ? -1 : 1);
		ctx.save();
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(cx - w, cy - h); ctx.lineTo(cx + w, cy - h); ctx.lineTo(cx, cy + h);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	// Dibuja la lista abierta y devuelve { index, close }: la fila tocada (o -1) y si hay que cerrar.
	#drawPopup(id, r, items, selected, opts) {
		const js = this.#js, th = this.theme, s = this.scale;
		const rowH = (opts.rowHeight ?? 32) * s;
		const W = js.getCanvasWidth(), H = js.getCanvasHeight();
		const gap = 2 * s, margin = 4 * s;
		const want = Math.min(items.length, opts.maxRows ?? 8) * rowH;
		const below = H - (r.y + r.h) - gap - margin, above = r.y - gap - margin;
		const up = want > below && above > below;
		const h = Math.max(0, Math.min(want, up ? above : below));
		const w = opts.popupWidth ? opts.popupWidth * s : r.w;
		const x = Math.max(margin, Math.min(r.x, W - w - margin));
		const y = up ? r.y - gap - h : r.y + r.h + gap;
		const listId = id + ':list';

		if (this.#openFresh) {
			this.#openFresh = false;
			this.#scroll.set(listId, Math.max(0, selected * rowH - (h - rowH) / 2));
		}

		this.#over = true;
		this.#register(null, { x: 0, y: 0, w: W, h: H }, false);   // lo de abajo no recibe toques mientras está abierto
		const box = { x, y, w, h };
		this.#box(box, th.radius * s, opts.color || th.popup, true);
		const index = this.list(listId, { x, y, width: w, height: h }, items, { rowHeight: opts.rowHeight ?? 32, size: opts.size, selected });
		js.drawRectangleRoundedLines({ x: x + 0.5, y: y + 0.5, width: w - 1, height: h - 1 }, th.radius * s, 1, th.panelBorder);
		this.#over = false;
		return { index, close: index >= 0 || this.#dismiss || js.consumeKeyPressed('Escape') };
	}

	#applyPopup(id, res) {
		if (res.index >= 0) this.#pick = { id, index: res.index };
		if (res.close) {
			this.#open = null;
			this.focused = id;     // el foco vuelve al campo
		}
	}

	// Parte `rect` en `n` filas (o columnas) iguales con `gap` entre ellas. Devuelve rectángulos.
	rows(rect, n, gap = 0) {
		const r = this.#rect(rect);
		const h = (r.h - gap * (n - 1)) / n;
		return Array.from({ length: n }, (_, i) => ({ x: r.x, y: r.y + i * (h + gap), width: r.w, height: h }));
	}

	columns(rect, n, gap = 0) {
		const r = this.#rect(rect);
		const w = (r.w - gap * (n - 1)) / n;
		return Array.from({ length: n }, (_, i) => ({ x: r.x + i * (w + gap), y: r.y, width: w, height: r.h }));
	}
}

// --- Acciones de entrada -----------------------------------------------------------------

// Entrada por acciones: el juego pregunta por "saltar" o "mover a la izquierda", no por una
// tecla. Cada acción tiene una o más fuentes (teclado, mouse, gamepad) y se puede reasignar.
// Js2d tiene una instancia (`js.input`); se actualiza sola en tick(), antes de todo lo demás.
//
//   js.input.bind('saltar', 'Space', 'pad:A');
//   js.input.bind('izquierda', 'KeyA', 'ArrowLeft', 'pad:Left', 'pad:LStickLeft');
//   js.input.bind('derecha',   'KeyD', 'ArrowRight', 'pad:Right', 'pad:LStickRight');
//   ...
//   if (js.input.pressed('saltar')) saltar();            // sólo el cuadro en que se apretó
//   if (js.input.isDown('disparar')) disparar();         // mientras está apretada
//   x += js.input.axis('izquierda', 'derecha') * vel * dt;
//   const { x, y } = js.input.vector('izquierda', 'derecha', 'arriba', 'abajo');   // largo <= 1
//
// Fuentes (texto): una tecla por su KeyboardEvent.code ('Space', 'KeyW', 'ArrowUp', 'Enter',
// 'ShiftLeft'...); 'mouse:left' | 'mouse:middle' | 'mouse:right' (el toque en pantalla cuenta
// como 'mouse:left'); y del gamepad 'pad:' + A, B, X, Y, LB, RB, LT, RT, Back, Start, L3, R3,
// Up, Down, Left, Right, Guide, o una dirección de palanca: LStickUp / LStickDown / LStickLeft /
// LStickRight y lo mismo con RStick. Con varios gamepads conectados se suman en uno solo.
class ActionMap {
	static PAD_BUTTONS = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, Back: 8, Start: 9, L3: 10, R3: 11, Up: 12, Down: 13, Left: 14, Right: 15, Guide: 16 };
	static MOUSE_BUTTONS = { left: 0, middle: 1, right: 2 };

	#js;
	#actions = new Map();    // nombre -> { sources: [{ raw, read }], value, down, prev, virtual }
	#padButtons = new Array(17).fill(0);
	#sticks = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } };
	#pads = [];
	#active = new Set();     // fuentes sueltas activas en este cuadro (para reasignar teclas)
	#prevActive = new Set();
	#capture = null;
	#padListeners = [];

	// Zona muerta de las palancas (0 a 1, radial) y valor desde el que una fuente analógica
	// cuenta como apretada.
	deadzone = 0.2;
	threshold = 0.5;
	// Último tipo de dispositivo que se usó: 'keyboard' | 'mouse' | 'gamepad'. Sirve para
	// mostrar las indicaciones del control que el jugador tiene en la mano.
	device = 'keyboard';

	constructor(js) {
		this.#js = js;
	}

	// --- Asignaciones ---

	// Define (o reemplaza) las fuentes de una acción. Acepta varias fuentes o una lista.
	bind(action, ...sources) {
		const raws = sources.flat();
		const parsed = raws.map(raw => this.#parse(raw));
		const prev = this.#actions.get(action);
		this.#actions.set(action, { sources: parsed, value: 0, down: false, prev: false, virtual: prev ? prev.virtual : 0, latchedPress: false, latchedRelease: false });
		return this;
	}

	// bindAll({ saltar: ['Space', 'pad:A'], correr: 'ShiftLeft' })
	bindAll(map) {
		for (const [action, sources] of Object.entries(map)) this.bind(action, sources);
		return this;
	}

	unbind(action) {
		this.#actions.delete(action);
	}

	bindings(action) {
		const a = this.#actions.get(action);
		return a ? a.sources.map(s => s.raw) : [];
	}

	get actions() {
		return [...this.#actions.keys()];
	}

	// Para guardar la configuración del jugador (js.saveJSON) y recuperarla con importBindings.
	exportBindings() {
		const out = {};
		for (const [name, a] of this.#actions) out[name] = a.sources.map(s => s.raw);
		return out;
	}

	importBindings(data) {
		if (data && typeof data === 'object') this.bindAll(data);
		return this;
	}

	#parse(raw) {
		if (typeof raw !== 'string' || !raw) throw new Error(`[Js2d] fuente de entrada inválida: ${raw}`);
		if (raw.startsWith('mouse:')) {
			const i = ActionMap.MOUSE_BUTTONS[raw.slice(6)];
			if (i === undefined) throw new Error(`[Js2d] botón de mouse desconocido: "${raw}"`);
			return { raw, read: () => this.#js.mouseButtons[i] ? 1 : 0 };
		}
		if (raw.startsWith('pad:')) {
			const name = raw.slice(4);
			const b = ActionMap.PAD_BUTTONS[name];
			if (b !== undefined) return { raw, read: () => this.#padButtons[b] };
			const m = /^(L|R)Stick(Up|Down|Left|Right)$/.exec(name);
			if (!m) throw new Error(`[Js2d] control de gamepad desconocido: "${raw}"`);
			const side = m[1], dir = m[2];
			return { raw, read: () => {
				const s = this.#sticks[side];
				return Math.max(0, dir === 'Left' ? -s.x : dir === 'Right' ? s.x : dir === 'Up' ? -s.y : s.y);
			} };
		}
		return { raw, read: () => (this.#js.keysPressed[raw] || this.#js.keyLatch.has(raw)) ? 1 : 0 };
	}

	// --- Lectura ---

	#get(action) {
		const a = this.#actions.get(action);
		if (!a) throw new Error(`[Js2d] acción sin asignar: "${action}"`);
		return a;
	}

	// 0 a 1 (las teclas y botones valen 1; gatillos y palancas, su valor analógico).
	value(action) { return this.#get(action).value; }
	isDown(action) { return this.#get(action).down; }
	// true sólo en el cuadro en que pasó de suelta a apretada (y al revés para released).
	pressed(action) { const a = this.#get(action); return a.down && !a.prev; }
	released(action) { const a = this.#get(action); return !a.down && a.prev; }

	// Para la simulación a paso fijo (ver FixedTimestep): true UNA vez por cada apretada (o
	// soltada), en el primer paso que lo pregunte, aunque la apretada haya llegado en un cuadro
	// sin pasos. Lo que ningún paso consume se descarta cuando termina un run() con pasos.
	consumePressed(action) {
		const a = this.#get(action);
		const v = a.latchedPress;
		a.latchedPress = false;
		return v;
	}

	consumeReleased(action) {
		const a = this.#get(action);
		const v = a.latchedRelease;
		a.latchedRelease = false;
		return v;
	}

	clearLatches() {
		for (const a of this.#actions.values()) a.latchedPress = a.latchedRelease = false;
	}

	// -1 a 1: lo que valga `positive` menos lo que valga `negative`.
	axis(negative, positive) {
		return this.value(positive) - this.value(negative);
	}

	// Dirección en 2D a partir de cuatro acciones. El largo nunca pasa de 1, así que en diagonal
	// con el teclado no se corre más rápido.
	vector(left, right, up, down) {
		let x = this.axis(left, right), y = this.axis(up, down);
		const len = Math.hypot(x, y);
		if (len > 1) { x /= len; y /= len; }
		return { x, y };
	}

	// Controles en pantalla (botones táctiles): fija el valor de una acción sin dispositivo real.
	// Se mantiene hasta que se vuelva a fijar (0 la suelta).
	setVirtual(action, value) {
		this.#get(action).virtual = Math.max(0, Math.min(1, value));
	}

	// --- Gamepad ---

	get gamepads() {
		return this.#pads.map(p => ({ index: p.index, id: p.id }));
	}

	// fn({ connected, index, id }) cuando se conecta o desconecta un gamepad. Devuelve cómo
	// dejar de escuchar.
	onGamepad(fn) {
		this.#padListeners.push(fn);
		return () => { this.#padListeners = this.#padListeners.filter(f => f !== fn); };
	}

	handleGamepadEvent(connected, pad) {
		for (const fn of [...this.#padListeners]) fn({ connected, index: pad.index, id: pad.id });
	}

	// Vibración en todos los gamepads que la tengan (los demás la ignoran). `weak` y `strong`
	// van de 0 a 1.
	rumble({ duration = 200, weak = 0.5, strong = 0.5 } = {}) {
		for (const p of this.#pads) {
			const act = p.vibrationActuator;
			if (act && act.playEffect) {
				try { act.playEffect('dual-rumble', { duration, weakMagnitude: weak, strongMagnitude: strong }); } catch (_) { /* sin soporte */ }
			}
		}
	}

	// --- Reasignar teclas ---

	// Espera al próximo control que el jugador apriete y devuelve su nombre ('KeyJ', 'pad:X'...)
	// para pasárselo a bind(). Escape cancela (devuelve null; cambialo con `cancel`). Lo que ya
	// estaba apretado al empezar (el clic que abrió el diálogo) no cuenta. El mouse queda
	// afuera salvo que se pida con `mouse: true`.
	captureNext({ cancel = 'Escape', mouse = false } = {}) {
		if (this.#capture) this.#capture.resolve(null);
		return new Promise(resolve => { this.#capture = { resolve, cancel, mouse }; });
	}

	// --- Cuadro ---

	// La llama tick() una vez por cuadro.
	update() {
		const js = this.#js;
		this.#pollPads();

		const now = new Set();
		for (const k of Object.keys(js.keysPressed)) if (js.keysPressed[k]) now.add(k);
		for (const k of js.keyLatch) now.add(k);
		if (js.mouseButtons[0]) now.add('mouse:left');
		if (js.mouseButtons[1]) now.add('mouse:middle');
		if (js.mouseButtons[2]) now.add('mouse:right');
		for (const [name, i] of Object.entries(ActionMap.PAD_BUTTONS)) if (this.#padButtons[i] >= this.threshold) now.add('pad:' + name);
		for (const side of ['L', 'R']) {
			const s = this.#sticks[side];
			if (s.x <= -0.7) now.add(`pad:${side}StickLeft`);
			if (s.x >= 0.7) now.add(`pad:${side}StickRight`);
			if (s.y <= -0.7) now.add(`pad:${side}StickUp`);
			if (s.y >= 0.7) now.add(`pad:${side}StickDown`);
		}

		for (const a of this.#actions.values()) {
			let v = a.virtual;
			for (const s of a.sources) v = Math.max(v, s.read());
			a.prev = a.down;
			a.value = v;
			a.down = v >= this.threshold;
			if (a.down && !a.prev) a.latchedPress = true;
			if (!a.down && a.prev) a.latchedRelease = true;
		}

		let newDevice = null;
		let fresh = null;
		for (const raw of now) {
			if (this.#prevActive.has(raw)) continue;
			newDevice = raw.startsWith('pad:') ? 'gamepad' : raw.startsWith('mouse:') ? 'mouse' : 'keyboard';
			if (this.#capture && fresh === null && (this.#capture.mouse || !raw.startsWith('mouse:'))) fresh = raw;
		}
		if (newDevice) this.device = newDevice;

		if (this.#capture && fresh !== null) {
			const { resolve, cancel } = this.#capture;
			this.#capture = null;
			resolve(fresh === cancel ? null : fresh);
		}

		this.#prevActive = now;
		this.#active = now;
		js.keyLatch.clear();
	}

	#pollPads() {
		const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
		this.#pads = Array.from(list || []).filter(p => p && p.connected !== false);
		this.#padButtons.fill(0);
		const sticks = { L: { x: 0, y: 0, m: 0 }, R: { x: 0, y: 0, m: 0 } };
		for (const p of this.#pads) {
			for (let i = 0; i < 17; i++) {
				const b = p.buttons[i];
				if (!b) continue;
				const v = b.value > 0 ? b.value : (b.pressed ? 1 : 0);
				if (v > this.#padButtons[i]) this.#padButtons[i] = v;
			}
			for (const [side, ax, ay] of [['L', 0, 1], ['R', 2, 3]]) {
				const x = p.axes[ax] || 0, y = p.axes[ay] || 0;
				const m = Math.hypot(x, y);
				if (m > sticks[side].m) sticks[side] = { x, y, m };
			}
		}
		// zona muerta radial: bajo `deadzone` es 0, y por encima se reescala para que empiece en 0
		for (const side of ['L', 'R']) {
			const s = sticks[side];
			if (s.m < this.deadzone) { this.#sticks[side] = { x: 0, y: 0 }; continue; }
			const scale = Math.min(1, (s.m - this.deadzone) / (1 - this.deadzone)) / s.m;
			this.#sticks[side] = { x: s.x * scale, y: s.y * scale };
		}
	}

	reset() {
		this.#actions.clear();
		this.#padListeners = [];
		if (this.#capture) this.#capture.resolve(null);
		this.#capture = null;
		this.#prevActive = new Set();
	}
}

// --- Paso fijo de simulación -------------------------------------------------------------

// Simulación a paso fijo con dibujo a velocidad variable: la lógica (física, IA, reglas) avanza
// siempre en pasos de 1/hz segundos, aunque la pantalla vaya a 30, 60 o 144 cuadros por segundo,
// y por eso se comporta igual en cualquier máquina. Js2d tiene uno (`js.fixed`); acumula el
// tiempo solo en tick() y el juego consume los pasos cuando quiere:
//
//   js.tick(ts);
//   js.fixed.run((dt, i) => {                     // 0, 1 o más veces por cuadro
//       if (js.input.consumePressed('saltar')) jugador.saltar();
//       mundo.paso(dt);
//   });
//   dibujar(js.fixed.alpha);                      // 0 a 1: cuánto pasó desde el último paso
//
// Para que el movimiento no se vea a saltos en pantallas más rápidas que `hz`, se dibuja
// interpolando entre el estado anterior y el actual con `alpha`:
//   x = Js2d.lerp(jugador.xAnterior, jugador.x, js.fixed.alpha)
//
// Ojo con las teclas: dentro de un paso no uses input.pressed() (un cuadro con varios pasos
// la vería en todos, y un cuadro sin pasos la perdería). Usá input.consumePressed() /
// consumeReleased(): cada apretada la recibe un solo paso, aunque llegue en un cuadro sin pasos.
class FixedTimestep {
	#js;
	#acc = 0;

	// Pasos por segundo.
	hz = 60;
	// Tope de pasos por cuadro: si la máquina no da abasto, el tiempo de más se descarta (en
	// vez de intentar alcanzarlo y volverse cada vez más lenta).
	maxSteps = 5;
	// Margen en segundos que absorbe el jitter del navegador: a 60 Hz los cuadros miden 16,2 y
	// 17,1 ms y sin esto, de tanto en tanto, un cuadro se queda sin paso y el siguiente hace dos.
	tolerance = 0.002;
	paused = false;
	// Cámara lenta (0,5) o rápida (2) de toda la simulación.
	timeScale = 1;

	// De sólo lectura: pasos del último run(), si se llegó al tope, fracción del paso pendiente
	// de simular, y totales desde reset() (útiles para repeticiones y para que dos corridas
	// con las mismas entradas den lo mismo).
	steps = 0;
	lagged = false;
	alpha = 0;
	ticks = 0;
	time = 0;

	constructor(js) {
		this.#js = js;
	}

	get step() {
		return 1 / this.hz;
	}

	// La llama tick() una vez por cuadro.
	add(frameTime) {
		if (this.paused) return;
		const step = this.step;
		this.#acc = Math.min(this.#acc + frameTime * this.timeScale, step * (this.maxSteps + 1));
	}

	// Corre `fn(dt, i, n)` una vez por cada paso pendiente (i: número de paso en este cuadro,
	// n: cuántos hay). Devuelve cuántos corrió. Si fn devuelve false, corta ahí.
	run(fn) {
		const step = this.step;
		let n = Math.max(0, Math.floor((this.#acc + this.tolerance) / step));
		this.lagged = n > this.maxSteps;
		if (this.lagged) {
			n = this.maxSteps;
			this.#acc = n * step;   // lo que sobra se descarta
		}
		let done = 0;
		for (let i = 0; i < n; i++) {
			done++;
			const r = fn(step, i, n);
			this.ticks++;
			this.time += step;
			if (r === false) break;
		}
		this.#acc -= done * step;
		this.steps = done;
		this.alpha = Math.max(0, Math.min(1, this.#acc / step));
		if (done > 0) this.#js.input.clearLatches();
		return done;
	}

	reset() {
		this.#acc = 0;
		this.steps = 0;
		this.alpha = 0;
		this.lagged = false;
		this.ticks = 0;
		this.time = 0;
	}
}

// Colisiones geométricas puras (no tocan el canvas ni el estado del motor).
// Formas: rect {x, y, width, height} (x, y es la esquina de arriba a la izquierda), círculo
// {x, y, radius}, segmento {x1, y1, x2, y2}, y polígono = array de {x, y} (convexo para
// polygons/polygonCircle; el mismo formato que devuelve getPolygonPoints). Igual que
// checkCollisionRectRect, tocarse nada más no es chocar: hace falta un solape.
//
// Las funciones de solape devuelven null si no chocan, o { nx, ny, depth }: la dirección (unitaria)
// y la distancia en que hay que mover el PRIMER argumento para que deje de tocar al segundo
// (para mover el segundo, se invierte el signo). Las de segmento y rayo devuelven
// { t, x, y, nx, ny }: dónde pega (t va de 0 a 1 a lo largo del segmento), el punto y la normal de la
// superficie; si el segmento ya empieza adentro, t es 0, inside es true y la normal es (0, 0).
const Collision = (() => {
	const EPS = 1e-9;
	const kindOf = s => Array.isArray(s) ? 'polygon' : ('radius' in s ? 'circle' : 'rect');
	const hit = (s, t, nx, ny) => ({ t, x: s.x1 + (s.x2 - s.x1) * t, y: s.y1 + (s.y2 - s.y1) * t, nx, ny });
	const centroid = pts => {
		let x = 0, y = 0;
		for (const p of pts) { x += p.x; y += p.y; }
		return { x: x / pts.length, y: y / pts.length };
	};

	// Segmento contra rect (método de las losas). Un segmento que empieza adentro da t = 0.
	// Con `strict` el borde no cuenta (el rect es abierto): sirve para mover un rect que está
	// apoyado en otro sin que se enganche.
	function segmentRect(s, r, strict = false) {
		const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
		let tmin = 0, tmax = 1, nx = 0, ny = 0;
		const axes = [[s.x1, dx, r.x, r.x + r.width, 1, 0], [s.y1, dy, r.y, r.y + r.height, 0, 1]];
		for (const [o, d, lo, hi, ax, ay] of axes) {
			if (Math.abs(d) < EPS) {
				const e = strict ? EPS : 0;
				if (o < lo + e || o > hi - e) return null;
				continue;
			}
			let t1 = (lo - o) / d, t2 = (hi - o) / d, sign = -1;   // se entra por el lado de arriba/izquierda: la normal apunta para atrás
			if (t1 > t2) { const k = t1; t1 = t2; t2 = k; sign = 1; }
			if (t1 >= tmin) { tmin = t1; nx = ax * sign; ny = ay * sign; }
			if (t2 < tmax) tmax = t2;
		}
		if (strict ? tmax <= tmin + EPS : tmax < tmin) return null;
		if (nx === 0 && ny === 0) { const h = hit(s, 0, 0, 0); h.inside = true; return h; }
		return hit(s, tmin, nx, ny);
	}

	function segmentCircle(s, c) {
		const dx = s.x2 - s.x1, dy = s.y2 - s.y1, fx = s.x1 - c.x, fy = s.y1 - c.y;
		const a = dx * dx + dy * dy, k = fx * fx + fy * fy - c.radius * c.radius;
		if (k < 0) { const h = hit(s, 0, 0, 0); h.inside = true; return h; }
		if (a === 0) return null;
		const b = 2 * (fx * dx + fy * dy), disc = b * b - 4 * a * k;
		if (disc < 0) return null;
		const t = (-b - Math.sqrt(disc)) / (2 * a);
		if (t < 0 || t > 1) return null;
		const h = hit(s, t, 0, 0);
		h.nx = (h.x - c.x) / c.radius; h.ny = (h.y - c.y) / c.radius;
		return h;
	}

	// Segmento contra segmento: t es la posición en `a`, u la de `b`. null si son paralelos.
	function segmentSegment(a, b) {
		const rx = a.x2 - a.x1, ry = a.y2 - a.y1, sx = b.x2 - b.x1, sy = b.y2 - b.y1;
		const den = rx * sy - ry * sx;
		if (Math.abs(den) < EPS) return null;
		const qx = b.x1 - a.x1, qy = b.y1 - a.y1;
		const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
		if (t < 0 || t > 1 || u < 0 || u > 1) return null;
		const len = Math.hypot(sx, sy);
		let nx = -sy / len, ny = sx / len;
		if (nx * rx + ny * ry > 0) { nx = -nx; ny = -ny; }   // la normal mira hacia donde viene `a`
		const h = hit(a, t, nx, ny);
		h.u = u;
		return h;
	}

	// Segmento contra polígono (el borde más cercano al comienzo). Si empieza adentro, t = 0.
	function segmentPolygon(s, pts) {
		if (pointInPolygon(s.x1, s.y1, pts)) { const h = hit(s, 0, 0, 0); h.inside = true; return h; }
		let best = null;
		for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
			const h = segmentSegment(s, { x1: pts[j].x, y1: pts[j].y, x2: pts[i].x, y2: pts[i].y });
			if (h && (!best || h.t < best.t)) best = h;
		}
		if (best) delete best.u;
		return best;
	}

	function pointInPolygon(x, y, pts) {
		let inside = false;
		for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
			if (((pts[i].y > y) !== (pts[j].y > y)) && (x < (pts[j].x - pts[i].x) * (y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x)) inside = !inside;
		}
		return inside;
	}

	// Segmento contra cualquier forma.
	function segment(s, shape) {
		const k = kindOf(shape);
		return k === 'rect' ? segmentRect(s, shape) : k === 'circle' ? segmentCircle(s, shape) : segmentPolygon(s, shape);
	}

	// Rayo desde `origin` en la dirección `direction` (no hace falta que sea unitaria) contra una
	// lista de formas; devuelve el primer impacto { shape, distance, x, y, nx, ny, inside } o null.
	// `filter(forma)` puede descartar formas. maxDistance acota el rayo (sin tope por defecto).
	function raycast(origin, direction, shapes, maxDistance = Infinity, filter = null) {
		const len = Math.hypot(direction.x, direction.y);
		if (len === 0) return null;
		const reach = Number.isFinite(maxDistance) ? maxDistance : 1e9;
		const s = { x1: origin.x, y1: origin.y, x2: origin.x + direction.x / len * reach, y2: origin.y + direction.y / len * reach };
		let best = null;
		for (const shape of shapes) {
			if (filter && !filter(shape)) continue;
			const h = segment(s, shape);
			if (h && (!best || h.t < best.t)) { best = h; best.shape = shape; }
		}
		if (!best) return null;
		best.distance = best.t * reach;
		return best;
	}

	// --- Solapes: cuánto y para dónde mover `a` para que deje de tocar a `b` ---

	function rects(a, b) {
		const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
		const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
		if (ox <= 0 || oy <= 0) return null;
		if (ox < oy) return { nx: a.x + a.width / 2 < b.x + b.width / 2 ? -1 : 1, ny: 0, depth: ox };
		return { nx: 0, ny: a.y + a.height / 2 < b.y + b.height / 2 ? -1 : 1, depth: oy };
	}

	function circles(a, b) {
		const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), depth = a.radius + b.radius - d;
		if (depth <= 0) return null;
		return d === 0 ? { nx: 0, ny: -1, depth } : { nx: dx / d, ny: dy / d, depth };
	}

	function circleRect(c, r) {
		const px = Math.max(r.x, Math.min(c.x, r.x + r.width)), py = Math.max(r.y, Math.min(c.y, r.y + r.height));
		const dx = c.x - px, dy = c.y - py, d = Math.hypot(dx, dy);
		if (d > 0) return d < c.radius ? { nx: dx / d, ny: dy / d, depth: c.radius - d } : null;
		// el centro está adentro del rect: se saca por el lado más cercano
		const l = c.x - r.x, rr = r.x + r.width - c.x, t = c.y - r.y, b = r.y + r.height - c.y, m = Math.min(l, rr, t, b);
		if (m === l) return { nx: -1, ny: 0, depth: l + c.radius };
		if (m === rr) return { nx: 1, ny: 0, depth: rr + c.radius };
		if (m === t) return { nx: 0, ny: -1, depth: t + c.radius };
		return { nx: 0, ny: 1, depth: b + c.radius };
	}

	// Teorema de los ejes separadores. `axes` son direcciones unitarias; project(axis) -> [min, max] de cada forma.
	function sat(axes, projA, projB, ca, cb) {
		let best = null;
		for (const ax of axes) {
			const [a0, a1] = projA(ax), [b0, b1] = projB(ax);
			const o = Math.min(a1, b1) - Math.max(a0, b0);
			if (o <= 0) return null;
			if (!best || o < best.depth) best = { nx: ax.x, ny: ax.y, depth: o };
		}
		if (best && best.nx * (ca.x - cb.x) + best.ny * (ca.y - cb.y) < 0) { best.nx = -best.nx; best.ny = -best.ny; }
		return best;
	}
	const edgeAxes = pts => pts.map((p, i) => {
		const q = pts[(i + 1) % pts.length], ex = q.x - p.x, ey = q.y - p.y, l = Math.hypot(ex, ey) || 1;
		return { x: -ey / l, y: ex / l };
	});
	const projectPoly = pts => ax => {
		let lo = Infinity, hi = -Infinity;
		for (const p of pts) { const v = p.x * ax.x + p.y * ax.y; if (v < lo) lo = v; if (v > hi) hi = v; }
		return [lo, hi];
	};

	// Dos polígonos convexos.
	function polygons(a, b) {
		return sat([...edgeAxes(a), ...edgeAxes(b)], projectPoly(a), projectPoly(b), centroid(a), centroid(b));
	}

	// Polígono convexo contra círculo (se mueve el polígono; para mover el círculo, se invierte).
	function polygonCircle(pts, c) {
		let near = pts[0], nd = Infinity;
		for (const p of pts) { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < nd) { nd = d; near = p; } }
		const axes = edgeAxes(pts);
		if (nd > 0) axes.push({ x: (near.x - c.x) / nd, y: (near.y - c.y) / nd });
		return sat(axes, projectPoly(pts), ax => { const v = c.x * ax.x + c.y * ax.y; return [v - c.radius, v + c.radius]; }, centroid(pts), c);
	}

	// Solape entre dos formas cualesquiera (rect, círculo o polígono), mueve `a`.
	function overlap(a, b) {
		const ka = kindOf(a), kb = kindOf(b);
		if (ka === 'rect' && kb === 'rect') return rects(a, b);
		if (ka === 'circle' && kb === 'circle') return circles(a, b);
		if (ka === 'circle' && kb === 'rect') return circleRect(a, b);
		if (ka === 'rect' && kb === 'circle') { const r = circleRect(b, a); return r && { nx: -r.nx, ny: -r.ny, depth: r.depth }; }
		const pa = ka === 'polygon' ? a : rectPoints(a), pb = kb === 'polygon' ? b : rectPoints(b);
		if (ka === 'polygon' && kb === 'circle') return polygonCircle(a, b);
		if (ka === 'circle' && kb === 'polygon') { const r = polygonCircle(b, a); return r && { nx: -r.nx, ny: -r.ny, depth: r.depth }; }
		if (ka === 'circle' || kb === 'circle') return null;
		return polygons(pa, pb);
	}
	const rectPoints = r => [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }];

	// --- Movimiento ---

	// Mueve el rect `moving` por (dx, dy) hasta que toque a `rect`. Devuelve { t, nx, ny } (t de 0 a 1:
	// la parte del recorrido que se puede hacer; la normal apunta para donde hay que rebotar o deslizar)
	// o null si el recorrido está libre. Apoyarse sobre un rect sin entrar no cuenta como choque.
	function sweepRect(moving, dx, dy, rect) {
		const grown = { x: rect.x - moving.width, y: rect.y - moving.height, width: rect.width + moving.width, height: rect.height + moving.height };
		const h = segmentRect({ x1: moving.x, y1: moving.y, x2: moving.x + dx, y2: moving.y + dy }, grown, true);
		if (!h || h.inside) return null;
		return { t: h.t, nx: h.nx, ny: h.ny };
	}

	// El primer rect de `solids` que se lleva por delante `moving` al moverlo (dx, dy).
	function sweepRects(moving, dx, dy, solids) {
		let best = null;
		for (const s of solids) {
			const h = sweepRect(moving, dx, dy, s);
			if (h && (!best || h.t < best.t)) { best = h; best.solid = s; }
		}
		return best;
	}

	// Movimiento de plataformero: mueve primero en X y después en Y, frenándose contra los rects
	// de `solids` (nada atraviesa nada, por rápido que vaya). Devuelve { x, y, left, right, top,
	// bottom, solids }: la posición final, de qué lados chocó y contra qué. Para deslizar contra una
	// pared se llama con el movimiento completo; el eje que choca se frena y el otro sigue.
	function moveAndCollide(rect, dx, dy, solids) {
		const out = { x: rect.x, y: rect.y, left: false, right: false, top: false, bottom: false, solids: [] };
		const cur = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
		for (const axis of ['x', 'y']) {
			const d = axis === 'x' ? dx : dy;
			if (d === 0) continue;
			const h = sweepRects(cur, axis === 'x' ? d : 0, axis === 'y' ? d : 0, solids);
			if (h) {
				const sol = h.solid;   // se pega al borde exacto, sin el error de la multiplicación
				cur[axis] = axis === 'x' ? (d > 0 ? sol.x - cur.width : sol.x + sol.width) : (d > 0 ? sol.y - cur.height : sol.y + sol.height);
				if (axis === 'x') out[d > 0 ? 'right' : 'left'] = true; else out[d > 0 ? 'bottom' : 'top'] = true;
				out.solids.push(h.solid);
			} else cur[axis] += d;
		}
		out.x = cur.x; out.y = cur.y;
		return out;
	}

	return { segmentRect, segmentCircle, segmentSegment, segmentPolygon, segment, raycast, rects, circles, circleRect, polygons, polygonCircle, overlap, sweepRect, sweepRects, moveAndCollide, pointInPolygon, kindOf };
})();

// Rejilla espacial: para no comparar cada objeto contra todos los demás. Cada objeto se anota en
// las celdas que toca su caja; una consulta mira sólo las celdas del área pedida. `cellSize` conviene
// que sea parecido al objeto típico (un poco más grande). Los objetos pueden ser cualquier cosa: la
// caja se pasa aparte, o se toma del propio objeto si tiene x, y, width y height.
//   const grid = new SpatialGrid(64);
//   for (const e of enemigos) grid.insert(e);
//   grid.query({ x, y, width, height })       // -> objetos cuya caja toca esa área
//   grid.pairs()                              // -> [[a, b], ...] cajas que se tocan, cada par una vez
//   grid.update(e)                            // si se movió (también acepta una caja nueva)
class SpatialGrid {
	#cells = new Map();   // "cx,cy" -> Set de objetos
	#boxes = new Map();   // objeto -> { x, y, width, height, id, x0, y0, x1, y1 }
	#nextId = 0;

	constructor(cellSize = 64) {
		this.cellSize = cellSize;
	}

	get size() { return this.#boxes.size; }

	#range(b) {
		const c = this.cellSize;
		return { x0: Math.floor(b.x / c), y0: Math.floor(b.y / c), x1: Math.floor((b.x + b.width) / c), y1: Math.floor((b.y + b.height) / c) };
	}

	#link(item, rec) {
		for (let cx = rec.x0; cx <= rec.x1; cx++) for (let cy = rec.y0; cy <= rec.y1; cy++) {
			const key = cx + ',' + cy;
			let set = this.#cells.get(key);
			if (!set) this.#cells.set(key, set = new Set());
			set.add(item);
		}
	}

	#unlink(item, rec) {
		for (let cx = rec.x0; cx <= rec.x1; cx++) for (let cy = rec.y0; cy <= rec.y1; cy++) {
			const key = cx + ',' + cy, set = this.#cells.get(key);
			if (set) { set.delete(item); if (set.size === 0) this.#cells.delete(key); }
		}
	}

	insert(item, box = item) {
		this.remove(item);
		const rec = { x: box.x, y: box.y, width: box.width, height: box.height, id: this.#nextId++ };
		Object.assign(rec, this.#range(rec));
		this.#boxes.set(item, rec);
		this.#link(item, rec);
		return item;
	}

	// Vuelve a anotar un objeto que se movió (si no estaba, lo inserta).
	update(item, box = item) {
		const old = this.#boxes.get(item);
		if (!old) return this.insert(item, box);
		const rec = { x: box.x, y: box.y, width: box.width, height: box.height, id: old.id };
		Object.assign(rec, this.#range(rec));
		if (rec.x0 !== old.x0 || rec.y0 !== old.y0 || rec.x1 !== old.x1 || rec.y1 !== old.y1) {
			this.#unlink(item, old);
			this.#link(item, rec);
		}
		this.#boxes.set(item, rec);
		return item;
	}

	remove(item) {
		const rec = this.#boxes.get(item);
		if (!rec) return false;
		this.#unlink(item, rec);
		this.#boxes.delete(item);
		return true;
	}

	has(item) { return this.#boxes.has(item); }

	clear() {
		this.#cells.clear();
		this.#boxes.clear();
	}

	// Objetos cuya caja se solapa con `area` (tocarse nada más no cuenta).
	query(area, out = []) {
		const seen = new Set(), r = this.#range(area);
		for (let cx = r.x0; cx <= r.x1; cx++) for (let cy = r.y0; cy <= r.y1; cy++) {
			const set = this.#cells.get(cx + ',' + cy);
			if (!set) continue;
			for (const item of set) {
				if (seen.has(item)) continue;
				seen.add(item);
				const b = this.#boxes.get(item);
				if (b.x < area.x + area.width && b.x + b.width > area.x && b.y < area.y + area.height && b.y + b.height > area.y) out.push(item);
			}
		}
		return out;
	}

	// Objetos cuya caja contiene el punto.
	queryPoint(x, y, out = []) {
		const set = this.#cells.get(Math.floor(x / this.cellSize) + ',' + Math.floor(y / this.cellSize));
		if (set) for (const item of set) {
			const b = this.#boxes.get(item);
			if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) out.push(item);
		}
		return out;
	}

	// Objetos cuya caja cruza el segmento, del más cercano al comienzo al más lejano.
	querySegment(s, out = []) {
		const area = { x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2), width: Math.abs(s.x2 - s.x1), height: Math.abs(s.y2 - s.y1) };
		const found = [];
		const r = this.#range(area), seen = new Set();
		for (let cx = r.x0; cx <= r.x1; cx++) for (let cy = r.y0; cy <= r.y1; cy++) {
			const set = this.#cells.get(cx + ',' + cy);
			if (!set) continue;
			for (const item of set) {
				if (seen.has(item)) continue;
				seen.add(item);
				const h = Collision.segmentRect(s, this.#boxes.get(item));
				if (h) found.push([h.t, item]);
			}
		}
		found.sort((a, b) => a[0] - b[0]);
		for (const [, item] of found) out.push(item);
		return out;
	}

	// Todos los pares de objetos cuyas cajas se solapan, cada uno una sola vez.
	pairs(out = []) {
		const done = new Set();
		for (const set of this.#cells.values()) {
			if (set.size < 2) continue;
			const items = [...set];
			for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
				const a = this.#boxes.get(items[i]), b = this.#boxes.get(items[j]);
				const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
				if (done.has(key)) continue;
				done.add(key);
				if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) out.push([items[i], items[j]]);
			}
		}
		return out;
	}
}

class SpriteFont {
	constructor(image, charWidth, charHeight, charMap) {
		this.image = image;
		this.charWidth = charWidth;
		this.charHeight = charHeight;
		this.charMap = charMap;
	}
}

class Js2d {
	static VERSION = "1.1";

	canvas = null;
	ctx = null;
	audioCtx = null;
	keysPressed = {};
	// Teclas que se apretaron desde el último tick(), aunque ya las hayan soltado: un golpe de
	// teclado más corto que un cuadro no se pierde (lo lee js.input).
	keyLatch = new Set();
	masterVolume = 1.0;

	// --- Entrada de texto por teclado ---
	// El motor dibuja sobre un canvas: no hay <input> al que el navegador le mande las teclas,
	// así que para escribir hay que juntar los caracteres a mano. Mientras la captura está
	// prendida (startTextCapture) las teclas NO pasan a keysPressed: si pasaran, escribir una
	// frase manejaría también la navegación por teclado del juego (Tab/Enter/Espacio/flechas,
	// ver update en game.js) y un Escape en medio de una palabra abriría el menú de pausa.
	textCapture = false;
	textBuffer = '';
	textMaxLength = 0;
	// Se consumen de a uno (consumeTextSubmit/consumeTextCancel): el keydown pasa cuando pasa,
	// y quien lo lee es el update del cuadro siguiente.
	#textSubmitted = false;
	#textCancelled = false;

	static clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}
	
	static lerp(a, b, t) {
		return a + (b - a) * t;
	}

	// Suavizado exponencial frame-rate independiente: persigue `target` desde `current` sin
	// importar el framerate real (a diferencia de un lerp con un `t` fijo por cuadro, que
	// converge distinto según cuántos cuadros por segundo corra el juego). `speed` más alto
	// alcanza el objetivo más rápido. Mismo patrón que ya reimplementan a mano los juegos que
	// usan este motor para animar barras de progreso, precios, o cualquier valor que no debe
	// saltar de golpe cuando cambia — acá queda una sola vez, reusable.
	static smooth(current, target, speed, dt) {
		const t = 1 - Math.exp(-speed * dt);
		return Js2d.lerp(current, target, t);
	}

	static inverseLerp(a, b, value) {
		return (value - a) / (b - a);
	}
	
	static map(value, inMin, inMax, outMin, outMax) {
		return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
	}
	
	static distance(x1, y1, x2, y2) {
		const dx = x2 - x1;
		const dy = y2 - y1;
		return Math.sqrt(dx * dx + dy * dy);
	}
	
	static randomRange(min, max) {
		return min + Math.random() * (max - min);
	}
	
	static randomInt(min, max) {
		return Math.floor(min + Math.random() * (max - min + 1));
	}

	lerpColor(color1, color2, t) {
		const clampT = Math.max(0, Math.min(1, t));
		const parseHex = color => {
			if (typeof color !== 'string') return { r: 255, g: 255, b: 255 };
			if (color.startsWith('#')) {
				const hex = color.slice(1);
				if (hex.length === 3) {
					const r = parseInt(hex[0] + hex[0], 16);
					const g = parseInt(hex[1] + hex[1], 16);
					const b = parseInt(hex[2] + hex[2], 16);
					return { r, g, b };
				}
				return {
					r: parseInt(hex.substring(0, 2), 16),
					g: parseInt(hex.substring(2, 4), 16),
					b: parseInt(hex.substring(4, 6), 16)
				};
			}
			switch (color.toLowerCase()) {
				case 'white': return { r: 255, g: 255, b: 255 };
				case 'black': return { r: 0, g: 0, b: 0 };
				case 'red': return { r: 255, g: 0, b: 0 };
				case 'green': return { r: 0, g: 255, b: 0 };
				case 'blue': return { r: 0, g: 0, b: 255 };
				default: return { r: 255, g: 255, b: 255 };
			}
		};

		const c1 = parseHex(color1);
		const c2 = parseHex(color2);
		const r = Math.round(c1.r + (c2.r - c1.r) * clampT);
		const g = Math.round(c1.g + (c2.g - c1.g) * clampT);
		const b = Math.round(c1.b + (c2.b - c1.b) * clampT);
		return `rgb(${r}, ${g}, ${b})`;
	}

	truncateText(text, maxWidth, fontSize, fontFamily = 'monospace', ellipsis = '...') {
		this.ctx.save();
		this.ctx.font = `${fontSize}px ${fontFamily}`;
		
		if (this.ctx.measureText(text).width <= maxWidth) {
			this.ctx.restore();
			return text;
		}
		
		let truncated = text;
		while (truncated.length > 0 && this.ctx.measureText(truncated + ellipsis).width > maxWidth) {
			truncated = truncated.slice(0, -1);
		}
		
		this.ctx.restore();
		return truncated + ellipsis;
	}

	mousePos = { x: 0, y: 0 };
    mouseButtons = [false, false, false]; // [izquierdo, medio, derecho]
    touchEventHandlers = { start: [], move: [], end: [], cancel: [] };
    mouseWheelDelta = 0;

	// Flancos del puntero (mouse o toque) desde la última vez que se consumieron: un toque que
	// empieza y termina entre dos cuadros no se pierde, como pasaría mirando sólo mouseButtons.
	// 'mouse' o 'touch': con qué se tocó por última vez (la interfaz no resalta por "hover" con el dedo).
	pointerType = 'mouse';
	pointerEvents = { pressed: false, released: false, canceled: false, pressX: 0, pressY: 0, releaseX: 0, releaseY: 0 };

	// Tweens activos (ver tween()). Se avanzan solos en tick().
	tweens = new TweenManager();

	// Escenas (ver SceneManager).
	scenes = new SceneManager(this);

	// Partículas (ver ParticleSystem). Se avanzan solas en tick(); el juego llama a
	// js.particles.draw() donde quiera que se vean.
	particles = new ParticleSystem(this);

	// Interfaz (ver UI): botones, interruptores, sliders y listas en modo inmediato.
	ui = new UI(this);

	// Entrada por acciones (ver ActionMap). Se actualiza sola en tick().
	input = new ActionMap(this);

	// Paso fijo de simulación (ver FixedTimestep). Acumula en tick(); el juego llama a js.fixed.run().
	fixed = new FixedTimestep(this);

	// Screen shake (ver shake()). `shakeEnabled = false` lo apaga del todo, para una opción
	// de accesibilidad en los ajustes del juego. `shakeOffset` es lo que se está aplicando.
	shakeEnabled = true;
	shakeOffset = { x: 0, y: 0, rotation: 0 };
	#shakes = [];

	// Cámara: `cameraX`/`cameraY` es el punto del mundo que queda en el centro de la
	// pantalla, `cameraZoom` la escala (1 = sin zoom). Ver beginCamera()/endCamera() más
	// abajo — sin cámara activa (el caso por defecto) todo se sigue dibujando 1:1 como
	// siempre, no cambia nada para un juego que no la use.
	cameraX = 0;
	cameraY = 0;
	cameraZoom = 1;
	
	// Propiedades para el contador de FPS. `#lastFrameTime` marca el arranque de la ventana de
	// un segundo con la que se cuentan los cuadros, no el cuadro anterior.
	#lastFrameTime = 0;
	#frameCount = 0;
	#fps = 0;

	// Tiempo del cuadro anterior (para el delta) y el delta en sí, en SEGUNDOS. Separado del
	// contador de FPS porque ese acumula de a un segundo y acá hace falta cuadro a cuadro.
	#lastTickTime = 0;
	#frameTime = 1 / 60;
	
	// --- Propiedades para Simplex Noise ---
	#p = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];
	#perm = new Array(512);
	#permMod12 = new Array(512);
	#F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
	#G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
	#grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
			 [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
			 [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];

	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.tilesets = {};
		
		// Resolución base para mantener proporción 16:9
		this.baseResolution = {
			width: 1366,
			height: 768
		};

		this.initListeners();
		this.resizeCanvas(); // Establecer tamaño inicial del canvas
		
		// Inicializar tablas de permutación para Simplex Noise
		for (let i = 0; i < 512; i++) {
			this.#perm[i] = this.#p[i & 255];
			this.#permMod12[i] = this.#perm[i] % 12;
		}
	}

	initAudio() {
		if (!this.audioCtx) {
			try {
				this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
				console.log("[Js2d] AudioContext inicializado.");
			} catch (e) {
				console.error("[Js2d] Web Audio API no es soportada en este navegador.", e);
			}
		}
		// algunos navegadores lo crean 'suspended' hasta un gesto del usuario
		if (this.audioCtx && this.audioCtx.state === "suspended") {
			this.audioCtx.resume().catch(() => {});
		}
	}

	initListeners() {
		const emitTouch = (type, event) => {
			const handlers = this.touchEventHandlers[type];
			if (!handlers) return;
			for (let i = 0; i < handlers.length; i++) handlers[i](event);
		};

		const updateMouseFromClient = (clientX, clientY) => {
			const rect = this.canvas.getBoundingClientRect();
			this.mousePos.x = clientX - rect.left;
			this.mousePos.y = clientY - rect.top;
		};

		// Cada listener se registra a través de #on() en vez de addEventListener directo, para
		// poder desregistrarlos todos desde destroy() (ver ahí) — necesario para cualquier
		// juego que quiera reiniciar el motor (por ejemplo, "volver al menú" reconstruyendo
		// todo) sin recargar la página entera y sin ir acumulando listeners fantasma.

		// Mover mouse
		this.#on(this.canvas, 'mousemove', e => {
			this.pointerType = 'mouse';
			updateMouseFromClient(e.clientX, e.clientY);
		});

	    // Clics (presionar)
		this.#on(window, 'mousedown', () => this.initAudio(), { once: true });
		this.#on(window, 'touchstart', () => this.initAudio(), { once: true });
	    this.#on(this.canvas, 'mousedown', e => {
	        if (e.button >= 0 && e.button < 3) { // 0: izq, 1: medio, 2: der
	            this.pointerType = 'mouse';
	            this.mouseButtons[e.button] = true;
	            if (e.button === 0) this.#pointerPress();
	        }
	    });

	    // Clics (soltar)
	    this.#on(this.canvas, 'mouseup', e => {
	        if (e.button >= 0 && e.button < 3) {
	            this.mouseButtons[e.button] = false;
	            if (e.button === 0) this.#pointerRelease();
	        }
	    });

	    // Rueda del ratón
	    this.#on(this.canvas, 'wheel', e => {
	        e.preventDefault(); // Evita que la página haga scroll
	        this.mouseWheelDelta = Math.sign(e.deltaY); // -1/1
	    });

	    // Clic derecho
	    this.#on(this.canvas, 'contextmenu', e => e.preventDefault());

		const updateMouseFromTouch = touch => {
			if (!touch) return;
			updateMouseFromClient(touch.clientX, touch.clientY);
		};

		this.#on(this.canvas, 'touchstart', e => {
			if (e.cancelable) e.preventDefault();
			const touch = e.touches[0] || e.changedTouches[0];
			if (!touch) return;
			updateMouseFromTouch(touch);
			this.pointerType = 'touch';
			this.mouseButtons[0] = true;
			this.#pointerPress();
			emitTouch('start', e);
		}, { passive: false });

		this.#on(this.canvas, 'touchmove', e => {
			if (e.cancelable) e.preventDefault();
			const touch = e.touches[0] || e.changedTouches[0];
			updateMouseFromTouch(touch);
			emitTouch('move', e);
		}, { passive: false });

		const endTouch = (type, e) => {
			if (e.cancelable) e.preventDefault();
			const touch = e.changedTouches[0];
			updateMouseFromTouch(touch);
			this.pointerType = 'touch';
			this.mouseButtons[0] = false;
			this.#pointerRelease(type === 'cancel');
			emitTouch(type, e);
		};

		this.#on(this.canvas, 'touchend', e => endTouch('end', e), { passive: false });
		this.#on(this.canvas, 'touchcancel', e => endTouch('cancel', e), { passive: false });

		// Teclado
		this.#on(window, 'keydown', e => {
			this.initAudio();

			// Con la captura de texto prendida, el teclado escribe y nada más: no se toca
			// keysPressed, así que ni la navegación por teclado ni los atajos del juego ven
			// estas teclas (ver el comentario de textCapture).
			if (this.textCapture) {
				this.#handleTextKey(e);
				return;
			}

			this.keysPressed[e.code] = true;
			this.keyLatch.add(e.code);

			if (e.code === 'Tab') {
				e.preventDefault();
			}
		});
    	this.#on(window, 'keyup', e => { delete this.keysPressed[e.code]; });
		// Al perder el foco el navegador no avisa de las teclas que se sueltan: quedarían apretadas.
		this.#on(window, 'blur', () => { this.keysPressed = {}; this.keyLatch.clear(); });
		this.#on(window, 'gamepadconnected', e => this.input.handleGamepadEvent(true, e.gamepad));
		this.#on(window, 'gamepaddisconnected', e => this.input.handleGamepadEvent(false, e.gamepad));

		// Manejar cambios de tamaño en desktop y móviles
		this.#on(window, 'resize', () => this.resizeCanvas());

		// Manejar cambios de orientación en dispositivos móviles
		this.#on(window, 'orientationchange', () => {
			// Esperar un momento para que la orientación se complete
			setTimeout(() => this.resizeCanvas(), 100);
		});

		// Usar visualViewport API si está disponible (mejor para móviles)
		if (window.visualViewport) {
			this.#on(window.visualViewport, 'resize', () => this.resizeCanvas());
		}
	}

	// Registro con seguimiento: guarda target/tipo/handler/options para poder desregistrar
	// todo de una en destroy(). Mismos argumentos que addEventListener, nada más.
	#listenerRefs = [];
	#on(target, type, handler, options) {
		target.addEventListener(type, handler, options);
		this.#listenerRefs.push({ target, type, handler, options });
	}

	// Saca todos los listeners cableados en initListeners() (mouse, touch, teclado, resize,
	// orientationchange, visualViewport). Pensado para un juego que necesite reiniciar el
	// motor sin recargar la página (por ejemplo, un "volver al menú" que reconstruye todo) o
	// para escenarios de hot-reload en desarrollo — hoy nada dentro de este archivo lo llama,
	// es responsabilidad de quien instancia Js2d invocarlo si lo necesita.
	destroy() {
		this.tweens.clear();
		this.stopShake();
		this.particles.clear();
		this.input.reset();
		for (const { target, type, handler, options } of this.#listenerRefs) {
			target.removeEventListener(type, handler, options);
		}
		this.#listenerRefs.length = 0;
	}

	addTouchListener(type, handler) {
		if (!this.touchEventHandlers[type] || typeof handler !== 'function') {
			return () => {};
		}
		this.touchEventHandlers[type].push(handler);
		return () => {
			const handlers = this.touchEventHandlers[type];
			const index = handlers.indexOf(handler);
			if (index >= 0) handlers.splice(index, 1);
		};
	}

	getMousePosition() {
	    return { ...this.mousePos }; // Copia
	}

	// Devuelve y reinicia los flancos del puntero ({ pressed, released, canceled, pressX/Y,
	// releaseX/Y }). Los usa js.ui.begin(); si un juego usa la interfaz, no tiene que llamarla.
	consumePointerEvents() {
		const e = this.pointerEvents;
		const copy = { ...e };
		e.pressed = e.released = e.canceled = false;
		return copy;
	}

	#pointerPress() {
		const e = this.pointerEvents;
		e.pressed = true;
		e.pressX = this.mousePos.x;
		e.pressY = this.mousePos.y;
	}

	#pointerRelease(canceled = false) {
		const e = this.pointerEvents;
		e.released = true;
		e.canceled = canceled;
		e.releaseX = this.mousePos.x;
		e.releaseY = this.mousePos.y;
	}

	getMouseWheelDelta() {
	    const delta = this.mouseWheelDelta;
	    this.mouseWheelDelta = 0;
	    return delta;
	}

	//
	// Cámara: offset + zoom sobre una escena más grande que la pantalla (un mapa, una grilla
	// que panea con el mouse, etc.) — sin esto, cada juego que lo necesita termina calculando
	// a mano el traslado/escala y su conversión pantalla↔mundo, como el paneo de la grilla de
	// módulos en bot-factory. `setCamera` fija los tres valores de una; `moveCamera` los
	// desplaza en delta (útil para arrastrar con el mouse, en píxeles de pantalla — ya
	// divide por el zoom para que el arrastre se sienta igual de rápido sea cual sea el
	// zoom actual).
	//

	setCamera(x, y, zoom = this.cameraZoom) {
		this.cameraX = x;
		this.cameraY = y;
		this.cameraZoom = zoom;
	}

	moveCamera(dx, dy) {
		this.cameraX += dx / this.cameraZoom;
		this.cameraY += dy / this.cameraZoom;
	}

	// Traslada + escala el contexto para que lo que se dibuje después de esto, y hasta el
	// próximo endCamera(), quede en espacio de mundo (coordenadas relativas a cameraX/Y, sin
	// preocuparse del zoom). Guarda el estado del contexto — endCamera() lo restaura, dejando
	// todo lo que se dibuje después otra vez en espacio de pantalla normal.
	beginCamera() {
		this.ctx.save();
		this.ctx.translate(this.getCanvasWidth() / 2, this.getCanvasHeight() / 2);
		this.ctx.scale(this.cameraZoom, this.cameraZoom);
		this.ctx.translate(-this.cameraX, -this.cameraY);
	}

	endCamera() {
		this.ctx.restore();
	}

	// Conversión pantalla↔mundo: para saber qué punto del mundo cayó bajo el mouse (clicks
	// sobre algo paneado/escalado) o dónde en pantalla cae un punto del mundo (por ejemplo,
	// para saber si conviene dibujarlo, o para posicionar UI que sigue a un objeto de la
	// escena). No dependen de que la cámara esté "activa" en este momento (no hace falta
	// llamarlas entre beginCamera/endCamera).
	worldToScreen(point) {
		return {
			x: (point.x - this.cameraX) * this.cameraZoom + this.getCanvasWidth() / 2,
			y: (point.y - this.cameraY) * this.cameraZoom + this.getCanvasHeight() / 2,
		};
	}

	screenToWorld(point) {
		return {
			x: (point.x - this.getCanvasWidth() / 2) / this.cameraZoom + this.cameraX,
			y: (point.y - this.getCanvasHeight() / 2) / this.cameraZoom + this.cameraY,
		};
	}

	// Atajo para el caso más común: dónde cayó el mouse en espacio de mundo.
	getMouseWorldPosition() {
		return this.screenToWorld(this.mousePos);
	}


	peekMouseWheelDelta() {
	    return this.mouseWheelDelta;
	}
	
	consumeMouseWheelDelta() {
	    this.mouseWheelDelta = 0;
	}

	getCanvasRectangle(){
		return {
			x: 0, y: 0,
			width: this.getCanvasWidth(),
			height: this.getCanvasHeight()
		};
	}

	// Tamaño en píxeles CSS (lógicos) — es con lo que trabajan las cámaras y los juegos.
	getCanvasWidth(){
		return this.cssWidth || this.canvas.width;
	}
	getCanvasHeight(){
		return this.cssHeight || this.canvas.height;
	}
	// Tamaño real del buffer, en píxeles físicos.
	getPixelWidth(){ return this.canvas.width; }
	getPixelHeight(){ return this.canvas.height; }

	async setClipboardText(text) {
		try {
			await navigator.clipboard.writeText(text);
			console.log('[Js2d] Text copied to clipboard.');
		} catch (err) {
			console.error('[Js2d] Error al copiar texto al portapapeles:', err);
		}
	}
	async getClipboardText() {
		try {
			const text = await navigator.clipboard.readText();
			return text;
		} catch (err) {
			console.error('[Js2d] Error al leer el contenido del portapapeles:', err);
			return null;
		}
	}
	async getClipboardImage() {
		try {
			const clipboardItems = await navigator.clipboard.read();
			for (const clipboardItem of clipboardItems) {
				// Check if the clipboard item contains an image type
				const imageType = clipboardItem.types.find(type => type.startsWith('image/'));

				if (imageType) {
					const blob = await clipboardItem.getType(imageType);
					imageDisplay.src = URL.createObjectURL(blob);
				} else {
					console.log("[Js2d] El elemento en el Portapapeles no contiene una imagen.");
				}
			}
		} catch (err) {
			console.error("[Js2d] Error al leer el contenido del portapapeles:", err.name, err.message);
		}
	}

	 isKeyPressed(key) {
		return this.keysPressed[key] === true;
	}

	// Como isKeyPressed, pero la tecla queda CONSUMIDA: nadie más la ve. Hace falta cuando dos
	// cosas encimadas escuchan la misma tecla —Escape cierra el panel que está abierto, no el que
	// quedó abajo— porque si no las dos reaccionan al mismo toque y se cierra todo junto.
	consumeKeyPressed(key) {
		if (this.keysPressed[key] !== true) return false;
		delete this.keysPressed[key];
		return true;
	}

	// --- Entrada de texto por teclado ---

	// Una tecla mientras se está escribiendo. Los atajos del navegador (Ctrl/Cmd/Alt) pasan de
	// largo sin preventDefault: recargar o pegar con el chat abierto tiene que seguir andando.
	#handleTextKey(e) {
		if (e.ctrlKey || e.metaKey || e.altKey) return;

		if (e.key === 'Enter')       { this.#textSubmitted = true; e.preventDefault(); return; }
		if (e.key === 'Escape')      { this.#textCancelled = true; e.preventDefault(); return; }
		if (e.key === 'Backspace')   { this.textBuffer = this.textBuffer.slice(0, -1); e.preventDefault(); return; }
		// Tab movería el foco fuera del canvas y no habría forma de volver escribiendo.
		if (e.key === 'Tab')         { e.preventDefault(); return; }

		// Un solo carácter es lo que distingue algo escribible ("a", "ñ", "7", " ") de una tecla
		// con nombre ("Shift", "ArrowLeft", "F5"), que es lo que hay que dejar pasar.
		if (typeof e.key === 'string' && e.key.length === 1) {
			if (this.textBuffer.length < this.textMaxLength) this.textBuffer += e.key;
			// La barra espaciadora scrollea la página si no se la frena, y el juego vive dentro
			// de un iframe en itch.io donde eso se nota.
			e.preventDefault();
		}
	}

	// Prende la captura: a partir de acá el teclado escribe en textBuffer en vez de manejar el
	// juego. Devuelve el motor para poder encadenar.
	startTextCapture({ maxLength = 200, initial = '' } = {}) {
		this.textCapture = true;
		this.textMaxLength = maxLength;
		this.textBuffer = String(initial).slice(0, maxLength);
		this.#textSubmitted = false;
		this.#textCancelled = false;
		// Las teclas que quedaron apretadas al abrir el chat (el Enter con el que lo abrió, sin ir
		// más lejos) seguirían "presionadas" al cerrarlo, porque el keyup se lo come la captura.
		this.keysPressed = {};
		return this;
	}

	stopTextCapture() {
		this.textCapture = false;
		this.textBuffer = '';
		this.#textSubmitted = false;
		this.#textCancelled = false;
		this.keysPressed = {};
	}

	getTextBuffer() {
		return this.textBuffer;
	}

	// Para las teclas que no vienen del teclado físico: el teclado en pantalla (ver
	// OnScreenKeyboard en game.js) y cualquier botón que quiera escribir por su cuenta.
	setTextBuffer(texto) {
		this.textBuffer = String(texto == null ? '' : texto).slice(0, this.textMaxLength);
	}

	// ¿Se apretó Enter desde la última vez que se preguntó? Se consume: la respuesta es true una
	// sola vez, así un mismo Enter no manda el mensaje dos veces.
	consumeTextSubmit() {
		const hubo = this.#textSubmitted;
		this.#textSubmitted = false;
		return hubo;
	}

	consumeTextCancel() {
		const hubo = this.#textCancelled;
		this.#textCancelled = false;
		return hubo;
	}

	// Cambiar canvas.width/height acá adentro borra todo lo dibujado al instante, por espec
	// del canvas — y esto se llama desde tres eventos distintos (window "resize", window
	// "orientationchange" con un setTimeout de 100ms, y visualViewport "resize" para
	// mobile/zoom, ver initListeners). Si el juego que usa este motor dibuja a un framerate
	// limitado (por ejemplo un loop() que tira cuadros para bajar el uso de CPU), ese cuadro
	// en blanco puede quedar visible unos cuadros — arrastrando el borde de la ventana se ve
	// como parpadeos negros.
	//
	// La forma correcta de evitarlo NO es agregar otro listener de "resize" en el juego (no
	// cubre visualViewport ni orientationchange, y duplica lógica que ya vive acá) — es
	// envolver este método una vez, después de crear la instancia:
	//
	//   const originalResizeCanvas = js2d.resizeCanvas.bind(js2d);
	//   js2d.resizeCanvas = function () {
	//       originalResizeCanvas();
	//       // recomputar layout y volver a dibujar en el mismo evento sincrónico
	//       draw();
	//   };
	//
	// Funciona porque los tres listeners de acá arriba llaman a `this.resizeCanvas()` (no a
	// una referencia capturada al método original), así que resuelven la versión pisada en
	// tiempo de ejecución sea cual sea el que dispare el resize.
	resizeCanvas() {
		// Piso mínimo, sin tope máximo (tiene que poder llenar una pantalla completa).
		//
		// El piso de ALTO era 480 y hacía daño en el caso más común de un celular: acostado, un
		// teléfono tiene unos 390px de alto, así que el canvas quedaba MÁS ALTO QUE LA VENTANA y
		// los últimos noventa píxeles —donde están la botonera y la mano— no se veían nunca. No
		// había forma de llegar a "Irse al Mazo". Ahora el piso es cuadrado y chico: lo que
		// garantiza que se pueda leer y tocar no es el tamaño del canvas sino los pisos en
		// píxeles de la interfaz (ver botoneraLayout en game.js), que es donde corresponde.
		const minWidth = 320;
		const minHeight = 320;

		// El canvas ocupa la ventana entera, sea cual sea su proporción. Antes se forzaba a 16:9
		// y se centraba, lo que dejaba franjas negras en cualquier ventana que no fuera de esa
		// forma (una de 1920x937, con la barra de marcadores, perdía 127px de cada lado). Lo que
		// se dibuja adentro se acomoda solo: las posiciones salen del ancho y el alto reales, y
		// el tamaño de las piezas lo da scaleFactor (ver updateScaleFactor en game.js, que mira
		// las dos dimensiones para que en una ventana angosta no quede todo gigante).
		const width = Math.max(minWidth, window.innerWidth);
		const height = Math.max(minHeight, window.innerHeight);

		// Rasterizado nítido en pantallas de alta densidad: el buffer del canvas tiene
		// `dpr` píxeles físicos por píxel CSS, y el contexto se escala por `dpr` al
		// principio de cada cuadro (ver clearBg). El resto del motor sigue trabajando en
		// píxeles lógicos: getCanvasWidth()/Height() y las cámaras devuelven el tamaño CSS.
		const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
		this.dpr = dpr;
		this.cssWidth = width;
		this.cssHeight = height;

		this.canvas.width = Math.round(width * dpr);
		this.canvas.height = Math.round(height * dpr);

		this.canvas.style.width = width + 'px';
		this.canvas.style.height = height + 'px';
		this.canvas.style.position = 'absolute';
		this.canvas.style.left = '50%';
		this.canvas.style.top = '50%';
		this.canvas.style.transform = 'translate(-50%, -50%)';

		if (this.ctx) { this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.ctx.imageSmoothingEnabled = IMAGE_SMOOTHING; }   // cambiar el tamaño del canvas reinicia el contexto
	}

	// Tope del delta, en segundos. Cuando la pestaña queda en segundo plano el navegador frena
	// el requestAnimationFrame, y al volver el primer cuadro traería un salto de varios segundos:
	// sin este techo, todo lo que se mueve por dt se teletransportaría de una. Es preferible que
	// el juego "pierda" ese tiempo a que dé un salto.
	static MAX_FRAME_TIME = 0.1;

	tick(timestamp) {
		// Primero la entrada: así todo lo que se actualice después en el cuadro ve lo mismo.
		this.input.update();

		if (!this.#lastFrameTime) {
			this.#lastFrameTime = timestamp;
		}
		const deltaTime = timestamp - this.#lastFrameTime;
		this.#frameCount++;
		if (deltaTime >= 1000) {
			this.#fps = this.#frameCount;
			this.#frameCount = 0;
			this.#lastFrameTime = timestamp;
		}

		// Delta real del cuadro. El primero no tiene con qué compararse: se le da un cuadro de
		// 60 fps para no arrancar con 0 (que congelaría todo por un cuadro) ni con el timestamp
		// entero, que es el tiempo desde que cargó la página.
		this.#frameTime = this.#lastTickTime
			? Math.min((timestamp - this.#lastTickTime) / 1000, Js2d.MAX_FRAME_TIME)
			: 1 / 60;
		this.#lastTickTime = timestamp;

		this.fixed.add(this.#frameTime);
		this.tweens.update(this.#frameTime);
		this.#updateShake(this.#frameTime);
		this.particles.update(this.#frameTime);
	}

	// Anima propiedades numéricas de un objeto hasta los valores de `props`, en `duration`
	// segundos. Se avanza sola en tick(), no hace falta llamarla en el update del juego.
	//
	//   js.tween(btn, { x: 200, alpha: 1 }, 0.4, { ease: 'outBack' });
	//   js.tween(icon, { y: 10 }, 0.5, { ease: 'inOutSine', repeat: true, yoyo: true });
	//   await js.tween(panel, { y: 0 }, 0.3, { delay: 0.1 }).finished;
	//
	// Opciones: ease (nombre de Ease o función), delay, repeat (n veces más, o true = sin fin),
	// yoyo, from (valores iniciales, se fijan al arrancar), onStart, onUpdate(target, p),
	// onComplete(target), overwrite (false para permitir que dos tweens toquen la misma
	// propiedad; por defecto el nuevo reemplaza al viejo). Devuelve el Tween: cancel(),
	// finish(), active, finished (promesa).
	tween(target, props, duration = 1, opts = {}) {
		return this.tweens.add(target, { ...props }, duration, opts);
	}

	// Ejecuta `fn` dentro de `seconds` segundos de juego (se frena si el juego deja de dibujar,
	// a diferencia de setTimeout). Devuelve un Tween: cancel() lo anula.
	after(seconds, fn) {
		return this.tweens.add({}, {}, 0, { delay: seconds, onComplete: fn });
	}

	// Cancela los tweens de `target` (todos, o sólo los que animen alguna de `props`).
	killTweens(target, props = null) {
		this.tweens.kill(target, props);
	}

	clearTweens() {
		this.tweens.clear();
	}

	// Cuánto duró el último cuadro, en segundos. Es lo que hay que pasarle a los update() para
	// que el juego se mueva a la misma velocidad en cualquier pantalla: con un dt fijo, un
	// monitor de 144 Hz corre todo 2,4 veces más rápido que uno de 60.
	getFrameTime() {
		return this.#frameTime;
	}
	
	clearBg(color) {
		// Restablece la transformación base del cuadro (escala por dpr) y limpia el área
		// lógica completa. Todo lo que se dibuje después queda en píxeles CSS y se rasteriza
		// a la densidad real de la pantalla.
		this.ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
		this.ctx.imageSmoothingEnabled = IMAGE_SMOOTHING;
		this.ctx.fillStyle = color;
		this.ctx.fillRect(0, 0, this.getCanvasWidth(), this.getCanvasHeight());

		// Screen shake: se aplica después de pintar el fondo, así que sacude todo lo que se
		// dibuje en el cuadro (incluida la cámara) pero no corre el fondo liso. Lo que no deba
		// temblar (el HUD) va dentro de withoutShake().
		const s = this.shakeOffset;
		if (s.x !== 0 || s.y !== 0 || s.rotation !== 0) {
			if (s.rotation !== 0) {
				const cx = this.getCanvasWidth() / 2, cy = this.getCanvasHeight() / 2;
				this.ctx.translate(cx, cy);
				this.ctx.rotate(s.rotation);
				this.ctx.translate(-cx, -cy);
			}
			this.ctx.translate(s.x, s.y);
		}
	}

	// Sacude la pantalla: `magnitude` en píxeles, `duration` en segundos. El temblor se va
	// apagando hasta cero. Los shakes simultáneos se suman. Se aplica en clearBg().
	//   js.shake(10, 0.3);                                  // golpe
	//   js.shake(4, 1.5, { frequency: 40, rotation: 1 });   // temblor largo, con giro de hasta 1 grado
	// Opciones: frequency (Hz, 25), decay (curva de Ease con que se apaga: 'linear' por
	// defecto, 'outQuad' cae rápido al principio), rotation (grados máximos, 0), axis ('both' |
	// 'x' | 'y'). Devuelve { stop() }.
	shake(magnitude = 8, duration = 0.3, opts = {}) {
		if (!(duration > 0) || !(magnitude > 0)) return { stop() {} };
		const shake = {
			magnitude, duration,
			frequency: opts.frequency ?? 25,
			decay: Ease.get(opts.decay),
			rotation: opts.rotation || 0,
			axis: opts.axis || 'both',
			elapsed: 0,
			seed: Math.random() * 1000,
		};
		this.#shakes.push(shake);
		return { stop: () => { shake.elapsed = shake.duration; } };
	}

	stopShake() {
		this.#shakes.length = 0;
		this.shakeOffset.x = this.shakeOffset.y = this.shakeOffset.rotation = 0;
	}

	#updateShake(dt) {
		const off = this.shakeOffset;
		let x = 0, y = 0, rot = 0;
		if (this.shakeEnabled) {
			for (const s of this.#shakes) {
				s.elapsed += dt;
				if (s.elapsed >= s.duration) continue;
				const amount = s.magnitude * (1 - s.decay(s.elapsed / s.duration));
				// ruido suave: el temblor oscila a `frequency` Hz en vez de saltar al azar
				const t = s.elapsed * s.frequency;
				if (s.axis !== 'y') x += this.noise2D(s.seed + t, 0) * amount;
				if (s.axis !== 'x') y += this.noise2D(0, s.seed + 50 + t) * amount;
				if (s.rotation) rot += this.noise2D(s.seed + 100 + t, 100) * (amount / s.magnitude) * s.rotation;
			}
		}
		this.#shakes = this.#shakes.filter(s => s.elapsed < s.duration);
		off.x = x;
		off.y = y;
		off.rotation = rot * Math.PI / 180;
	}

	// Ejecuta `fn` sin el temblor del cuadro (para el HUD, menús, textos fijos). También deja
	// de lado una cámara activa: vuelve a coordenadas de pantalla.
	withoutShake(fn) {
		this.ctx.save();
		this.ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
		try { fn(); } finally { this.ctx.restore(); }
	}

	drawFPS() {
		this.ctx.fillStyle = 'white';
		this.ctx.font = '16px Arial';
		this.ctx.fillText(`FPS: ${this.#fps}`, 10, 20);
	}

	drawDebugBox(rect) {
		const width = rect.width || rect.w
		const height = rect.height || rect.h

		const color = "#0f0"
		const thickness = 2

		this.drawRectangleLines({ x: rect.x, y: rect.y, width: width, height: height }, thickness, color)
		this.drawLine({ x: rect.x, y: rect.y }, { x: rect.x + width, y: rect.y + height }, thickness, color)
		this.drawLine({ x: rect.x, y: rect.y + height }, { x: rect.x + width, y: rect.y }, thickness, color)
	}

	// Todos los rectángulos se dibujan desde la esquina "superior izquierda"
	drawRectangle(rect, color = Color.BLACK, pivot = Pivot.Top_Left) {
		const width = rect.width || rect.w;
		const height = rect.height || rect.h;
		if (width <= 0 || height <= 0) return;
		
		this.ctx.save()
		this.ctx.strokeStyle = "none"
		this.ctx.fillStyle = color
		this.ctx.fillRect(rect.x, rect.y, width, height)
		this.ctx.restore()
	}

	drawRectangleOutline(rect, fillColor, borderColor, borderWidth = 1) {
		const width = rect.width || rect.w;
		const height = rect.height || rect.h;
		if (width <= 0 || height <= 0) return;

		const r1 = {x: rect.x, y: rect.y, width: width, height: height};
		if (fillColor) {
			this.drawRectangle(r1, fillColor);
		}
		
		if (borderWidth > 0 && borderColor) {
			const strokeWidth = Math.max(0, width - borderWidth);
			const strokeHeight = Math.max(0, height - borderWidth);
			const inset = borderWidth / 2;
			const r2 = {x: r1.x + inset, y: r1.y + inset, width: strokeWidth, height: strokeHeight};
			this.drawRectangleLines(r2, borderWidth, borderColor);
		}
	}

	drawRectWithAlpha(rect, color, alpha) {
		this.ctx.save()
		this.ctx.globalAlpha = alpha
		this.drawRectangle(rect, color)
		this.ctx.restore()
		this.ctx.globalAlpha = 1
	}
	drawRectangleLines(rect, thickness, color = Color.BLACK) {
		this.ctx.save()
		this.ctx.lineWidth = thickness
		this.ctx.strokeStyle = color
		this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
		this.ctx.restore()
	}
	drawRectangleRounded(rect, cornerRadius, color = Color.BLACK) {
		this.ctx.save()

		this.ctx.strokeStyle = "none"
		this.ctx.fillStyle = color

		this.ctx.beginPath()
		this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, cornerRadius)
		this.ctx.fill()

		this.ctx.restore()
	}
	drawRectangleRoundedLines(rect, cornerRadius, thickness = 1, color = Color.BLACK) {
		this.ctx.save()

		this.ctx.strokeStyle = color
		this.ctx.lineWidth = thickness

		this.ctx.beginPath()
		this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, cornerRadius)
		this.ctx.stroke()

		this.ctx.restore()
	}
	drawRectangleRoundedOutline(rect, cornerRadius, fillColor, borderColor, borderWidth = 1) {
		const width = rect.width || rect.w;
		const height = rect.height || rect.h;
		if (width <= 0 || height <= 0) return;
		const radius = Math.max(0, Math.min(cornerRadius, Math.min(width, height) / 2));
		
		const r1 = { x: rect.x, y: rect.y, width: width, height: height};
		if (fillColor) {
			this.drawRectangleRounded(r1, cornerRadius, fillColor);
		}
		
		if (borderWidth > 0 && borderColor) {
			const inset = borderWidth / 2;
			const strokeWidth = Math.max(0, width - borderWidth);
			const strokeHeight = Math.max(0, height - borderWidth);
			const r2 = { x: r1.x + inset, y: r1.y + inset, width: strokeWidth, height: strokeHeight};
			this.drawRectangleRoundedLines(r2, cornerRadius, borderWidth, borderColor);
		}
	}

	drawTriangle(p1, p2, p3, color = Color.BLACK) {
		this.ctx.save()

		this.ctx.strokeStyle = "none"
		this.ctx.fillStyle = color

		this.ctx.beginPath()
		this.ctx.moveTo(p1.x, p1.y)
		this.ctx.lineTo(p2.x, p2.y)
		this.ctx.lineTo(p3.x, p3.y)
		this.ctx.fill()

		this.ctx.restore()
	}
	drawTriangleLines(p1, p2, p3, thickness, color = Color.BLACK) {
		this.ctx.save()

		this.ctx.lineWidth = thickness
		this.ctx.strokeStyle = color

		this.ctx.beginPath()
		this.ctx.moveTo(p1.x, p1.y)
		this.ctx.lineTo(p2.x, p2.y)
		this.ctx.lineTo(p3.x, p3.y)
		this.ctx.lineTo(p1.x, p1.y)
		this.ctx.stroke()

		this.ctx.restore()
	}
	drawTriangleRounded(p1, p2, p3, cornerRadius, color = Color.BLACK) {
		this.ctx.save()

		this.ctx.strokeStyle = "none"
		this.ctx.fillStyle = color

		this.ctx.beginPath()
		this.pointsToRoundedPolygon([p1, p2, p3], cornerRadius)
		this.ctx.fill()

		this.ctx.restore()
	}

	drawPolygon(center, sides, radius, rotation = 0, color = Color.BLACK) {
		if (sides < 3) return;

		this.ctx.save();
		this.ctx.strokeStyle = "none";
		this.ctx.fillStyle = color;

		const points = this.getPolygonPoints(center, sides, radius, rotation);

		if (!points || points.length < 3) {
			this.ctx.restore();
			return;
		}

		this.ctx.beginPath();
		this.ctx.moveTo(points[0].x, points[0].y);

		for (let i = 1; i < points.length; i += 1) {
			this.ctx.lineTo(points[i].x, points[i].y);
		}

		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.restore();
	}

	drawPolygonRounded(center, sides, radius, cornerRadius, rotation = 0, color = Color.BLACK) {
		this.ctx.save()

		this.ctx.strokeStyle = "none"
		this.ctx.fillStyle = color

		this.ctx.beginPath()
		this.pointsToRoundedPolygon(this.getPolygonPoints(center, sides, radius, rotation), cornerRadius)
		this.ctx.fill()

		this.ctx.restore()
	}
	drawPolygonRoundedLines(center, sides, radius, cornerRadius, thickness = 1, rotation = 0, color = 'black') {
		if (sides < 3 || radius <= 0) {
			return;
		}
		const maxCornerRadius = radius * Math.tan(Math.PI / sides);
		const r = Math.min(cornerRadius, maxCornerRadius);


		this.ctx.save();
		this.ctx.lineWidth = thickness;
		this.ctx.strokeStyle = color;

		this.ctx.beginPath();
		const points = this.getPolygonPoints(center, sides, radius, rotation);
		this.pointsToRoundedPolygon(points, r);
		this.ctx.stroke();

		this.ctx.restore();
	}

	drawPie(center, radius, startAngle, endAngle, color = Color.BLACK/*, rotation = 0*/) {
		this.ctx.save();
		this.ctx.fillStyle = color;
		this.ctx.beginPath();
		this.ctx.moveTo(center.x, center.y);
		this.ctx.arc(center.x, center.y, radius, startAngle, endAngle);
		this.ctx.closePath();
		this.ctx.fill();
		// this.ctx.rotate(rotation);
		this.ctx.restore();
	}

	drawCircle(center, radius, color = Color.BLACK) {
		this.ctx.save()
		this.ctx.strokeStyle = "none"
		this.ctx.fillStyle = color
		this.ctx.beginPath()
		this.ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI)
		this.ctx.fill()
		this.ctx.restore()
	}
	// Círculo con halo: útil para luces, faros, marcadores encendidos. `glow` es el radio
	// del desenfoque del halo (0 = sin halo). El halo usa el mismo color que el relleno.
	drawGlowCircle(center, radius, color = Color.WHITE, glow = radius) {
		this.ctx.save()
		this.ctx.fillStyle = color
		if (glow > 0) {
			this.ctx.shadowColor = color
			this.ctx.shadowBlur = glow
		}
		this.ctx.beginPath()
		this.ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI)
		this.ctx.fill()
		// segundo pase para intensificar el halo sin engordar el círculo
		if (glow > 0) {
			this.ctx.fill()
		}
		this.ctx.restore()
	}

	drawCircleLines(center, radius, thickness, color = Color.BLACK, dashArray = null) {
		this.ctx.save()
		this.ctx.lineWidth = thickness
		this.ctx.strokeStyle = color
		if(dashArray != null){
			this.ctx.setLineDash(dashArray);
		}
		this.ctx.beginPath()
		this.ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI)
		this.ctx.stroke()
		this.ctx.restore()
	}

	drawDonut(center, outerRadius, innerRadius, startAngle = 0, endAngle = 2 * Math.PI, color = Color.BLACK) {
		this.ctx.save()
		this.ctx.fillStyle = color
		this.ctx.beginPath()
		this.ctx.arc(center.x, center.y, outerRadius, startAngle, endAngle)
		this.ctx.arc(center.x, center.y, innerRadius, endAngle, startAngle, true)
		this.ctx.closePath()
		this.ctx.fill()
		this.ctx.restore()
	}

	drawLine(p1, p2, thickness, color = Color.BLACK, cap = Line_Cap.Butt) {
		this.ctx.save()
		this.ctx.lineWidth = thickness
		this.ctx.strokeStyle = color
		this.ctx.lineCap = cap;
		this.ctx.beginPath()
		this.ctx.moveTo(p1.x, p1.y)
		this.ctx.lineTo(p2.x, p2.y)
		this.ctx.stroke()
		this.ctx.restore()
	}
	drawLineDashed(p1, p2, thickness, dashArray, color) {
		this.ctx.save()
		this.ctx.lineWidth = thickness
		this.ctx.strokeStyle = color
		this.ctx.setLineDash(dashArray);
		this.ctx.beginPath()
		this.ctx.moveTo(p1.x, p1.y)
		this.ctx.lineTo(p2.x, p2.y)
		this.ctx.stroke()
		this.ctx.restore()
	}

	beginClippingRect(rect) {
		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.rect(rect.x, rect.y, rect.width, rect.height);
		this.ctx.clip();
	}
	endClipping(){
		this.ctx.restore();
	}
	// `outline` dibuja un contorno alrededor de las letras, para que un texto claro se lea sobre
	// cualquier fondo sin tener que ponerle un panel detrás. Puede ser un color ("black") o
	// { color, width }; sin ancho, se usa un sexto del tamaño de la letra, que aguanta bien el
	// escalado. Se traza ANTES del relleno: al revés, el contorno se comería medio trazo de cada
	// letra y el texto saldría más flaco.
	drawTextCustom(font, text, size, color, pos, alignment = "left", outline = null) {
		this.ctx.save();

		if (!font || !font.fontFamily) {
			if (!font) {
				console.warn("[Js2d] Intento de usar una fuente nula. Se usará la fuente por defecto.");
			}
			this.ctx.font = `${size}px monospace`;
		} else {
			this.ctx.font = `${size}px "${font.fontFamily}"`;
		}

		this.ctx.textAlign = alignment;

		if (outline) {
			const { color: colorBorde = Color.BLACK, width } = (typeof outline === 'string')
				? { color: outline }
				: outline;
			this.ctx.lineWidth = width || Math.max(2, size / 6);
			this.ctx.strokeStyle = colorBorde;
			// Sin esto, los vértices agudos de la tipografía sacan púas al engrosar el trazo.
			this.ctx.lineJoin = 'round';
			this.ctx.miterLimit = 2;
			this.ctx.strokeText(text, pos.x, pos.y);
		}

		this.ctx.fillStyle = color;
		this.ctx.fillText(text, pos.x, pos.y);
		this.ctx.restore();
	}
	measureText(text, fontSize, fontFamily = 'monospace') {
		this.ctx.save();
		this.ctx.font = `${fontSize}px ${fontFamily}`;
		const width = this.ctx.measureText(text).width;
		this.ctx.restore();
		return width;
	}
	measureTextCustom(font, text, size) {
		this.ctx.save();

		if (!font || !font.fontFamily) {
			if (!font) {
				console.warn("[Js2d] Intento de usar una fuente nula. Se usará la fuente por defecto.");
			}
			this.ctx.font = `${size}px monospace`;
		} else {
			this.ctx.font = `${size}px "${font.fontFamily}"`;
		}

		const metrics = this.ctx.measureText(text);
		this.ctx.restore();
		return metrics.width;
	}
	loadFont(name, path) {
		const customFont = new FontFace(name, `url(${path})`)
		return customFont
			.load()
			.then((font) => {
				document.fonts.add(font)
				console.log(`[Js2d] Fuente "${name}" cargada correctamente desde "${path}"`)
				return { fontFamily: name }
			})
			.catch((error) => {
				console.error(`[Js2d] La fuente "${name}" no se pudo cargar:`, error)
				return null
			})
	}
	
	// loadImage() es async — antes esto le asignaba la Promise directo a `image` sin esperarla,
	// así que spriteFont.image terminaba siendo una Promise en vez de un HTMLImageElement.
	// drawSpriteText() chequea spriteFont.image._loaded, que en una Promise es siempre
	// undefined: el sprite font quedaba roto en silencio, sin dibujar nada y sin tirar ningún
	// error. Por eso este método es async: hay que esperar la imagen antes de armar el
	// SpriteFont, y quien lo llame tiene que hacer `await` (o `.then()`).
	async createSpriteFont(path, characters, charWidth, charHeight) {
		const image = await this.loadImage(path);
		const charMap = {};

		for (let i = 0; i < characters.length; i++) {
			const char = characters[i];
			charMap[char] = {
				x: i * charWidth,
				y: 0
			};
		}

		return new SpriteFont(image, charWidth, charHeight, charMap);
	}
	measureSpriteText(spriteFont, text, size) {
		if (!spriteFont) {
			return 0;
		}
		const charWidth = size || spriteFont.charWidth;
		return text.length * charWidth;
	}
	drawSpriteText(spriteFont, text, pos, size){
		if (!spriteFont || !spriteFont.image || !spriteFont.image._loaded) {
			return;
		}

		let currentX = pos.x;

		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			const charInfo = spriteFont.charMap[char];

			if (charInfo) {
				this.ctx.drawImage(
					spriteFont.image,
					charInfo.x,
					charInfo.y,
					spriteFont.charWidth,
					spriteFont.charHeight,
					currentX,
					pos.y,
					size,
					size
				);
			}
			currentX += size; 
		}
	}

	drawText(text, size, color, pos, alignment = "left") {
		this.ctx.save()
		this.ctx.font = `${size}px monospace`
		this.ctx.textAlign = alignment
		this.ctx.fillStyle = color
		this.ctx.fillText(text, pos.x, pos.y)
		this.ctx.restore()
	}
	drawTextLines(text, size, color, pos, alignment = "left", thickness = 1) {
		this.ctx.save()
		this.ctx.font = `${size}px monospace`
		this.ctx.textAlign = alignment
		this.ctx.lineWidth = thickness
		this.ctx.strokeStyle = color
		this.ctx.strokeText(text, pos.x, pos.y)
		this.ctx.restore()
	}

	drawTextWrapped(font, text, x, y, maxWidth, lineHeight, lineSpacing, alignment = "left", color = Color.BLACK) {
		let drawX;
		switch (alignment) {
			case "center":
				drawX = x + (maxWidth / 2);
				break;
			case "right":
				drawX = x + maxWidth;
				break;
			case "left":
			default:
				drawX = x;
				break;
		}
		
		if (font && font.fontFamily) {
			this.ctx.font = `${lineHeight}px "${font.fontFamily}"`;
		} else {
			// Fallback
			this.ctx.font = `${lineHeight}px monospace`;
		}

		const words = text.split(' ');
		let line = '';
		let lineCount = 1;

		for (let n = 0; n < words.length; n++) {
			const testLine = line + words[n] + ' ';
			const metrics = this.ctx.measureText(testLine);
			const testWidth = metrics.width;

			if (testWidth > maxWidth && n > 0) {
				this.drawTextCustom(font, line.trim(), lineHeight, color, { x: drawX, y: y }, alignment);
				
				line = words[n] + ' ';
				y += lineSpacing;
				lineCount++;
			} else {
				line = testLine;
			}
		}

		this.drawTextCustom(font, line.trim(), lineHeight, color, { x: drawX, y: y }, alignment);
		return lineCount;
	}

	countWrappedLines(font, text, maxWidth, fontSize, lineSpacing) {
		if (!text || text.length === 0) return 0;
		const ctx = this.ctx;
		
		const originalFont = ctx.font; 

		if (!font || !font.fontFamily) {
			ctx.font = `${fontSize}px monospace`;
		} else {
			ctx.font = `${fontSize}px "${font.fontFamily}"`;
		}

		// Misma lógica de wrap que drawTextWrapped (línea con espacio final incluido,
		// corte en n > 0) para que el conteo de líneas siempre coincida con lo dibujado.
		const words = text.split(' ');
		let currentLine = '';
		let numLines = 1;

		for (let i = 0; i < words.length; i++) {
			const testLine = currentLine + words[i] + ' ';
			const metrics = ctx.measureText(testLine);
			if (metrics.width > maxWidth && i > 0) {
				numLines++;
				currentLine = words[i] + ' ';
			} else {
				currentLine = testLine;
			}
		}
		
		// Restaura el estado original de la fuente
		ctx.font = originalFont;

		return numLines;
	}

	loadImages(imagePaths) {
		const promises = imagePaths.map((path) => {
			return new Promise((resolve, reject) => {
				const img = new Image()
				img.onload = () => resolve(img)
				img.onerror = reject
				img.src = path
			})
		})
		return Promise.all(promises)
	}

	loadImage(path) {
		return new Promise((resolve, reject) => {
			const image = new Image();
			image.crossOrigin = "anonymous";

			image._loaded = false;
			image._w = 0;
			image._h = 0;

			image.onload = () => {
				image._loaded = true;
				image._w = image.naturalWidth || image.width || 0;
				image._h = image.naturalHeight || image.height || 0;
				this.ctx.imageSmoothingEnabled = IMAGE_SMOOTHING;
				
				resolve(image); 
			};

			image.onerror = () => {
				const errorMsg = `[Js2d] Error cargando imagen desde ruta: ${path}`;
				console.warn(errorMsg);
				// La promesa falla y devuelve un error
				reject(new Error(errorMsg)); 
			};

			// Inicia la carga de la imagen
			image.src = path;
		});
	}

	loadBase64Image(base64) {
		return new Promise((resolve, reject) => {
			const image = new Image();
			image.crossOrigin = "anonymous";
			image._loaded = false;
			image._w = 0;
			image._h = 0;
			
			image.onload = () => {
				image._loaded = true;
				image._w = image.naturalWidth || image.width || 0;
				image._h = image.naturalHeight || image.height || 0;
				this.ctx.imageSmoothingEnabled = IMAGE_SMOOTHING;
				resolve(image);
			};
			
			image.onerror = () => {
				const errorMsg = `[Js2d] Error cargando imagen base64.`;
				console.warn(errorMsg);
				reject(new Error(errorMsg));
			};

			image.src = base64;
		});
	}

	drawImage(imgOrSpriteInfo, pos, scale = 1, rotation = 0, pivot = Pivot.Top_Left) {
		let imageElement;
		let effectiveScale = scale;

		if (imgOrSpriteInfo instanceof HTMLImageElement) {
			imageElement = imgOrSpriteInfo;
		} else if (imgOrSpriteInfo && imgOrSpriteInfo.image instanceof HTMLImageElement) {
			imageElement = imgOrSpriteInfo.image;
			if (imgOrSpriteInfo.scale !== undefined) {
				effectiveScale *= imgOrSpriteInfo.scale;
			}
		} else {
			console.warn("[Js2d] drawImage: Objeto de imagen o sprite no válido. No se puede dibujar.");
			return;
		}

		if (!imageElement || !imageElement._loaded) {
			console.warn("[Js2d] drawImage: La imagen no está cargada o es inválida.");
			return;
		}

		this.ctx.imageSmoothingEnabled = IMAGE_SMOOTHING;

		const sWidth = imageElement.naturalWidth || imageElement.width;
		const sHeight = imageElement.naturalHeight || imageElement.height;

		const dWidth = sWidth * effectiveScale;
		const dHeight = sHeight * effectiveScale;

		this.ctx.save();
		this.ctx.translate(pos.x, pos.y);
		if (rotation !== 0) {
			this.ctx.rotate(this.toRadians(rotation));
		}

		// Offset del dibujo relativo al punto ya trasladado (pos): en Top_Left el offset
		// queda en (0,0) porque el dibujo arranca ahí mismo; el resto de los pivots
		// retrocede la mitad/el total del ancho/alto según qué lado de la imagen deba
		// caer sobre `pos`. Mismo criterio que usa drawSprite() más abajo.
		let drawOffsetX = 0;
		let drawOffsetY = 0;

		switch(pivot) {
			case Pivot.Top_Left: break;
			case Pivot.Top_Center: drawOffsetX = -dWidth / 2; break;
			case Pivot.Top_Right: drawOffsetX = -dWidth; break;
			case Pivot.Center_Left: drawOffsetY = -dHeight / 2; break;
			case Pivot.Center: drawOffsetX = -dWidth / 2; drawOffsetY = -dHeight / 2; break;
			case Pivot.Center_Right: drawOffsetX = -dWidth; drawOffsetY = -dHeight / 2; break;
			case Pivot.Bottom_Left: drawOffsetY = -dHeight; break;
			case Pivot.Bottom_Center: drawOffsetX = -dWidth / 2; drawOffsetY = -dHeight; break;
			case Pivot.Bottom_Right: drawOffsetX = -dWidth; drawOffsetY = -dHeight; break;
		}

		this.ctx.drawImage(imageElement, 0, 0, sWidth, sHeight, drawOffsetX, drawOffsetY, dWidth, dHeight);

		this.ctx.restore();
	}

	beginAlpha(alpha) {
		if(alpha >= 0 || alpha <= 1) {
			this.ctx.save()
			this.ctx.globalAlpha = alpha
		}
	}

	endAlpha() {
		this.ctx.globalAlpha = 1
		this.ctx.restore()
	}

	npatches = {}

	loadNPatch(name, image, left, top, right, bottom) {
		if (!image || !image._loaded) {
			console.warn(`[Js2d] loadNPatch: Imagen no válida o no cargada para NPatch "${name}".`);
			return;
		}

		this.npatches[name] = {
			image: image,
			left: left,
			top: top,
			right: right,
			bottom: bottom,
			width: image._w,
			height: image._h
		};
	}

	drawNPatch(npatchNameOrData, pos, size, options = {}) {
		let npatchData;

		if (typeof npatchNameOrData === 'string') {
			npatchData = this.npatches[npatchNameOrData];
			if (!npatchData) {
				console.warn(`[Js2d] drawNPatch: NPatch "${npatchNameOrData}" no encontrado.`);
				return;
			}
		} else if (npatchNameOrData && npatchNameOrData.image) {
			npatchData = npatchNameOrData;
		} else {
			console.warn("[Js2d] drawNPatch: Datos de NPatch inválidos.");
			return;
		}

		const image = npatchData.image;
		const srcLeft = npatchData.left;
		const srcTop = npatchData.top;
		const srcRight = npatchData.right;
		const srcBottom = npatchData.bottom;
		const srcWidth = npatchData.width;
		const srcHeight = npatchData.height;
		const scale = options.scale || 1;

		const centerWidth = srcWidth - srcLeft - srcRight;
		const centerHeight = srcHeight - srcTop - srcBottom;

		const dstWidth = size.width;
		const dstHeight = size.height;

		const dstLeft = Math.round((options.left || srcLeft) * scale);
		const dstTop = Math.round((options.top || srcTop) * scale);
		const dstRight = Math.round((options.right || srcRight) * scale);
		const dstBottom = Math.round((options.bottom || srcBottom) * scale);

		const dstCenterWidth = dstWidth - dstLeft - dstRight;
		const dstCenterHeight = dstHeight - dstTop - dstBottom;

		this.ctx.imageSmoothingEnabled = false;
		this.ctx.save();

		const x = Math.round(pos.x);
		const y = Math.round(pos.y);

		const parts = [
			{ sx: 0, sy: 0, sw: srcLeft, sh: srcTop, dx: x, dy: y, dw: dstLeft, dh: dstTop },
			{ sx: srcLeft, sy: 0, sw: centerWidth, sh: srcTop, dx: Math.round(x + dstLeft), dy: y, dw: dstCenterWidth, dh: dstTop },
			{ sx: srcWidth - srcRight, sy: 0, sw: srcRight, sh: srcTop, dx: Math.round(x + dstLeft + dstCenterWidth), dy: y, dw: dstRight, dh: dstTop },

			{ sx: 0, sy: srcTop, sw: srcLeft, sh: centerHeight, dx: x, dy: Math.round(y + dstTop), dw: dstLeft, dh: dstCenterHeight },
			{ sx: srcLeft, sy: srcTop, sw: centerWidth, sh: centerHeight, dx: Math.round(x + dstLeft), dy: Math.round(y + dstTop), dw: dstCenterWidth, dh: dstCenterHeight },
			{ sx: srcWidth - srcRight, sy: srcTop, sw: srcRight, sh: centerHeight, dx: Math.round(x + dstLeft + dstCenterWidth), dy: Math.round(y + dstTop), dw: dstRight, dh: dstCenterHeight },

			{ sx: 0, sy: srcHeight - srcBottom, sw: srcLeft, sh: srcBottom, dx: x, dy: Math.round(y + dstTop + dstCenterHeight), dw: dstLeft, dh: dstBottom },
			{ sx: srcLeft, sy: srcHeight - srcBottom, sw: centerWidth, sh: srcBottom, dx: Math.round(x + dstLeft), dy: Math.round(y + dstTop + dstCenterHeight), dw: dstCenterWidth, dh: dstBottom },
			{ sx: srcWidth - srcRight, sy: srcHeight - srcBottom, sw: srcRight, sh: srcBottom, dx: Math.round(x + dstLeft + dstCenterWidth), dy: Math.round(y + dstTop + dstCenterHeight), dw: dstRight, dh: dstBottom }
		];

		for (const part of parts) {
			if (part.sw > 0 && part.sh > 0 && part.dw > 0 && part.dh > 0) {
				this.ctx.drawImage(image, part.sx, part.sy, part.sw, part.sh, Math.round(part.dx), Math.round(part.dy), Math.round(part.dw), Math.round(part.dh));
			}
		}

		this.ctx.restore();
	}

	loadAudio(path) {
		return new Audio(path)
	}

	playAudio(audio, loop = false, onEndCallback = null) {
		if (!audio) return;

		audio.volume = this.masterVolume; // Aplica el volumen maestro siempre
		audio.loop = loop;

		if (onEndCallback && !loop) {
			const callbackWrapper = () => {
				onEndCallback();
				audio.removeEventListener('ended', callbackWrapper);
			};
			audio.addEventListener('ended', callbackWrapper, { once: true });
		}

		const playPromise = audio.play();
		if (playPromise !== undefined) {
			playPromise.catch(error => {});
		}
	}

	playAudioOverlap(audio) {
		if (audio && audio.src) {
			const clone = audio.cloneNode();
			clone.volume = this.masterVolume; // Aplica el volumen maestro a los clones
			clone.play();
		}
	}
	setVolume(audio, vol = 1) {
		audio.volume = vol * this.masterVolume;
	}
	stopAudio(audio) {
		if (audio && typeof audio.pause === 'function') {
			audio.pause();
			audio.currentTime = 0;
		}
	}
	pauseAudio(audio) {
		if (audio && typeof audio.pause === 'function') {
			audio.pause();
		}
	}
	setMasterVolume(volume) {
		this.masterVolume = Math.max(0, Math.min(1, volume));
	}

	// `endFrequency` hace un glide de tono; `curve: 'exp'` usa una caída exponencial
	// (más natural para sonidos percusivos). Sin esos dos, el comportamiento es el de antes.
	playSoundEffect({ frequency = 440, endFrequency = null, duration = 0.1, volume = 0.5, type = 'sine', attack = 0.01, release = 0.1, curve = 'linear' }) {
		if (!this.audioCtx) return null;

		const now = this.audioCtx.currentTime;
		const gainNode = this.audioCtx.createGain();
		gainNode.connect(this.audioCtx.destination);

		const finalVolume = volume * this.masterVolume;

		gainNode.gain.setValueAtTime(0, now);
		gainNode.gain.linearRampToValueAtTime(finalVolume, now + attack);

		const releaseStart = Math.max(now + attack, now + duration - release);
		gainNode.gain.setValueAtTime(finalVolume, releaseStart);
		if (curve === 'exp') {
			gainNode.gain.exponentialRampToValueAtTime(0.0001, releaseStart + release);
		} else {
			gainNode.gain.linearRampToValueAtTime(0, releaseStart + release);
		}

		const oscillator = this.audioCtx.createOscillator();
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(frequency, now);
		if (endFrequency != null && endFrequency > 0) {
			oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
		}

		oscillator.connect(gainNode);
		oscillator.start(now);
		oscillator.stop(now + duration + release);

		return { oscillator, gainNode };
	}

	// Ráfaga de ruido blanco con envolvente y lowpass opcional (para golpes de aire,
	// arena, whooshes). `lowpass` en Hz o null.
	playNoise({ duration = 0.2, volume = 0.4, lowpass = null, attack = 0.005, release = 0.12 }) {
		if (!this.audioCtx) return null;

		const now = this.audioCtx.currentTime;
		const frames = Math.max(1, Math.floor(this.audioCtx.sampleRate * duration));
		const buffer = this.audioCtx.createBuffer(1, frames, this.audioCtx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

		const src = this.audioCtx.createBufferSource();
		src.buffer = buffer;

		const gainNode = this.audioCtx.createGain();
		const finalVolume = volume * this.masterVolume;
		gainNode.gain.setValueAtTime(0, now);
		gainNode.gain.linearRampToValueAtTime(finalVolume, now + attack);
		const releaseStart = Math.max(now + attack, now + duration - release);
		gainNode.gain.setValueAtTime(finalVolume, releaseStart);
		gainNode.gain.exponentialRampToValueAtTime(0.0001, releaseStart + release);

		let node = src;
		if (lowpass) {
			const filter = this.audioCtx.createBiquadFilter();
			filter.type = 'lowpass';
			filter.frequency.setValueAtTime(lowpass, now);
			src.connect(filter);
			node = filter;
		}
		node.connect(gainNode);
		gainNode.connect(this.audioCtx.destination);

		src.start(now);
		src.stop(now + duration + release);
		return { src, gainNode };
	}

	sprites = {}

	async loadSprite(name, pathOrImage, scale = 1, frameWidth = null, frameHeight = null) {
		this.sprites[name] = {};
		let image;

		if (pathOrImage instanceof HTMLImageElement) {
			image = pathOrImage;
			this.sprites[name].path = pathOrImage.src || "";
		} else {
			image = await this.loadImage(pathOrImage);
			this.sprites[name].path = pathOrImage;
		}
		
		this.sprites[name].image = image;
		this.sprites[name].scale = scale;

		this.sprites[name].frameWidth = frameWidth || image._w;
		this.sprites[name].frameHeight = frameHeight || image._h;
	}

	async loadSprites(spriteList) {
		const paths = spriteList.map(item => item[1]);
		
		try {
			const images = await this.loadImages(paths);
			
			images.forEach((img, index) => {
				const item = spriteList[index];
				const name = item[0];
				const scale = item[2] || 1;

				const frameWidth = item[3] || null;
				const frameHeight = item[4] || null;
				
				this.loadSprite(name, img, scale, frameWidth, frameHeight);
			});
			
			console.log(`[Js2d] ${spriteList.length} sprites cargados correctamente`);
			return true;
		} catch (error) {
			console.error("[Js2d] Error cargando sprites:", error);
			return false;
		}
	}

	async loadTileset(name, path, tileWidth, tileHeight) {
		try {
			const image = await this.loadImage(path);
			this.tilesets[name] = {
				image: image,
				tileWidth: tileWidth,
				tileHeight: tileHeight
			};
			console.log(`[Js2d] Tileset "${name}" cargado correctamente.`);
			return this.tilesets[name];
		} catch (error) {
			console.error(`[Js2d] No se pudo cargar el tileset "${name}".`, error);
			return null;
		}
	}

	defineSpriteFromTileset(spriteName, tilesetName, tileX, tileY, numFrames = 1, scale = 1) {
		if (!this.tilesets[tilesetName]) {
			console.error(`[Js2d] No se puede definir el sprite "${spriteName}" porque el tileset "${tilesetName}" no existe.`);
			return;
		}

		this.sprites[spriteName] = {
			tilesetName: tilesetName,
			tileX: tileX, // Coordenada X del primer fotograma (en tiles)
			tileY: tileY, // Coordenada Y del primer fotograma (en tiles)
			numFrames: numFrames,
			scale: scale
		};
	}

	drawSprite(imageOrSpriteName, frame = 0, pos, scale = 1, flipped = false, rotation = 0, pivot = Pivot.Center) {
		let spriteInfo = null;
		let image;

		// Primero, determinamos si estamos trabajando con un nombre de sprite o una imagen directa.
		if (typeof imageOrSpriteName === 'string') {
			spriteInfo = this.sprites[imageOrSpriteName];
		} else if (imageOrSpriteName instanceof HTMLImageElement) {
			image = imageOrSpriteName;
			// Buscamos si hay info de sprite asociada a esta imagen
			for (const key in this.sprites) {
				if (this.sprites[key].image === image) {
					spriteInfo = this.sprites[key];
					break;
				}
			}
		}

		if (!image && !spriteInfo) return; // No se puede dibujar nada.

		let sx, sy, sWidth, sHeight; // Coordenadas y tamaño del recorte (Source)

		if (spriteInfo && spriteInfo.tilesetName) {
			// Sprite de un Tileset
			const tileset = this.tilesets[spriteInfo.tilesetName];
			if (!tileset) return;

			image = tileset.image;
			sWidth = tileset.tileWidth;
			sHeight = tileset.tileHeight;

			// El recorte según las coordenadas del tile y el frame de la animación se calcula una vez y se guarda en el sprite
			// (con la imagen para la que valía: si el tileset cambia, se recalcula)
			const cuts = spriteInfo._cuts || (spriteInfo._cuts = []);
			let cut = cuts[frame];
			if (!cut || cut.image !== image) {
				const framesPerRow = Math.floor(image._w / sWidth);
				const currentTileIndex = spriteInfo.tileY * framesPerRow + spriteInfo.tileX + frame;
				cut = { image, sx: (currentTileIndex % framesPerRow) * sWidth, sy: Math.floor(currentTileIndex / framesPerRow) * sHeight };
				if (image._w > 0) cuts[frame] = cut;   // mientras la imagen no cargó no se guarda
			}
			sx = cut.sx;
			sy = cut.sy;
		} else {
			// Imagen suelta
			if (!image) image = spriteInfo.image; // Aseguramos que tenemos la imagen
			if (!image || !image._loaded) return;

			sWidth = (spriteInfo && spriteInfo.frameWidth) ? spriteInfo.frameWidth : image._w;
			sHeight = (spriteInfo && spriteInfo.frameHeight) ? spriteInfo.frameHeight : image._h;
			
			const framesPerRow = Math.floor(image._w / sWidth);
			const col = frame % framesPerRow;
			const row = Math.floor(frame / framesPerRow);
			sx = col * sWidth;
			sy = row * sHeight;
		}

		// (el suavizado de imágenes se fija una vez por cuadro en clearBg y al cambiar el tamaño del canvas, no en cada dibujo)

		const dWidth = sWidth * scale;
		const dHeight = sHeight * scale;

		let drawOffsetX = 0;
		let drawOffsetY = 0;

		switch(pivot) {
			case Pivot.Top_Center:    drawOffsetX = -dWidth / 2; break;
			case Pivot.Top_Right:     drawOffsetX = -dWidth; break;
			case Pivot.Center_Left:   drawOffsetY = -dHeight / 2; break;
			case Pivot.Center:        drawOffsetX = -dWidth / 2; drawOffsetY = -dHeight / 2; break;
			case Pivot.Center_Right:  drawOffsetX = -dWidth; drawOffsetY = -dHeight / 2; break;
			case Pivot.Bottom_Left:   drawOffsetY = -dHeight; break;
			case Pivot.Bottom_Center: drawOffsetX = -dWidth / 2; drawOffsetY = -dHeight; break;
			case Pivot.Bottom_Right:  drawOffsetX = -dWidth; drawOffsetY = -dHeight; break;
		}

		// Sin rotación ni espejado se ajustan los bordes del rectángulo a píxeles físicos. Redondear
		// posición y tamaño por separado deja una rendija de 1px entre tiles contiguos cuando la
		// escala es fraccionaria; con bordes absolutos, dos tiles vecinos comparten el mismo borde.
		if (rotation === 0 && !flipped) {
			const dpr = this.dpr || 1;
			// Redondeo con un sesgo mínimo: el borde derecho de un tile y el izquierdo del siguiente son el mismo valor, pero
			// calculados por caminos distintos pueden diferir en el último decimal; justo en un empate (n,5 px físicos) uno
			// redondeaba para arriba y el otro para abajo y quedaba una rendija de 1 px que aparecía y desaparecía al scrollear.
			const snap = v => Math.floor(v * dpr + 0.5 + 1e-4) / dpr;
			const x0 = snap(pos.x + drawOffsetX);
			const y0 = snap(pos.y + drawOffsetY);
			const x1 = snap(pos.x + drawOffsetX + dWidth);
			const y1 = snap(pos.y + drawOffsetY + dHeight);
			this.ctx.drawImage(image, sx, sy, sWidth, sHeight, x0, y0, x1 - x0, y1 - y0);
			return;
		}

		this.ctx.save();
		this.ctx.translate(Math.round(pos.x), Math.round(pos.y));

		if (rotation !== 0) {
			this.ctx.rotate(this.toRadians(rotation));
		}

		if (flipped) {
			this.ctx.scale(-1, 1);
			drawOffsetX = -drawOffsetX - dWidth;
		}

		this.ctx.drawImage(image, sx, sy, sWidth, sHeight, 
			Math.round(drawOffsetX), Math.round(drawOffsetY), 
			dWidth, dHeight);
		
		this.ctx.restore();
	}
	
	animatedSprites = {}

	createAnimatedSprite(name, spriteName, position, scale = 1) {
		if (!this.sprites[spriteName]) {
			console.error(`[Js2d] Sprite "${spriteName}" no existe. Carga el sprite primero.`)
			return null
		}

		this.animatedSprites[name] = {
			spriteName: spriteName,
			position: { ...position },
			scale: scale,
			currentAnimation: null,
			currentFrame: 0,
			frameElapsed: 0, // segundos acumulados en el frame actual — ver drawAnimatedSprite
			frameSpeed: 16,
			flipped: false,
			animations: {},
		}

		return this.animatedSprites[name]
	}

	addAnimationToSprite(spriteName, animationName, frames, loop = true, frameSpeed = 16) {
		if (!this.animatedSprites[spriteName]) {
			console.error(`[Js2d] AnimatedSprite "${spriteName}" no existe.`)
			return
		}

		this.animatedSprites[spriteName].animations[animationName] = {
			frames: frames,
			loop: loop,
			frameSpeed: frameSpeed,
		}

		if (!this.animatedSprites[spriteName].currentAnimation) {
			this.animatedSprites[spriteName].currentAnimation = animationName
		}
	}

	setAnimationForSprite(spriteName, animationName, resetFrame = true) {
		if (!this.animatedSprites[spriteName]) {
			console.error(`[Js2d] AnimatedSprite "${spriteName}" no existe.`)
			return
		}

		if (!this.animatedSprites[spriteName].animations[animationName]) {
			console.error(`[Js2d] Animación "${animationName}" no existe para "${spriteName}".`)
			return
		}

		if (this.animatedSprites[spriteName].currentAnimation !== animationName) {
			
			this.animatedSprites[spriteName].currentAnimation = animationName
			
			if (resetFrame) {
				this.animatedSprites[spriteName].currentFrame = 0
				this.animatedSprites[spriteName].frameElapsed = 0
			}
		}
	}

	// `dt` es obligatorio (ver getFrameTime()): antes esto avanzaba un frame cada N llamadas
	// a drawAnimatedSprite, así que la velocidad de la animación dependía de cuántas veces
	// por segundo se llamaba a este método (el framerate real del juego) en vez de tiempo
	// real — la misma animación corría distinto en una pantalla de 144Hz que en una de 60Hz,
	// o si el juego limita su propio framerate. `frameSpeed` se sigue interpretando en las
	// mismas unidades que ya usaban los juegos existentes ("cuadros a 60fps de referencia"),
	// así que los valores de frameSpeed que ya se hayan elegido no hace falta retocarlos.
	drawAnimatedSprite(name, dt, pivot = Pivot.Center) {
		const sprite = this.animatedSprites[name]
		if (!sprite || !sprite.currentAnimation) return

		const animation = sprite.animations[sprite.currentAnimation]
		if (!animation) return

		const frameSpeed = animation.frameSpeed || sprite.frameSpeed
		const frameDuration = frameSpeed / 60

		sprite.frameElapsed += dt
		while (sprite.frameElapsed >= frameDuration) {
			sprite.frameElapsed -= frameDuration
			if (animation.loop) {
				sprite.currentFrame = (sprite.currentFrame + 1) % animation.frames.length
			} else if (sprite.currentFrame < animation.frames.length - 1) {
				sprite.currentFrame++
			}
		}

		// Dibujo
		const frame = animation.frames[sprite.currentFrame]

		this.drawSprite(sprite.spriteName, frame, sprite.position, sprite.scale, sprite.flipped, 0, pivot)
	}

	getCurrentFrame(name) {
		const sprite = this.animatedSprites[name]
		if (!sprite || !sprite.currentAnimation) return 0

		const animation = sprite.animations[sprite.currentAnimation]
		if (!animation) return 0

		return animation.frames[sprite.currentFrame]
	}

	//
	// Herramientas
	//

	setCookie(name, value, days) {
		let expires = "";
		if (days) {
			const date = new Date();
			date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
			expires = "; expires=" + date.toUTCString();
		}
		document.cookie = name + "=" + (value || "")  + expires + "; path=/";
	}

	getCookie(name) {
		const nameEQ = name + "=";
		const ca = document.cookie.split(';');
		for(let i = 0; i < ca.length; i++) {
			let c = ca[i];
			while (c.charAt(0) === ' ') c = c.substring(1, c.length); // Quita espacios en blanco
			if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
		}
		return null;
	}

	//
	// Memoria del navegador (configuración, progreso). setCookie/getCookie de acá arriba son el
	// depósito crudo; lo que hay que usar es saveData/loadData.
	//
	// Son DOS depósitos y no uno porque ninguno de los dos anda siempre, y de maneras distintas:
	//
	//   - Adentro de un iframe de otro sitio —que es exactamente cómo se juega en itch.io: el
	//     juego se sirve desde html-classic.itch.zone dentro de la página de itch.io— las cookies
	//     son "de tercera parte". Safari las bloquea desde hace años y Chrome va en ese camino.
	//     Lo peor del caso es que escribir NO falla: se traga el dato y no queda nada.
	//   - localStorage aguanta en más de esos casos, pero tiene la trampa opuesta: en Safari,
	//     tocarlo dentro de un iframe bloqueado TIRA EXCEPCIÓN. No devuelve null: revienta. Sin
	//     el try/catch, leer la configuración se llevaba puesto el arranque del juego entero.
	//
	// Así que se escribe en los dos y se lee del primero que conteste. Nada de esto es una
	// garantía: si el navegador bloquea todo, no se guarda nada y el juego tiene que seguir
	// andando igual — para avisarlo está storageAvailable().
	saveData(name, value) {
		const texto = String(value === undefined || value === null ? "" : value);
		try {
			if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(name, texto);
		} catch (e) { /* bloqueado o lleno: queda la cookie */ }
		try { this.setCookie(name, texto, 365); } catch (e) { /* idem, queda localStorage */ }
	}

	loadData(name) {
		try {
			if (typeof localStorage !== 'undefined' && localStorage) {
				const guardado = localStorage.getItem(name);
				if (guardado !== null) return guardado;
			}
		} catch (e) { /* ver arriba: tocarlo puede tirar */ }

		const enCookie = this.getCookie(name);
		// Lo que venía guardado de antes, cuando todo iba a la cookie: se copia a localStorage al
		// leerlo para que no dependa de ella la próxima vez. Sin esto, a quien ya tenía su
		// configuración guardada no lo alcanzaría nunca la mejora.
		if (enCookie !== null) {
			try {
				if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(name, enCookie);
			} catch (e) { /* no se pudo migrar; se sigue leyendo de la cookie */ }
		}
		return enCookie;
	}

	clearData(name) {
		try {
			if (typeof localStorage !== 'undefined' && localStorage) localStorage.removeItem(name);
		} catch (e) { /* nada que hacer */ }
		this.setCookie(name, "", -1); // fecha en el pasado: así se borra una cookie
	}

	// ¿Este navegador está guardando algo de verdad? No alcanza con preguntar si existe
	// localStorage ni con mirar si la escritura falló: una cookie bloqueada se escribe sin
	// protestar y desaparece. La única forma de saberlo es escribir algo y volver a leerlo.
	// Se contesta una sola vez por sesión (la respuesta no cambia sola).
	storageAvailable() {
		if (this._storageOk !== undefined) return this._storageOk;
		const clave = '__js2d_probe';
		try {
			this.saveData(clave, '1');
			this._storageOk = this.loadData(clave) === '1';
			this.clearData(clave);
		} catch (e) {
			this._storageOk = false;
		}
		return this._storageOk;
	}

	// Wrapper de saveData/loadData para objetos: cada juego nuevo termina reimplementando
	// JSON.stringify/parse + relleno de campos faltantes a mano (bot-factory tiene
	// buildSaveData/applySavedData para justamente esto). loadJSON() nunca tira: si no hay
	// nada guardado o el JSON quedó corrupto, devuelve `fallback` tal cual.
	saveJSON(name, obj) {
		this.saveData(name, JSON.stringify(obj));
	}

	loadJSON(name, fallback = null) {
		const raw = this.loadData(name);
		if (raw === null || raw === undefined || raw === "") return fallback;
		try {
			return JSON.parse(raw);
		} catch (e) {
			return fallback;
		}
	}

	getFileExtention(filename) {
		const parts = filename.split(".")
		if (parts.length <= 1 || (parts.length === 2 && parts[0] === "")) {
			return ""
		}
		return parts.pop()
	}

	// https://gist.github.com/tommyettinger/46a874533244883189143505d203312c?permalink_comment_id=4365431#gistcomment-4365431
	random(seed, max) {
		seed |= 0
		seed = seed + 0x9e3779b9 | 0
		let t = seed ^ seed >>> 16
		t = Math.imul(t, 0x21f0aaad)
		t = t ^ t >>> 15
		t = Math.imul(t, 0x735a2d97)
		let rand = ((t = t ^ t >>> 15) >>> 0) / 4294967296
		return rand * max
	}

	indexToCoords(index, width) {
		return { x: index % width, y: Math.floor(index / width) }
	}

	coordsToIndex({x: x, y: y}, width) {
		return y * width + x
	}

	toRadians(degrees) {
		return degrees * (Math.PI / 180)
	}

	toDegrees(radians) {
		return radians * (180 / Math.PI)
	}

	Vector2(p1, p2) {
		const v = {}

		v.x = p2.x - p1.x
		v.y = p2.y - p1.y
		v.len = Math.sqrt(v.x * v.x + v.y * v.y)
		v.nx = v.x / v.len
		v.ny = v.y / v.len
		v.ang = Math.atan2(v.ny, v.nx)

		return v
	}

	// Colisiones
	checkCollisionRectRect(rect1, rect2) {
		return (
			rect1.x < rect2.x + rect2.width &&
			rect1.x + rect1.width > rect2.x &&
			rect1.y < rect2.y + rect2.height &&
			rect1.y + rect1.height > rect2.y
		);
	}
	checkCollisionCircleCircle(circle1, circle2) {
		const dx = circle2.x - circle1.x;
		const dy = circle2.y - circle1.y;
		const distance = Math.sqrt(dx * dx + dy * dy);
		return distance < circle1.radius + circle2.radius;
	}
	checkCollisionPointRect(point, rect) {
		return point.x >= rect.x && point.x <= rect.x + rect.width &&
			   point.y >= rect.y && point.y <= rect.y + rect.height;
	}
	checkCollisionCircleRect(circle, rect) {
		const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
		const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

		// Calcular la distancia entre el punto más cercano y el centro del círculo
		const dx = circle.x - closestX;
		const dy = circle.y - closestY;
		const distanceSquared = (dx * dx) + (dy * dy);

		return distanceSquared < (circle.radius * circle.radius);
	}
	checkCollisionPointCircle(point, circle) {
		const dx = point.x - circle.x;
		const dy = point.y - circle.y;
		return (dx * dx) + (dy * dy) < (circle.radius * circle.radius);
	}
	// Ray casting: cuenta cuántas veces un rayo horizontal desde `point` hacia la derecha
	// cruza los bordes del polígono — adentro si el total es impar. `points` es un array de
	// {x, y}, mismo formato que devuelve getPolygonPoints() (no hace falta cerrarlo repitiendo
	// el primer punto al final, el módulo ya envuelve al último borde de vuelta al primero).
	checkCollisionPointPolygon(point, points) {
		let inside = false;
		for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
			const pi = points[i];
			const pj = points[j];
			const intersects = ((pi.y > point.y) !== (pj.y > point.y)) &&
				(point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x);
			if (intersects) inside = !inside;
		}
		return inside;
	}


	getPolygonPoints(center, sides, radius, rotation = 0) {
		const rotationInRadians = this.toRadians(rotation)
		const points = []

		let p1 = {
			x: center.x + radius * Math.cos(rotationInRadians),
			y: center.y + radius * Math.sin(rotationInRadians)
		}
		points.push(p1)

		let point
		for (let i = 1; i < sides; i += 1) {
			point = {
				x: center.x + radius * Math.cos(i * 2 * Math.PI / sides + rotationInRadians),
				y: center.y + radius * Math.sin(i * 2 * Math.PI / sides + rotationInRadians)
			}
			points.push(point)
		}

		return points
	}

	pointsToRoundedPolygon(points, radiusAll) {
		let p1, p2, p3

		let radius = radiusAll

		let v1 = {}
		let v2 = {}

		const len = points.length

		p1 = points[len - 1]

		for (let i = 0; i < len; i++) {
			p2 = points[(i) % len]
			p3 = points[(i + 1) % len]

			v1 = this.Vector2(p2, p1)
			v2 = this.Vector2(p2, p3)

			const sinA = v1.nx * v2.ny - v1.ny * v2.nx
			const sinA90 = v1.nx * v2.nx - v1.ny * -v2.ny
			let angle = Math.asin(Math.max(-1, Math.min(1, sinA)));

			let radDirection = 1
			let drawDirection = false
			if (sinA90 < 0) {
				if (angle < 0) {
					angle = Math.PI + angle
				} else {
					angle = Math.PI - angle
					radDirection = -1
					drawDirection = true
				}
			} else {
				if (angle > 0) {
					radDirection = -1
					drawDirection = true
				}
			}
			if(p2.radius !== undefined){
					radius = p2.radius
			}else{
					radius = radiusAll
			}

			const halfAngle = angle / 2
			
			let lenOut = Math.abs(Math.cos(halfAngle) * radius / Math.sin(halfAngle))
			
			let cRadius

			if (lenOut > Math.min(v1.len / 2, v2.len / 2)) {
				lenOut = Math.min(v1.len / 2, v2.len / 2)
				cRadius = Math.abs(lenOut * Math.sin(halfAngle) / Math.cos(halfAngle))
			} else {
				cRadius = radius
			}

			let x = p2.x + v2.nx * lenOut
			let y = p2.y + v2.ny * lenOut

			x += -v2.ny * cRadius * radDirection
			y += v2.nx * cRadius * radDirection

			this.ctx.arc(x, y, cRadius, v1.ang + Math.PI / 2 * radDirection, v2.ang - Math.PI / 2 * radDirection, drawDirection)
			
			p1 = p2
			p2 = p3
		}

		this.ctx.closePath();
	}

	changeImageHSLAsync(sourceImage, options = {}) {
		return new Promise((resolve, reject) => {
			if (!sourceImage || !sourceImage.complete || !sourceImage.naturalWidth) {
				const errorMsg = "[Js2d] La imagen de origen no está lista para ser modificada.";
				console.warn(errorMsg);
				reject(new Error(errorMsg));
				return;
			}

			const hueShift = options.hue || 0;
			const saturationShift = options.saturation || 0;
			const lightnessShift = options.lightness || 0;

			const canvas = document.createElement('canvas');
			canvas.width = sourceImage.naturalWidth;
			canvas.height = sourceImage.naturalHeight;
			const ctx = canvas.getContext('2d');

			ctx.drawImage(sourceImage, 0, 0);

			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const data = imageData.data;

			for (let i = 0; i < data.length; i += 4) {
				if (data[i + 3] === 0) continue;

				const hsl = this.rgbToHsl(data[i], data[i + 1], data[i + 2]);
				
				hsl.h = (hsl.h + (hueShift / 360)) % 1;
				if (hsl.h < 0) hsl.h += 1;

				hsl.s = Math.max(0, Math.min(1, hsl.s + saturationShift));
				hsl.l = Math.max(0, Math.min(1, hsl.l + lightnessShift));

				const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);

				data[i] = newRgb.r;
				data[i + 1] = newRgb.g;
				data[i + 2] = newRgb.b;
			}
			ctx.putImageData(imageData, 0, 0);

			const newImage = new Image();

			newImage.onload = () => {
				newImage._w = newImage.width;
				newImage._h = newImage.height;
				newImage._loaded = true;
				
				resolve(newImage);
			};
			
			newImage.onerror = () => {
				reject(new Error("[Js2d] No se pudo crear la imagen a partir de los datos del canvas."));
			};

			newImage.src = canvas.toDataURL();
		});
	}

	noise2D(xin, yin) {
		let n0, n1, n2;
		const s = (xin + yin) * this.#F2;
		const i = Math.floor(xin + s);
		const j = Math.floor(yin + s);
		const t = (i + j) * this.#G2;
		const X0 = i - t;
		const Y0 = j - t;
		const x0 = xin - X0;
		const y0 = yin - Y0;
		let i1, j1;
		if (x0 > y0) { i1 = 1; j1 = 0; }
		else { i1 = 0; j1 = 1; }
		const x1 = x0 - i1 + this.#G2;
		const y1 = y0 - j1 + this.#G2;
		const x2 = x0 - 1.0 + 2.0 * this.#G2;
		const y2 = y0 - 1.0 + 2.0 * this.#G2;
		const ii = i & 255;
		const jj = j & 255;
		const gi0 = this.#permMod12[ii + this.#perm[jj]];
		const gi1 = this.#permMod12[ii + i1 + this.#perm[jj + j1]];
		const gi2 = this.#permMod12[ii + 1 + this.#perm[jj + 1]];
		let t0 = 0.5 - x0 * x0 - y0 * y0;
		if (t0 < 0) n0 = 0.0;
		else {
			t0 *= t0;
			n0 = t0 * t0 * (this.#grad3[gi0][0] * x0 + this.#grad3[gi0][1] * y0);
		}
		let t1 = 0.5 - x1 * x1 - y1 * y1;
		if (t1 < 0) n1 = 0.0;
		else {
			t1 *= t1;
			n1 = t1 * t1 * (this.#grad3[gi1][0] * x1 + this.#grad3[gi1][1] * y1);
		}
		let t2 = 0.5 - x2 * x2 - y2 * y2;
		if (t2 < 0) n2 = 0.0;
		else {
			t2 *= t2;
			n2 = t2 * t2 * (this.#grad3[gi2][0] * x2 + this.#grad3[gi2][1] * y2);
		}
		return 70.0 * (n0 + n1 + n2);
	}
}
