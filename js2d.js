Color = {
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
}

Line_Cap = {
	Butt: "butt",
	Round: "round",
	Square: "square"

}

Pivot = {
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

IMAGE_SMOOTHING = false;

class SpriteFont {
	constructor(image, charWidth, charHeight, charMap) {
		this.image = image;
		this.charWidth = charWidth;
		this.charHeight = charHeight;
		this.charMap = charMap;
	}
}

class Js2d {
	canvas = null;
	ctx = null;
	audioCtx = null;
	keysPressed = {};
	masterVolume = 1.0;
	mousePos = {x: 0, y: 0};
	
	// Propiedades para el contador de FPS
	#lastFrameTime = 0;
	#frameCount = 0;
	#fps = 0;
	
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
		this.initListeners();
		
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
	}

	initListeners() {
		window.addEventListener('mousedown', () => this.initAudio(), { once: true });
		window.addEventListener('mousemove', e => {
			this.mousePos = {
				x: e.mouseX,
				y: e.mouseY
			}
		});

		window.addEventListener('keydown', e => {
			this.initAudio();
			this.keysPressed[e.code] = true;
		}, { once: true });

		window.addEventListener('keydown', e => { this.keysPressed[e.code] = true; });
		window.addEventListener('keyup', e => { this.keysPressed[e.code] = false; });
		window.addEventListener('resize', () => this.resizeCanvas());
	}

	getCanvasRectangle(){
		return {
			x: 0, y: 0,
			width: js2d.getCanvasWidth(),
			height: js2d.getCanvasHeight()
		};
	}

	getCanvasWidth(){
		return this.canvas.width;
	}
	getCanvasHeight(){
		return this.canvas.height;
	}

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

	resizeCanvas() {
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
	}

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
	}
	
	clearBg(color) {
		this.ctx.fillStyle = color;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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
	drawRectangle(rect, color = Color.BLACK) {
		this.ctx.save()
		this.ctx.strokeStyle = "none"
		this.ctx.fillStyle = color
		this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
		this.ctx.restore()
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
	drawRectangleRoundedLines(rect, cornerRadius, color = Color.BLACK) {
		this.ctx.save()

		this.ctx.strokeStyle = color

		this.ctx.beginPath()
		this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, cornerRadius)
		this.ctx.stroke()

		this.ctx.restore()
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

		for (var i = 1; i < points.length; i += 1) {
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
	drawTextCustom(font, text, size, color, pos, alignment = "left") {
		this.ctx.save();

		if (!font || !font.family) {
			if (!font) {
				console.warn("[Js2d] Intento de usar una fuente nula. Se usará la fuente por defecto.");
			}
			this.ctx.font = `${size}px monospace`;
		} else {
			this.ctx.font = `${size}px "${font.family}"`;
		}

		this.ctx.textAlign = alignment;
		this.ctx.fillStyle = color;
		this.ctx.fillText(text, pos.x, pos.y);
		this.ctx.restore();
	}
	loadFont(name, path) {
		const customFont = new FontFace(name, `url(${path})`)
		return customFont
			.load()
			.then((font) => {
				document.fonts.add(font)
				console.log(`[Js2d] Fuente "${name}" cargada correctamente desde "${path}"`)
				return customFont
			})
			.catch((error) => {
				console.error(`[Js2d] La fuente "${name}" no se pudo cargar:`, error)
				return null
			})
	}
	
	createSpriteFont(path, characters, charWidth, charHeight) {
		const image = this.loadImage(path);
		const charMap = {};

		for (let i = 0; i < characters.length; i++) {
			const char = characters[i];
			charMap[char] = {
				x: i * charWidth,
				y: 0
			};
		}

		const spriteFont = new SpriteFont(image, charWidth, charHeight, charMap);
		return spriteFont;
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
		
		if (font && font.family) {
			this.ctx.font = `${lineHeight}px "${font.family}"`;
		} else {
			// Fallback
			this.ctx.font = `${lineHeight}px monospace`;
		}

		const words = text.split(' ');
		let line = '';

		for (let n = 0; n < words.length; n++) {
			const testLine = line + words[n] + ' ';
			const metrics = this.ctx.measureText(testLine);
			const testWidth = metrics.width;

			if (testWidth > maxWidth && n > 0) {
				this.drawTextCustom(font, line.trim(), lineHeight, color, { x: drawX, y: y }, alignment);
				
				line = words[n] + ' ';
				y += lineSpacing;
			} else {
				line = testLine;
			}
		}

		this.drawTextCustom(font, line.trim(), lineHeight, color, { x: drawX, y: y }, alignment);
	}

	countWrappedLines(font, text, maxWidth, fontSize, lineSpacing) {
		if (!text || text.length === 0) return 0;
		const ctx = this.ctx; // Accede al contexto de dibujo de Js2d
		
		// Guarda el estado actual de la fuente
		const originalFont = ctx.font; 

		ctx.font = `${fontSize}px ${font.fontFamily}`; // Establece la fuente para medir

		const words = text.split(' ');
		let currentLine = '';
		let numLines = 1;

		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			const testLine = currentLine.length === 0 ? word : currentLine + ' ' + word;
			const metrics = ctx.measureText(testLine);
			if (metrics.width > maxWidth && currentLine.length > 0) {
				numLines++;
				currentLine = word;
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
			console.warn("[Js2d] drawImage: La imagen no está cargada o es inválida.", imageElement);
			return;
		}

		this.ctx.imageSmoothingEnabled = IMAGE_SMOOTHING;

		const sWidth = imageElement.naturalWidth || imageElement.width;
		const sHeight = imageElement.naturalHeight || imageElement.height;

		const dWidth = sWidth * effectiveScale;
		const dHeight = sHeight * effectiveScale;

		this.ctx.save();
		
		let translateX = pos.x;
		let translateY = pos.y;

		switch(pivot) {
			case Pivot.Top_Left: break;
			case Pivot.Top_Center: translateX += dWidth / 2; break;
			case Pivot.Top_Right: translateX += dWidth; break;
			case Pivot.Center_Left: translateY += dHeight / 2; break;
			case Pivot.Center: translateX += dWidth / 2; translateY += dHeight / 2; break;
			case Pivot.Center_Right: translateX += dWidth; translateY += dHeight / 2; break;
			case Pivot.Bottom_Left: translateY += dHeight; break;
			case Pivot.Bottom_Center: translateX += dWidth / 2; translateY += dHeight; break;
			case Pivot.Bottom_Right: translateX += dWidth; translateY += dHeight; break;
		}

		this.ctx.translate(translateX, translateY);
		if (rotation !== 0) {
			this.ctx.rotate(this.toRadians(rotation));
		}
		
		this.ctx.drawImage(imageElement, 0, 0, sWidth, sHeight, -dWidth / 2, -dHeight / 2, dWidth, dHeight);
		
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

	loadAudio(path) {
		return new Audio(path)
	}

	playAudio(audio, loop = false, onEndCallback = null) {
		audio.loop = loop;
		const playPromise = audio.play();

		if (playPromise !== undefined) {
			playPromise.catch((error) => {
				// La interacción del usuario puede ser necesaria para reproducir audio.
			});
		}

		if (onEndCallback && !loop) {
			audio.addEventListener('ended', onEndCallback, { once: true });
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

	playSoundEffect({ frequency = 440, duration = 0.1, volume = 0.5, type = 'sine', attack = 0.01, release = 0.1 }) {
		if (!this.audioCtx) {
			console.warn("[Js2d] El AudioContext no está listo. No se puede reproducir el sonido.");
			return;
		}

		const now = this.audioCtx.currentTime;
		const gainNode = this.audioCtx.createGain();
		gainNode.connect(this.audioCtx.destination);

		const finalVolume = volume * this.masterVolume;

		gainNode.gain.setValueAtTime(0, now);
		gainNode.gain.linearRampToValueAtTime(finalVolume, now + attack);
		
		const releaseStart = Math.max(now + attack, now + duration - release);
		gainNode.gain.setValueAtTime(finalVolume, releaseStart);
		gainNode.gain.linearRampToValueAtTime(0, releaseStart + release);

		const oscillator = this.audioCtx.createOscillator();
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(frequency, now);

		oscillator.connect(gainNode);
		oscillator.start(now);

		oscillator.stop(now + duration);
	}

	animations = {}

	setSpriteAnimation(name, position, speed, loop = true) {
		if (this.animations[name] == undefined || this.animations[name] == null) {
			this.animations[name] = {}
		}

		this.animations[name].position = position
		this.animations[name].speed = speed
		this.animations[name].loop = loop // Store loop setting
	}

	addFramesToAnimation(name, frames) {
		if (this.animations[name] == undefined || this.animations[name] == null) {
			this.animations[name] = {}
		}

		if (this.animations[name].frames == undefined || this.animations[name].frames == null) {
			this.animations[name].frames = []
		}

		for (const frame of frames) {
			this.animations[name].frames.push(frame)
		}
	}

	animate(name, dt) {
		this.animations[name].position.x += dt * this.animations[name].speed.x
		this.animations[name].position.y += dt * this.animations[name].speed.y
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

	drawSprite(image, frame = 0, pos, scale = 1, flipped = false, rotation = 0, pivot = Pivot.Center) {
		let spriteInfo = null;
		for (const key in this.sprites) {
			if (this.sprites[key].image === image) {
				spriteInfo = this.sprites[key];
				break;
			}
		}

		if (!image) return;
		const loaded = image._loaded || (image.complete && image.naturalWidth);
		if (!loaded) return;

		this.ctx.imageSmoothingEnabled = IMAGE_SMOOTHING;

		const iw = image._w || image.naturalWidth;
		const ih = image._h || image.naturalHeight;

		let sWidth, sHeight, dx, dy;

		if (spriteInfo && spriteInfo.frameWidth) {
			sWidth = spriteInfo.frameWidth;
			sHeight = spriteInfo.frameHeight || ih;
			const framesPerRow = Math.floor(iw / sWidth);
			const row = Math.floor(frame / framesPerRow);
			const col = frame % framesPerRow;
			dx = col * sWidth;
			dy = row * sHeight;
		} else {
			sWidth = iw;
			sHeight = ih;
			dx = 0;
			dy = 0;
		}
		
		const dWidth = sWidth * scale;
		const dHeight = sHeight * scale;
		
		this.ctx.save();
		
		// --- LÓGICA DE DIBUJADO EN PÍXELES EXACTOS ---
		
		// 1. Nos movemos a la posición REDONDEADA. Este es el anclaje para la rotación.
		this.ctx.translate(Math.round(pos.x), Math.round(pos.y));
		
		// 2. Aplicamos la rotación alrededor de ese punto.
		if (rotation !== 0) {
			this.ctx.rotate(this.toRadians(rotation));
		}
		
		// 3. Calculamos el desfase según el pivote.
		let drawOffsetX = 0;
		let drawOffsetY = 0;

		switch(pivot) {
			case Pivot.Top_Left:      break;
			case Pivot.Top_Center:    drawOffsetX = -dWidth / 2; break;
			case Pivot.Top_Right:     drawOffsetX = -dWidth; break;
			case Pivot.Center_Left:   drawOffsetY = -dHeight / 2; break;
			case Pivot.Center:        drawOffsetX = -dWidth / 2; drawOffsetY = -dHeight / 2; break;
			case Pivot.Center_Right:  drawOffsetX = -dWidth; drawOffsetY = -dHeight / 2; break;
			case Pivot.Bottom_Left:   drawOffsetY = -dHeight; break;
			case Pivot.Bottom_Center: drawOffsetX = -dWidth / 2; drawOffsetY = -dHeight; break;
			case Pivot.Bottom_Right:  drawOffsetX = -dWidth; drawOffsetY = -dHeight; break;
			default:                  drawOffsetX = -dWidth / 2; drawOffsetY = -dHeight / 2; break;
		}

		if (flipped) {
			this.ctx.scale(-1, 1);
			drawOffsetX = -drawOffsetX - dWidth;
		}

		// 4. Dibujamos la imagen en la posición desfasada.
		// Redondeamos también los offsets para máxima precisión.
		this.ctx.drawImage(image, dx, dy, sWidth, sHeight, 
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
			frameCounter: 0,
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
				this.animatedSprites[spriteName].frameCounter = 0
			}
		}
	}

	drawAnimatedSprite(name, pivot = Pivot.Center) {
		const sprite = this.animatedSprites[name]
		if (!sprite || !sprite.currentAnimation) return

		const animation = sprite.animations[sprite.currentAnimation]
		if (!animation) return

		const frameSpeed = animation.frameSpeed || sprite.frameSpeed

		if (sprite.frameCounter % frameSpeed === 0) {
			if (animation.loop) {
				sprite.currentFrame = (sprite.currentFrame + 1) % animation.frames.length
			} else {
				if (sprite.currentFrame < animation.frames.length - 1) {
					sprite.currentFrame++
				}
			}
		}
		sprite.frameCounter++

		// Dibujo
		const spriteData = this.sprites[sprite.spriteName]
		const frame = animation.frames[sprite.currentFrame]

		this.drawSprite(spriteData.image, frame, sprite.position, sprite.scale, sprite.flipped, 0, pivot)
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
	        while (c.charAt(0) == ' ') c = c.substring(1, c.length); // Quita espacios en blanco
	        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
	    }
	    return null;
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
		var v = {}

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
	checkCollisionCircleRect(circle, rect) {
		const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
		const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

		// Calcular la distancia entre el punto más cercano y el centro del círculo
		const dx = circle.x - closestX;
		const dy = circle.y - closestY;
		const distanceSquared = (dx * dx) + (dy * dy);

		return distanceSquared < (circle.radius * circle.radius);
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
		for (var i = 1; i < sides; i += 1) {
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

		for (var i = 0; i < len; i++) {
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

			var x = p2.x + v2.nx * lenOut
			var y = p2.y + v2.ny * lenOut

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

	componentToHex(c) {
		const hex = c.toString(16);
		return hex.length == 1 ? "0" + hex : hex;
	}

	rgbToHex(r, g, b) {
		return "#" + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
	}

	hexToRgb(hex) {
		// Expande el formato corto (ej. "03F") al formato completo (ej. "0033FF")
		const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
		hex = hex.replace(shorthandRegex, function(m, r, g, b) {
			return r + r + g + g + b + b;
		});

		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}

	rgbToHsl(r, g, b) {
		r /= 255; g /= 255; b /= 255;
		const max = Math.max(r, g, b), min = Math.min(r, g, b);
		let h, s, l = (max + min) / 2;

		if (max === min) {
			h = s = 0; // Acromático
		} else {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}
		return { h, s, l };
	}

	hslToRgb(h, s, l) {
		let r, g, b;
		if (s === 0) {
			r = g = b = l; // Acromático
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
		return {
			r: Math.round(r * 255),
			g: Math.round(g * 255),
			b: Math.round(b * 255)
		};
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
