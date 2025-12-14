const SPRITE_SIZE = 32;
const TILE_PIXEL_SIZE = 16;

const SPRITE_SCALE = 4;
const BASE_JUMP_POWER = -22;
const BASE_GRAVITY = 0.8;
const BASE_VELOCITY_GROUND = (TILE_PIXEL_SIZE * 9.10 / 16) * 60;
const BASE_VELOCITY_TURBO = (TILE_PIXEL_SIZE * 14.4 / 16) * 60;
const BASE_VELOCITY_SWIM = (TILE_PIXEL_SIZE * 17.6 / 16) * 60;

const TEXT_SIZE = 16;

const DEFAULT_LIVES = 1;
const DEFAULT_VOLUME = 0.2;

const TOUCH_CONTROLS = {
	PAD_RADIUS: 90,
	BUTTON_RADIUS: 60,
	PAD_INNER_RADIUS: 35,
	MARGIN: 50,
	BUTTON_SPACING: 30,
	PAD_THRESHOLD: 0.25,
	ALPHA_INACTIVE: 0.25,
	ALPHA_ACTIVE: 0.55,
	COLOR_BASE: 'rgba(255,255,255,0.35)',
	COLOR_ACTIVE: 'rgba(255,255,255,0.65)'
};

const COIN_SPIN_VELOCITY = 15;
const BLACK_SCREEN_DURATION = 2000;

const Game_State = {
	Title_Menu:		0,
	Pause:			1,
	Playing:		2,
	Player_Dying:	3,
	Black_Screen:	4,
	Level_Complete:	5,
	Editor:			6,
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
	'Block_Question',				// 	3
	'Block_Question_Used',			// 	4
	'Block_Pipe_Top_Left',			// 	5
	'Block_Pipe_Top_Right',			// 	6
	'Block_Pipe_Body_Left',			// 	7
	'Block_Pipe_Body_Right',		// 	8
	'Object_Coin',					// 	9
	'Enemy_Goomba',					// 10
	'Enemy_Koopa_Green',			// 11
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
	'Block_Question',				// 41 (Coin version)
	'Block_Pipe_Start_Top',			// 42
	'Block_Pipe_Start_Bottom',		// 43
	'Block_Pipe_Body_Top',			// 44
	'Block_Pipe_Body_Bottom',		// 45
	'Block_Pipe_End_Top',			// 46
	'Block_Pipe_End_Bottom',		// 47
	'Block_Pipe_Top_Center',		// 48
	'Block_Pipe_Body_Center',		// 49
	'Block_Pipe_End_Center',		// 50
];

class Game {
	engine = null;
	state = Game_State.Title_Menu;
	player = Player.Mario;
	playerSize = Player_Size.Small;
	currentMap = null;
	savedState = null;
	
	volume = DEFAULT_VOLUME;
	savedVolume = DEFAULT_VOLUME;
	
	score = 0;
	time = 0;
	lives = DEFAULT_LIVES;
	coins = 0;
	highscore = 0;

	growTimer = 0;
	invincibleTimer = 0;
	throwTimer = 0;
	skidTimer = 0;
	screenTimer = 0;

	currentSelection = 0;
	currentWorldIndex = 0;
	mapOffset = {x: 0, y: 0};
	tileScale = SPRITE_SCALE;
	tileSize = TILE_PIXEL_SIZE * this.tileScale;
	velocityY = 0;
	jumpPower = 0;
	gravity = 0;
	slideVelocityX = 0;
	
	isInvincible = false;
	isOnGround = true;
	isSwimming = true;	
	wasMovingTurbo = false;
	isThrowing = false;
	playerIsVisible = true;
	isSliding = false;

	levelCompleteState = 'none';
	flagpoleFlag = null;
	flagpoleInfo = null;

	availableWorlds = [];
	enemies = [];
	activeCoins = [];
	bumpingBlocks = [];
	activePowerups = [];
	scorePopups = [];
	brickParticles = [];
	activeFireballs = [];
	touchControls = null;
	virtualKeysState = {};
	virtualKeysDown = new Set();
	hardwareKeysDown = new Set();
	touchListenerDisposers = [];
	boundUpdateTouchLayout = null;
	boundResetTouchInput = null;
	boundHardwareKeyDown = null;
	boundHardwareKeyUp = null;

	fireballCooldown = 0;

	screenDuration = 0
	screenType = Black_Screen_Type.Start_Level;

	isEditorMode = false;
	editorCursorPos = { x: 0, y: 0 };
	selectedTileIndex = 0;
	editorPalette = [
        1,  // Suelo
        2,  // Ladrillo
        24, // Escalera (Piedra)
        3,  // ? (Powerup)
        41, // ? (Moneda)
        34, // ? (Multi Monedas)
        5, 6, 7, 8, // Tuberías Vertical
        13, // Bandera
        25, // Bloque Invisible
        10, // Goomba
        11, // Koopa Rojo
        12, // Koopa Verde
        12, // Planta Piraña
        42, 43, 44, 45, 46, 47, 48, 49, 50, // Tuberías Horizontal

    ];
	// editorPalette = BlockType;

	OVERWORLD_COLOR = "#5C94FC";
	UNDERGROUND_COLOR = "#000000";
	UNDERWATER_COLOR = "#5C94FC";
	CASTLE_COLOR = "#000000";

	velocityXGround = BASE_VELOCITY_GROUND;
	velocityXTurbo  = BASE_VELOCITY_TURBO;
	velocityXSwim   = BASE_VELOCITY_SWIM;


