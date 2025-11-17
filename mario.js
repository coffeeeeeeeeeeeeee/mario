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

const Player_Size = {
	Small: 0,
	Big: 1,
	Fire: 2
};

const Powerup_Type = {
	Mushroom_Super: 'Mushroom_Super',
	Mushroom_1UP: '1UP',
	Fire_Flower: 'Fire_Flower',
	Invincible: 'Star'
};

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
	'Enemy_Pakkun_Green',			// 12
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
	'Object_Coinbox_Multiple',		// 34
	'Block_Used',					// 35
	'Block_Life_Used',				// 36
	'Enemy_Koopa_Winged_Red',		// 37
	'Enemy_Koopa_Winged_Green',		// 38
	'Enemy_Koopa_Red',				// 39
	'Enemy_Pakkun_Red',				// 40
	'Object_Question',				// 41
];

class Game {
	engine = null;
	state = Game_State.Title_Menu;
	player = Player.Mario;
	currentMap = null;
	volume = 1;
	
	score = 0;
	time = 0;
	lives = DEFAULT_LIVES;
	coins = 0;
	highscore = 0;

	playerSize = Player_Size.Small;
	isInvincible = false;
	invincibleTimer = 0;

	currentSelection = 0;
	currentWorldIndex = 0;
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
	wasMovingTurbo = false;

	levelCompleteState = 'none';
	flagpoleFlag = null;
	flagpoleInfo = null;
	playerIsVisible = true;

	availableWorlds = [];
	enemies = [];
	activeCoins = [];
	bumpingBlocks = [];
	activePowerups = [];
	scorePopups = [];
	brickParticles = [];

	skidTimer = 0;

	screenTimer = 0;
	screenDuration = 0
	screenType = Black_Screen_Type.Start_Level;

	OVERWORLD_COLOR = "#5C94FC";
	UNDERGROUND_COLOR = "#000000";
	UNDERWATER_COLOR = "#5C94FC";
	CASTLE_COLOR = "#000000";

	velocityXGround = (this.spriteSize * 9.10 / 16) * 60;
	velocityXTurbo  = (this.spriteSize * 14.4 / 16) * 60;
	velocityXSwim   = (this.spriteSize * 17.6 / 16) * 60;

	constructor(engine, textSize) {
		this.engine = engine;
		this.textSize = textSize;
		this.specialBlocks = {};
		this.foregroundBlocks = [5, 6, 7, 8];
		
		this.availableWorlds = [
			'0-0', '1-1', '1-1b', '1-2'
		]; 
		this.currentWorldIndex = 0;

		const savedHighscore = this.engine.getCookie("smb_highscore");
		this.highscore = savedHighscore ? parseInt(savedHighscore, 10) : 0;

		this.HILL_SMALL_PATTERN = [
			[' ', 'T', ' '],
			['L', '1', 'R']
		];

		this.HILL_LARGE_PATTERN = [
			[' ', ' ', 'T', ' ', ' '],
			[' ', 'L', '2', 'R', ' '],
			['L', '1', 'M', '2', 'R']
		];

		this.HILL_SPRITE_MAP = {
			'L': 'Block_Hill_Left',
			'M': 'Block_Hill_Middle',
			'R': 'Block_Hill_Right',
			'T': 'Block_Hill_Top',
			'1': 'Block_Hill_Middle_Hole_1',
			'2': 'Block_Hill_Middle_Hole_2'
		};

		this.CLOUD_SPRITE_MAP = {
			'TL': 'Block_Cloud_Top_Left',
			'TM': 'Block_Cloud_Top_Middle',
			'TR': 'Block_Cloud_Top_Right',
			'BL': 'Block_Cloud_Bottom_Left',
			'BM': 'Block_Cloud_Bottom_Middle',
			'BR': 'Block_Cloud_Bottom_Right'
		};
		
		this.BUSH_SPRITE_MAP = {
			'L': 'Block_Bush_Left',
			'M': 'Block_Bush_Middle',
			'R': 'Block_Bush_Right'
		};
	}

