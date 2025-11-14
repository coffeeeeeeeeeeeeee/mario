const DEFAULT_LIVES = 1;
const COIN_SPIN_VELOCITY = 15;

const Game_State = {
	Title_Menu: 0,
	Pause:      1,
	Playing:    2,
	Player_Dying: 3,
	Black_Screen: 4,
	Level_Complete: 5,
};

const Player = {
	Mario: 0,
	Luigi: 1
};

const PlayerName = [
	"Mario",
	"Luigi"
];

const Player_State = {
	Idle:    0,
	Running: 1,
	Jumping: 2,
	Falling: 3,
};

const Black_Screen_Type = {
	Start_Level: 0,
	Game_Over: 1,
	Time_Up: 2,
};

const BlockType = [
	'Block_Empty',					// 	0
	'Block_Ground',					// 	1
	'Block_Brick',					// 	2
	'Object_Question',				// 	3
	'Object_Question_Used',			// 	4
	'Block_Pipe_Top_Left',			// 	5
	'Block_Pipe_Top_Right',			// 	6
	'Block_Pipe_Body_Left',			// 	7
	'Block_Pipe_Body_Right',		// 	8
	'Object_Coin',					// 	9
	'Enemy_Goomba',					// 10
	'Enemy_Koopa',					// 11
	'Enemy_Pakkun',					// 12
	'Block_Flagpole',				// 13
	'Block_Cloud_Left',				// 14
	'Block_Cloud_Middle',			// 15
	'Block_Cloud_Right',			// 16
	'Block_Bush_Left',				// 17
	'Block_Bush_Middle',			// 18
	'Block_Bush_Right',				// 19
	'Block_Hill_Top',				// 20
	'Block_Hill_Left',				// 21
	'Block_Hill_Right',				// 22
	'Block_Hill_Dots',				// 23
	'Block_Stairs',					// 24
	'Block_Invisible',				// 25
	'Block_Flagpole_Top',			// 26
	'Block_Brick_Middle',			// 27
	'Block_Brick_Zigzag',			// 28
	'Block_Brick_Zigzag_Filled',	// 29
	'Block_Brick_Break',			// 30
	'Block_Brick_Cut',				// 31
	'Block_Brick_Arch',				// 32
	'Block_Black',					// 33
	'Object_Question_Multiple',		// 34
	'Block_Used',					// 35
	'Block_Life_Used',				// 36
	'Enemy_Koopa_Winged_Red',		// 37
	'Block_Ground_Underground',		// 38
	'Block_Brick_Underground',		// 39
	'Object_Coin_Underground',		// 40
];

class Game {
	engine = null;
	state = Game_State.Title_Menu;
	player = Player.Mario;
	currentMap = null;
	
	score = 0;
	time = 0;
	lives = DEFAULT_LIVES;
	coins = 0;
	highscore = 0;

	currentSelection = 0;
	mapOffset = {x: 0, y: 0};
	spriteSize = 16;
	spriteScale = 4;
	tileSize = this.spriteSize * this.spriteScale;
	velocityY = 0;
	jumpPower = -22;
	gravity = 0.8;
	textSize = 16;
	
	isOnGround = true;
	isSwimming = true;	

	levelCompleteState = 'none'; // 'sliding', 'dismounting', 'walking_to_castle', 'finished'
    flagpoleInfo = null;
    playerIsVisible = true;

	enemies = [];
	activeCoins = [];
	bumpingBlocks = [];
	activePowerups = [];
	scorePopups = [];

	skidTimer = 0;
	wasMovingTurbo = false;

	screenTimer = 0;
	screenDuration = 0
	screenType = Black_Screen_Type.Start_Level;

	BG_1 = "#5C94FC";

	velocityXGround = (this.spriteSize * 9.10 / 16) * 60;
	velocityXTurbo  = (this.spriteSize * 14.4 / 16) * 60;
	velocityXSwim   = (this.spriteSize * 17.6 / 16) * 60;

	constructor(engine, textSize) {
		this.engine = engine;
		this.textSize = textSize;
		this.specialBlocks = {};
		this.foregroundBlocks = [5, 6, 7, 8];
	}

	screenToTile(x, y) {
		const mapWidth = this.currentMap.dimensions.width;
		const mapHeight = this.currentMap.dimensions.height;
		const offsetY = mapHeight * this.tileSize - this.engine.canvas.height;
		const worldX = x - this.mapOffset.x;
		const worldY = y - this.mapOffset.y + offsetY;
		const tx = Math.floor(worldX / this.tileSize);
		const ty = Math.floor(worldY / this.tileSize);
		return { x: tx, y: ty };
	}

	tileToScreen(tx, ty) {
		const mapHeight = this.currentMap.dimensions.height;
		const offsetY = mapHeight * this.tileSize - this.engine.canvas.height;
		const x = tx * this.tileSize + this.mapOffset.x;
		const y = ty * this.tileSize + this.mapOffset.y - offsetY;
		return { x, y };
	}

	loadMap(name) {
		// Encuentra el mapa por el nombre del mundo en el array de mapas
		const mapData = map.find(m => m.world === name);

		if (mapData) {
			this.currentMap = JSON.parse(JSON.stringify(mapData)); // Copia profunda para evitar modificar el original
			console.info(`[SMB] Mapa cargado: ${name}`);

			this.enemies = [];
			const map_w = this.currentMap.dimensions.width;

			for (var i = 0; i < this.currentMap.map.length; i++) {
				const blockId = this.currentMap.map[i];
				let enemyType = null;

				switch (blockId) {
					case 10: enemyType = "Goomba"; break;
					case 11: enemyType = "Koopa"; break;
					case 12: enemyType = "Pakkun"; break;
					case 37: enemyType = "Koopa_Winged"; break;
				}

				if (enemyType) {
					let coords = this.engine.indexToCoords(i, map_w);
					let screenPos = this.tileToScreen(coords.x, coords.y);

					if (enemyType === "Pakkun") {
						this.enemies.push({
							type: 'Pakkun', x: (screenPos.x - this.mapOffset.x) + (this.tileSize / 2), y: screenPos.y + this.tileSize,
							initialY: screenPos.y + this.tileSize, maxHeight: this.tileSize * 1.5, state: 'hiding', timer: 120
						});
					} else {
						this.enemies.push({
							id: this.enemies.length,
							type: enemyType,
							color: 'Green',
							x: screenPos.x - this.mapOffset.x,
							y: screenPos.y,
							vx: -2,
							vy: 0,
							state: "walking",
							stompTimer: 0,
							isWinged: enemyType === "Koopa_Winged",
							canFly: enemyType === "Koopa_Winged",
							flyTimer: 0,
						});
					}
					this.currentMap.map[i] = 0;
				}
			}
		} else {
			console.error(`[SMB] No se pudo encontrar el mapa: ${name}`);
		}
	}