	constructor(engine, textSize, spriteScale = SPRITE_SCALE) {
		this.engine = engine;
		this.tileScale = spriteScale;
		this.tileSize = TILE_PIXEL_SIZE * this.tileScale;
		this.updatePhysicsScaling();
		this.specialBlocks = {};
		this.foregroundBlocks = [5, 6, 7, 8];
		
		this.availableWorlds = [...new Set(map.map(m => m.world))].sort();
		this.currentWorldIndex = 0;

		const savedHighscore = this.engine.getCookie("smb_highscore");
		this.highscore = savedHighscore ? parseInt(savedHighscore, 10) : 0;

		const savedVolume = this.engine.getCookie("smb_volume");
		this.volume = savedVolume !== null ? parseFloat(savedVolume) : DEFAULT_VOLUME;
		this.updateMusicVolume();

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

		if (typeof this.initializeTouchControls === 'function') {
			this.initializeTouchControls = this.initializeTouchControls.bind(this);
		}

		if (typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator?.maxTouchPoints > 0))) {
			if (typeof this.initializeTouchControls === 'function') {
				this.initializeTouchControls();
			} else {
				console.warn('[GAME] initializeTouchControls no disponible; controles táctiles deshabilitados.');
			}
		}

		let tilesetName = "Overworld_Tiles";
		const tileScale = this.tileScale;

		switch (this.currentMap?.type ?? World_Type.Overworld) {
			case World_Type.Underground:
				tilesetName = "Underground_Tiles";
				break;
			case World_Type.Overworld:
			default:
				tilesetName = "Overworld_Tiles";
				break;
		}

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

		js2d.defineSpriteFromTileset("Block_Question",				tilesetName, 0, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Object_Coinbox_Multiple",	tilesetName, 0, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Block_Question_Used",		tilesetName, 1, 1, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Twentyfive",			tilesetName, 2, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Object_Coin",					tilesetName, 7, 1, 3, tileScale);

		js2d.defineSpriteFromTileset("Block_Used",		tilesetName, 3, 1, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Invisible",	tilesetName, 15, 15, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Empty",		tilesetName, 15, 15, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Pipe_Start_Top", tilesetName, 4, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Start_Bottom", tilesetName, 5, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Body_Top", tilesetName, 8, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Body_Bottom", tilesetName, 9, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_End_Top", tilesetName, 6, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_End_Bottom", tilesetName, 7, 2, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Pipe_Top_Left", tilesetName, 0, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Top_Right", tilesetName, 1, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Body_Left", tilesetName, 2, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Body_Right", tilesetName, 3, 2, 1, tileScale);

		const sceneryTileset = "Overworld_Tiles";

		js2d.defineSpriteFromTileset("Block_Cloud_Top_Left", sceneryTileset, 0, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Top_Middle", sceneryTileset, 1, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Top_Right", sceneryTileset, 2, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Left", sceneryTileset, 3, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Middle", sceneryTileset, 4, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Right", sceneryTileset, 5, 4, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Bush_Left", sceneryTileset, 12, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Bush_Middle", sceneryTileset, 13, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Bush_Right", sceneryTileset, 14, 4, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Hill_Left", sceneryTileset, 6, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Middle_Hole_1", sceneryTileset, 7, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Middle", sceneryTileset, 8, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Middle_Hole_2", sceneryTileset, 9, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Right", sceneryTileset, 10, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Top", sceneryTileset, 11, 4, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Flagpole_Top", sceneryTileset, 0, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Flagpole", sceneryTileset, 1, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Flag", sceneryTileset, 2, 3, 1, tileScale);

		js2d.defineSpriteFromTileset("Object_Mushroom_Super", sceneryTileset, 0, 6, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Mushroom_1UP", sceneryTileset, 1, 6, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Fire_Flower", sceneryTileset, 0, 7, 4, tileScale);

		js2d.createAnimatedSprite("Mushroom_Super", "Object_Mushroom_Super", {x: 0, y: 0}, tileScale);
		js2d.createAnimatedSprite("Mushroom_1UP", "Object_Mushroom_1UP", {x: 0, y: 0}, tileScale);
		js2d.createAnimatedSprite("Fire_Flower", "Object_Fire_Flower", {x: 0, y: 0}, tileScale);
		js2d.createAnimatedSprite("Coin", "Object_Coin",  {x: 0, y: 0}, tileScale);

		js2d.createAnimatedSprite("UICoin", "UI_Coin",  {x: 0, y: 0}, TEXT_SIZE / this.tileSize);
		js2d.createAnimatedSprite("Cursor", "Cursor",  {x: 0, y: 0}, TEXT_SIZE / this.tileSize);

		js2d.addAnimationToSprite("Coin", "Coin_Shine", [0, 1, 2], true, 8);
		js2d.addAnimationToSprite("UICoin", "Coin_Score", [0, 1, 2], true, 8);
		
		js2d.setAnimationForSprite("Coin", "Coin_Shine");
		js2d.setAnimationForSprite("UICoin", "Coin_Score");
	}

	updatePhysicsScaling() {
		const scaleFactor = this.tileScale / SPRITE_SCALE;
		this.jumpPower = BASE_JUMP_POWER * scaleFactor;
		this.gravity = BASE_GRAVITY * scaleFactor;
		this.velocityXGround = BASE_VELOCITY_GROUND * scaleFactor;
		this.velocityXTurbo = BASE_VELOCITY_TURBO * scaleFactor;
		this.velocityXSwim = BASE_VELOCITY_SWIM * scaleFactor;
	}

	defineWorldSprites() {
		let tilesetName = "Overworld_Tiles";
		const tileScale = this.tileScale;

		switch (this.currentMap?.type ?? World_Type.Overworld) {
			case World_Type.Underground:
				tilesetName = "Underground_Tiles";
				break;
			case World_Type.Overworld:
			default:
				tilesetName = "Overworld_Tiles";
				break;
		}

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

		js2d.defineSpriteFromTileset("Block_Question",				tilesetName, 0, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Object_Coinbox_Multiple",	tilesetName, 0, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Block_Question_Used",		tilesetName, 1, 1, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Twentyfive",			tilesetName, 2, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Object_Coin",					tilesetName, 7, 1, 3, tileScale);

		js2d.defineSpriteFromTileset("Block_Used",		tilesetName, 3, 1, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Invisible",	tilesetName, 15, 15, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Empty",		tilesetName, 15, 15, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Pipe_Start_Top", tilesetName, 4, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Start_Bottom", tilesetName, 5, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Body_Top", tilesetName, 8, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Body_Bottom", tilesetName, 9, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_End_Top", tilesetName, 6, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_End_Bottom", tilesetName, 7, 2, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Pipe_Top_Left", tilesetName, 0, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Top_Right", tilesetName, 1, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Body_Left", tilesetName, 2, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Pipe_Body_Right", tilesetName, 3, 2, 1, tileScale);

		const sceneryTileset = "Overworld_Tiles";

		js2d.defineSpriteFromTileset("Block_Cloud_Top_Left", sceneryTileset, 0, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Top_Middle", sceneryTileset, 1, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Top_Right", sceneryTileset, 2, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Left", sceneryTileset, 3, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Middle", sceneryTileset, 4, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Right", sceneryTileset, 5, 4, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Bush_Left", sceneryTileset, 12, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Bush_Middle", sceneryTileset, 13, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Bush_Right", sceneryTileset, 14, 4, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Hill_Left", sceneryTileset, 6, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Middle_Hole_1", sceneryTileset, 7, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Middle", sceneryTileset, 8, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Middle_Hole_2", sceneryTileset, 9, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Right", sceneryTileset, 10, 4, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Hill_Top", sceneryTileset, 11, 4, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Flagpole_Top", sceneryTileset, 0, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Flagpole", sceneryTileset, 1, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Flag", sceneryTileset, 2, 3, 1, tileScale);

		js2d.defineSpriteFromTileset("Object_Mushroom_Super", sceneryTileset, 0, 6, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Mushroom_1UP", sceneryTileset, 1, 6, 1, tileScale);
		js2d.defineSpriteFromTileset("Object_Fire_Flower", sceneryTileset, 0, 7, 4, tileScale);

		js2d.createAnimatedSprite("Mushroom_Super", "Object_Mushroom_Super", {x: 0, y: 0}, tileScale);
		js2d.createAnimatedSprite("Mushroom_1UP", "Object_Mushroom_1UP", {x: 0, y: 0}, tileScale);
		js2d.createAnimatedSprite("Fire_Flower", "Object_Fire_Flower", {x: 0, y: 0}, tileScale);
		js2d.createAnimatedSprite("Coin", "Object_Coin",  {x: 0, y: 0}, tileScale);

		js2d.createAnimatedSprite("UICoin", "UI_Coin",  {x: 0, y: 0}, TEXT_SIZE / this.tileSize);
		js2d.createAnimatedSprite("Cursor", "Cursor",  {x: 0, y: 0}, TEXT_SIZE / this.tileSize);

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
		const x = Math.round(tx * this.tileSize + this.mapOffset.x);
		const y = Math.round(ty * this.tileSize + this.mapOffset.y - offsetY);
		return { x, y };
	}

	loadMap(name) {
		const mapData = map.find(m => m.world === name);

		if (mapData) {
			this.currentMap = JSON.parse(JSON.stringify(mapData));
			this.pristineMapData = JSON.parse(JSON.stringify(this.currentMap.map));
			console.info(`[GAME] Mapa cargado: ${name}`);

			this.defineWorldSprites();

			const mapPixelWidth = this.currentMap.dimensions.width * this.tileSize;
			const screenWidth = this.engine.getCanvasWidth();

			if (mapPixelWidth < screenWidth) {

				this.mapOffset.x = (screenWidth - mapPixelWidth) / 2;
			} else {

				this.mapOffset.x = 0;
			}

			this.mapOffset.y = 0;

			// No borrar!
			this.pristineMapData = JSON.parse(JSON.stringify(this.currentMap.map));

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

						const worldY = coords.y * this.tileSize + this.tileSize * 2;
						const screenPosX = this.tileToScreen(coords.x, coords.y).x + this.tileSize / 2;

						this.enemies.push({
							type: 'Pakkun', 
							color: enemyColor,
							x: (screenPosX - this.mapOffset.x),
							y: worldY,                         
							initialY: worldY,
							maxHeight: this.tileSize * 2,
							state: 'hiding',
							timer: 120
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
			console.error(`[GAME] No se pudo encontrar el mapa: ${name}`);
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
		this.transitionToBlackScreen(Black_Screen_Type.Start_Level, BLACK_SCREEN_DURATION);
	}

	damagePlayer() {
		if (this.isInvincible) return;

		if (this.playerSize > Player_Size.Small) {
			this.playerSize = Player_Size.Small;
			this.isInvincible = true;
			this.invincibleTimer = 1500;
			this.engine.playAudio(audio["Player_Pipe"], false);
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
				console.log(`[GAME] Nuevo highscore guardado: ${this.highscore}`);
			}

			if (this.score > this.highscore) {
				this.highscore = this.score;
			}

			this.stopAllMusic();

			const onDeathSoundEnd = () => {

				if (this.lives <= 0) {

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
			this.transitionToBlackScreen(Black_Screen_Type.Start_Level, BLACK_SCREEN_DURATION);
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
			console.error(`[GAME] El siguiente mundo "${nextWorldName}" no se encontró en la lista 'availableWorlds'.`);
			this.state = Game_State.Title_Menu;
			return;
		}

		this.currentWorldIndex = nextWorldIndex;
		this.playerIsVisible = true;
		
		this.resetLevelState();
		
		this.transitionToBlackScreen(Black_Screen_Type.Start_Level, BLACK_SCREEN_DURATION);
	}

	rectsOverlap(r1, r2) {
		return !(r1.x + r1.w < r2.x || r1.y + r1.h < r2.y || r1.x > r2.x + r2.w || r1.y > r2.y + r2.h);
	}

	updateMusicVolume() {
		this.engine.setMasterVolume(this.volume);
		this.engine.setCookie("smb_volume", this.volume, 365);

		if (typeof audio !== 'undefined') {
			Object.values(audio).forEach(sound => {
				if (sound) {
					sound.volume = this.volume;
				}
			});
		}
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
			} else if (enemy.type === 'Goomba' && enemy.state === 'stomped') {

				enemy.stompTimer++;
				if (enemy.stompTimer > 30) { this.enemies.splice(i, 1); continue; }
			} else if (enemy.type.includes('Koopa')) {

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
			}

			const enemyHeight = (enemy.type.includes('Koopa') && enemy.state === 'walking') ? this.tileSize * 1.5 : this.tileSize;

			let enemyScreenY = enemy.y;
			if (enemy.type === 'Pakkun') {
				 const mapHeight = this.currentMap.dimensions.height;
				 const offsetY = mapHeight * this.tileSize - this.engine.canvas.height;
				 // Aplicamos el offset para convertir coordenadas de mundo a pantalla
				 enemyScreenY = enemy.y + this.mapOffset.y - offsetY;
			}

			const enemyRect = { x: enemyScreenX, y: enemyScreenY, w: this.tileSize, h: enemyHeight };

			const isBig = this.playerSize > Player_Size.Small;
			const playerHeight = isBig ? this.tileSize * 2 : this.tileSize;
			const playerRect = { x: player.position.x, y: player.position.y, w: this.tileSize, h: playerHeight };

			if (this.rectsOverlap(playerRect, enemyRect)) {

				let isStomping = this.velocityY > 0 && (player.position.y + playerHeight) < (enemyRect.y + enemyHeight / 1.5);

				if (enemy.type === 'Pakkun') {
					isStomping = false;
				}

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
				} else {
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
			pakkunRedAnim.currentFrame = nextFrame;
		}

		for (const enemy of this.enemies) {

			const screenX = enemy.x + this.mapOffset.x;

			let spriteNameToDraw = enemy.type;

			if (enemy.color) {
				spriteNameToDraw = `${enemy.type}_${enemy.color}`;
			}

			if (enemy.type === 'Koopa' && enemy.isWinged) {
				 spriteNameToDraw = `Koopa_Winged_${enemy.color}`;
			}

			if (enemy.type === 'Pakkun') {

				const mapHeight = this.currentMap.dimensions.height;
				const offsetY = mapHeight * this.tileSize - this.engine.canvas.height;
				const screenY = enemy.y + this.mapOffset.y - offsetY;

				const baseSpriteName = `Enemy_Pakkun_${enemy.color}`;
				this.engine.drawSprite(
					baseSpriteName,
					pakkunGreenAnim.animations.Pakkun_Bite.frames[pakkunGreenAnim.currentFrame],

					{ x: screenX, y: screenY + this.tileSize },
					this.tileScale, 
					false, 0, 
					Pivot.Bottom_Left
				);
			} else {
				const animSprite = this.engine.animatedSprites[spriteNameToDraw];
				if (!animSprite) continue;

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

				if (enemy.state !== 'shell') {
					animSprite.position = { x: screenX, y: enemy.y };
					animSprite.flipped = enemy.vx > 0;
					this.engine.drawAnimatedSprite(spriteNameToDraw, Pivot.Top_Left);
				}
			}
		}
	}

	drawBlackScreen(){
		this.engine.drawRectangle(this.engine.getCanvasRectangle(), Color.BLACK);
		this.drawUI();
		const centerX = this.engine.getCanvasWidth() / 2;
		const centerY = this.engine.getCanvasHeight() / 2;

		switch (this.screenType) {
			case Black_Screen_Type.Start_Level:
				const worldPos = { x: centerX, y: centerY - this.tileSize * 2 };
				this.engine.drawTextCustom(font, `WORLD ${this.currentMap.world}`, TEXT_SIZE, Color.WHITE, worldPos, "center");
				
				const livesPos = { x: centerX + this.tileSize, y: centerY };
				this.engine.drawTextCustom(font, `${String.fromCharCode('0x00D7')} ${this.lives}`, TEXT_SIZE, Color.WHITE, livesPos, "center");
				
				const playerImagePos = { x: centerX - this.tileSize * 2, y: centerY - this.tileSize / 2 };
				const spriteName = "Player_" + PlayerName[this.player];
				const playerSprite = this.engine.sprites[spriteName];
				if(playerSprite) {
					this.engine.drawSprite(spriteName, 0, playerImagePos, this.tileScale, false, 0, Pivot.Top_Left);
				}
				break;

			case Black_Screen_Type.Game_Over:
				const gameOverPlayerPos = { x: centerX, y: centerY - this.tileSize };
				this.engine.drawTextCustom(font, PlayerName[this.player], TEXT_SIZE, Color.WHITE, gameOverPlayerPos, "center");
				const gameOverPos = { x: centerX, y: centerY };
				this.engine.drawTextCustom(font, "GAME OVER", TEXT_SIZE, Color.WHITE, gameOverPos, "center");
				break;
				
			case Black_Screen_Type.Time_Up:
				const timeUpPos = { x: centerX, y: centerY };
				this.engine.drawTextCustom(font, "TIME UP", TEXT_SIZE, Color.WHITE, timeUpPos, "center");
				break;
		}
	}

	drawMenu() {
		this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.OVERWORLD_COLOR);

		this.drawBackground();
		this.drawBlocks();
		this.drawForegroundBlocks();
		this.drawUI();

		const titleMaxY = 0.60;
		const titleSprite = this.engine.sprites["UI_Title_Image"];
		const titleImg = titleSprite.image;
		const titlePosX = this.engine.canvas.width / 2;
		const titlePosY = this.tileSize * 1.5;
		const titleScale = this.tileScale * this.engine.getCanvasHeight() * titleMaxY * 0.002;
		const titleWidth = titleImg.width * titleScale;
		const imgPos = { x: titlePosX - titleWidth / 2, y: titlePosY };
		this.engine.drawSprite(titleImg, 0, imgPos, titleScale, false, 0, Pivot.Top_Left);

		const menuButtons = [
			{ name: "MARIO GAME", action: () => { this.selectPlayer(Player.Mario); }},
			{ name: "LUIGI GAME", action: () => { this.selectPlayer(Player.Luigi); }},
		];
		if(this.savedState){
			menuButtons.push({ name: "CONTINUE", action: () => { this.continueGame(); } });
		}

		const executeMenuSelection = () => {
			const selection = menuButtons[this.currentSelection];
			if (selection?.action) {
				selection.action();
			}
		};

		const numButtons = menuButtons.length;
		const menuGap = this.engine.canvas.height * 0.1 / numButtons;
		const getMenuSelectionFromPointer = () => {
			const mousePos = this.engine.getMousePosition();
			if (!mousePos) return this.currentSelection;
			let closestIndex = this.currentSelection;
			let closestDistance = Infinity;
			for (let i = 0; i < numButtons; i++) {
				const menuPosY = this.engine.canvas.height * titleMaxY + menuGap * i + menuGap / 2 + TEXT_SIZE;
				const distance = Math.abs(mousePos.y - menuPosY);
				if (distance < closestDistance) {
					closestDistance = distance;
					closestIndex = i;
				}
			}
			return closestIndex;
		};
		const handlePrimaryPress = () => {
			this.currentSelection = getMenuSelectionFromPointer();
			executeMenuSelection();
		};
		if(this.engine.keysPressed['ArrowUp'] || this.engine.keysPressed['KeyW']){
			this.engine.keysPressed = [];
			this.currentSelection--;
		}
		if(this.engine.keysPressed['ArrowDown'] || this.engine.keysPressed['KeyS']){
			this.engine.keysPressed = [];
			this.currentSelection++;
		}

		if(this.engine.keysPressed['ArrowLeft'] || this.engine.keysPressed['KeyA']){
			this.engine.keysPressed['ArrowLeft'] = false;
			this.engine.keysPressed['KeyA'] = false;
			this.currentWorldIndex--;
		}
		if(this.engine.keysPressed['ArrowRight'] || this.engine.keysPressed['KeyD']){
			this.engine.keysPressed['ArrowRight'] = false;
			this.engine.keysPressed['KeyD'] = false;
			this.currentWorldIndex++;
		}

		const worldCount = this.availableWorlds.length;
		this.currentWorldIndex = ((this.currentWorldIndex % worldCount) + worldCount) % worldCount;

		if (this.engine.keysPressed['KeyN']) {
			this.engine.keysPressed['KeyN'] = false;
			this.volume = Math.min(1, this.volume + 0.1);
			this.engine.setMasterVolume(this.volume);
		}
		if (this.engine.keysPressed['KeyB']) {
			this.engine.keysPressed['KeyB'] = false;
			this.volume = Math.max(0, this.volume - 0.1);
			this.engine.setMasterVolume(this.volume);
		}
		if (this.engine.keysPressed['KeyM']) {
			this.engine.keysPressed['KeyM'] = false;
			if (this.volume > 0) {
				this.savedVolume = this.volume;
				this.volume = 0;
			} else {
				this.volume = this.savedVolume;
			}
			this.updateMusicVolume();
		}

		if(this.engine.keysPressed['Enter'] || this.engine.keysPressed['Space']){
			handlePrimaryPress();
			delete this.engine.keysPressed['Enter'];
			delete this.engine.keysPressed['Space'];
		}

		if (this.engine.mouseButtons[0]) {
			handlePrimaryPress();
			this.engine.mouseButtons[0] = false;
		}

		this.currentSelection = ((this.currentSelection % numButtons) + numButtons) % numButtons;
		for(let i = 0; i < numButtons; i++){
			const menuPosY = this.engine.canvas.height * titleMaxY + menuGap * i + menuGap / 2 + TEXT_SIZE;
			const textPos = { x: this.engine.getCanvasWidth() / 2, y: menuPosY };
			const buttonLabel = menuButtons[i].name;
			const textWidth = this.engine.measureTextCustom(font, buttonLabel, TEXT_SIZE);
			if(this.currentSelection === i){
				const textLeft = textPos.x - textWidth / 2;
				const cursorOffset = this.tileSize * 1.5;
				const cursorPos = { x: textLeft - cursorOffset, y: menuPosY - SPRITE_SIZE / 2 };
				if(this.engine.sprites["Cursor"]) {
					this.engine.drawSprite("Cursor", 0, cursorPos, this.engine.sprites["Cursor"].scale, false, 0, Pivot.Top_Left);
				}
			}
			this.engine.drawTextCustom(font, buttonLabel, TEXT_SIZE, "#ffffff", textPos, "center");
		}

		const topScore = "TOP - " + this.highscore.toString().padStart(6, "0");
		const topScorePos = {
			x: this.engine.getCanvasWidth() / 2,
			y: this.engine.canvas.height * 0.65 + menuGap * numButtons + menuGap / 2 + TEXT_SIZE
		};
		this.engine.drawTextCustom(font, topScore, TEXT_SIZE, "#ffffff", topScorePos, "center");

		const volumePercentage = Math.round(this.volume * 100);
		const volumeText = `VOL ${volumePercentage}%`;
		const volumePos = {
			x: 20,
			y: this.engine.getCanvasHeight() - 20
		};
		this.engine.drawTextCustom(font, volumeText, TEXT_SIZE, Color.WHITE, volumePos, "left");
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
					this.engine.drawSprite(spriteName, 0, drawPos, this.tileScale, false, 0, Pivot.Top_Left);
				}
			}
		}
	}

	drawBackground() {
		switch(this.currentMap?.type ?? World_Type.Overworld) {
			case World_Type.Overworld:
				this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.OVERWORLD_COLOR);

				const parallaxSpeedClouds = 0.5;
				const parallaxSpeedHills = 0.8;
				const parallaxSpeedBushes = 1;

				const offsetX = this.mapOffset.x;
				const numObjects = Math.ceil(this.currentMap.dimensions.width * 0.35);
				const groundY = this.engine.canvas.height - this.tileSize * 2;

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
						spriteName = this.specialBlocks[i]?.revealed ? 'Block_Question' : 'Block_Brick';
						break;
					case World_Type.Underground:
						spriteName = this.specialBlocks[i]?.revealed ? 'Block_Question' : 'Block_Brick_Underground';
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

	spawnFireball() {

		if (this.fireballCooldown > 0) return;

		this.fireballCooldown = 30;

		const fireSprite = this.engine.animatedSprites[PlayerName[this.player] + "_Fire"];
		if (!fireSprite) return;

		const startX = fireSprite.position.x + (fireSprite.flipped ? -this.tileSize / 2 : this.tileSize);
		const startY = fireSprite.position.y + this.tileSize / 2;

		const fireball = {
			x: startX - this.mapOffset.x,
			y: startY,
			vx: 10 * (fireSprite.flipped ? -1 : 1),
			vy: 0,
			state: 'moving',
			animTimer: 0
		};

		this.activeFireballs.push(fireball);
		this.engine.playAudioOverlap(audio["Player_Fireball"]);

		this.isThrowing = true;
		this.throwTimer = 15;
	}

	updateAndDrawFireballs() {
		for (let i = this.activeFireballs.length - 1; i >= 0; i--) {
			const fb = this.activeFireballs[i];
			const screenPos = { x: fb.x + this.mapOffset.x, y: fb.y };

			if (fb.state === 'exploding') {
				const hitSprite = this.engine.animatedSprites["Fireball"];
				hitSprite.position = screenPos;
				
				if (fb.animTimer === 0) {

					this.engine.setAnimationForSprite("Fireball", "Explode", true);
				}

				this.engine.drawAnimatedSprite("Fireball", Pivot.Center);

				fb.animTimer++;
				const explosionAnim = hitSprite.animations.Explode;

				if (explosionAnim) {
					const explosionDuration = explosionAnim.frames.length * explosionAnim.frameSpeed;
					if (fb.animTimer > explosionDuration) {
						this.activeFireballs.splice(i, 1);
					}
				} else {

					if (fb.animTimer > 15) {
						this.activeFireballs.splice(i, 1);
					}
				}
				continue;
			}

			fb.vy += this.gravity * 0.8;
			fb.x += fb.vx;
			fb.y += fb.vy;

			const groundTile = this.screenToTile(screenPos.x, fb.y + SPRITE_SIZE / 2);
			if (this.currentMap.map[this.engine.coordsToIndex(groundTile, this.currentMap.dimensions.width)] > 0) {
				fb.y = this.tileToScreen(groundTile.x, groundTile.y).y - SPRITE_SIZE / 2;
				fb.vy = -8;
			}

			const wallTile = this.screenToTile(screenPos.x + (fb.vx > 0 ? SPRITE_SIZE : 0), fb.y);
			if (this.currentMap.map[this.engine.coordsToIndex(wallTile, this.currentMap.dimensions.width)] > 0 || screenPos.x < 0 || screenPos.x > this.engine.getCanvasWidth()) {
				fb.state = 'exploding';
				this.engine.playAudioOverlap(audio["Player_Bump"]);
				continue;
			}

			for (let j = this.enemies.length - 1; j >= 0; j--) {
				const enemy = this.enemies[j];
				if (enemy.state === 'stomped' || enemy.state === 'shell') continue;
				
				const enemyScreenX = enemy.x + this.mapOffset.x;
    			const enemyHeight = (enemy.type.includes('Koopa') && enemy.state === 'walking') ? this.tileSize * 1.5 : this.tileSize;
    			let enemyScreenY = enemy.y;
    
			    if (enemy.type === 'Pakkun') {
			        const mapHeight = this.currentMap.dimensions.height;
			        const offsetY = mapHeight * this.tileSize - this.engine.canvas.height;
			        // Convertir coordenada de mundo a pantalla
			        enemyScreenY = enemy.y + this.mapOffset.y - offsetY;
			    }

				const enemyRect = { x: enemyScreenX, y: enemyScreenY, w: this.tileSize, h: enemyHeight };
				const fbRect = { x: screenPos.x, y: screenPos.y, w: SPRITE_SIZE, h: SPRITE_SIZE };

				if (this.rectsOverlap(fbRect, enemyRect)) {
					this.score += 200;
					this.spawnScorePopup("200", enemyScreenX, enemy.y);
					this.enemies.splice(j, 1);
					fb.state = 'exploding';
					this.engine.playAudioOverlap(audio["Player_Bump"]);
					break; 
				}
			}

			if (fb.state === 'moving') {

				const moveSprite = this.engine.animatedSprites["Fireball_Hit"];
				moveSprite.position = screenPos;
				
				this.engine.drawAnimatedSprite("Fireball_Hit", Pivot.Center);
			}
		}
	}
	
	spawnCoin(x, y) {
		const coin = {
			x: (x - this.mapOffset.x) + (this.tileSize / 4),

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

			coin.y += coin.vY;
			coin.vY += 0.8;
			coin.timer++;

			if (coin.timer > 30) {
				this.activeCoins.splice(i, 1);
			}
		}

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

			const screenX = coin.x + this.mapOffset.x;

			coin.rotation = (coin.rotation + COIN_SPIN_VELOCITY) % 360;

			this.engine.drawSprite(
				"Object_Coin", 
				coinSprite.currentFrame, 
				{ x: screenX, y: coin.y }, 
				this.tileScale, 
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
				if (block.originalId === 3 || block.originalId === 41) {
					finalId = 4; // Block_Used
				} else if (block.originalId === 34) { // Super
					finalId = (this.specialBlocks[block.mapIndex]?.coinsLeft === 0) ? 4 : 34;
				} else if (block.originalId === 25) { // 1UP
					finalId = 35; // Question_Used
				}

				this.currentMap.map[block.mapIndex] = finalId;
				this.bumpingBlocks.splice(i, 1);
				continue;
			}
			let spriteNameToDraw = BlockType[block.originalId];
			if (block.originalId === 34) {
				if (this.specialBlocks[block.mapIndex]?.coinsLeft === 0) {
					spriteNameToDraw = (this.currentMap.type === World_Type.Overworld) ? 'Block_Question_Used' : 'Block_Question_Used';
				} else {
					spriteNameToDraw = (this.currentMap.type === World_Type.Overworld) ? 'Block_Question' : 'Block_Question';
				}
			}
			const spriteData = this.engine.sprites[spriteNameToDraw];
			if (spriteData) {
				this.engine.drawSprite(spriteNameToDraw, 0, { x: block.x, y: block.y }, spriteData.scale, false, 0, Pivot.Top_Left);
			}
		}
	}

	spawnBrickParticles(x, y) {

		const velocities = [
			{ vx: -4, vy: -15 },
			{ vx: 4, vy: -15 }, 
			{ vx: -3, vy: -8 },  
			{ vx: 3, vy: -8 }   
		];

		velocities.forEach(vel => {
			this.brickParticles.push({
				x: x + this.tileSize / 2,
				y: y + this.tileSize / 2,
				vx: vel.vx,
				vy: vel.vy,
				lifespan: 60
			});
		});

		this.engine.playAudioOverlap(audio["Brick_Break"]);
	}

	updateAndDrawBrickParticles() {

		for (let i = this.brickParticles.length - 1; i >= 0; i--) {
			const p = this.brickParticles[i];

			p.vy += this.gravity * 1.5;
			p.x += p.vx;
			p.y += p.vy;
			p.lifespan--;

			const particleSize = this.tileSize / 4;
			this.engine.drawRectangle(
				{ x: p.x, y: p.y, width: particleSize, height: particleSize }, 
				"#D99B59"
			);

			if (p.lifespan <= 0) {
				this.brickParticles.splice(i, 1);
			}
		}
	}

	drawPlayer(name, dt) {

		let currentSpriteName;
		const isBig = this.playerSize > Player_Size.Small;

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
		const isSolid = (blockId) => blockId > 0 && ![25, 12, 26].includes(blockId);


			let isCrouching = false;
			const oldPlayerHeight = isBig ? (this.wasCrouching ? this.tileSize : this.tileSize * 2) : this.tileSize;

			if (isBig) {
				const isPressingCrouchKey = this.engine.keysPressed['KeyS'];
				const checkPos = { x: playerPos.x + this.tileSize / 2, y: playerPos.y - 1 };
				const tileAbove = this.screenToTile(checkPos.x, checkPos.y);
				const mapIndex = this.engine.coordsToIndex(tileAbove, this.currentMap.dimensions.width);
				const ceilingBlocksStand = isSolid(this.currentMap.map[mapIndex]);
				
				isCrouching = isPressingCrouchKey || (!isPressingCrouchKey && this.wasCrouching && ceilingBlocksStand);
			}
			
			let playerHeight = isBig ? (isCrouching ? this.tileSize : this.tileSize * 2) : this.tileSize;


			if (oldPlayerHeight < playerHeight) {
				playerPos.y -= (playerHeight - oldPlayerHeight);
			}
			this.wasCrouching = isCrouching;

			const dt_sec = dt / 1000;

			if (this.isInvincible) {
				this.invincibleTimer -= dt;
				if (this.invincibleTimer <= 0) this.isInvincible = false;
			}
			const shouldDrawPlayer = !this.isInvincible || Math.floor(this.invincibleTimer / 100) % 2 === 0;

			if (this.state === Game_State.Player_Dying) {

				this.deathTimer += dt;
				const deathAnimDuration = 400;
				const maxScaleMultiplier = 1.5;
				const progress = Math.min(1, this.deathTimer / deathAnimDuration);
				const newScale = this.tileScale + (this.tileScale * (maxScaleMultiplier - 1) * progress);
				const newWidth = SPRITE_SIZE * newScale;
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

			const mapWidth = this.currentMap.dimensions.width;
			const inBounds = (x, y) => x >= 0 && x < mapWidth;
			
			this.velocityY += this.gravity;
			const newY = playerPos.y + this.velocityY;

			// Colisión con techo
			if (this.velocityY < 0) {

				const headCenterTile = this.screenToTile(playerPos.x + this.tileSize / 2, newY);
				let hitCeiling = false;
				if (inBounds(headCenterTile.x, headCenterTile.y)) {
					const idx = this.engine.coordsToIndex(headCenterTile, mapWidth);
					this.handleCoinCollision(idx); 
					const blockId = this.currentMap.map[idx] || 0;
					if (isSolid(blockId) || blockId === 25) {
						const { x: blockX, y: blockY } = this.tileToScreen(headCenterTile.x, headCenterTile.y);
						let blockSoundPlayed = false;

						if (blockId === 2 || blockId === 27) { // Brick / Brick_Middle
							const idxAbove = idx - mapWidth;
							if (this.currentMap.map[idxAbove] === 9) { // Moneda
								this.currentMap.map[idxAbove] = 0;

								this.coins++;
								this.score += 200;

								this.spawnCoin(blockX, blockY - this.tileSize); 
								this.engine.playAudioOverlap(audio["Coin"]);
							}
						}

						const isBreakableBrick = (blockId === 2 || blockId === 27);
						const canPlayerBreakBrick = this.playerSize > Player_Size.Small;

						if (isBreakableBrick && canPlayerBreakBrick) {
							this.currentMap.map[idx] = 0;
							this.spawnBrickParticles(blockX, blockY);
							this.score += 50;
							this.spawnScorePopup("50", blockX + this.tileSize / 2, blockY);


						} else {
							let blockSoundPlayed = false;

							if (blockId === 34) {
								if (!this.specialBlocks[idx]) { this.specialBlocks[idx] = { coinsLeft: 10, revealed: true }; }
								if (this.specialBlocks[idx].coinsLeft > 0) {
									this.specialBlocks[idx].coinsLeft--; this.coins++; this.spawnCoin(blockX, blockY);
									this.engine.playAudioOverlap(audio["Coin"]); blockSoundPlayed = true;
								}
							} else if (blockId === 41) {
								this.spawnCoin(blockX, blockY);
								this.engine.playAudioOverlap(audio["Coin"]); blockSoundPlayed = true;
							} else if (blockId === 3) {
								const powerupType = isBig ? Powerup_Type.Fire_Flower : Powerup_Type.Mushroom_Super;
								this.spawnPowerup(blockX, blockY, powerupType);
							} else if (blockId === 25) {
								this.spawnPowerup(blockX, blockY, Powerup_Type.Mushroom_1UP);
							}

							const isAlreadyBumping = this.bumpingBlocks.some(b => b.mapIndex === idx);
							const justExhausted = (blockId === 34 && this.specialBlocks[idx]?.coinsLeft === 0);

							if (!isAlreadyBumping && !justExhausted) {
								this.bumpingBlocks.push({ x: blockX, y: blockY, originalY: blockY, vY: -6, mapIndex: idx, originalId: blockId });
								this.currentMap.map[idx] = 0;
							}

							if (!blockSoundPlayed) {
								this.engine.playAudioOverlap(audio["Player_Bump"]);
							}
						}

						this.velocityY = 0; playerPos.y = this.tileToScreen(headCenterTile.x, headCenterTile.y + 1).y; hitCeiling = true;
					}
				}
				if (!hitCeiling) playerPos.y = newY;
			}
			else {

				const bottomLeft = this.screenToTile(playerPos.x + 4, newY + playerHeight);
				const bottomRight = this.screenToTile(playerPos.x + this.tileSize - 4, newY + playerHeight);
				let foundGround = false;
				for (let tx = bottomLeft.x; tx <= bottomRight.x; tx++) {
					if (inBounds(tx, bottomLeft.y)) {
						const idx = this.engine.coordsToIndex({x: tx, y: bottomLeft.y}, mapWidth);
						this.handleCoinCollision(idx);
						if (isSolid(this.currentMap.map[idx])) {
							playerPos.y = this.tileToScreen(tx, bottomLeft.y).y - playerHeight;
							this.isOnGround = true; this.velocityY = 0; foundGround = true; break;
						}
					}
				}
				if (!foundGround) { this.isOnGround = false; playerPos.y = newY; }
			}


			if (this.fireballCooldown > 0) this.fireballCooldown--;
			if (this.throwTimer > 0) this.throwTimer--; else this.isThrowing = false;

			const isShooting = this.engine.keysPressed['ControlLeft'] || this.engine.keysPressed['ControlRight'] || this.engine.keysPressed['Space'];
			if (isShooting && this.playerSize === Player_Size.Fire && !this.isThrowing) {
				this.spawnFireball();

				this.engine.keysPressed['ControlLeft'] = false;
				this.engine.keysPressed['ControlRight'] = false;
			}

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

				if (isBig && isCrouching && isMoving && this.isOnGround && !this.isSliding) {
				this.isSliding = true;
				// Usamos la velocidad turbo como base para un deslizamiento más satisfactorio
				const initialSpeed = this.velocityXTurbo * dt_sec; 
				this.slideVelocityX = player.flipped ? -initialSpeed : initialSpeed;
				this.engine.playAudioOverlap(audio["Player_Skid"]);
			}

			// 2. Lógica de físicas MIENTRAS se está deslizando
			if (this.isSliding) {
				// Aplicar fricción para frenar
				this.slideVelocityX *= 0.96; 
				const newX = playerPos.x + this.slideVelocityX;

				// Comprobar colisión con paredes
				const checkTileX = this.slideVelocityX > 0 ? newX + this.tileSize - 4 : newX + 4;
				const wallTile = this.screenToTile(checkTileX, playerPos.y + playerHeight / 2);
				if (inBounds(wallTile.x, wallTile.y) && isSolid(this.currentMap.map[this.engine.coordsToIndex(wallTile, mapWidth)])) {
					this.slideVelocityX = 0; // Detenerse en seco si choca
				} else {
					// Mover al jugador (replicando la lógica de la cámara)
					if (this.slideVelocityX > 0) { // Deslizando a la derecha
						if (playerPos.x < (this.engine.canvas.width / 2)) playerPos.x = newX;
						else this.mapOffset.x -= this.slideVelocityX;
					} else { // Deslizando a la izquierda
						playerPos.x = newX;
					}
				}
				
				// Condiciones para DETENER el deslizamiento
				const ceilingCheckPos = { x: playerPos.x + this.tileSize / 2, y: playerPos.y - 1 };
				const tileAbove = this.screenToTile(ceilingCheckPos.x, ceilingCheckPos.y);
				const isBlockedByCeiling = isSolid(this.currentMap.map[this.engine.coordsToIndex(tileAbove, mapWidth)]);
				
				// Se detiene si la velocidad es muy baja, si deja de estar en el suelo, o si suelta la tecla y no hay un techo
				if (Math.abs(this.slideVelocityX) < 1 || !this.isOnGround || (!isCrouching && !isBlockedByCeiling)) {
					this.isSliding = false;
					this.slideVelocityX = 0;
				}
			}

			const animPrefix = PlayerName[this.player] + (this.playerSize === Player_Size.Fire ? "_Fire" : (isBig ? "_Big" : ""));
			if (isCrouching) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Crouch`);
			else if (this.isThrowing) { this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Shoot`); } 
			else if (this.velocityY < 0 && !this.isOnGround) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Jump`);
			else if (this.velocityY > this.gravity && !this.isOnGround) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Fall`);
			else if (this.skidTimer > 0) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Stop`);
			else if (isMoving) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Run`);
			else this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Idle`);
			const velocityX = (isTurbo ? this.velocityXTurbo : this.velocityXGround) * dt_sec;
			if (!isCrouching) {
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
						const tileCoords = { x: rightTop.x, y: ty };
						const mapIndex = this.engine.coordsToIndex(tileCoords, mapWidth);
						const blockId = this.currentMap.map[mapIndex];
						this.handleCoinCollision(mapIndex);
						if (blockId === 13) {
							const poleCoords = this.tileToScreen(tileCoords.x, tileCoords.y);
							playerPos.x = poleCoords.x - this.tileSize / 2;
							let groundYTile = ty;
							while (this.currentMap.map[this.engine.coordsToIndex({x: tileCoords.x, y: groundYTile + 1}, mapWidth)] === 13) {
								groundYTile++;
							}
							const finalLandingY = this.tileToScreen(tileCoords.x, groundYTile + 1).y - playerHeight + this.tileSize;
							this.flagpoleInfo = { topY: poleCoords.y, groundY: finalLandingY, castleDoorX: poleCoords.x + this.tileSize * 5 };
							this.flagpoleFlag = { x: poleCoords.x - this.tileSize / 2, y: playerPos.y };
							this.state = Game_State.Level_Complete; this.levelCompleteState = 'none'; 
							return;
						}
						if (inBounds(rightTop.x, ty) && isSolid(this.currentMap.map[this.engine.coordsToIndex({x: rightTop.x, y: ty}, mapWidth)])) {
							blocked = true;
							break;
						}
					}
					if (!blocked) { if (playerPos.x < (this.engine.canvas.width / 2)) playerPos.x = newX; else this.mapOffset.x -= velocityX; }
				}
			}
			if ((this.engine.keysPressed['ArrowUp'] || this.engine.keysPressed['KeyW']) && this.isOnGround) { this.velocityY = this.jumpPower; this.isOnGround = false; this.engine.playAudioOverlap(isTurbo ? audio["Player_Jump_Turbo"] : audio["Player_Jump"]); }
			
			// Verificar si el jugador cayó del mapa (usando coordenadas de mundo)
			const playerTile = this.screenToTile(playerPos.x + this.tileSize / 2, playerPos.y + this.tileSize / 2);
			if ((playerTile.y >= this.currentMap.dimensions.height || playerPos.y > this.engine.canvas.height + this.tileSize * 2) && this.state === Game_State.Playing) { 
				this.killPlayer(); 
			}


		if (shouldDrawPlayer) {
			const allPlayerSprites = [ this.engine.animatedSprites[PlayerName[this.player]], this.engine.animatedSprites[PlayerName[this.player] + "_Big"], this.engine.animatedSprites[PlayerName[this.player] + "_Fire"] ];
			allPlayerSprites.forEach(spriteToSync => {
				if (spriteToSync && spriteToSync !== player) {
					spriteToSync.position.x = player.position.x;
					spriteToSync.position.y = player.position.y;
					spriteToSync.flipped = player.flipped;
				}
			});


			const originalY = player.position.y;


			if (isBig && isCrouching) {
				player.position.y -= this.tileSize;
			}

			this.engine.drawAnimatedSprite(currentSpriteName, Pivot.Top_Left);

			player.position.y = originalY;

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
			this.engine.drawTextCustom(font, popup.text, TEXT_SIZE, Color.WHITE, {x: popup.x, y: popup.y}, "center");
			if (popup.timer <= 0) {
				this.scorePopups.splice(i, 1);
			}
		}
	}

	updateAndDrawLevelComplete(dt) {

		let currentSpriteName;
		const isBig = this.playerSize > Player_Size.Small;

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

                const playerPos = player.position;
                const slideSpeed = 5;
                const playerHeight = isBig ? this.tileSize * 2 : this.tileSize;

                switch(this.levelCompleteState) {
                    case 'none':
                        this.stopAllMusic();
                        this.engine.playAudio(audio["Flagpole"], false);

                        const poleHeight = this.flagpoleInfo.groundY - this.flagpoleInfo.topY + playerHeight;
                        const playerHeightOnPole = this.flagpoleInfo.groundY - playerPos.y + playerHeight;
                        
                        const heightPercentage = Math.max(0, Math.min(1, playerHeightOnPole / poleHeight));

				let points = 100;

				if (heightPercentage >= 0.95) {
					points = 5000;
				} else if (heightPercentage >= 0.80) {
					points = 2000;
				} else if (heightPercentage >= 0.50) {
					points = 800;
				} else if (heightPercentage >= 0.25) {
					points = 400;
				} else {
					points = 100;
				}

				this.score += points;
				this.spawnScorePopup(points.toString(), playerPos.x + this.tileSize, playerPos.y);
				
				player.flipped = true;
				
				const animPrefix = PlayerName[this.player] + (this.playerSize === Player_Size.Fire ? "_Fire" : (isBig ? "_Big" : ""));
				this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Slide`);

				this.levelCompleteState = 'sliding';
				break;

			case 'sliding':
				playerPos.y += slideSpeed;
				if (this.flagpoleFlag) {
					this.flagpoleFlag.y += slideSpeed;
				}

				if (playerPos.y >= this.flagpoleInfo.groundY) {
					playerPos.y = this.flagpoleInfo.groundY;
					player.flipped = false;
					playerPos.x += this.tileSize / 2;

					const runAnimPrefix = PlayerName[this.player] + (this.playerSize === Player_Size.Fire ? "_Fire" : (isBig ? "_Big" : ""));
					this.engine.setAnimationForSprite(currentSpriteName, `${runAnimPrefix}_Run`);
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

			this.engine.drawAnimatedSprite(currentSpriteName, Pivot.Top_Left);
		}
	}

	updateAndDrawGrowingPlayer(dt) {
		const GROW_DURATION = 800;
		const NUM_FLASHES = 6;    
		this.growTimer += dt;

		const smallSprite = this.engine.animatedSprites[PlayerName[this.player]];
		const bigSprite = this.engine.animatedSprites[PlayerName[this.player] + "_Big"];
		if (!smallSprite || !bigSprite) return;

		const flashDuration = GROW_DURATION / NUM_FLASHES;
		const currentFlash = Math.floor(this.growTimer / flashDuration);

		bigSprite.flipped = smallSprite.flipped;



		if (currentFlash % 2 === 0) {

			this.engine.drawAnimatedSprite(PlayerName[this.player], Pivot.Top_Left);
		} else {

			const bigSpritePos = {
				x: smallSprite.position.x,
				y: smallSprite.position.y - this.tileSize
			};

			this.engine.drawSprite(bigSprite.spriteName, 0, bigSpritePos, bigSprite.scale, bigSprite.flipped, 0, Pivot.Top_Left);
		}

		if (this.growTimer >= GROW_DURATION) {
			this.playerSize = Player_Size.Big;
			this.syncPlayerSpritesOnPowerup();
			this.state = Game_State.Playing;

		}
	}

	spawnPowerup(x, y, type) {
		let powerup = {
			x: x - this.mapOffset.x,
			y: y,
			vx: (type === Powerup_Type.Mushroom_Super || type === Powerup_Type.Mushroom_1UP) ? 2.5 : 0,
			vy: 0,
			type: type,
			state: "emerging",
			emergeCounter: this.tileSize
		};

		if (type === Powerup_Type.Fire_Flower) {
			powerup.animTimer = 0;
		}

		this.activePowerups.push(powerup);
		this.engine.playAudio(audio["Powerup_Appears"], false);
	}

	handleCoinCollision = (idx) => {
		if (this.currentMap.map[idx] === 9) {
			this.currentMap.map[idx] = 0;
			this.coins++;
			this.score += 200;
			this.engine.playAudioOverlap(audio["Coin"]);
			return true;
		}
		return false;
	};

	updatePowerups() {
		const isSolid = (blockId) => blockId > 0 && ![25, 12, 26].includes(blockId);
		
		for (let i = this.activePowerups.length - 1; i >= 0; i--) {
			const p = this.activePowerups[i];

			if (p.state === "emerging") {
				p.y -= 1;
				p.emergeCounter--;
				if (p.emergeCounter <= 0) {
					p.state = "moving";
				}
			} 

			else if (p.type === Powerup_Type.Mushroom_Super || p.type === Powerup_Type.Mushroom_1UP) {

				p.vy += this.gravity;
				p.y += p.vy;

				const groundScreenX = (p.x + this.tileSize / 2) + this.mapOffset.x;
				const groundTile = this.screenToTile(groundScreenX, p.y + this.tileSize);
				const groundIndex = this.engine.coordsToIndex(groundTile, this.currentMap.dimensions.width);

				if (isSolid(this.currentMap.map[groundIndex])) {
					p.y = this.tileToScreen(groundTile.x, groundTile.y).y - this.tileSize;
					p.vy = 0;
				}

				p.x += p.vx;
				const wallCheckX = p.vx > 0 ? p.x + this.tileSize : p.x;

				const wallCheckScreenX = wallCheckX + this.mapOffset.x;
				const wallTile = this.screenToTile(wallCheckScreenX, p.y + this.tileSize / 2);
				const wallIndex = this.engine.coordsToIndex(wallTile, this.currentMap.dimensions.width);
				
				if (isSolid(this.currentMap.map[wallIndex])) {
					p.vx *= -1;
				}
			}

			const player = this.engine.animatedSprites[PlayerName[this.player]];
			const playerHeight = this.playerSize > Player_Size.Small ? this.tileSize * 2 : this.tileSize;
			const playerRect = { x: player.position.x, y: player.position.y, w: this.tileSize, h: playerHeight };

			const screenX = p.x + this.mapOffset.x;
			const powerupRect = { x: screenX, y: p.y, w: this.tileSize, h: this.tileSize };

			// Colisión con el hongo
			if (this.rectsOverlap(playerRect, powerupRect)) {
				switch (p.type) {
					// 1UP
					case Powerup_Type.Mushroom_1UP:
						this.lives++;
						this.engine.playAudio(audio["Life"], false);
						break;
					// Super
					case Powerup_Type.Mushroom_Super:
						if (this.playerSize === Player_Size.Small) {
							this.state = Game_State.Player_Growing;
							this.growTimer = 0;
							const currentTheme = this.getCurrentThemeAudio();
							if (currentTheme) {
								this.engine.pauseAudio(currentTheme);
							}
							this.engine.playAudio(audio["Player_Pipe"], false);
						} else {

							this.score += 1000;
							this.engine.playAudio(audio["Life"], false);
						}
						this.activePowerups.splice(i, 1);
						continue;
					// Fire
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

			const screenX = p.x + this.mapOffset.x;

			let spriteToDraw = '';

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

					this.engine.drawSprite('Object_Fire_Flower', frame, { x: screenX, y: p.y }, this.tileScale, false, 0, Pivot.Top_Left);
					continue;
			}
			
			if (spriteToDraw) {
				this.engine.drawSprite(spriteToDraw, 0, { x: screenX, y: p.y }, this.tileScale, false, 0, Pivot.Top_Left);
			}
		}
	}

	drawUI(){
		const cols = 4;
		const paddingX = TEXT_SIZE * 4;
		const paddingY = TEXT_SIZE;
		const colWidth = (this.engine.getCanvasWidth() - paddingX * 2) / cols;
		const multChar = String.fromCharCode('0x00D7');

		let nameText = PlayerName[this.player];
		if (this.lives > 1) {
			nameText = `${PlayerName[this.player]} ${multChar}${this.lives}`;
		}
		this.engine.drawTextCustom(font, nameText, TEXT_SIZE, "#ffffff", {x: paddingX, y: paddingY * 2}, "left");
		this.engine.drawTextCustom(font, this.score.toString().padStart(6, "0"), TEXT_SIZE, "#ffffff", {x: paddingX, y: paddingY * 3}, "left");
		
		const coinSprite = this.engine.sprites["UI_Coin"];
		if (coinSprite) {
			const coinPos = { x: colWidth + paddingX + paddingX * 0.15, y: paddingY * 3 - TEXT_SIZE + paddingY * 0.15 };
			this.engine.drawSprite("UI_Coin", 0, coinPos, this.tileScale / 1.8, false, 0, Pivot.Top_Left);
		}

		const coinText = multChar + this.coins.toString().padStart(2, "0");
		this.engine.drawTextCustom(font, coinText, TEXT_SIZE, "#ffffff", {x: colWidth + paddingX + 32, y: paddingY * 3}, "left");
		this.engine.drawTextCustom(font, "WORLD", TEXT_SIZE, "#ffffff", {x: colWidth * 2 + paddingX + colWidth / 2, y: paddingY * 2}, "center");

		if (this.currentMap && this.currentMap.world) {
			this.engine.drawTextCustom(font, ' ' + this.availableWorlds[this.currentWorldIndex], TEXT_SIZE, "#ffffff", {x: colWidth * 2 + paddingX + colWidth / 2 - TEXT_SIZE / 2, y: paddingY * 3}, "center");
		} else {
			this.engine.drawTextCustom(font, ' ' + this.currentMap.world, TEXT_SIZE, "#ffffff", {x: colWidth * 2 + paddingX + colWidth / 2 - TEXT_SIZE / 2, y: paddingY * 3}, "center");
		}

		this.engine.drawTextCustom(font, "TIME", TEXT_SIZE, "#ffffff", {x: this.engine.getCanvasWidth() - paddingX, y: paddingY * 2}, "right");
		this.engine.drawTextCustom(font, Math.floor(this.time).toString().padStart(3, "0"), TEXT_SIZE, "#ffffff", {x: this.engine.getCanvasWidth() - paddingX, y: paddingY * 3}, "right");
		this.drawTouchControls();
	}

	drawTouchControls() {
		if (!this.touchControls?.enabled) return;
		if (this.state !== Game_State.Playing && this.state !== Game_State.Editor) return;
		const pad = this.touchControls.pad;
		const padColor = pad.touchId !== null ? TOUCH_CONTROLS.COLOR_ACTIVE : TOUCH_CONTROLS.COLOR_BASE;
		this.engine.drawCircle(pad.center, pad.radius, padColor);
		this.engine.drawCircle(pad.center, pad.innerRadius, 'rgba(255,255,255,0.15)');
		this.engine.drawCircle(pad.knob, pad.innerRadius, TOUCH_CONTROLS.COLOR_ACTIVE);
		const buttons = this.touchControls.buttons;
		Object.values(buttons).forEach(button => {
			const color = button.pressed ? TOUCH_CONTROLS.COLOR_ACTIVE : TOUCH_CONTROLS.COLOR_BASE;
			this.engine.drawCircle(button.center, button.radius, color);
			this.engine.drawTextCustom(font, button.label, TEXT_SIZE * 1.2, "#ffffff", { x: button.center.x, y: button.center.y + TEXT_SIZE * 0.4 }, "center");
		});
	}

	initializeTouchControls() {
		if (!this.engine?.canvas) return;
		if (this.touchControls?.initialized) return;
		this.disposeTouchListeners();
		this.touchControls = {
			initialized: true,
			enabled: true,
			pad: {
				center: { x: 0, y: 0 },
				radius: TOUCH_CONTROLS.PAD_RADIUS,
				innerRadius: TOUCH_CONTROLS.PAD_INNER_RADIUS,
				touchId: null,
				vector: { x: 0, y: 0 },
				knob: { x: 0, y: 0 }
			},
			buttons: {
				jump: {
					label: "A",
					keys: ["ArrowUp", "KeyW"],
					center: { x: 0, y: 0 },
					radius: TOUCH_CONTROLS.BUTTON_RADIUS,
					touchId: null,
					pressed: false
				},
				shoot: {
					label: "B",
					keys: ["ControlLeft", "ControlRight", "Space"],
					center: { x: 0, y: 0 },
					radius: TOUCH_CONTROLS.BUTTON_RADIUS,
					touchId: null,
					pressed: false
				}
			}
		};
		if (typeof window !== 'undefined') {
			this.boundHardwareKeyDown = e => this.hardwareKeysDown.add(e.code);
			this.boundHardwareKeyUp = e => this.hardwareKeysDown.delete(e.code);
			window.addEventListener('keydown', this.boundHardwareKeyDown);
			window.addEventListener('keyup', this.boundHardwareKeyUp);
		}

		this.boundUpdateTouchLayout = () => this.updateTouchLayout();
		this.boundResetTouchInput = () => this.resetTouchInput();
		window.addEventListener("resize", this.boundUpdateTouchLayout);
		window.addEventListener("orientationchange", this.boundUpdateTouchLayout);
		window.addEventListener("blur", this.boundResetTouchInput);
		this.touchListenerDisposers = [
			this.engine.addTouchListener("start", e => this.handleTouchStart(e)),
			this.engine.addTouchListener("move", e => this.handleTouchMove(e)),
			this.engine.addTouchListener("end", e => this.handleTouchEnd(e)),
			this.engine.addTouchListener("cancel", e => this.handleTouchEnd(e))
		];
		this.updateTouchLayout();
	}

	disposeTouchListeners() {
		if (this.touchListenerDisposers?.length) {
			this.touchListenerDisposers.forEach(dispose => {
				if (typeof dispose === "function") dispose();
			});
		}
		this.touchListenerDisposers = [];
		if (this.boundUpdateTouchLayout) {
			window.removeEventListener("resize", this.boundUpdateTouchLayout);
			window.removeEventListener("orientationchange", this.boundUpdateTouchLayout);
			this.boundUpdateTouchLayout = null;
		}
		if (this.boundResetTouchInput) {
			window.removeEventListener("blur", this.boundResetTouchInput);
			this.boundResetTouchInput = null;
		}
	}

	updateTouchLayout() {
		if (!this.touchControls?.enabled) return;
		const canvasWidth = this.engine.getCanvasWidth();
		const canvasHeight = this.engine.getCanvasHeight();
		const pad = this.touchControls.pad;
		pad.center.x = TOUCH_CONTROLS.MARGIN + pad.radius;
		pad.center.y = canvasHeight - (TOUCH_CONTROLS.MARGIN + pad.radius);
		pad.knob.x = pad.center.x;
		pad.knob.y = pad.center.y;
		pad.vector = { x: 0, y: 0 };
		const buttons = this.touchControls.buttons;
		const jump = buttons.jump;
		const shoot = buttons.shoot;
		jump.center.x = canvasWidth - (TOUCH_CONTROLS.MARGIN + jump.radius);
		jump.center.y = canvasHeight - (TOUCH_CONTROLS.MARGIN + jump.radius * 1.25);
		shoot.center.x = jump.center.x - (jump.radius * 2 + TOUCH_CONTROLS.BUTTON_SPACING);
		shoot.center.y = jump.center.y - jump.radius * 0.25;
		Object.values(buttons).forEach(button => {
			button.touchId = null;
			button.pressed = false;
		});
		this.applyPadDirection();
	}

	handleTouchStart(event) {
		if (!this.touchControls?.enabled) return;
		const pad = this.touchControls.pad;
		const buttons = this.touchControls.buttons;
		Array.from(event.changedTouches || []).forEach(touch => {
			const point = this.getTouchPoint(touch);
			if (pad.touchId === null && this.isPointInsideCircle(point, pad.center, pad.radius)) {
				pad.touchId = touch.identifier;
				this.updatePadVector(point);
				return;
			}
			Object.values(buttons).forEach(button => {
				if (button.touchId !== null) return;
				if (this.isPointInsideCircle(point, button.center, button.radius)) {
					button.touchId = touch.identifier;
					this.pressButton(button, true);
				}
			});
		});
	}

	handleTouchMove(event) {
		if (!this.touchControls?.enabled) return;
		const pad = this.touchControls.pad;
		const buttons = this.touchControls.buttons;
		Array.from(event.changedTouches || []).forEach(touch => {
			const point = this.getTouchPoint(touch);
			if (pad.touchId === touch.identifier) {
				this.updatePadVector(point);
			}
			Object.values(buttons).forEach(button => {
				if (button.touchId !== touch.identifier) return;
				if (this.isPointInsideCircle(point, button.center, button.radius)) return;
				this.pressButton(button, false);
				button.touchId = null;
			});
		});
	}

	handleTouchEnd(event) {
		if (!this.touchControls?.enabled) return;
		const pad = this.touchControls.pad;
		const buttons = this.touchControls.buttons;
		Array.from(event.changedTouches || []).forEach(touch => {
			if (pad.touchId === touch.identifier) {
				pad.touchId = null;
				pad.vector = { x: 0, y: 0 };
				pad.knob = { x: pad.center.x, y: pad.center.y };
				this.applyPadDirection();
			}
			Object.values(buttons).forEach(button => {
				if (button.touchId !== touch.identifier) return;
				this.pressButton(button, false);
				button.touchId = null;
			});
		});
	}

	getTouchPoint(touch) {
		const rect = this.engine.canvas.getBoundingClientRect();
		const scaleX = this.engine.canvas.width / rect.width;
		const scaleY = this.engine.canvas.height / rect.height;
		return {
			x: (touch.clientX - rect.left) * scaleX,
			y: (touch.clientY - rect.top) * scaleY
		};
	}

	updatePadVector(point) {
		const pad = this.touchControls.pad;
		const dx = point.x - pad.center.x;
		const dy = point.y - pad.center.y;
		const distance = Math.sqrt(dx * dx + dy * dy);
		const cappedDistance = Math.min(distance, pad.radius);
		const vector = distance === 0 ? { x: 0, y: 0 } : { x: dx / pad.radius, y: dy / pad.radius };
		if (distance < pad.radius * TOUCH_CONTROLS.PAD_THRESHOLD) {
			pad.vector = { x: 0, y: 0 };
			pad.knob = { x: pad.center.x, y: pad.center.y };
		} else {
			pad.vector = vector;
			const knobDistance = Math.min(cappedDistance, pad.radius - pad.innerRadius);
			pad.knob = {
				x: pad.center.x + vector.x * knobDistance,
				y: pad.center.y + vector.y * knobDistance
			};
		}
		this.applyPadDirection();
	}

	applyPadDirection() {
		const pad = this.touchControls?.pad;
		if (!pad) return;
		const threshold = TOUCH_CONTROLS.PAD_THRESHOLD;
		const leftActive = pad.vector.x <= -threshold;
		const rightActive = pad.vector.x >= threshold;
		const upActive = pad.vector.y <= -threshold;
		const downActive = pad.vector.y >= threshold;
		this.setVirtualKey(["ArrowLeft", "KeyA"], leftActive);
		this.setVirtualKey(["ArrowRight", "KeyD"], rightActive);
		this.setVirtualKey(["ArrowUp", "KeyW"], upActive);
		this.setVirtualKey(["ArrowDown", "KeyS"], downActive);
	}

	setVirtualKey(code, active) {
		const codes = Array.isArray(code) ? code : [code];
		codes.forEach(keyCode => {
			if (!keyCode) return;
			if (active) {
				this.virtualKeysState[keyCode] = true;
				this.virtualKeysDown.add(keyCode);
				this.engine.keysPressed[keyCode] = true;
			} else {
				this.virtualKeysState[keyCode] = false;
				if (this.virtualKeysDown.has(keyCode)) this.virtualKeysDown.delete(keyCode);
				if (!this.hardwareKeysDown.has(keyCode)) {
					delete this.engine.keysPressed[keyCode];
				}
			}
		});
	}

	pressButton(button, active) {
		if (!button) return;
		button.pressed = active;
		this.setVirtualKey(button.keys, active);
	}

	resetTouchInput() {
		if (!this.touchControls) return;
		const pad = this.touchControls.pad;
		pad.touchId = null;
		pad.vector = { x: 0, y: 0 };
		pad.knob = { x: pad.center.x, y: pad.center.y };
		const buttons = this.touchControls.buttons;
		Object.values(buttons).forEach(button => {
			if (button.pressed) this.pressButton(button, false);
			button.touchId = null;
		});
		this.applyPadDirection();
	}

	isPointInsideCircle(point, center, radius) {
		const dx = point.x - center.x;
		const dy = point.y - center.y;
		return dx * dx + dy * dy <= radius * radius;
	}

	getCurrentThemeAudio() {
		if (!this.currentMap) return null;
		switch (this.currentMap.type) {
			case World_Type.Overworld: return audio["Overworld_Theme"];
			case World_Type.Underground: return audio["Underground_Theme"];
			case World_Type.Underwater: return audio["Underwater_Theme"];
			case World_Type.Castle: return audio["Castle_Theme"];
			default: return null;
		}
	}

	toggleEditor() {
        if (this.state === Game_State.Playing) {
            this.isEditorMode = true;
            this.state = Game_State.Editor;
            
            const currentTheme = this.getCurrentThemeAudio();
            if (currentTheme) this.engine.stopAudio(currentTheme);

            if (this.pristineMapData) {
                this.currentMap.map = JSON.parse(JSON.stringify(this.pristineMapData));
            }
            
            this.enemies = [];
            
            console.log("[GAME] Modo editor activado. Mapa restaurado.");

        } else if (this.state === Game_State.Editor) {
            this.isEditorMode = false;
            this.state = Game_State.Playing;
            
            this.pristineMapData = JSON.parse(JSON.stringify(this.currentMap.map));
            
            console.log("[GAME] Saliendo. Generando enemigos...");
            this.reloadEnemiesFromMap();
        }
    }

	reloadEnemiesFromMap() {
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

				let worldX = coords.x * this.tileSize;
                let worldY = coords.y * this.tileSize;

                if (enemyType.includes("Pakkun")) {
                    // La planta se coloca en el tile de la "boca" de la tubería.
                    // Su posición inicial (escondida) debe ser un tile más abajo (+ this.tileSize).
                    this.enemies.push({
                        type: 'Pakkun', 
                        color: enemyColor,
                        x: worldX + (this.tileSize / 2), // Centrado horizontalmente
                        y: worldY + this.tileSize * 1.5,       // Posición Y inicial (escondida en el tubo)
                        initialY: worldY + this.tileSize,// Referencia para saber dónde volver
                        maxHeight: this.tileSize * 1.5,  // Cuánto sube
                        state: 'hiding', 
                        timer: 120
                    });
                } else {
                    // Enemigos normales
                    this.enemies.push({
                        id: this.enemies.length, 
                        type: enemyType, 
                        color: enemyColor,
                        x: worldX, 
                        y: worldY,
                        vx: -2, 
                        vy: 0, 
                        state: "walking", 
                        stompTimer: 0,
                        isWinged: enemyType === "Koopa_Winged",
                        canFly: enemyType === "Koopa_Winged",
                        flyTimer: 0,
                    });
                }

                // Importante: Borrar el bloque del mapa para que no sea un obstáculo sólido estático
                this.currentMap.map[i] = 0;
			}
		}
	}

    updateAndDrawEditor() {
        // 1. GESTIÓN DE CÁMARA
        if (this.engine.keysPressed['ArrowLeft']) { this.mapOffset.x += 15; }
        if (this.engine.keysPressed['ArrowRight']) { this.mapOffset.x -= 15; }

        // 2. COORDENADAS DEL MOUSE
        const mousePos = this.engine.getMousePosition();
        const worldTile = this.screenToTile(mousePos.x, mousePos.y);
        const mapWidth = this.currentMap.dimensions.width;
        const mapHeight = this.currentMap.dimensions.height;
        
        // Validar si el cursor está dentro del mundo
        let mapIndex = -1;
        let isInsideMap = false;
        
        if (worldTile.x >= 0 && worldTile.x < mapWidth && worldTile.y >= 0 && worldTile.y < mapHeight) {
            mapIndex = this.engine.coordsToIndex(worldTile, mapWidth);
            isInsideMap = true;
        }

        // 3. SELECCIÓN DE PALETA (Rueda del ratón)
        const wheelDelta = this.engine.getMouseWheelDelta();
        const len = this.editorPalette.length;
        if (len > 0) {
            if (wheelDelta < 0) { this.selectedTileIndex++; }
            if (wheelDelta > 0) { this.selectedTileIndex--; }
            // Ajuste circular seguro
            this.selectedTileIndex = ((this.selectedTileIndex % len) + len) % len;
        }

        // 4. ACCIÓN DE DIBUJAR / BORRAR
        const tileToPlace = this.editorPalette[this.selectedTileIndex];
        
        if (isInsideMap && mapIndex >= 0 && mapIndex < this.currentMap.map.length) {
            // Click Izquierdo: Colocar
            if (this.engine.mouseButtons[0]) { 
                if (tileToPlace !== undefined) {
                    this.currentMap.map[mapIndex] = tileToPlace;
                }
            }
            // Click Derecho: Borrar
            if (this.engine.mouseButtons[2]) { 
                this.currentMap.map[mapIndex] = 0;
            }
        }

        // 5. DIBUJAR EL JUEGO
        this.drawBackground();
        this.drawBlocks();
        this.drawForegroundBlocks();

        // Dibujar enemigos estáticos (para ver dónde están en el editor)
        for (let i = 0; i < this.currentMap.map.length; i++) {
            const bid = this.currentMap.map[i];
            // IDs de enemigos conocidos
            if ([10, 11, 12, 37, 38, 40, 43, 44, 45].includes(bid)) {
                 const coords = this.engine.indexToCoords(i, mapWidth);
                 const pos = this.tileToScreen(coords.x, coords.y);
                 if (BlockType[bid] && this.engine.sprites[BlockType[bid]]) {
                    this.engine.drawSprite(BlockType[bid], 0, pos, this.tileScale, false, 0, Pivot.Top_Left);
                 }
            }
        }
        this.drawUI();

        // 6. DIBUJAR CURSOR Y BLOQUE FANTASMA
        const cursorScreenPos = this.tileToScreen(worldTile.x, worldTile.y);
        
        // Solo dibujar si está visible en pantalla
        if (cursorScreenPos.x > -this.tileSize && cursorScreenPos.x < this.engine.getCanvasWidth()) {
            
            // A) Cuadro indicador amarillo
            const cursorColor = isInsideMap ? "rgba(255, 255, 0, 0.5)" : "rgba(255, 0, 0, 0.5)";
            this.engine.drawRectangle(
                { x: cursorScreenPos.x, y: cursorScreenPos.y, width: this.tileSize, height: this.tileSize },
                cursorColor
            );

            // B) Bloque Fantasma (Ghost): Previsualiza qué vas a poner
            if (isInsideMap && tileToPlace) {
                const ghostSpriteName = BlockType[tileToPlace];
                if (ghostSpriteName && this.engine.sprites[ghostSpriteName]) {
                    this.engine.ctx.save();
                    this.engine.ctx.globalAlpha = 0.6; // Semitransparente
                    this.engine.drawSprite(ghostSpriteName, 0, cursorScreenPos, this.tileScale, false, 0, Pivot.Top_Left);
                    this.engine.ctx.restore();
                }
            }
        }

        // 7. DIBUJAR PALETA (Carrete)
        const paletteHeight = this.tileSize + 80;
        const paletteY = this.engine.getCanvasHeight() - paletteHeight;
        
        // Fondo paleta
        this.engine.drawRectangle({
            x: 0, y: paletteY,
            width: this.engine.getCanvasWidth(), height: paletteHeight
        }, "rgba(0, 0, 0, 0.8)");
        
        const centerX = this.engine.getCanvasWidth() / 2;
        const itemSpacing = this.tileSize + 30; 
        const numVisibleItems = Math.ceil(centerX / itemSpacing) + 2; 

        for (let offset = -numVisibleItems; offset <= numVisibleItems; offset++) {
            let paletteIndex = (this.selectedTileIndex + offset) % len;
            if (paletteIndex < 0) paletteIndex += len;

            const blockId = this.editorPalette[paletteIndex];
            let spriteName = (BlockType && BlockType[blockId]) ? BlockType[blockId] : "Unknown";
            
            const drawPos = {
                x: centerX + (offset * itemSpacing) - (this.tileSize / 2),
                y: paletteY + 30
            };

            const alpha = offset === 0 ? 1.0 : 0.4;
            const scale = offset === 0 ? this.tileScale * 1.2 : this.tileScale;
            
            // Ajuste de centro por escala
            const adjustedPos = {
                x: drawPos.x - (scale - this.tileScale) * (SPRITE_SIZE / 2),
                y: drawPos.y - (scale - this.tileScale) * (SPRITE_SIZE / 2)
            };

            if (spriteName !== "Unknown" && this.engine.sprites[spriteName]) {
                this.engine.ctx.save();
                this.engine.ctx.globalAlpha = alpha;
                this.engine.drawSprite(spriteName, 0, adjustedPos, scale, false, 0, Pivot.Top_Left);
                this.engine.ctx.restore();
            } else {
                // Fallback visual si falta imagen
                this.engine.ctx.save();
                this.engine.ctx.globalAlpha = alpha;
                this.engine.drawRectangle({
                    x: adjustedPos.x, y: adjustedPos.y, 
                    width: this.tileSize * (scale/this.tileScale), 
                    height: this.tileSize * (scale/this.tileScale)
                }, "#FF00FF");
                this.engine.ctx.restore();
            }

            if (offset === 0) {
                this.engine.drawRectangleLines({
                    x: adjustedPos.x - 5, y: adjustedPos.y - 5,
                    width: (this.tileSize * 1.2) + 10, height: (this.tileSize * 1.2) + 10
                }, 4, Color.WHITE);

                let displayName = spriteName !== "Unknown" ? spriteName.replace(/_/g, " ") : `ID ${blockId}`;
                this.engine.drawTextCustom(font, displayName, TEXT_SIZE * 0.8, Color.YELLOW, {
                    x: this.engine.getCanvasWidth() / 2, y: paletteY + 15
                }, "center");
            }
        }
    }
}