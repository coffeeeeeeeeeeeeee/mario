// js2d.js — motor de canvas 2D genérico, versión 1.1

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
			updateMouseFromClient(e.clientX, e.clientY);
		});

	    // Clics (presionar)
		this.#on(window, 'mousedown', () => this.initAudio(), { once: true });
		this.#on(window, 'touchstart', () => this.initAudio(), { once: true });
	    this.#on(this.canvas, 'mousedown', e => {
	        if (e.button >= 0 && e.button < 3) { // 0: izq, 1: medio, 2: der
	            this.mouseButtons[e.button] = true;
	        }
	    });

	    // Clics (soltar)
	    this.#on(this.canvas, 'mouseup', e => {
	        if (e.button >= 0 && e.button < 3) {
	            this.mouseButtons[e.button] = false;
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
			this.mouseButtons[0] = true;
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
			this.mouseButtons[0] = false;
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

			if (e.code === 'Tab') {
				e.preventDefault();
			}
		});
    	this.#on(window, 'keyup', e => { delete this.keysPressed[e.code]; });

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

		if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	// Tope del delta, en segundos. Cuando la pestaña queda en segundo plano el navegador frena
	// el requestAnimationFrame, y al volver el primer cuadro traería un salto de varios segundos:
	// sin este techo, todo lo que se mueve por dt se teletransportaría de una. Es preferible que
	// el juego "pierda" ese tiempo a que dé un salto.
	static MAX_FRAME_TIME = 0.1;

	tick(timestamp) {
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
		this.ctx.fillStyle = color;
		this.ctx.fillRect(0, 0, this.getCanvasWidth(), this.getCanvasHeight());
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

			// Calculamos el recorte basado en las coordenadas del tile + el frame de la animación
			const framesPerRow = Math.floor(image._w / sWidth);
			const startTileIndex = spriteInfo.tileY * framesPerRow + spriteInfo.tileX;
			const currentTileIndex = startTileIndex + frame;
			
			sx = (currentTileIndex % framesPerRow) * sWidth;
			sy = Math.floor(currentTileIndex / framesPerRow) * sHeight;			
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
		
		this.ctx.imageSmoothingEnabled = IMAGE_SMOOTHING;

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
			const x0 = Math.round((pos.x + drawOffsetX) * dpr) / dpr;
			const y0 = Math.round((pos.y + drawOffsetY) * dpr) / dpr;
			const x1 = Math.round((pos.x + drawOffsetX + dWidth) * dpr) / dpr;
			const y1 = Math.round((pos.y + drawOffsetY + dHeight) * dpr) / dpr;
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