	saveGameState() {
		const player = this.engine.animatedSprites[PlayerName[this.player]];
		this.savedState = {
			playerPos: {x: player.position.x, y: player.position.y}, mapOffset: {x: this.mapOffset.x, y: this.mapOffset.y},
			player: this.player, velocityX: this.velocityX, velocityY: this.velocityY, time: this.time, score: this.score, lives: this.lives,
			coins: this.coins, isOnGround: this.isOnGround, currentAnimation: player.currentAnimation,
			mapState: JSON.parse(JSON.stringify(this.currentMap)), enemiesState: JSON.parse(JSON.stringify(this.enemies)),
			specialBlocksState: JSON.parse(JSON.stringify(this.specialBlocks))
		};
	}

	restoreGameState() {
		if (this.savedState) {
			this.currentMap = this.savedState.mapState;
			this.enemies = this.savedState.enemiesState;
			this.specialBlocks = this.savedState.specialBlocksState;
			this.player = this.savedState.player; this.time = this.savedState.time; this.score = this.savedState.score; this.lives = this.savedState.lives;
			this.coins = this.savedState.coins;
			const player = this.engine.animatedSprites[PlayerName[this.player]];
			player.position.x = this.savedState.playerPos.x; player.position.y = this.savedState.playerPos.y;
			this.mapOffset.x = this.savedState.mapOffset.x; this.mapOffset.y = this.savedState.mapOffset.y;
			this.velocityX = this.savedState.velocityX; this.velocityY = this.savedState.velocityY;
			this.isOnGround = this.savedState.isOnGround;
			this.engine.setAnimationForSprite(PlayerName[this.player], this.savedState.currentAnimation);
		}
	}

	continueGame() {
		this.restoreGameState();
		this.state = Game_State.Playing;
	}
	
	exitGame() {
		this.saveGameState();
		this.state = Game_State.Title_Menu;
	}

	selectPlayer(player) {
		this.player = player;
		this.lives = DEFAULT_LIVES;
		this.score = 0;
		this.coins = 0;
		this.savedState = null;
		this.resetLevelState();
		this.transitionToBlackScreen(Black_Screen_Type.Start_Level, 3000);
	}

	killPlayer() {
		if (this.state === Game_State.Playing) {
			this.state = Game_State.Player_Dying;
			this.velocityY = -18;
			if (this.score > this.highscore) { this.highscore = this.score; }
			this.engine.stopAudio(audio["Main_Theme"]);
			this.engine.playAudio(audio["Player_Die"], false);
		}
	}

	handleDeath() {
		this.lives--;
		if (this.lives > 0) {
			this.resetLevelState();
			this.transitionToBlackScreen(Black_Screen_Type.Start_Level, 3000);
		} else {
			this.engine.playAudio(audio["Game_Over_Theme"], false);
			this.transitionToBlackScreen(Black_Screen_Type.Game_Over, 5000);
		}
	}

	transitionToBlackScreen(type, duration) {
		this.state = Game_State.Black_Screen;
		this.screenType = type;
		this.screenTimer = 0;
		this.screenDuration = duration;
	}
	
	handleBlackScreenEnd() {
		if (this.screenType === Black_Screen_Type.Game_Over) {
			this.engine.stopAudio(audio["Game_Over_Theme"]);
			this.state = Game_State.Title_Menu;
		} else {
			this.state = Game_State.Playing;
		}
	}

	resetLevelState() {
		const playerSprite = this.engine.animatedSprites[PlayerName[this.player]];
		playerSprite.position = {x: 150, y: 0};
		this.mapOffset = {x: 0, y: 0};
		this.velocityY = 0;
		this.time = 400;
		this.specialBlocks = {};
		this.loadMap("1-1");
	}

	resetLevel() {
		const player = this.engine.animatedSprites[PlayerName[this.player]];
		player.position.x = 300; player.position.y = 300;
		this.mapOffset.x = 0; this.velocityY = 0; this.coins = 0; this.score = 0;
		this.specialBlocks = {};
		this.state = Game_State.Playing;
		this.loadMap(this.currentMap.world);
	}

	rectsOverlap(r1, r2) {
		return !(r1.x + r1.w < r2.x || r1.y + r1.h < r2.y || r1.x > r2.x + r2.w || r1.y > r2.y + r2.h);
	}