	defineWorldSprites() {
		let tilesetName = "Overworld_Tiles";
		const tileScale = this.spriteScale;

		switch (this.currentMap.type) {
			case World_Type.Underground:
				tilesetName = "Underground_Tiles";
				break;
			case World_Type.Overworld:
			default:
				tilesetName = "Overworld_Tiles";
				break;
		}

		// Bloques Comunes
		js2d.defineSpriteFromTileset("Block_Black", tilesetName, 0, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Ground", tilesetName, 1, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Stairs", tilesetName, 2, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Brick", tilesetName, 3, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Brick_Middle", tilesetName, 4, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Brick_Zigzag", tilesetName, 5, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Brick_Zigzag_Filled", tilesetName, 6, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Brick_Arch", tilesetName, 7, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Brick_Break", tilesetName, 8, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Brick_Cut", tilesetName, 9, 0, 1, tileScale);

		// Objetos Interactivos
		js2d.defineSpriteFromTileset("Object_Question",				tilesetName, 0, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Object_Coinbox_Multiple",	tilesetName, 0, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Object_Question_Used",		tilesetName, 1, 1, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Twentyfive",			tilesetName, 2, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Object_Coin",					tilesetName, 7, 1, 3, tileScale);

		js2d.defineSpriteFromTileset("Block_Used",		tilesetName, 3, 1, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Invisible",	tilesetName, 15, 15, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Empty",		tilesetName, 15, 15, 1, tileScale);

		// Tuberías
		js2d.defineSpriteFromTileset("Block_Pipe_Top_Left", tilesetName, 0, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Top_Right", tilesetName, 1, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Body_Left", tilesetName, 2, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Body_Right", tilesetName, 3, 2, 1, tileScale);
		
		// Escenario (Nubes, Arbustos, etc.) - Usamos Overworld por defecto
		const sceneryTileset = "Overworld_Tiles";
		// Nubes
		js2d.defineSpriteFromTileset("Block_Cloud_Top_Left", sceneryTileset, 0, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Top_Middle", sceneryTileset, 1, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Top_Right", sceneryTileset, 2, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Left", sceneryTileset, 3, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Middle", sceneryTileset, 4, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Right", sceneryTileset, 5, 4, 1, tileScale);

		// Arbustos
		js2d.defineSpriteFromTileset("Block_Bush_Left", sceneryTileset, 12, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Bush_Middle", sceneryTileset, 13, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Bush_Right", sceneryTileset, 14, 4, 1, tileScale);
		
		// Colinas
		js2d.defineSpriteFromTileset("Block_Hill_Left", sceneryTileset, 6, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Middle_Hole_1", sceneryTileset, 7, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Middle", sceneryTileset, 8, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Middle_Hole_2", sceneryTileset, 9, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Right", sceneryTileset, 10, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Top", sceneryTileset, 11, 4, 1, tileScale);

		// Bandera
		js2d.defineSpriteFromTileset("Block_Flagpole_Top", sceneryTileset, 0, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Flagpole", sceneryTileset, 1, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Flag", sceneryTileset, 2, 3, 1, tileScale);

		// Power-ups
		js2d.defineSpriteFromTileset("Object_Mushroom_Super", sceneryTileset, 0, 6, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Mushroom_1UP", sceneryTileset, 1, 6, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Fire_Flower", sceneryTileset, 0, 7, 4, tileScale);

		// ---

		js2d.createAnimatedSprite("Mushroom_Grow", "Object_Mushroom_Grow", {x: 0, y: 0}, tileScale);
		js2d.createAnimatedSprite("Mushroom_1UP", "Object_Mushroom_1UP", {x: 0, y: 0}, tileScale);
		js2d.createAnimatedSprite("Coin", "Object_Coin",  {x: 0, y: 0}, tileScale);
		js2d.createAnimatedSprite("UICoin", "UI_Coin",  {x: 0, y: 0}, this.textSize / this.tileSize);
		js2d.createAnimatedSprite("Cursor", "Cursor",  {x: 0, y: 0}, this.textSize / this.tileSize);

		js2d.addAnimationToSprite("Coin", "Coin_Shine", [0, 1, 2], true, 8);
		js2d.addAnimationToSprite("UICoin", "Coin_Score", [0, 1, 2], true, 8);
		
		js2d.setAnimationForSprite("Coin", "Coin_Shine");
		js2d.setAnimationForSprite("UICoin", "Coin_Score");
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

	syncPlayerSpritesOnPowerup() {
		const smallSprite = this.engine.animatedSprites[PlayerName[this.player]];
		const bigSprite = this.engine.animatedSprites[PlayerName[this.player] + "_Big"];
		const fireSprite = this.engine.animatedSprites[PlayerName[this.player] + "_Fire"];

		// Si pasamos de pequeño a grande
		if (this.playerSize > Player_Size.Small) {
			if (smallSprite && bigSprite) {
				bigSprite.position.x = smallSprite.position.x;
				bigSprite.position.y = smallSprite.position.y - this.tileSize;
			}
			if (smallSprite && fireSprite) {
				fireSprite.position.x = smallSprite.position.x;
				fireSprite.position.y = smallSprite.position.y - this.tileSize;
			}
		}
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
			this.currentMap = JSON.parse(JSON.stringify(mapData));
			console.info(`[SMB] Mapa cargado: ${name}`);

			this.defineWorldSprites();

			// Centrar el mapa si es más pequeño que la pantalla
			const mapPixelWidth = this.currentMap.dimensions.width * this.tileSize;
			const screenWidth = this.engine.getCanvasWidth();

			if (mapPixelWidth < screenWidth) {
				// El offset es la mitad del espacio vacío que queda a los lados
				this.mapOffset.x = (screenWidth - mapPixelWidth) / 2;
			} else {
				// Si el mapa es más grande, empieza desde el borde izquierdo como siempre
				this.mapOffset.x = 0;
			}
			// También nos aseguramos de que el offset vertical se reinicie
			this.mapOffset.y = 0;

			this.enemies = [];
			const map_w = this.currentMap.dimensions.width;

			for (var i = 0; i < this.currentMap.map.length; i++) {
				const blockId = this.currentMap.map[i];
				let enemyType = null;
				let enemyColor = null;

				switch (blockId) {
					case 10: 
						enemyType = "Goomba"; 
						break;
					case 11: 
						enemyType = "Koopa"; 
						enemyColor = "Green";
						break;
					case 12: 
						enemyType = "Pakkun"; 
						enemyColor = "Green";
						break;
					case 37: 
						enemyType = "Koopa_Winged";
						enemyColor = "Red";
						break;
					case 43:
						enemyType = "Koopa_Winged";
						enemyColor = "Green";
						break;
					case 44:
						enemyType = "Koopa";
						enemyColor = "Red";
						break;
					case 45:
						enemyType = "Pakkun";
						enemyColor = "Red";
						break;
				}

				if (enemyType) {
					let coords = this.engine.indexToCoords(i, map_w);
					let screenPos = this.tileToScreen(coords.x, coords.y);

					if (enemyType.includes("Pakkun")) {
						this.enemies.push({
							type: 'Pakkun', 
							color: enemyColor,
							x: (screenPos.x - this.mapOffset.x) + (this.tileSize / 2), y: screenPos.y + this.tileSize,
							initialY: screenPos.y + this.tileSize, maxHeight: this.tileSize * 1.5, state: 'hiding', timer: 120
						});
					} else {
						this.enemies.push({
							id: this.enemies.length,
							type: enemyType,
							color: enemyColor,
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

	damagePlayer() {
		if (this.isInvincible) return; // Si es invencible, no puede ser dañado

		if (this.playerSize > Player_Size.Small) {
			this.playerSize = Player_Size.Small;
			this.isInvincible = true;
			this.invincibleTimer = 1500; // 1.5 segundos de invencibilidad
			this.engine.playAudio(audio["Player_Pipe"], false); // Sonido de transformación
		} else {
			this.killPlayer();
		}
	}

	killPlayer() {
		if (this.state === Game_State.Playing) {
			this.state = Game_State.Player_Dying;
			this.deathTimer = 0;
			this.velocityY = -18;

			if (this.score > this.highscore) {
				this.highscore = this.score;
				this.engine.setCookie("smb_highscore", this.highscore, 365);
				console.log(`[SMB] Nuevo highscore guardado: ${this.highscore}`);
			}

			if (this.score > this.highscore) {
				this.highscore = this.score;
			}

			this.stopAllMusic();

			// Preparamos la función que se ejecutará CUANDO el sonido de muerte TERMINE.
			const onDeathSoundEnd = () => {
				// Si después de que el sonido termina, al jugador no le quedan vidas...
				if (this.lives <= 0) {
					// ...entonces reproducimos la melodía de Game Over.
					this.engine.playAudio(audio["Game_Over_Theme"], false);
				}
			};

			this.engine.setVolume(audio["Player_Die"], 0.5);
			this.engine.playAudio(audio["Player_Die"], false, onDeathSoundEnd);
		}
	}

	handleDeath() {
		this.lives--;
		if (this.lives > 0) {
			this.resetLevelState();
			this.transitionToBlackScreen(Black_Screen_Type.Start_Level, 3000);
		} else {
			this.transitionToBlackScreen(Black_Screen_Type.Game_Over, 6500);
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
			// this.engine.stopAudio(audio["Game_Over_Theme"]);
			this.state = Game_State.Title_Menu;
		} else {
			this.state = Game_State.Playing;
		}
	}

	stopAllMusic() {
		this.engine.stopAudio(audio["Overworld_Theme"]);
		this.engine.stopAudio(audio["Underground_Theme"]);
		this.engine.stopAudio(audio["Underwater_Theme"]);
		this.engine.stopAudio(audio["Castle_Theme"]);
	}

	resetLevelState() {
		this.velocityY = 0;
		this.time = 400;
		this.specialBlocks = {};
		this.flagpoleFlag = null;
	
		if (this.currentMap && this.currentWorldIndex) {
			this.loadMap(this.availableWorlds[this.currentWorldIndex]);
		} else {
			this.loadMap("1-1");
		}

		const playerSprite = this.engine.animatedSprites[PlayerName[this.player]];
		
		playerSprite.position = {x: this.mapOffset.x + 150, y: 100};
	}

	resetLevel() {
		const player = this.engine.animatedSprites[PlayerName[this.player]];
		player.position.x = 300; player.position.y = 300;
		this.mapOffset.x = 0; this.velocityY = 0; this.coins = 0; this.score = 0;
		this.specialBlocks = {};
		this.state = Game_State.Playing;
		this.loadMap(this.currentMap.world);
	}

	startNextLevel(nextWorldName) {
		const nextWorldIndex = this.availableWorlds.indexOf(nextWorldName);

		if (nextWorldIndex === -1) {
			console.error(`[SMB] El siguiente mundo "${nextWorldName}" no se encontró en la lista 'availableWorlds'.`);
			this.state = Game_State.Title_Menu;
			return;
		}

		this.currentWorldIndex = nextWorldIndex;
		this.playerIsVisible = true;
		
		this.resetLevelState();
		
		this.transitionToBlackScreen(Black_Screen_Type.Start_Level, 3000);
	}

	rectsOverlap(r1, r2) {
		return !(r1.x + r1.w < r2.x || r1.y + r1.h < r2.y || r1.x > r2.x + r2.w || r1.y > r2.y + r2.h);
	}

	updateEnemies(dt) {
		const player = this.engine.animatedSprites[PlayerName[this.player]];
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			const enemy = this.enemies[i];
			const enemyScreenX = enemy.x + this.mapOffset.x;

			// --- LÓGICA DE MOVIMIENTO Y FÍSICA DE CADA ENEMIGO ---

			if (enemy.type === 'Pakkun') {
				// La lógica de Pakkun ya incluye su propio movimiento vertical, así que podemos saltar el resto.
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
			} else if (enemy.type === 'Goomba' && enemy.state === 'stomped') {
				// Goomba aplastado solo necesita un temporizador, sin física.
				enemy.stompTimer++;
				if (enemy.stompTimer > 30) { this.enemies.splice(i, 1); continue; }
			} else if (enemy.type.includes('Koopa')) {
				// LÓGICA COMPLEJA DE KOOPAS (NORMALES, ALADOS, CAPARAZONES)
				if (enemy.state === 'shell') {
					if (enemy.vx !== 0) {
						enemy.x += enemy.vx;
						const wallCheckX = enemy.vx > 0 ? enemy.x + this.mapOffset.x + this.tileSize : enemy.x + this.mapOffset.x;
						const wallTile = this.screenToTile(wallCheckX, enemy.y);
						if (this.currentMap.map[this.engine.coordsToIndex(wallTile, this.currentMap.dimensions.width)] > 0) {
							enemy.vx *= -1;
							enemy.x += enemy.vx > 0 ? 1 : -1;
						}
						for (let j = this.enemies.length - 1; j >= 0; j--) {
							const otherEnemy = this.enemies[j];
							if (otherEnemy.id === enemy.id) continue;
							const shellRect = { x: enemy.x + this.mapOffset.x, y: enemy.y, w: this.tileSize, h: this.tileSize };
							const otherRect = { x: otherEnemy.x + this.mapOffset.x, y: otherEnemy.y, w: this.tileSize, h: this.tileSize };
							if (this.rectsOverlap(shellRect, otherRect)) {
								this.score += 400;
								this.enemies.splice(j, 1);
							}
						}
					}
				} else if (enemy.isWinged && enemy.canFly) {
					enemy.flyTimer++;
					if (enemy.flyTimer > 60 && enemy.vy === 0) { 
						enemy.vy = -10; 
						enemy.flyTimer = 0; 
					}
				}

				const enemyHeight = (enemy.state === 'walking') ? this.tileSize * 1.5 : this.tileSize;
				enemy.vy += this.gravity;
				enemy.y += enemy.vy;

				const feetY = enemy.y + enemyHeight;
				const feetLeft = this.screenToTile(enemy.x + this.mapOffset.x + 4, feetY);
				const feetRight = this.screenToTile(enemy.x + this.mapOffset.x + this.tileSize - 4, feetY);
				const onGroundLeft = this.currentMap.map[this.engine.coordsToIndex(feetLeft, this.currentMap.dimensions.width)] > 0;
				const onGroundRight = this.currentMap.map[this.engine.coordsToIndex(feetRight, this.currentMap.dimensions.width)] > 0;

				let isOnSolidGround = false;
				if (onGroundLeft || onGroundRight) {
					enemy.y = this.tileToScreen(feetLeft.x, feetLeft.y).y - enemyHeight;
					enemy.vy = 0;
					isOnSolidGround = true;
				}

				if (enemy.state === 'walking') {
					enemy.x += enemy.vx;
					const wallCheckX = enemy.vx > 0 ? enemy.x + this.mapOffset.x + this.tileSize : enemy.x + this.mapOffset.x;
					const wallTile = this.screenToTile(wallCheckX, enemy.y);
					if (this.currentMap.map[this.engine.coordsToIndex(wallTile, this.currentMap.dimensions.width)] > 0) {
						enemy.vx *= -1;
					}
					if (isOnSolidGround && !enemy.isWinged) {
						if (enemy.vx < 0 && !onGroundLeft) enemy.vx *= -1;
						else if (enemy.vx > 0 && !onGroundRight) enemy.vx *= -1;
					}
				}
			} else {
				// --- INICIO DEL CÓDIGO RESTAURADO PARA GOOMBAS Y OTROS ENEMIGOS ---
				// Lógica de física genérica para enemigos que no son Koopas ni Pakkuns.
				const enemyHeight = this.tileSize;
				enemy.vy += this.gravity;
				enemy.y += enemy.vy;

				const feetY = enemy.y + enemyHeight;
				const feetTile = this.screenToTile(enemy.x + this.mapOffset.x + this.tileSize / 2, feetY);
				if (this.currentMap.map[this.engine.coordsToIndex(feetTile, this.currentMap.dimensions.width)] > 0) {
					enemy.vy = 0;
					enemy.y = this.tileToScreen(feetTile.x, feetTile.y).y - enemyHeight;
				}

				if (enemy.state === 'walking') {
					enemy.x += enemy.vx;
					const wallCheckX = enemy.vx > 0 ? enemy.x + this.mapOffset.x + this.tileSize : enemy.x + this.mapOffset.x;
					const wallTile = this.screenToTile(wallCheckX, enemy.y);
					if (this.currentMap.map[this.engine.coordsToIndex(wallTile, this.currentMap.dimensions.width)] > 0) {
						enemy.vx *= -1;
					}
				}
				// --- FIN DEL CÓDIGO RESTAURADO ---
			}

			// --- LÓGICA DE COLISIÓN CON EL JUGADOR (PARA TODOS LOS ENEMIGOS) ---
			
			const enemyHeight = (enemy.type.includes('Koopa') && enemy.state === 'walking') ? this.tileSize * 1.5 : this.tileSize;
			const enemyRect = { x: enemyScreenX, y: enemy.y, w: this.tileSize, h: enemyHeight };
            
            // 1. Obtenemos la altura correcta del jugador
            const isBig = this.playerSize > Player_Size.Small;
            const playerHeight = isBig ? this.tileSize * 2 : this.tileSize;
			const playerRect = { x: player.position.x, y: player.position.y, w: this.tileSize, h: playerHeight };

			if (this.rectsOverlap(playerRect, enemyRect)) {
                // 2. Usamos la altura correcta para detectar el pisotón
				const isStomping = this.velocityY > 0 && (player.position.y + playerHeight) < (enemy.y + enemyHeight / 1.5);

				if (isStomping) {
					this.velocityY = -10;
					this.engine.playAudioOverlap(audio["Player_Stomp"]);
					if (enemy.type === 'Goomba') {
						enemy.state = 'stomped';
						this.score += 100;
					} else if (enemy.type.includes('Koopa')) {
						if (enemy.isWinged) {
							enemy.isWinged = false; enemy.type = 'Koopa';
						} else if (enemy.state === 'walking') {
							enemy.state = 'shell'; enemy.vx = 0; this.score += 200;
						} else if (enemy.state === 'shell') {
							if (enemy.vx !== 0) {
								enemy.vx = 0; this.score += 500;
							} else {
								enemy.vx = (player.position.x < enemyRect.x) ? 8 : -8; this.score += 500;
							}
						}
					}
				} else { // Colisión lateral
					if (enemy.type === 'Pakkun' || (enemy.state === 'walking' && this.velocityY >= 0) || (enemy.state === 'shell' && enemy.vx !== 0)) {
						this.damagePlayer();
					} else if (enemy.state === 'shell' && enemy.vx === 0) {
						enemy.vx = (player.position.x < enemyRect.x) ? 8 : -8;
					}
				}
			}

			if (enemy.state === 'falling' && enemy.y > this.engine.canvas.height) {
				this.enemies.splice(i, 1);
			}
		}
	}

	drawEnemies() {
		const pakkunGreenAnim = this.engine.animatedSprites['Pakkun_Green'];
		const pakkunRedAnim = this.engine.animatedSprites['Pakkun_Red'];
		const biteAnim = pakkunGreenAnim.animations.Pakkun_Bite;

		if (pakkunGreenAnim.frameCounter % biteAnim.frameSpeed === 0) {
			const nextFrame = (pakkunGreenAnim.currentFrame + 1) % biteAnim.frames.length;
			pakkunGreenAnim.currentFrame = nextFrame;
			pakkunRedAnim.currentFrame = nextFrame; // Sincroniza la animación
		}

		// Ahora, recorre y dibuja todos los enemigos.
		for (const enemy of this.enemies) {
			const screenX = enemy.x + this.mapOffset.x;
			if (screenX < -this.tileSize || screenX > this.engine.canvas.width) continue;

			let spriteNameToDraw = enemy.type;
			// Construye el nombre del sprite si tiene un color (Goomba no tiene)
			if (enemy.color) {
				spriteNameToDraw = `${enemy.type}_${enemy.color}`;
			}

			// Si es un Koopa que ha perdido sus alas, su tipo cambia a 'Koopa'
			// y esta lógica lo dibujará correctamente con su color original.
			if (enemy.type === 'Koopa' && enemy.isWinged) {
				 spriteNameToDraw = `Koopa_Winged_${enemy.color}`;
			}
			
			// Dibujado
			if (enemy.type === 'Pakkun') {
				const baseSpriteName = `Enemy_Pakkun_${enemy.color}`;
				this.engine.drawSprite(
					baseSpriteName,
					pakkunGreenAnim.animations.Pakkun_Bite.frames[pakkunGreenAnim.currentFrame],
					{ x: screenX, y: enemy.y },
					this.spriteScale, false, 0, Pivot.Top_Left
				);
			} else {
				const animSprite = this.engine.animatedSprites[spriteNameToDraw];
				if (!animSprite) continue; // Si el sprite no existe, no lo dibujes

				if (enemy.state === 'stomped') {
					this.engine.setAnimationForSprite(spriteNameToDraw, `${enemy.type}_Stomped`);
				} else if (enemy.state === 'shell') {
					 const shellSpriteName = `Koopa_Shell_${enemy.color}`;
					 const shellSprite = this.engine.animatedSprites[shellSpriteName];
					 if(shellSprite) {
						shellSprite.position = { x: screenX, y: enemy.y };
						this.engine.setAnimationForSprite(shellSpriteName, enemy.vx === 0 ? 'Shell_Idle' : 'Shell_Sliding');
						this.engine.drawAnimatedSprite(shellSpriteName, Pivot.Top_Left);
					 }
				} else {
					 this.engine.setAnimationForSprite(spriteNameToDraw, `${enemy.type.includes("Winged") ? `${enemy.type}_Walk` : `${enemy.type}_Walk`}`);
				}

				// Actualiza posición y dibujado (excepto para caparazones ya dibujados)
				if (enemy.state !== 'shell') {
					animSprite.position = { x: screenX, y: enemy.y };
					animSprite.flipped = enemy.vx > 0;
					this.engine.drawAnimatedSprite(spriteNameToDraw, Pivot.Top_Left);
				}
			}
		}

		// Incrementa todos los contadores al final
		Object.values(this.engine.animatedSprites).forEach(sprite => sprite.frameCounter++);
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
				if(playerSprite) {
					this.engine.drawSprite(spriteName, 0, playerImagePos, this.spriteScale, false, 0, Pivot.Top_Left);
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
		this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.OVERWORLD_COLOR);

		this.drawBackground();
		this.drawBlocks();
		this.drawForegroundBlocks();
		this.drawUI();

		const titleMaxY = 0.65;
		const titleSprite = this.engine.sprites["UI_Title_Image"];
		const titleImg = titleSprite.image;
		const titlePosX = this.engine.canvas.width / 2;
		const titlePosY = this.tileSize;
		const titleScale = this.spriteScale * this.engine.getCanvasHeight() / titleMaxY / 1000;
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

		if (this.engine.keysPressed['KeyA']) {
			this.engine.keysPressed['KeyA'] = false;
			this.currentWorldIndex--;
			if (this.currentWorldIndex < 0) {
				this.currentWorldIndex = this.availableWorlds.length - 1;
			}
		}
		if (this.engine.keysPressed['KeyD']) {
			this.engine.keysPressed['KeyD'] = false;
			this.currentWorldIndex++;
			if (this.currentWorldIndex >= this.availableWorlds.length) {
				this.currentWorldIndex = 0;
			}
		}
		
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
				if(this.engine.sprites["Cursor"]) {
					this.engine.drawSprite("Cursor", 0, cursorPos, this.engine.sprites["Cursor"].scale, false, 0, Pivot.Top_Left);
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

	drawCompositeObject(objPos, pattern, spriteMap) {
		for (let y = 0; y < pattern.length; y++) {
			const row = pattern[y];
			for (let x = 0; x < row.length; x++) {
				const key = row[x];
				if (key !== ' ' && spriteMap[key]) {
					const spriteName = spriteMap[key];
					const drawPos = { 
						x: objPos.x + x * this.tileSize, 
						y: objPos.y + y * this.tileSize 
					};
					this.engine.drawSprite(spriteName, 0, drawPos, this.spriteScale, false, 0, Pivot.Top_Left);
				}
			}
		}
	}

	drawBackground() {
		switch(this.currentMap.type) {
			case World_Type.Overworld:
				this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.OVERWORLD_COLOR);

				const parallaxSpeedClouds = 0.5;
				const parallaxSpeedHills = 0.8;
				const parallaxSpeedBushes = 1;

				const offsetX = this.mapOffset.x;
				const numObjects = Math.ceil(this.currentMap.dimensions.width * 0.35);
				const groundY = this.engine.canvas.height - this.tileSize * 2;

				// Nubes
				const cloudY = 80;
				for (let i = 0; i < numObjects; i++) {
					const cloudWidth = 2 + (i % 2);
					const cloudPos = {
						x: (i * 500) + offsetX * parallaxSpeedClouds,
						y: cloudY + (i % 3) * 40
					};

					if (cloudPos.x + cloudWidth * this.tileSize < 0 || cloudPos.x > this.engine.canvas.width) continue;

					const cloudPattern = [
						['TL', ...Array(cloudWidth - 2).fill('TM'), 'TR'],
						['BL', ...Array(cloudWidth - 2).fill('BM'), 'BR']
					];

					this.drawCompositeObject(cloudPos, cloudPattern, this.CLOUD_SPRITE_MAP);
				}
				
				// --- Dibujar Colinas (usando patrones estáticos) ---
				for (let i = 0; i < numObjects; i++) {
					const isLargeHill = (i % 2 === 0);
					const pattern = isLargeHill ? this.HILL_LARGE_PATTERN : this.HILL_SMALL_PATTERN;
					const hillWidth = isLargeHill ? 5 : 3;
					
					const hillPos = {
						x: (i * 450) + offsetX * parallaxSpeedHills,
						y: groundY - (pattern.length - 1) * this.tileSize
					};

					if (hillPos.x + hillWidth * this.tileSize < 0 || hillPos.x > this.engine.canvas.width) continue;

					this.drawCompositeObject(hillPos, pattern, this.HILL_SPRITE_MAP);
				}

				// --- Dibujar Arbustos (usando el nuevo sistema) ---
				for (let i = 0; i < numObjects; i++) {
					const bushWidth = 2 + (i % 3);
					 const bushPos = {
						x: (i * 350) + offsetX * parallaxSpeedBushes,
						y: groundY + this.tileSize / 2
					};

					if (bushPos.x + bushWidth * this.tileSize < 0 || bushPos.x > this.engine.canvas.width) continue;

					const bushPattern = [
						['L', ...Array(bushWidth - 2).fill('M'), 'R']
					];
					
					this.drawCompositeObject(bushPos, bushPattern, this.BUSH_SPRITE_MAP);
				}
				break;
				
			case World_Type.Underground:
				this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.UNDERGROUND_COLOR);
				break;
			case World_Type.Underwater:
				this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.UNDERWATER_COLOR);
				break;
			case World_Type.Castle:
				this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.CASTLE_COLOR);
				break;
			default:
				this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.OVERWORLD_COLOR);
				break;
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
				switch (this.currentMap.type) {
					case World_Type.Overworld:
						spriteName = this.specialBlocks[i]?.revealed ? 'Object_Question' : 'Block_Brick';
						break;
					case World_Type.Underground:
						spriteName = this.specialBlocks[i]?.revealed ? 'Object_Question_Underground' : 'Block_Brick_Underground';
						break;
					default:
						break;
				}
			}

			const sprite = this.engine.sprites[spriteName];
			if (sprite) {
				this.engine.drawSprite(spriteName, 0, blockPos, sprite.scale, false, 0, Pivot.Top_Left);
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
			const spriteName = BlockType[blockId];
			const sprite = this.engine.sprites[spriteName];

			if (sprite) {
				this.engine.drawSprite(spriteName, 0, blockPos, sprite.scale, false, 0, Pivot.Top_Left);
			}
		}
	}
	
	spawnCoin(x, y) {
		const coin = {
			x: (x - this.mapOffset.x) + (this.tileSize / 4),
			// <<< FIN DE LA CORRECCIÓN >>>
			y: y,
			vY: -10,
			timer: 0,
			active: true,
			rotation: 0
		};
		this.activeCoins.push(coin);
	}

	updateCoins() {
		for (let i = this.activeCoins.length - 1; i >= 0; i--) {
			const coin = this.activeCoins[i];
			
			// Actualiza la física y el temporizador
			coin.y += coin.vY;
			coin.vY += 0.8; // Gravedad
			coin.timer++;

			// Si el tiempo de vida de la moneda ha terminado, la elimina
			if (coin.timer > 30) {
				this.activeCoins.splice(i, 1);
			}
		}

		// Lógica de animación del sprite de la moneda (se puede quedar aquí)
		const coinSprite = this.engine.animatedSprites["Coin"];
		const coinAnim = coinSprite.animations["Coin_Shine"];
		coinSprite.frameCounter++;
		if (coinSprite.frameCounter % coinAnim.frameSpeed === 0) {
			coinSprite.currentFrame = (coinSprite.currentFrame + 1) % coinAnim.frames.length;
		}
	}

	drawCoins() {
		const coinSprite = this.engine.animatedSprites["Coin"];

		for (const coin of this.activeCoins) {
			// Calculamos la posición en pantalla teniendo en cuenta la cámara
			const screenX = coin.x + this.mapOffset.x;

			// La rotación se puede seguir calculando aquí para el efecto visual
			coin.rotation = (coin.rotation + COIN_SPIN_VELOCITY) % 360;

			this.engine.drawSprite(
				"Object_Coin", 
				coinSprite.currentFrame, 
				{ x: screenX, y: coin.y }, 
				this.spriteScale, 
				false,
				coin.rotation,
				Pivot.Center
			);
		}
	}

	drawBumpingBlocksOverlay() {
		for (let i = this.bumpingBlocks.length - 1; i >= 0; i--) {
			const block = this.bumpingBlocks[i];
			block.y += block.vY;
			block.vY += this.gravity * 1.5;
			if (block.y >= block.originalY) {
				let finalId = block.originalId;
				if (block.originalId === 3) finalId = 4; // 'Used'
				if (block.originalId === 41) finalId = 4; // 'Used'

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
					spriteNameToDraw = (this.currentMap.type === World_Type.Overworld) ? 'Object_Question_Used' : 'Object_Question_Used_Underground';
				} else {
					spriteNameToDraw = (this.currentMap.type === World_Type.Overworld) ? 'Object_Question' : 'Object_Question_Underground';
				}
			}
			const spriteData = this.engine.sprites[spriteNameToDraw];
			if (spriteData) {
				this.engine.drawSprite(spriteNameToDraw, 0, { x: block.x, y: block.y }, spriteData.scale, false, 0, Pivot.Top_Left);
			}
		}
	}

	spawnBrickParticles(x, y) {
		// Velocidades iniciales para las 4 partículas para que salgan disparadas
		const velocities = [
			{ vx: -4, vy: -15 }, // Arriba-izquierda
			{ vx: 4, vy: -15 },  // Arriba-derecha
			{ vx: -3, vy: -8 },   // Abajo-izquierda (menos fuerza)
			{ vx: 3, vy: -8 }    // Abajo-derecha (menos fuerza)
		];

		velocities.forEach(vel => {
			this.brickParticles.push({
				x: x + this.tileSize / 2, // Empiezan en el centro del bloque
				y: y + this.tileSize / 2,
				vx: vel.vx,
				vy: vel.vy,
				lifespan: 60 // Durarán 60 frames (1 segundo aprox.)
			});
		});

		this.engine.playAudioOverlap(audio["Brick_Break"]);
	}

	updateAndDrawBrickParticles() {
	// Recorremos el array hacia atrás para poder eliminar elementos de forma segura
		for (let i = this.brickParticles.length - 1; i >= 0; i--) {
			const p = this.brickParticles[i];

			// Aplicamos física
			p.vy += this.gravity * 1.5; // Una gravedad un poco más fuerte para que caigan rápido
			p.x += p.vx;
			p.y += p.vy;
			p.lifespan--;

			// Dibujamos la partícula como un pequeño cuadrado marrón
			const particleSize = this.tileSize / 4;
			this.engine.drawRectangle(
				{ x: p.x, y: p.y, width: particleSize, height: particleSize }, 
				"#D99B59" // Un color parecido al ladrillo
			);

			// Si la vida de la partícula ha terminado, la eliminamos
			if (p.lifespan <= 0) {
				this.brickParticles.splice(i, 1);
			}
		}
	}

	drawPlayer(name, dt) {
		// --- 1. Determinar el estado y las variables del jugador ---
		let currentSpriteName;
		const isBig = this.playerSize > Player_Size.Small; // Es true para Big y Fire

		// Selecciona el nombre del sprite a usar basado en el tamaño actual
		switch (this.playerSize) {
			case Player_Size.Small:
				currentSpriteName = PlayerName[this.player];
				break;
			case Player_Size.Big:
				currentSpriteName = PlayerName[this.player] + "_Big";
				break;
			case Player_Size.Fire:
				currentSpriteName = PlayerName[this.player] + "_Fire";
				break;
		}

		const player = this.engine.animatedSprites[currentSpriteName];
		if (!player) {
			console.error(`Sprite animado no encontrado: ${currentSpriteName}`);
			return; 
		}

		const playerPos = player.position;
		const playerHeight = isBig ? this.tileSize * 2 : this.tileSize;
		const dt_sec = dt / 1000;

		// Lógica de invencibilidad y parpadeo
		if (this.isInvincible) {
			this.invincibleTimer -= dt;
			if (this.invincibleTimer <= 0) this.isInvincible = false;
		}
		const shouldDrawPlayer = !this.isInvincible || Math.floor(this.invincibleTimer / 100) % 2 === 0;

		// --- 2. Lógica de Muerte (Estado de Muerte) ---
		if (this.state === Game_State.Player_Dying) {
			this.deathTimer += dt;
			const deathAnimDuration = 400;
			const maxScaleMultiplier = 1.5;
			const progress = Math.min(1, this.deathTimer / deathAnimDuration);
			const newScale = this.spriteScale + (this.spriteScale * (maxScaleMultiplier - 1) * progress);
			const newWidth = this.spriteSize * newScale;
			const offset = (newWidth - this.tileSize) / 2;
			const drawPos = { x: playerPos.x - offset, y: playerPos.y - offset };
			
			this.velocityY += this.gravity * 60 * dt_sec;
			playerPos.y += this.velocityY * 60 * dt_sec;

			if (playerPos.y > this.engine.canvas.height + this.tileSize) {
				this.handleDeath();
			}

			const deathFrameIndex = 6;
			this.engine.drawSprite(player.spriteName, deathFrameIndex, drawPos, newScale, player.flipped, 0, Pivot.Top_Left);
			return;
		}

		// --- 3. Lógica de Físicas y Colisiones ---
		const mapWidth = this.currentMap.dimensions.width;
		const inBounds = (x, y) => x >= 0 && x < mapWidth;
		const isSolid = (blockId) => blockId > 0 && ![25, 12, 26].includes(blockId);
		
		this.velocityY += this.gravity;
		const newY = playerPos.y + this.velocityY;

		// Colisión con el TECHO (cuando salta)
		if (this.velocityY < 0) {
			const headCenterTile = this.screenToTile(playerPos.x + this.tileSize / 2, newY);
			let hitCeiling = false;

			if (inBounds(headCenterTile.x, headCenterTile.y)) {
				const idx = this.engine.coordsToIndex(headCenterTile, mapWidth);
				const blockId = this.currentMap.map[idx] || 0;

				if (isSolid(blockId)) {
					const { x: blockX, y: blockY } = this.tileToScreen(headCenterTile.x, headCenterTile.y);
					let blockSoundPlayed = false;

					// Lógica de Bloques Múltiples
					if (blockId === 34) {
						if (!this.specialBlocks[idx]) {
							this.specialBlocks[idx] = { coinsLeft: 10, revealed: true };
						}

						
						if (this.specialBlocks[idx].coinsLeft > 0) {
							this.specialBlocks[idx].coinsLeft--;
							this.coins++;
							this.spawnCoin(blockX, blockY);
							this.engine.playAudioOverlap(audio["Coin"]);
							blockSoundPlayed = true;
							if (this.specialBlocks[idx].coinsLeft === 0) {
								this.currentMap.map[idx] = 35; // Bloque Usado
							}
						}
					}
					// Lógica de Romper Ladrillos
					else if (blockId === 2 && isBig) {
						this.currentMap.map[idx] = 0;
						this.spawnBrickParticles(blockX, blockY);
						blockSoundPlayed = true; // El sonido de rotura ya se reproduce en spawnBrickParticles
					}
					// Caja de una sola moneda
					else if (blockId === 41) {
	                    this.spawnCoin(blockX, blockY);
	                    this.engine.playAudioOverlap(audio["Coin"]);
	                    blockSoundPlayed = true;
	                }
					// Lógica de Golpeo Genérico
					else { 
						if (blockId === 3) { // Bloque de Pregunta
							this.currentMap.map[idx] = 35;
							const powerupType = isBig ? Powerup_Type.Fire_Flower : Powerup_Type.Mushroom_Super;
							this.spawnPowerup(blockX, blockY, powerupType);
						}
					}
					
					// Efecto visual de "bump"
					const isAlreadyBumping = this.bumpingBlocks.some(b => b.mapIndex === idx);

	                // Condición para saber si un bloque de monedas múltiples se acaba de agotar.
	                const justExhausted = (blockId === 34 && this.specialBlocks[idx]?.coinsLeft === 0);

	                // Añadimos "!justExhausted" a la condición para evitar el "bump" en el último golpe.
	                if (!isAlreadyBumping && [2, 3, 34, 41].includes(blockId) && !(blockId === 2 && isBig) && !justExhausted) {
	                     this.bumpingBlocks.push({ x: blockX, y: blockY, originalY: blockY, vY: -6, mapIndex: idx, originalId: blockId });
	                     this.currentMap.map[idx] = 0;
	                }
					
					if (!blockSoundPlayed) this.engine.playAudioOverlap(audio["Player_Bump"]);
					
					this.velocityY = 0;
					playerPos.y = this.tileToScreen(headCenterTile.x, headCenterTile.y + 1).y;
					hitCeiling = true;
				}
			}
			if (!hitCeiling) playerPos.y = newY;
		}
		// Colisión con el SUELO (cuando cae)
		else {
			const bottomLeft = this.screenToTile(playerPos.x + 4, newY + playerHeight);
			const bottomRight = this.screenToTile(playerPos.x + this.tileSize - 4, newY + playerHeight);
			let foundGround = false;
			for (let tx = bottomLeft.x; tx <= bottomRight.x; tx++) {
				if (inBounds(tx, bottomLeft.y)) {
					const idx = this.engine.coordsToIndex({x: tx, y: bottomLeft.y}, mapWidth);
					if (isSolid(this.currentMap.map[idx])) {
						playerPos.y = this.tileToScreen(tx, bottomLeft.y).y - playerHeight;
						this.isOnGround = true; this.velocityY = 0; foundGround = true; break;
					}
				}
			}
			if (!foundGround) { this.isOnGround = false; playerPos.y = newY; }
		}

		// --- 4. Lógica de Movimiento y Animación ---
		if (this.skidTimer > 0) this.skidTimer--;
		const isTurbo = this.engine.keysPressed['ShiftLeft'] || this.engine.keysPressed['ShiftRight'];
		const isTryingToMoveLeft = this.engine.keysPressed['ArrowLeft'] || this.engine.keysPressed['KeyA'];
		const isTryingToMoveRight = this.engine.keysPressed['ArrowRight'] || this.engine.keysPressed['KeyD'];
		const isMoving = isTryingToMoveLeft || isTryingToMoveRight;
		
		const changedDirection = (isTryingToMoveLeft && !player.flipped) || (isTryingToMoveRight && player.flipped);
		if (this.isOnGround && isMoving && changedDirection && this.wasMovingTurbo) {
			this.skidTimer = 10;
			this.engine.playAudioOverlap(audio["Player_Skid"]);
		}
		this.wasMovingTurbo = isMoving && isTurbo;
		
		const animPrefix = PlayerName[this.player] + (this.playerSize === Player_Size.Fire ? "_Fire" : (isBig ? "_Big" : ""));
		if (this.velocityY < 0 && !this.isOnGround) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Jump`);
		else if (this.velocityY > this.gravity && !this.isOnGround) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Fall`);
		else if (this.skidTimer > 0) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Stop`);
		else if (isMoving) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Run`);
		else this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Idle`);

		const velocityX = (isTurbo ? this.velocityXTurbo : this.velocityXGround) * dt_sec;

		if (isTryingToMoveLeft) {
			player.flipped = true;
			const newX = playerPos.x - velocityX;
			const leftTop = this.screenToTile(newX + 4, playerPos.y);
			const leftBottom = this.screenToTile(newX + 4, playerPos.y + playerHeight - 1);
			let blocked = false;
			for (let ty = leftTop.y; ty <= leftBottom.y; ty++) {
				if (inBounds(leftTop.x, ty) && isSolid(this.currentMap.map[this.engine.coordsToIndex({x: leftTop.x, y: ty}, mapWidth)])) {
					blocked = true; break;
				}
			}
			if (!blocked) playerPos.x = newX;
		} else if (isTryingToMoveRight) {
			player.flipped = false;
			const newX = playerPos.x + velocityX;
			const rightTop = this.screenToTile(newX + this.tileSize - 4, playerPos.y);
			const rightBottom = this.screenToTile(newX + this.tileSize - 4, playerPos.y + playerHeight - 1);
			let blocked = false;
			for (let ty = rightTop.y; ty <= rightBottom.y; ty++) {
				if (inBounds(rightTop.x, ty) && isSolid(this.currentMap.map[this.engine.coordsToIndex({x: rightTop.x, y: ty}, mapWidth)])) {
					blocked = true; break;
				}
			}
			if (!blocked) {
				if (playerPos.x < (this.engine.canvas.width / 2)) playerPos.x = newX;
				else this.mapOffset.x -= velocityX;
			}
		}
		
		if ((this.engine.keysPressed['ArrowUp'] || this.engine.keysPressed['KeyW'] || this.engine.keysPressed['Space']) && this.isOnGround) {
			this.velocityY = this.jumpPower; this.isOnGround = false;
			this.engine.playAudioOverlap(isTurbo ? audio["Player_Jump_Turbo"] : audio["Player_Jump"]);
		}
		
		if (playerPos.y > this.engine.canvas.height && this.state === Game_State.Playing) {
			this.killPlayer();
		}

		// --- 5. Dibujar el Sprite y Sincronizar ---
		if (shouldDrawPlayer) {
			const allPlayerSprites = [
				this.engine.animatedSprites[PlayerName[this.player]],
				this.engine.animatedSprites[PlayerName[this.player] + "_Big"],
				this.engine.animatedSprites[PlayerName[this.player] + "_Fire"]
			];

			allPlayerSprites.forEach(spriteToSync => {
				if (spriteToSync && spriteToSync !== player) {
					spriteToSync.position.x = player.position.x;
					if (isBig && spriteToSync.spriteName.indexOf("_") === -1) {
						spriteToSync.position.y = player.position.y + this.tileSize;
					} else if (!isBig && spriteToSync.spriteName.indexOf("_") !== -1) {
						spriteToSync.position.y = player.position.y - this.tileSize;
					} else {
						spriteToSync.position.y = player.position.y;
					}
					spriteToSync.flipped = player.flipped;
				}
			});

			this.engine.drawAnimatedSprite(currentSpriteName, Pivot.Top_Left);
		}
	}

	spawnScorePopup(text, x, y) {
		this.scorePopups.push({ text: text, x: x, y: y, timer: 90 });
	}

	updateAndDrawScorePopups() {
		for (let i = this.scorePopups.length - 1; i >= 0; i--) {
			const popup = this.scorePopups[i];
			popup.y -= 0.5;
			popup.timer--;
			this.engine.drawTextCustom(font, popup.text, this.textSize, Color.WHITE, {x: popup.x, y: popup.y}, "center");
			if (popup.timer <= 0) {
				this.scorePopups.splice(i, 1);
			}
		}
	}

	updateAndDrawLevelComplete(dt) {
		const player = this.engine.animatedSprites[PlayerName[this.player]];
		const playerPos = player.position;

		switch(this.levelCompleteState) {
			case 'sliding':
				player.flipped = true;
				this.engine.setAnimationForSprite(PlayerName[this.player], `${PlayerName[this.player]}_Slide`);
				const slideSpeed = 5;
				playerPos.y += slideSpeed;
				if (this.flagpoleFlag) {
					this.flagpoleFlag.y += slideSpeed;
				}
				if (playerPos.y >= this.flagpoleInfo.groundY) {
					playerPos.y = this.flagpoleInfo.groundY;
					player.flipped = false;
					playerPos.x += this.tileSize / 2;
					this.engine.setAnimationForSprite(PlayerName[this.player], `${PlayerName[this.player]}_Run`);
					this.engine.playAudio(audio["Level_Clear"], false);
					this.levelCompleteState = 'walking_to_castle';
				}
				break;
			case 'walking_to_castle':
				playerPos.x += 2;
				if (playerPos.x >= this.flagpoleInfo.castleDoorX && this.levelCompleteState !== 'finished') {
					this.playerIsVisible = false;
					this.levelCompleteState = 'finished';
					const nextWorldName = this.currentMap.nextWorld;
					if (nextWorldName) {
						this.startNextLevel(nextWorldName);
					} else {
						this.state = Game_State.Title_Menu;
					}
				}
				break;
		}

		if (this.flagpoleFlag) {
			const flagSprite = this.engine.sprites['Object_Flag'];
			if(flagSprite){
				 this.engine.drawSprite('Object_Flag', 0, this.flagpoleFlag, flagSprite.scale, false, 0, Pivot.Top_Left);
			}
		}

		if (this.playerIsVisible) {
			this.engine.drawAnimatedSprite(PlayerName[this.player], Pivot.Top_Left);
		}
	}

	spawnPowerup(x, y, type) {
		let powerup = {
			x: x - this.mapOffset.x,
			y: y,
			vx: type === Powerup_Type.Mushroom_Super ? 2.5 : 0, // Los hongos se mueven, las flores no
			vy: 0,
			type: type,
			state: "emerging",
			emergeCounter: this.tileSize
		};

		// Si el powerup es una flor, necesita un contador para su animación
		if (type === Powerup_Type.Fire_Flower) {
			powerup.animTimer = 0;
		}

		this.activePowerups.push(powerup);
		this.engine.playAudio(audio["Powerup_Appears"], false);
	}

	updatePowerups() {
		// Helper para no repetir código de colisión
		const isSolid = (blockId) => blockId > 0 && ![25, 12, 26].includes(blockId);
		
		for (let i = this.activePowerups.length - 1; i >= 0; i--) {
			const p = this.activePowerups[i];
			
			// --- 1. LÓGICA DE ESTADO (Salir del bloque) ---
			if (p.state === "emerging") {
				p.y -= 1;
				p.emergeCounter--;
				if (p.emergeCounter <= 0) {
					p.state = "moving";
				}
			} 
			// --- 2. FÍSICA Y MOVIMIENTO (Solo para el champiñón) ---
			else if (p.type === Powerup_Type.Mushroom_Super) {
				
				// A. Movimiento Vertical y Colisión con el Suelo
				p.vy += this.gravity;
				p.y += p.vy;
				
				const groundTile = this.screenToTile(p.x + this.tileSize / 2, p.y + this.tileSize);
				const groundIndex = this.engine.coordsToIndex(groundTile, this.currentMap.dimensions.width);

				if (isSolid(this.currentMap.map[groundIndex])) {
					p.y = this.tileToScreen(groundTile.x, groundTile.y).y - this.tileSize;
					p.vy = 0;
				}

				// B. Movimiento Horizontal y Colisión con Paredes
				p.x += p.vx;
				const wallCheckX = p.vx > 0 ? p.x + this.tileSize : p.x;
				// Comprobamos la colisión a media altura del champiñón
				const wallTile = this.screenToTile(wallCheckX, p.y + this.tileSize / 2);
				const wallIndex = this.engine.coordsToIndex(wallTile, this.currentMap.dimensions.width);
				
				if (isSolid(this.currentMap.map[wallIndex])) {
					p.vx *= -1; // Rebotar
				}
			}

			// --- 3. LÓGICA DE COLISIÓN CON EL JUGADOR ---
			const player = this.engine.animatedSprites[PlayerName[this.player]];
			const playerHeight = this.playerSize > Player_Size.Small ? this.tileSize * 2 : this.tileSize;
			const playerRect = { x: player.position.x, y: player.position.y, w: this.tileSize, h: playerHeight };

			const screenX = p.x + this.mapOffset.x;
			const powerupRect = { x: screenX, y: p.y, w: this.tileSize, h: this.tileSize };

			if (this.rectsOverlap(playerRect, powerupRect)) {
				switch (p.type) {
					case Powerup_Type.Mushroom_1UP:
						this.lives++;
						this.engine.playAudio(audio["Life"], false);
						break;
					case Powerup_Type.Mushroom_Super:
						if (this.playerSize === Player_Size.Small) {
							this.playerSize = Player_Size.Big;
							this.syncPlayerSpritesOnPowerup();
						}
						this.engine.playAudio(audio["Life"], false);
						break;
					case Powerup_Type.Fire_Flower:
						if (this.playerSize >= Player_Size.Big) {
							this.playerSize = Player_Size.Fire;
						} else {
							this.playerSize = Player_Size.Big;
						}
						this.syncPlayerSpritesOnPowerup();
						this.engine.playAudio(audio["Life"], false);
						break;
				}
				this.activePowerups.splice(i, 1);
				continue;
			}
		}
	}

	drawPowerups() {
		for (const p of this.activePowerups) {
			// Calculamos la posición X correcta en la pantalla.
			const screenX = p.x + this.mapOffset.x;

			let spriteToDraw = '';

			// Lógica de Dibujado
			switch (p.type) {
				case Powerup_Type.Mushroom_1UP: 
					spriteToDraw = 'Object_Mushroom_1UP'; 
					break;
				case Powerup_Type.Mushroom_Super: 
					spriteToDraw = 'Object_Mushroom_Super'; 
					break;
				case Powerup_Type.Fire_Flower:
					p.animTimer = (p.animTimer + 1) % 16;
					const frame = Math.floor(p.animTimer / 8);
					// <<< CAMBIO: Usamos screenX en lugar de p.x >>>
					this.engine.drawSprite('Object_Fire_Flower', frame, { x: screenX, y: p.y }, this.spriteScale, false, 0, Pivot.Top_Left);
					continue;
			}
			
			if (spriteToDraw) {
				this.engine.drawSprite(spriteToDraw, 0, { x: screenX, y: p.y }, this.spriteScale, false, 0, Pivot.Top_Left);
			}
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
		if (coinSprite) {
			const coinPos = { x: colWidth + paddingX + paddingX * 0.15, y: paddingY * 3 - this.textSize + paddingY * 0.15 };
			this.engine.drawSprite("UI_Coin", 0, coinPos, this.spriteScale / 1.8, false, 0, Pivot.Top_Left);
		}

		const coinText = String.fromCharCode('0x00D7') + this.coins.toString().padStart(2, "0");
		this.engine.drawTextCustom(font, coinText, this.textSize, "#ffffff", {x: colWidth + paddingX + 32, y: paddingY * 3}, "left");
		this.engine.drawTextCustom(font, "WORLD", this.textSize, "#ffffff", {x: colWidth * 2 + paddingX + colWidth / 2, y: paddingY * 2}, "center");

		if (this.currentMap && this.currentMap.world) {
			this.engine.drawTextCustom(font, ' ' + this.availableWorlds[this.currentWorldIndex], this.textSize, "#ffffff", {x: colWidth * 2 + paddingX + colWidth / 2 - this.textSize / 2, y: paddingY * 3}, "center");
		} else {
			this.engine.drawTextCustom(font, ' ' + this.currentMap.world, this.textSize, "#ffffff", {x: colWidth * 2 + paddingX + colWidth / 2 - this.textSize / 2, y: paddingY * 3}, "center");
		}

		this.engine.drawTextCustom(font, "TIME", this.textSize, "#ffffff", {x: this.engine.getCanvasWidth() - paddingX, y: paddingY * 2}, "right");
		this.engine.drawTextCustom(font, Math.floor(this.time).toString().padStart(3, "0"), this.textSize, "#ffffff", {x: this.engine.getCanvasWidth() - paddingX, y: paddingY * 3}, "right");
	}
}