	updateEnemies(dt) {
		const player = this.engine.animatedSprites[PlayerName[this.player]];
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			const enemy = this.enemies[i];
			const enemyScreenX = enemy.x + this.mapOffset.x;

			if (enemy.type === 'Pakkun') {
				const playerRect = { x: player.position.x, y: player.position.y, w: this.tileSize, h: this.tileSize };
				const isPlayerNear = Math.abs(playerRect.x - enemyScreenX) < this.tileSize * 1.5;
				switch (enemy.state) {
					case 'hiding':
						enemy.timer++;
						if (enemy.timer > 120 && !isPlayerNear) { enemy.state = 'rising'; enemy.timer = 0; }
						break;
					case 'rising':
						enemy.y--;
						if (enemy.y <= enemy.initialY - enemy.maxHeight) { enemy.state = 'showing'; }
						break;
					case 'showing':
						enemy.timer++;
						if (enemy.timer > 90) { enemy.state = 'sinking'; enemy.timer = 0; }
						break;
					case 'sinking':
						enemy.y++;
						if (enemy.y >= enemy.initialY) { enemy.state = 'hiding'; }
						break;
				}
				if (enemy.state !== 'hiding') {
					const pakkunRect = { x: enemyScreenX, y: enemy.y, w: this.tileSize, h: this.tileSize * 2 };
					if (this.rectsOverlap(playerRect, pakkunRect)) { this.killPlayer(); }
				}
				continue;
			}

			if (enemy.type === 'Goomba' && enemy.state === 'stomped') {
				enemy.stompTimer++;
				if (enemy.stompTimer > 30) { this.enemies.splice(i, 1); continue; }
			}

			if (enemy.type.includes('Koopa')) {
				if (enemy.type.includes('Koopa')) {
					// Lógica para cuando el Koopa está en estado de caparazón
					if (enemy.state === 'shell') {
						// 1. Aplicar movimiento horizontal si se está deslizando
						if (enemy.vx !== 0) {
							enemy.x += enemy.vx;
							
							// 2. Colisión con PAREDES
							const wallCheckX = enemy.vx > 0 ? enemy.x + this.mapOffset.x + this.tileSize : enemy.x + this.mapOffset.x;
							const wallTile = this.screenToTile(wallCheckX, enemy.y);
							const wallIndex = this.engine.coordsToIndex(wallTile, this.currentMap.dimensions.width);

							if (this.currentMap.map[wallIndex] > 0 && this.currentMap.map[wallIndex] !== BlockType.Enemy_Pakkun) {
								enemy.vx *= -1; // Rebotar
								// Pequeño ajuste para evitar que se quede atascado en la pared
								enemy.x += enemy.vx > 0 ? 1 : -1;
							}

							// 3. NOVEDAD: Colisión con otros enemigos
							for (let j = this.enemies.length - 1; j >= 0; j--) {
								const otherEnemy = this.enemies[j];
								// Evitar que colisione consigo mismo
								if (otherEnemy.id === enemy.id) continue;

								const shellRect = { x: enemy.x + this.mapOffset.x, y: enemy.y, w: this.tileSize, h: this.tileSize };
								const otherRect = { x: otherEnemy.x + this.mapOffset.x, y: otherEnemy.y, w: this.tileSize, h: this.tileSize };

								if (this.rectsOverlap(shellRect, otherRect)) {
									this.score += 400; // Puntos por derrotar a un enemigo con un caparazón
									this.enemies.splice(j, 1); // Eliminar el otro enemigo
								}
							}
						}
					} else if (enemy.isWinged && enemy.canFly) {
						// Lógica de Koopa volador (sin cambios)
						enemy.flyTimer++;
						if (enemy.flyTimer > 60 && enemy.vy === 0) { enemy.vy = -10; enemy.flyTimer = 0; }
					}
				}

				// Lógica de GRAVEDAD y SUELO para TODOS los enemigos (incluyendo caparazones)
				enemy.vy += this.gravity;
				enemy.y += enemy.vy;

				const feetY = enemy.y + this.tileSize;
				const feetLeft = this.screenToTile(enemy.x + this.mapOffset.x + 4, feetY);
				const feetRight = this.screenToTile(enemy.x + this.mapOffset.x + this.tileSize - 4, feetY);
				const groundIndexLeft = this.engine.coordsToIndex(feetLeft, this.currentMap.dimensions.width);
				const groundIndexRight = this.engine.coordsToIndex(feetRight, this.currentMap.dimensions.width);
				const onGroundLeft = this.currentMap.map[groundIndexLeft] > 0 && this.currentMap.map[groundIndexLeft] !== BlockType.Enemy_Pakkun;
				const onGroundRight = this.currentMap.map[groundIndexRight] > 0 && this.currentMap.map[groundIndexRight] !== BlockType.Enemy_Pakkun;

				let isOnSolidGround = false;
				if (onGroundLeft || onGroundRight) {
					enemy.y = this.tileToScreen(feetLeft.x, feetLeft.y).y - this.tileSize;
					enemy.vy = 0;
					isOnSolidGround = true;
				}

				// Lógica de MOVIMIENTO y GIRO para enemigos que caminan (no caparazones)
				if (enemy.state === 'walking') {
					enemy.x += enemy.vx;
					
					// Girar si llega a una pared
					const wallCheckX = enemy.vx > 0 ? enemy.x + this.mapOffset.x + this.tileSize : enemy.x + this.mapOffset.x;
					const wallTile = this.screenToTile(wallCheckX, enemy.y);
					if (this.currentMap.map[this.engine.coordsToIndex(wallTile, this.currentMap.dimensions.width)] > 0) {
						enemy.vx *= -1;
					}
					
					// NOVEDAD: Los enemigos que caminan giran en los acantilados, los caparazones no
					if (isOnSolidGround) {
						if (enemy.vx < 0 && !onGroundLeft) { // Si va a la izquierda y no hay suelo a la izquierda
							enemy.vx *= -1;
						} else if (enemy.vx > 0 && !onGroundRight) { // Si va a la derecha y no hay suelo a la derecha
							enemy.vx *= -1;
						}
					}
				}
			}

			enemy.vy += this.gravity;
			const enemyRect = { x: enemy.x + this.mapOffset.x, y: enemy.y, w: this.tileSize, h: this.tileSize };
			const groundTile = this.screenToTile(enemyRect.x, enemyRect.y + this.tileSize);
			if (this.currentMap.map[this.engine.coordsToIndex(groundTile, this.currentMap.dimensions.width)] > 0) {
				enemy.vy = 0;
				enemy.y = this.tileToScreen(groundTile.x, groundTile.y).y - this.tileSize;
			}
			if (enemy.state === 'walking') enemy.x += enemy.vx;
			enemy.y += enemy.vy;
			const wallTile = this.screenToTile(enemy.vx > 0 ? enemyRect.x + this.tileSize : enemyRect.x, enemyRect.y);
			if (this.currentMap.map[this.engine.coordsToIndex(wallTile, this.currentMap.dimensions.width)] > 0 && enemy.state === 'walking') {
				enemy.vx *= -1;
			}

			const playerRect = { x: player.position.x, y: player.position.y, w: this.tileSize, h: this.tileSize };
			// const enemyRect = { x: enemyScreenX, y: enemy.y, w: this.tileSize, h: this.tileSize }; // Definimos enemyRect aquí para usarlo después

			if (this.rectsOverlap(playerRect, enemyRect)) {
			    const isStomping = this.velocityY > 0 && (player.position.y + this.tileSize) < (enemy.y + this.tileSize / 2);

			    if (isStomping) {
			        this.velocityY = -10; // Pequeño rebote al aplastar
			        this.engine.playAudio(audio["Player_Stomp"], false);

			        if (enemy.type === 'Goomba') {
			            enemy.state = 'stomped';
			            this.score += 100;
			        } else if (enemy.type.includes('Koopa')) { // Es un Koopa
			            if (enemy.isWinged) {
			                enemy.isWinged = false; // Le quita las alas
			                enemy.type = 'Koopa';
			            } else if (enemy.state === 'walking') {
			                enemy.state = 'shell'; // Lo convierte en caparazón
			                enemy.vx = 0;
			                this.score += 200;
			            } else if (enemy.state === 'shell') {
			                // Si ya es un caparazón, patearlo con el salto
			                const shellSpeed = 8;
			                enemy.vx = (player.position.x < enemyRect.x) ? shellSpeed : -shellSpeed;
			                this.score += 500;
			            }
			        }
			    } else { // Colisión lateral
			        // Si el jugador choca con un enemigo caminando O un caparazón YA EN MOVIMIENTO, muere.
			        if (enemy.state === 'walking' || (enemy.state === 'shell' && enemy.vx !== 0)) {
			            this.killPlayer();
			        } 
			        // NOVEDAD: Lógica para patear un caparazón detenido
			        else if (enemy.state === 'shell' && enemy.vx === 0) {
			            // Pone en movimiento el caparazón estacionario
			            const shellSpeed = 8; // Velocidad del caparazón
			            
			            // Determina la dirección del empuje basado en la posición del jugador
			            enemy.vx = (player.position.x < enemyRect.x) ? shellSpeed : -shellSpeed;
			        }
			    }
			}
			if (enemy.state === 'falling' && enemy.y > this.engine.canvas.height) {
				this.enemies.splice(i, 1);
			}
		}
	}

	drawEnemies() {
		for (const enemy of this.enemies) {
			const screenX = enemy.x + this.mapOffset.x;
			if (screenX < -this.tileSize || screenX > this.engine.canvas.width) continue;

			if (enemy.type === 'Pakkun') {
				const animSprite = this.engine.animatedSprites['Pakkun'];
				const spriteData = this.engine.sprites.Enemy_Pakkun;
				const biteAnim = animSprite.animations.Pakkun_Bite;
				if (animSprite.frameCounter % biteAnim.frameSpeed === 0) {
					animSprite.currentFrame = (animSprite.currentFrame + 1) % biteAnim.frames.length;
				}
				const frameToDraw = biteAnim.frames[animSprite.currentFrame];
				this.engine.drawSprite(spriteData.image, frameToDraw, { x: screenX, y: enemy.y }, spriteData.scale, false, 0, Pivot.Top_Left);
			} else { // Goomba y Koopa
				if (enemy.isWinged) {
					const wingedSprite = this.engine.animatedSprites['Koopa_Winged'];
					this.engine.setAnimationForSprite('Koopa_Winged', 'Koopa_Winged_Walk');
					wingedSprite.position = { x: screenX, y: enemy.y - this.tileSize / 2 };
					wingedSprite.flipped = enemy.vx > 0;
					this.engine.drawAnimatedSprite('Koopa_Winged', Pivot.Top_Left);
				}
				else if (enemy.type === 'Koopa' && (enemy.state === 'shell' || enemy.state === 'falling')) {
					const shellSpriteName = `Koopa_Shell_${enemy.color}`;
					const shellSprite = this.engine.animatedSprites[shellSpriteName];
					
					// Elige la animación basada en la velocidad
					if (enemy.vx === 0) {
						this.engine.setAnimationForSprite(shellSpriteName, 'Shell_Idle', false);
					} else {
						this.engine.setAnimationForSprite(shellSpriteName, 'Shell_Sliding');
					}
					shellSprite.position = { x: screenX, y: enemy.y };
					this.engine.drawAnimatedSprite(shellSpriteName, Pivot.Top_Left);
				} else {
					// Dibuja Goomba o Koopa caminando
					const animSprite = this.engine.animatedSprites[enemy.type];

					// Lógica de animación corregida
					if (enemy.state === 'stomped') {
						this.engine.setAnimationForSprite(enemy.type, 'Goomba_Stomped');
					} else {
						this.engine.setAnimationForSprite(enemy.type, `${enemy.type}_Walk`);
					}

					animSprite.position = { x: screenX, y: enemy.y };
					if (enemy.type === 'Koopa') {
						animSprite.position.y -= this.tileSize / 2;
					}
					animSprite.flipped = enemy.vx > 0;
					this.engine.drawAnimatedSprite(enemy.type, Pivot.Top_Left);
				}
			}
		}
		this.engine.animatedSprites["Goomba"].frameCounter++;
		this.engine.animatedSprites["Koopa"].frameCounter++;
		this.engine.animatedSprites["Koopa_Winged"].frameCounter++;
		this.engine.animatedSprites["Pakkun"].frameCounter++;
	}

	drawBlackScreen(){
		this.engine.drawRectangle(this.engine.getCanvasRectangle(), Color.BLACK);
		this.drawUI();
		const centerX = this.engine.getCanvasWidth() / 2;
		const centerY = this.engine.getCanvasHeight() / 2;

		switch (this.screenType) {
			case Black_Screen_Type.Start_Level:
				const worldPos = { x: centerX, y: centerY - this.tileSize * 2 };
				this.engine.drawTextCustom(font, `WORLD ${this.currentMap.world}`, this.textSize, Color.WHITE, worldPos, "center");
				
				const livesPos = { x: centerX + this.tileSize, y: centerY };
				this.engine.drawTextCustom(font, `${String.fromCharCode('0x00D7')} ${this.lives}`, this.textSize, Color.WHITE, livesPos, "center");
				
				const playerImagePos = { x: centerX - this.tileSize * 2, y: centerY - this.tileSize / 2 };
				const spriteName = "Player_" + PlayerName[this.player];
				const playerSprite = this.engine.sprites[spriteName];
				if(playerSprite && playerSprite.image) {
					this.engine.drawSprite(playerSprite.image, 0, playerImagePos, this.spriteScale, this.player.flipped, 0, Pivot.Top_Left);
				}
				break;

			case Black_Screen_Type.Game_Over:

				const gameOverPlayerPos = { x: centerX, y: centerY - this.tileSize };
				this.engine.drawTextCustom(font, PlayerName[this.player], this.textSize, Color.WHITE, gameOverPlayerPos, "center");
				const gameOverPos = { x: centerX, y: centerY };
				this.engine.drawTextCustom(font, "GAME OVER", this.textSize, Color.WHITE, gameOverPos, "center");
				break;
				
			case Black_Screen_Type.Time_Up:
				const timeUpPos = { x: centerX, y: centerY };
				this.engine.drawTextCustom(font, "TIME UP", this.textSize, Color.WHITE, timeUpPos, "center");
				break;
		}
	}

	drawMenu() {
		this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.BG_1);

		// Dibuja el mapa cargado (0-0) como fondo
		this.drawBackground();
		this.drawBlocks();
		this.drawForegroundBlocks();

		this.drawUI();

		const titleMaxY = 0.65;

		const titleSprite = this.engine.sprites["UI_Title_Image"];
		const titleImg = titleSprite.image

		const titlePosX = this.engine.canvas.width / 2;
		const titlePosY = this.tileSize;
		const titleScale = this.spriteScale * this.engine.getCanvasHeight() / titleMaxY / 1000
		const titleWidth = titleImg.width * titleScale;

		const imgPos = { x: titlePosX - titleWidth / 2, y: titlePosY };
		this.engine.drawSprite(titleImg, 0, imgPos, titleScale, false, 0, Pivot.Top_Left);

		const menuButtons = [
			{ name: "MARIO GAME", action: () => { this.selectPlayer(Player.Mario); }},
			{ name: "LUIGI GAME", action: () => { this.selectPlayer(Player.Luigi); }},
		];
		if(this.savedState != null){
			menuButtons.push({ name: "CONTINUE", action: () => { this.continueGame() } });
		}

		const numButtons = menuButtons.length;
		const menuGap = this.engine.canvas.height * 0.2 / numButtons;
		if(this.engine.keysPressed['ArrowUp'] || this.engine.keysPressed['KeyW']){ this.engine.keysPressed = []; this.currentSelection--; }
		if(this.engine.keysPressed['ArrowDown'] || this.engine.keysPressed['KeyS']){ this.engine.keysPressed = []; this.currentSelection++; }
		
		if(this.engine.keysPressed['Enter'] || this.engine.keysPressed['Space']){
			if (menuButtons[this.currentSelection].action) {
				menuButtons[this.currentSelection].action();
			}
			delete this.engine.keysPressed['Enter'];
			delete this.engine.keysPressed['Space'];
		}

		this.currentSelection = ((this.currentSelection % numButtons) + numButtons) % numButtons;
		for(let i = 0; i < numButtons; i++){
			const menuPosY = this.engine.canvas.height * titleMaxY + menuGap * i + menuGap / 2 + this.textSize;
			const textPos = { x: this.engine.getCanvasWidth() / 2, y: menuPosY };
			if(this.currentSelection == i){
				const cursorPos = { x: this.engine.getCanvasWidth() / 2 - this.tileSize * 3, y: menuPosY - this.spriteSize * 1.1 };
				const cursorSprite = this.engine.sprites["Cursor"];
				if(cursorSprite && cursorSprite.image) {
					this.engine.drawSprite(cursorSprite.image, 0, cursorPos, cursorSprite.scale, false, 0, Pivot.Top_Left);
				}
			}
			this.engine.drawTextCustom(font, menuButtons[i].name, this.textSize, "#ffffff", textPos, "center");
		}

		const topScore = "TOP - " + this.highscore.toString().padStart(6, "0");
		const topScorePos = {
			x: this.engine.getCanvasWidth() / 2,
			y: this.engine.canvas.height * 0.65 + menuGap * numButtons + menuGap / 2 + this.textSize
		};
		this.engine.drawTextCustom(font, topScore, this.textSize, "#ffffff", topScorePos, "center");
	}

	drawBackground() {
		this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.BG_1);
		
		const parallaxSpeed = 0.5;
		const offsetX = this.mapOffset.x * parallaxSpeed;
		const numObjects = Math.ceil(this.currentMap.dimensions.width * 0.3);

		// Dibujar Nubes
		const cloudY = 80;
		for (let i = 0; i < numObjects; i++) {
			const cloudSizeX = 2 + (i % 2);
			const cloudOffsetY = cloudY + (i % 3) * 40;
			const cloudX = (i * 500) + offsetX;
			
			if (cloudX + cloudSizeX * this.tileSize >= 0 && cloudX <= this.engine.canvas.width) {
				this.drawCompositeObject({x: cloudX, y: cloudOffsetY}, {x: cloudSizeX, y: 2}, this.tileSize, 'Block_Cloud');
			}
		}
		
		// Dibujar Arbustos
		const groundY = this.engine.canvas.height - this.tileSize * 2;
		for (let i = 0; i < numObjects; i++) {
			const bushSizeX = 2 + (i % 3);
			const bushOffsetY = groundY + this.tileSize / 2;
			// Movemos los arbustos un poco más rápido para dar profundidad
			const bushX = (i * 350) + offsetX * 1.2;

			if (bushX + bushSizeX * this.tileSize >= 0 && bushX <= this.engine.canvas.width) {
				this.drawCompositeObject({x: bushX, y: bushOffsetY}, {x: bushSizeX, y: 1}, this.tileSize, 'Block_Bush');
			}
		}
	}

	drawCompositeObject(objPos, objSize, tileSize, baseName) {
		// Solo las nubes tienen sprites inferiores distintos
		const hasBottomSprites = (baseName === 'Block_Cloud');

		for (let y = 0; y < objSize.y; y++) {
			for (let x = 0; x < objSize.x; x++) {
				let spriteName;
				let part = '';

				if (hasBottomSprites && y > 0) {
					part = '_Bottom';
				}

				if (x === 0) {
					part += '_Left';
				} else if (x === objSize.x - 1) {
					part += '_Right';
				} else if (y === 0) {
					part = '_Middle'; // Para la parte superior central de las nubes
				}

				// Caso especial para el centro de las partes inferiores de la nube
				if (hasBottomSprites && y > 0 && x > 0 && x < objSize.x - 1) {
					part = '_Bottom';
				}

				spriteName = `${baseName}${part}`;
				
				const sprite = this.engine.sprites[spriteName];
				if (sprite && sprite.image) {
					const drawPos = { x: objPos.x + tileSize * x, y: objPos.y + tileSize * y };
					this.engine.drawSprite(sprite.image, 0, drawPos, this.spriteScale);
				}
			}
		}
	}

	drawBlocks(){
		if (!this.currentMap) return;

		const mapWidth = this.currentMap.dimensions.width;
		for (let i = 0; i < this.currentMap.map.length; i++) {
			const blockId = this.currentMap.map[i];
			
			if (blockId === 0 || this.foregroundBlocks.includes(blockId)) continue;
			
			const coords = this.engine.indexToCoords(i, mapWidth);
			const blockPos = this.tileToScreen(Math.floor(coords.x), Math.floor(coords.y));
			
			let spriteName = BlockType[blockId];
			if (blockId === 34) {
				spriteName = this.specialBlocks[i]?.revealed ? 'Object_Question' : 'Block_Brick';
			}

			const sprite = this.engine.sprites[spriteName];
			if (sprite && sprite.image) {
				this.engine.drawSprite(sprite.image, 0, blockPos, sprite.scale, false, 0, Pivot.Top_Left);
			}
		}
	}

	drawForegroundBlocks() {
		if (!this.currentMap) return;
		const mapWidth = this.currentMap.dimensions.width;
		for (let i = 0; i < this.currentMap.map.length; i++) {
			const blockId = this.currentMap.map[i];
			if (!this.foregroundBlocks.includes(blockId)) continue;
			const coords = this.engine.indexToCoords(i, mapWidth);
			const blockPos = this.tileToScreen(coords.x, coords.y);
			const sprite = this.engine.sprites[BlockType[blockId]];
			if (sprite && sprite.image) {
				this.engine.drawSprite(sprite.image, 0, blockPos, sprite.scale, false, 0, Pivot.Top_Left);
			}
		}
	}
	
	spawnCoin(x, y) {
		const coin = {
			x: x + (this.tileSize / 4),
			y: y,
			vY: -10,
			timer: 0,
			active: true,
			rotation: 0
		};
		this.activeCoins.push(coin);
	}

	updateAndDrawCoins() {
		for (let i = this.activeCoins.length - 1; i >= 0; i--) {
			const coin = this.activeCoins[i];

			coin.y += coin.vY;
			coin.vY += 0.8;
			coin.timer++;

			coin.rotation = (coin.rotation + COIN_SPIN_VELOCITY) % 360;

			const coinSprite = this.engine.animatedSprites["Coin"];
			const coinData = this.engine.sprites["Object_Coin"];
			
			this.engine.drawSprite(
				coinData.image, 
				coinSprite.currentFrame, 
				{x: coin.x, y: coin.y}, 
				coinSprite.scale, 
				false,
				coin.rotation,
				Pivot.Center
			);

			if (coin.timer > 30) {
				this.activeCoins.splice(i, 1);
			}
		}

		const coinAnim = this.engine.animatedSprites["Coin"].animations["Coin_Shine"];
		this.engine.animatedSprites["Coin"].frameCounter++;
		if (this.engine.animatedSprites["Coin"].frameCounter % coinAnim.frameSpeed === 0) {
			this.engine.animatedSprites["Coin"].currentFrame = (this.engine.animatedSprites["Coin"].currentFrame + 1) % coinAnim.frames.length;
		}
	}

	drawBumpingBlocksOverlay() {
		for (let i = this.bumpingBlocks.length - 1; i >= 0; i--) {
			const block = this.bumpingBlocks[i];
			block.y += block.vY;
			block.vY += this.gravity * 1.5;
			if (block.y >= block.originalY) {
				let finalId = block.originalId;
				if (block.originalId === 3) finalId = 4;
				if (block.originalId === 34) {
					finalId = (this.specialBlocks[block.mapIndex]?.coinsLeft === 0) ? 4 : 34;
				}
				this.currentMap.map[block.mapIndex] = finalId;
				this.bumpingBlocks.splice(i, 1);
				continue;
			}
			let spriteNameToDraw = BlockType[block.originalId];
			if (block.originalId === 34) {
				if (this.specialBlocks[block.mapIndex]?.coinsLeft === 0) {
					spriteNameToDraw = 'Object_Question_Used';
				} else {
					spriteNameToDraw = 'Object_Question';
				}
			}
			const spriteData = this.engine.sprites[spriteNameToDraw];
			if (spriteData) {
				this.engine.drawSprite(spriteData.image, 0, { x: block.x, y: block.y }, spriteData.scale, false, 0, Pivot.Top_Left);
			}
		}
	}

	drawPlayer(name, dt){
		const player = this.engine.animatedSprites[name];
		const playerPos = player.position;
		const dt_sec = dt / 1000;

		if (this.state === Game_State.Player_Dying) {
			this.engine.setAnimationForSprite(name, `${PlayerName[this.player]}_Fail`);
			this.velocityY += this.gravity * 60 * dt_sec;
			playerPos.y += this.velocityY * 60 * dt_sec;
			
			if (playerPos.y > this.engine.canvas.height + this.tileSize) { 
				this.handleDeath(); 
			}
			this.engine.drawAnimatedSprite(name, Pivot.Top_Left);
			return;
		}

		const mapWidth = this.currentMap.dimensions.width;
		const inBounds = (x, y) => x >= 0 && x < mapWidth;
		const isSolid = (blockId) => blockId > 0 && blockId !== 25 && blockId !== 12 && blockId !== 26;
		if (this.skidTimer > 0) this.skidTimer--;
		
		this.velocityY += this.gravity;
		const newY = playerPos.y + this.velocityY;

		if (this.velocityY < 0) {
			const headCenterTile = this.screenToTile(playerPos.x + this.tileSize / 2, newY);
			let hitCeiling = false;
			if (inBounds(headCenterTile.x, headCenterTile.y)) {
				const idx = this.engine.coordsToIndex({x: headCenterTile.x, y: headCenterTile.y}, mapWidth);
				const blockId = this.currentMap.map[idx] || 0;
				if (blockId === 25) {
					this.currentMap.map[idx] = 4;
					const { x: blockX, y: blockY } = this.tileToScreen(headCenterTile.x, headCenterTile.y);
					this.spawnPowerup(blockX, blockY, '1UP');
				}
				if (blockId === 3) {
					this.currentMap.map[idx] = 4; this.coins++; this.engine.playAudio(audio["Coin"], false);
					const { x: coinX, y: coinY } = this.tileToScreen(idx % mapWidth, Math.floor(idx / mapWidth));
					this.spawnCoin(coinX, coinY - this.tileSize);
				}
				if (blockId === 34) {
					if (!this.specialBlocks[idx]) {
						this.specialBlocks[idx] = { coinsLeft: 10, revealed: true }; this.engine.playAudio(audio["Player_Bump"], false);
					} else if (this.specialBlocks[idx].coinsLeft > 0) {
						this.specialBlocks[idx].coinsLeft--; this.coins++; this.engine.playAudio(audio["Coin"], false);
						const { x: coinX, y: coinY } = this.tileToScreen(headCenterTile.x, headCenterTile.y);
						this.spawnCoin(coinX, coinY - this.tileSize);
						if (this.specialBlocks[idx].coinsLeft === 0) { this.currentMap.map[idx] = 4; }
					}
				}
				if (blockId === 2 || blockId === 3 || blockId === 25 || (blockId === 34 && this.specialBlocks[idx]?.coinsLeft > 0)) {
					const isAlreadyBumping = this.bumpingBlocks.some(b => b.mapIndex === idx);
					const isDepleted = blockId === 34 && this.specialBlocks[idx]?.coinsLeft === 0;
					if (!isAlreadyBumping && !isDepleted) {
						const screenPos = this.tileToScreen(headCenterTile.x, headCenterTile.y);
						this.bumpingBlocks.push({ x: screenPos.x, y: screenPos.y, originalY: screenPos.y, vY: -6, mapIndex: idx, originalId: blockId });
						this.currentMap.map[idx] = 0;
					}
				}
				if (isSolid(blockId)) {
					this.velocityY = 0;
					playerPos.y = this.tileToScreen(headCenterTile.x, headCenterTile.y + 1).y;
					hitCeiling = true;
					this.engine.playAudio(audio["Player_Bump"]);
				}
			}
			if (!hitCeiling) { playerPos.y = newY; }
		} else {
			const bottomLeft = this.screenToTile(playerPos.x + 4, newY + this.tileSize);
			const bottomRight = this.screenToTile(playerPos.x + this.tileSize - 4, newY + this.tileSize);
			let foundGround = false;
			for (let tx = bottomLeft.x; tx <= bottomRight.x; tx++) {
				if (inBounds(tx, bottomLeft.y)) {
					const idx = this.engine.coordsToIndex({x: tx, y: bottomLeft.y}, mapWidth);
					const blockId = this.currentMap.map[idx] || 0;
					if (isSolid(blockId)) {
						playerPos.y = this.tileToScreen(tx, bottomLeft.y).y - this.tileSize;
						this.isOnGround = true; this.velocityY = 0; foundGround = true; break;
					}
				}
			}
			if (!foundGround) { this.isOnGround = false; playerPos.y = newY; }
		}

		const isTurbo = this.engine.keysPressed['ShiftLeft'] || this.engine.keysPressed['ShiftRight'];
		const isTryingToMoveLeft = this.engine.keysPressed['ArrowLeft'] || this.engine.keysPressed['KeyA'];
		const isTryingToMoveRight = this.engine.keysPressed['ArrowRight'] || this.engine.keysPressed['KeyD'];
		const isMoving = isTryingToMoveLeft || isTryingToMoveRight;
		const stoppedRunningTurbo = !isMoving && this.wasMovingTurbo;
		const changedDirection = (isTryingToMoveLeft && !player.flipped) || (isTryingToMoveRight && player.flipped);
		
		if (this.isOnGround && this.skidTimer <= 0 && (stoppedRunningTurbo || changedDirection)) {
			this.engine.playAudio(audio["Player_Skid"], false);
			this.skidTimer = 10;
		}
		
		const animationName = PlayerName[this.player];
		if (this.velocityY < 0 && !this.isOnGround) { this.engine.setAnimationForSprite(name, `${animationName}_Jump`); }
		else if (this.velocityY > this.gravity && !this.isOnGround) { this.engine.setAnimationForSprite(name, `${animationName}_Fall`); }
		else if (this.skidTimer > 0 && this.isOnGround) { this.engine.setAnimationForSprite(name, `${animationName}_Stop`); }
		else if (isMoving && this.isOnGround) { this.engine.setAnimationForSprite(name, `${animationName}_Run`); }
		else if (!isMoving && this.isOnGround) { this.engine.setAnimationForSprite(name, `${animationName}_Idle`); }

		if (this.engine.keysPressed['Escape']) { this.exitGame(); this.engine.stopAudio(audio["Main_Theme"]); this.engine.playAudio(audio["Pause"], false); return; }

		const velocityX = (isTurbo ? this.velocityXTurbo : this.velocityXGround) * dt_sec;

		if (isTryingToMoveLeft) {
			player.flipped = true;
			const newX = playerPos.x - velocityX;
			const leftTop = this.screenToTile(newX + 4, playerPos.y);
			const leftBottom = this.screenToTile(newX + 4, playerPos.y + this.tileSize - 1);
			let blocked = false;
			for (let ty = leftTop.y; ty <= leftBottom.y; ty++) {
				if (inBounds(leftTop.x, ty) && isSolid(this.currentMap.map[this.engine.coordsToIndex({x: leftTop.x, y: ty}, mapWidth)])) {
					playerPos.x = this.tileToScreen(leftTop.x + 1, ty).x; blocked = true; break;
				}
			}
			if (!blocked) playerPos.x = newX;
		} else if (isTryingToMoveRight) {
			player.flipped = false;
			const newX = playerPos.x + velocityX;
			const rightTop = this.screenToTile(newX + this.tileSize - 4, playerPos.y);
			const rightBottom = this.screenToTile(newX + this.tileSize - 4, playerPos.y + this.tileSize - 1);

			const poleTileIdx = this.engine.coordsToIndex({x: rightTop.x, y: rightTop.y}, mapWidth);
			const poleBlockId = this.currentMap.map[poleTileIdx];

			if (poleBlockId === 13 && this.state === Game_State.Playing) { // 13 es Block_Flagpole
				const poleScreenX = this.tileToScreen(rightTop.x, rightTop.y).x + (this.tileSize / 2);
				
				// Si el jugador ha cruzado la mitad del tile del mástil
				// if (playerPos.x + this.tileSize >= poleScreenX) {
					const poleTopScreenY = this.tileToScreen(rightTop.x, 2).y; // Coordenada Y del bloque superior del mástil (ID 26)
					const playerGrabOffset = playerPos.y - poleTopScreenY;
					let points = 0;

					if (playerGrabOffset < this.tileSize) { // Tocar la punta (dentro del primer tile)
						points = 5000;
					} else if (playerGrabOffset < this.tileSize * 2.5) { // Un poco más abajo
						points = 2000;
					} else if (playerGrabOffset < this.tileSize * 5) { // Mitad superior
						points = 800;
					} else if (playerGrabOffset < this.tileSize * 8) { // Mitad inferior
						points = 400;
					} else { // Parte más baja
						points = 100;
					}

					this.score += points;
					this.spawnScorePopup(points.toString(), playerPos.x + this.tileSize, playerPos.y);

					this.state = Game_State.Level_Complete;
					this.levelCompleteState = 'sliding';
					
					playerPos.x = this.tileToScreen(rightTop.x, rightTop.y).x; // Ajusta a Mario al mástil
					this.velocityY = 0;

					this.engine.stopAudio(audio["Main_Theme"]);
					this.engine.playAudio(audio["Flagpole"], false);
					this.engine.setAnimationForSprite(name, `${PlayerName[this.player]}_Slide`);

					// Guarda la posición del suelo para saber dónde parar de deslizar
					const groundY = this.tileToScreen(rightTop.x, 13).y;
					this.flagpoleInfo = { groundY: groundY, castleDoorX: playerPos.x + this.tileSize * 4 };
					return; // Detiene el procesamiento normal del jugador
				// }
			}

			let blocked = false;
			for (let ty = rightTop.y; ty <= rightBottom.y; ty++) {
				if (inBounds(rightTop.x, ty) && isSolid(this.currentMap.map[this.engine.coordsToIndex({x: rightTop.x, y: ty}, mapWidth)])) {
					playerPos.x = this.tileToScreen(rightTop.x, ty).x - this.tileSize; blocked = true; break;
				}
			}
			if (!blocked) {
				if (playerPos.x < (this.engine.canvas.width / 2)) playerPos.x = newX;
				else this.mapOffset.x -= velocityX;
			}
		}
		
		if ((this.engine.keysPressed['ArrowUp'] || this.engine.keysPressed['KeyW'] || this.engine.keysPressed['Space']) && this.isOnGround) {
			this.velocityY = this.jumpPower; this.isOnGround = false;
			this.engine.setVolume(audio["Player_Jump"], 0.2);
			this.engine.playAudio(isTurbo ? audio["Player_Jump_Turbo"] : audio["Player_Jump"], false);
		}
		
		this.wasMovingTurbo = isMoving && isTurbo && this.isOnGround;
		if (playerPos.y > this.engine.canvas.height && this.state === Game_State.Playing) { this.killPlayer(); }

		this.engine.drawAnimatedSprite(name, Pivot.Top_Left);
	}

	spawnScorePopup(text, x, y) {
		this.scorePopups.push({ text: text, x: x, y: y, timer: 90 }); // El popup dura 1.5 segundos (90 frames)
	}

	updateAndDrawScorePopups() {
		for (let i = this.scorePopups.length - 1; i >= 0; i--) {
			const popup = this.scorePopups[i];
			popup.y -= 0.5; // El texto flota hacia arriba
			popup.timer--;

			this.engine.drawTextCustom(font, popup.text, this.textSize, Color.WHITE, {x: popup.x, y: popup.y}, "center");

			if (popup.timer <= 0) {
				this.scorePopups.splice(i, 1); // Elimina el popup cuando el tiempo se acaba
			}
		}
	}

	updateAndDrawLevelComplete(dt) {
		const player = this.engine.animatedSprites[PlayerName[this.player]];
		const playerPos = player.position;

		switch(this.levelCompleteState) {
			case 'sliding':
				playerPos.y += 5; // Velocidad de deslizamiento
				if (playerPos.y >= this.flagpoleInfo.groundY) {
					playerPos.y = this.flagpoleInfo.groundY;
					this.levelCompleteState = 'dismounting'; // Cambia al estado intermedio
				}
				break;

			case 'dismounting':
				// Este estado se ejecuta una sola vez para preparar la caminata
				playerPos.x += this.tileSize / 2; // Saca a Mario del mástil
				player.flipped = false; // Asegúrate de que mira hacia el castillo
				this.engine.setAnimationForSprite(PlayerName[this.player], `${PlayerName[this.player]}_Run`);
				this.engine.playAudio(audio["Level_Clear"], false);
				this.levelCompleteState = 'walking_to_castle'; // Pasa inmediatamente a caminar
				break;

			case 'walking_to_castle':
				playerPos.x += 2; // Velocidad de caminata hacia el castillo
				if (playerPos.x >= this.flagpoleInfo.castleDoorX) {
					this.playerIsVisible = false; // Mario "entra" al castillo
					this.levelCompleteState = 'finished';
				}
				break;
		}

		if (this.playerIsVisible) {
			this.engine.drawAnimatedSprite(PlayerName[this.player], Pivot.Top_Left);
		}
	}

	spawnPowerup(x, y, type) {
		this.activePowerups.push({ x: x, y: y, vx: 2.5, vy: 0, type: type, state: "emerging", emergeCounter: this.tileSize });
		this.engine.playAudio(audio["Powerup_Appears"], false);
	}

	updateAndDrawPowerups() {
		const player = this.engine.animatedSprites[PlayerName[this.player]];
		for (let i = this.activePowerups.length - 1; i >= 0; i--) {
			const p = this.activePowerups[i];
			if (p.state === "emerging") {
				p.y -= 1; p.emergeCounter--;
				if (p.emergeCounter <= 0) { p.state = "moving"; }
			} else {
				p.vy += this.gravity; p.x += p.vx; p.y += p.vy;
				const groundTile = this.screenToTile(p.x, p.y + this.tileSize);
				const groundIndex = this.engine.coordsToIndex(groundTile, this.currentMap.dimensions.width);
				if (this.currentMap.map[groundIndex] > 0) {
					p.vy = 0; p.y = this.tileToScreen(groundTile.x, groundTile.y).y - this.tileSize;
				}
				const wallCheckX = p.vx > 0 ? p.x + this.tileSize : p.x;
				const wallTile = this.screenToTile(wallCheckX, p.y);
				if (this.currentMap.map[this.engine.coordsToIndex(wallTile, this.currentMap.dimensions.width)] > 0) { p.vx *= -1; }
			}
			const powerupRect = { x: p.x, y: p.y, w: this.tileSize, h: this.tileSize };
			const playerRect = { x: player.position.x, y: player.position.y, w: this.tileSize, h: this.tileSize };
			if (this.rectsOverlap(playerRect, powerupRect)) {
				console.log("VIDA EXTRA!");
				this.engine.playAudio(audio["Life"], false);
				this.activePowerups.splice(i, 1);
				continue;
			}
			const spriteData = this.engine.sprites['Object_Mushroom_1UP'];
			this.engine.drawSprite(spriteData.image, 0, { x: p.x, y: p.y }, spriteData.scale, false, 0, Pivot.Top_Left);
		}
	}

	drawUI(){
		const cols = 4;
		const paddingX = this.textSize * 4;
		const paddingY = this.textSize;
		const colWidth = (this.engine.getCanvasWidth() - paddingX * 2) / cols;
		this.engine.drawTextCustom(font, PlayerName[this.player], this.textSize, "#ffffff", {x: paddingX, y: paddingY * 2}, "left");
		this.engine.drawTextCustom(font, this.score.toString().padStart(6, "0"), this.textSize, "#ffffff", {x: paddingX, y: paddingY * 3}, "left");
		const coinSprite = this.engine.sprites["UI_Coin"];
		if (coinSprite && coinSprite.image) {
			const coinPos = { x: colWidth + paddingX + paddingX * 0.15, y: paddingY * 3 - this.textSize + paddingY * 0.15 };
			this.engine.drawSprite(coinSprite.image, 0, coinPos, this.spriteScale / 1.8, false, 0, Pivot.Top_Left);
		}
		const coinText = String.fromCharCode('0x00D7') + this.coins.toString().padStart(2, "0");
		this.engine.drawTextCustom(font, coinText, this.textSize, "#ffffff", {x: colWidth + paddingX + 32, y: paddingY * 3}, "left");
		this.engine.drawTextCustom(font, "WORLD", this.textSize, "#ffffff", {x: colWidth * 2 + paddingX + colWidth / 2, y: paddingY * 2}, "center");
		this.engine.drawTextCustom(font, ' ' + this.currentMap.world, this.textSize, "#ffffff", {x: colWidth * 2 + paddingX + colWidth / 2 - this.textSize / 2, y: paddingY * 3}, "center");
		this.engine.drawTextCustom(font, "TIME", this.textSize, "#ffffff", {x: this.engine.getCanvasWidth() - paddingX, y: paddingY * 2}, "right");
		this.engine.drawTextCustom(font, Math.floor(this.time).toString().padStart(3, "0"), this.textSize, "#ffffff", {x: this.engine.getCanvasWidth() - paddingX, y: paddingY * 3}, "right");
	}
}