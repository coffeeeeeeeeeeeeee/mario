const SPRITE_SIZE = 16;
const TILE_PIXEL_SIZE = 16;

const SPRITE_SCALE = 3;
const BASE_GRAVITY = 0.8;
// Velocidades máximas del Super Mario Bros original, en píxeles del NES por cuadro (a ~60 cuadros
// por segundo). Salen de MaxRightXSpdData en SMBDIS.ASM: $18 caminando y $28 corriendo (con B),
// en unidades de 1/16 de píxel, o sea 24/16 y 40/16. Se escalan por SPRITE_SCALE para quedar en
// píxeles de esta pantalla por segundo.
const SMB_WALK_SPEED = 24 / 16;
const SMB_RUN_SPEED = 40 / 16;
const BASE_VELOCITY_GROUND = SMB_WALK_SPEED * SPRITE_SCALE * 60;
const BASE_VELOCITY_TURBO = SMB_RUN_SPEED * SPRITE_SCALE * 60;
// Salto del Super Mario Bros original (SMBDIS.ASM: JumpMForceData, FallMForceData, PlayerYSpdData).
// Todo en píxeles del NES: la velocidad es en píxeles por cuadro y las fuerzas en píxeles por
// cuadro al cuadrado (el original las guarda en 1/256). Se multiplica por tileScale para pasar
// a píxeles de esta pantalla. La física vertical corre en pasos fijos de 1/60 s, como el original.
// El tipo de salto depende de la velocidad horizontal al despegar: parado, caminando o corriendo.
const SMB_JUMP = {
	standing: { speed: 4, up: 0x20 / 256, down: 0x70 / 256 },
	walking:  { speed: 4, up: 0x1e / 256, down: 0x60 / 256 },
	running:  { speed: 5, up: 0x28 / 256, down: 0x90 / 256 },
};
const SMB_MAX_FALL_SPEED = 4;
const SMB_STOMP_SPEED = -4;        // rebote al pisar un Goomba o un Koopa ($FC)
const SMB_BRICK_BREAK_SPEED = -2;  // al romper un ladrillo Mario sigue subiendo ($FE)
const SMB_BUMP_SPEED = 0;          // al golpear un bloque que rebota
const SMB_CEILING_SPEED = 1;       // al chocar con un techo sólido empieza a caer
const PHYSICS_STEP_MS = 1000 / 60;
const PHYSICS_STEP_TOLERANCE_MS = 2; // absorbe el jitter de requestAnimationFrame a 60 Hz
const PIPE_TRANSITION_MS = 700;      // lo que tarda Mario en entrar o salir de un caño

// Tiempos y puntajes del original (la NES corre a 60,0988 cuadros por segundo)
const NES_FPS = 60.0988;
const GAME_TIMER_TICK_MS = 24 * 1000 / NES_FPS;           // el contador baja 1 cada 24 cuadros
const INJURY_INVINCIBLE_MS = 8 * 21 * 1000 / NES_FPS;     // InjuryTimer: 8 intervalos de 21 cuadros
const STAR_INVINCIBLE_MS = 0x23 * 21 * 1000 / NES_FPS;    // StarInvincibleTimer
// Puntos de la cadena de pisotones sin tocar el suelo (ScoreUpdateData); el último es una vida
const SCORE_CHAIN = [0, 100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000, 'life'];
// Movimiento de enemigos y objetos, en píxeles del NES por cuadro (las fuerzas, por cuadro al cuadrado)
const ENEMY_WALK_SPEED = 0.5;          // NormalXSpdData: $f8
const ENEMY_SHELL_SPEED = 3;           // KickedShellXSpdData: $30
const ENEMY_GRAVITY = 0x3d / 256;      // MoveD_EnemyVertically
const JUMPER_GRAVITY = 0x1c / 256;     // MoveJ_EnemyVertically: paratroopa y estrella
const ENEMY_MAX_FALL = 3;
const ENEMY_JUMP_SPEED = -3;           // EnemyJump: $fd
const MUSHROOM_SPEED = 1;              // $10
const FIREBALL_SPEED = 4;              // FireballXSpdData: $40
const FIREBALL_GRAVITY = 0x50 / 256;
const FIREBALL_MAX_FALL = 3;
const FIREBALL_BOUNCE = -3;
const MAX_FIREBALLS = 2;
const PIRANHA_SPEED = 0.5;             // 1 px cada 2 cuadros
const PIRANHA_RISE = 24;               // PiranhaPlantUpYPos: 24 px sobre la boca
const PIRANHA_DELAY_STEPS = 0x40;      // EnemyFrameTimer al llegar arriba o abajo
const PIRANHA_NEAR = 33;               // no sale si Mario está a menos de 33 px
const ENEMY_ACTIVATE_AHEAD = 3;        // los enemigos aparecen a 3 tiles del borde derecho de la pantalla
const ENEMY_DESPAWN_BEHIND = 72;       // y desaparecen 72 px más allá del borde izquierdo
const STOMPED_GOOMBA_STEPS = 30;
const DEATH_PAUSE_MS = 15 * 1000 / NES_FPS;
const DEATH_GRAVITY = 0x28 / 256;       // VerticalForce de PlayerKilled
// Monedas que hay que juntar en el nivel -3 para que aparezca el 1UP oculto del mundo siguiente
const HIDDEN_1UP_COINS = [0x15, 0x23, 0x16, 0x1b, 0x17, 0x18, 0x23, 0x63];
const BRICK_COIN_TIMER_MS = 0x0b * 21 * 1000 / NES_FPS;   // BrickCoinTimer: el ladrillo da monedas durante ~3,8 s
// Física horizontal de Mario (X_Physics, ImposeFriction): la velocidad va en 1/16 de píxel del NES por cuadro
const X_MAX_RIGHT = [0x28, 0x18, 0x10];   // MaxRightXSpdData: corriendo, caminando y en el agua
const X_MAX_LEFT = [-0x28, -0x18, -0x10]; // MaxLeftXSpdData ($d8, $e8, $f0)
const X_FRICTION = [0xe4, 0x98, 0xd0];    // FrictionData, en 1/256 de unidad de velocidad por cuadro
const RUNNING_TIMER_STEPS = 10 * 21;      // RunningTimer: se sigue corriendo ~3,5 s tras soltar B
// Salto según la velocidad horizontal al despegar (umbrales de ProcJumping: 9, 16, 25 y 28)
const JUMP_BY_SPEED = [SMB_JUMP.standing, SMB_JUMP.standing, SMB_JUMP.walking, SMB_JUMP.running, SMB_JUMP.running];
// Natación (entradas de agua de JumpMForceData, FallMForceData, PlayerYSpdData e InitMForceData)
const SWIM_STROKE_SPEED = -1.5;           // $fe más la fracción $80
const SWIM_FORCE_UP = 0x0d / 256;
const SWIM_FORCE_DOWN = 0x0a / 256;
const SWIM_TIMER_STEPS = 0x20;            // JumpSwimTimer: se puede dar otra brazada en seguida
// Altura de Mario al tocar el mástil (en píxeles del NES) -> premio (FlagpoleYPosData, FlagpoleScoreMods)
const FLAGPOLE_Y_DATA = [0x18, 0x22, 0x50, 0x68, 0x90];
const FLAGPOLE_SCORES = [5000, 2000, 800, 400, 100];
const BASE_VELOCITY_SWIM = (TILE_PIXEL_SIZE * 17.6 / 16) * 60;

const TEXT_SIZE = 16;

const DEFAULT_LIVES = 3;
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
	Settings_Menu:	7,
	Pipe_Transition: 8,
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

// Metatiles del Super Mario Bros original: los mapas usan los mismos números que el juego de NES
// (ver tools/smb-levels.js). Sólo se nombran los que el motor trata de forma especial.
const MT = {
	Empty: 0x00,
	PipeTopLeft: 0x10, PipeTopRight: 0x11, PipeBodyLeft: 0x14, PipeBodyRight: 0x15,
	FlagpoleTop: 0x24, Flagpole: 0x25,
	Brick: 0x51, BrickUnderground: 0x52, Ground: 0x54,
	HiddenCoin: 0x5f, Hidden1Up: 0x60, Hard: 0x61,
	Axe: 0xc5,
	QuestionCoin: 0xc0, QuestionPowerup: 0xc1, Coin: 0xc2, CoinWater: 0xc3, Used: 0xc4,
};

// Sprite con el que se dibuja cada metatile. Lo que no figura y es sólido se dibuja como bloque duro.
const METATILE_SPRITE = {
	0x10: 'Block_Pipe_Top_Left', 0x12: 'Block_Pipe_Top_Left', 0x11: 'Block_Pipe_Top_Right', 0x13: 'Block_Pipe_Top_Right',
	0x14: 'Block_Pipe_Body_Left', 0x15: 'Block_Pipe_Body_Right',
	0x1c: 'Block_Pipe_Start_Top', 0x1d: 'Block_Pipe_Body_Top', 0x1e: 'Block_Pipe_End_Top',
	0x1f: 'Block_Pipe_Start_Bottom', 0x20: 'Block_Pipe_Body_Bottom', 0x21: 'Block_Pipe_End_Bottom',
	0x69: 'Block_Coral', 0x6b: 'Block_Pipe_Start_Top', 0x6c: 'Block_Pipe_Start_Bottom',   // boca del caño de salida en agua
	0x24: 'Block_Flagpole_Top', 0x25: 'Block_Flagpole',
	0x51: 'Block_Brick', 0x52: 'Block_Brick_Middle', 0x54: 'Block_Ground', 0x62: 'Block_Ground',   // 0x62: terreno del castillo
	0xc0: 'Block_Question', 0xc1: 'Block_Question', 0xc2: 'Object_Coin', 0xc3: 'Object_Coin',
	0xc4: 'Block_Used',          // bloque vacío liso (el 'Block_Question_Used' es un cuadro de la animación de la pregunta)
};
for (let id = 0x45; id <= 0x4b; id++) METATILE_SPRITE[id] = `Block_Castle_${id.toString(16)}`;   // castillo del final del nivel
for (let id = 0x55; id <= 0x59; id++) METATILE_SPRITE[id] = 'Block_Brick';             // ladrillos con contenido (exterior)
for (let id = 0x5a; id <= 0x5e; id++) METATILE_SPRITE[id] = 'Block_Brick_Middle';      // ídem (subterráneo y castillo)
METATILE_SPRITE[MT.HiddenCoin] = 'Block_Invisible';                                      // sólo se ve en el editor
METATILE_SPRITE[MT.Hidden1Up] = 'Block_Invisible';
for (const id of [0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x61, 0x67, 0x68]) METATILE_SPRITE[id] = 'Block_Stairs';
METATILE_SPRITE[0x88] = 'Block_Cloud_Platform'; METATILE_SPRITE[0x63] = 'Block_Rope_Bridge'; METATILE_SPRITE[0x0b] = 'Block_Rope_Rail';
METATILE_SPRITE[MT.Axe] = 'Block_Axe'; METATILE_SPRITE[0x0c] = 'Block_Chain'; METATILE_SPRITE[0x89] = 'Block_Bridge';
METATILE_SPRITE[0x64] = 'Block_Cannon_Top'; METATILE_SPRITE[0x65] = 'Block_Cannon_Mid'; METATILE_SPRITE[0x66] = 'Block_Cannon_Base';

// Celda (columna, fila) de la hoja de cada pieza de escenografía de fondo (no sólida), por número de metatile.
// Las piezas del castillo (0x45 a 0x4b) y el coral (0x69) salen de METATILE_SPRITE.
const SCENERY_CELL = {
	0x80: [0, 4], 0x81: [1, 4], 0x82: [2, 4], 0x83: [3, 4], 0x84: [4, 4], 0x85: [5, 4],       // nube
	0x05: [6, 4], 0x06: [7, 4], 0x0a: [8, 4], 0x09: [9, 4], 0x08: [10, 4], 0x07: [11, 4],     // colina
	0x02: [12, 4], 0x03: [13, 4], 0x04: [14, 4],                                              // arbusto
	0x4d: [7, 5], 0x4e: [8, 5], 0x0d: [9, 5], 0x0e: [10, 5], 0x0f: [11, 5],                   // valla, tronco, árboles
	0x86: [12, 5], 0x87: [13, 5],                                                             // superficie y relleno del agua
};

// Qué entrega un bloque al golpearlo desde abajo
const BLOCK_ITEM = {
	[MT.QuestionPowerup]: 'powerup', [MT.QuestionCoin]: 'coin',
	0x55: 'powerup', 0x5a: 'powerup',
	0x56: 'vine', 0x5b: 'vine',       // ladrillo con enredadera
	0x57: 'star', 0x5c: 'star',
	0x58: 'coins', 0x5d: 'coins',     // ladrillo con monedas (hasta 10)
	0x59: '1up', 0x5e: '1up', [MT.Hidden1Up]: '1up',
	[MT.HiddenCoin]: 'coin',
};
const PLAIN_BRICKS = new Set([MT.Brick, MT.BrickUnderground]);
const HIDDEN_BLOCKS = new Set([MT.HiddenCoin, MT.Hidden1Up]);   // sólo se golpean desde abajo
const NON_SOLID_BLOCKS = new Set([MT.FlagpoleTop, MT.HiddenCoin, MT.Hidden1Up, MT.Coin, MT.CoinWater]);
const FOREGROUND_METATILES = [0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x21]; // Mario pasa por detrás
NON_SOLID_BLOCKS.add(0x0b); NON_SOLID_BLOCKS.add(0x0c); NON_SOLID_BLOCKS.add(MT.Axe);   // cadena y hacha: se tocan, no frenan
for (let id = 0x45; id <= 0x4b; id++) NON_SOLID_BLOCKS.add(id);   // castillo: decoración
const isSolidMetatile = id => id > 0 && id < 0x100 && !NON_SOLID_BLOCKS.has(id);
const isCoinMetatile = id => id === MT.Coin || id === MT.CoinWater;

// Marcadores de enemigo del editor: ids fuera del rango de metatiles, para colocarlos en la grilla.
const SWIMMERS = new Set(['Bloober', 'Cheep']);
const BOWSER_HP = 5, BOWSER_SCORE = 5000;
const BOWSER_W = 32, BOWSER_H = 24;                        // px del NES
const BOWSER_FIRST_FLAME_STEPS = 0xdf;                     // cuadros hasta la primera llama
const BOWSER_FLAME_TIMER = [0xbf, 0x40, 0xbf, 0xbf, 0xbf, 0x40, 0x40, 0xbf];   // FlameTimerData
const BOWSER_RANGE = [0x21, 0x41, 0x11, 0x31];             // PRandomRange: alcance de la patrulla y espera entre saltos
const BOWSER_JUMP_SPEED = 2, BOWSER_GRAVITY = 0.0625;      // px del NES por cuadro
const BOWSER_FLAME_SPEED = 1.25;                           // la llama avanza 1 px + 0x40/256 por cuadro
const BOWSER_FLAME_HEIGHTS = [16, 32, 48, 16];             // alturas sobre el puente a las que apunta la llama
const FLAME_W = 24, FLAME_H = 8;
const BRIDGE_COLLAPSE_MS = 4 * 1000 / 60;                  // un tile del puente cada 4 cuadros (BridgeCollapse)
const BASE_GRAVITY_NES = 0.4;   // px del NES por cuadro al cuadrado, para la caída automática de Mario al final
const BULLET_BILL_SPEED = 1.5;       // px del NES por cuadro (el original lo mueve a $e8/16)
const CANNON_TIMER = 14;             // el temporizador de un cañón tras disparar (baja de a uno cada vez que sale sorteado)
const CANNON_NEAR = 40;              // px del NES: más cerca que esto el Bullet Bill muere al salir
const CANNON_MAX_BILLS = 3;
const PLATFORM_LIFT_SPEED = 0.94;      // px del NES por cuadro de las plataformas que suben o bajan
const PLATFORM_ACCEL = 5 / 256, PLATFORM_MAX_SPEED = 3;           // la que sube y baja y el balancín: aceleran de a 5/256 hasta 3 px por cuadro
const PLATFORM_VERT_HALF = 64;                                    // la que sube y baja oscila 64 px a cada lado de su centro
const PLATFORM_HORI_MAX = 14;                                     // la que va y viene: velocidad máxima en 1/16 px (XMoveCntr_Platform)
const PLATFORM_DROP_GRAVITY = 0x7f / 256, PLATFORM_DROP_MAX = 2;  // la que cae al pisarla
const PLATFORM_FALL_GRAVITY = 0.2;                               // balancín que se suelta
const PLATFORM_BALANCE_LIMIT = 13;                               // el balancín se suelta si una sube hasta acá
const HAMMER_THROW_STEPS = 0x30;       // cuadros entre martillos (HammerThrowTmrData); en el modo difícil, 0x1c
const HAMMER_THROW_STEPS_HARD = 0x1c;
const BUBBLE_STEPS = 48, BUBBLE_SPEED = 0.6;   // una burbuja de Mario cada tanto, que sube 0,6 px por cuadro
const HAMMER_BRO_JUMP_SPEED = 5;      // px del NES por cuadro
const HAMMER_GRAVITY = 0x10 / 256, HAMMER_UP_SPEED = 2;
const LAKITU_DIFF_ADJ = [0x15, 0x30, 0x40];   // velocidad base de Lakitu, en 1/16 px por cuadro (LakituDiffAdj)
const LAKITU_EGG_STEPS = 0x80;        // cuadros entre huevos de espinosos
const LAKITU_RESPAWN_STEPS = 7 * 0x80;
const SPRING_OFFSETS = [0, 8, 16, 8];              // cuánto baja la parte de arriba en cada cuadro (Jumpspring_Y_PosData)
const SPRING_STEPS_PER_FRAME = 4;                  // cuadros que dura cada paso de la compresión
const SPRING_BOUNCE = 7, SPRING_BOUNCE_HIGH = 12;  // px del NES por cuadro: rebote normal y apretando el salto
const SPRING_FORCE = 0x70 / 256;                   // gravedad de Mario tras el rebote (VerticalForce)
const FLY_CHEEP_GRAVITY = 0.1;                       // px del NES por cuadro al cuadrado de los cheep-cheeps que saltan
const FLY_CHEEP_TIMERS = [0x10, 0x60, 0x20, 0x48];   // FlyCCTimerData: cuadros hasta el próximo cheep-cheep que salta
const FRENZY_Y = [32, 16, 112, 48, 0, 64, 128, 80];   // alturas (desde la fila 0 del nivel) de Enemy17YPosData
const FIREWORK_X = [0x00, 0x30, 0x60, 0x60, 0x00, 0x20];   // FireworksXPosData
const FIREWORK_Y = [0x60, 0x40, 0x70, 0x40, 0x60, 0x30];   // FireworksYPosData
const FIREWORK_FRAME_MS = 100;
const VINE_GROW_SPEED = 0.5, VINE_MAX = 96;   // la enredadera crece 1 px cada dos cuadros hasta 96 px (VineHeightData)
const CLIMB_SPEED = 0.8;                     // px del NES por cuadro al trepar
const LOOP_BACK_PAGES = 4;                         // el laberinto devuelve a Mario cuatro páginas atrás
const LOOP_TOLERANCE = 3;                          // px del NES de margen en la altura de los pies
const HURRY_TIME = 100;               // con este tiempo o menos suena la música apurada
const TIME_WARNING_MS = 3000;           // lo que dura el aviso de poco tiempo antes de la música apurada
const SHELL_REVIVE = 0x10 * 21, SHELL_REVIVE_HARD = 0x0b * 21;   // cuadros hasta que un caparazón pisado se levanta (RevivalRateData)
const SHELL_WIGGLE = 63;                                       // los últimos cuadros se sacude antes de volver
const HURRY_PLAYBACK_RATE = 1.25;    // cuánto se acelera la melodía en los niveles sin pista propia
const NPC_TYPES = new Set(['Toad', 'Princess']);
const UNKILLABLE = new Set(['Firebar', 'Podoboo', 'Bowser', 'BowserFlame', 'Hammer']);
const ENEMY_POINTS = { Goomba: 100, Lakitu: 800, HammerBro: 1000 };   // ni pisarlos ni la bola de fuego ni el caparazón los afectan
const FIREBAR_SLOW = 0x28 / 256, FIREBAR_FAST = 0x38 / 256;   // giro en 1/32 de vuelta por cuadro (FirebarSpinSpdData)
const FIREBAR_BALL_STEP = 8;       // separación entre bolas, en px del NES
const FIREBAR_HIT = 3;             // medio lado de la caja de cada bola, en px del NES
const PODOBOO_SPEED = 7, PODOBOO_GRAVITY = 0x1c / 256;     // salto del Podoboo en px del NES por cuadro
const PODOBOO_INTERVAL_STEPS = 21;   // cuadros por "intervalo" del temporizador original
const BLOOBER_FLOAT_STEPS = 32;   // cuadros que flota hacia abajo antes de volver a mirar a Mario

const ENEMY_MARKERS = [
	{ id: 0x100, type: 'Goomba', sprite: 'Enemy_Goomba' },
	{ id: 0x101, type: 'Koopa', color: 'Green', sprite: 'Enemy_Koopa_Green' },
	{ id: 0x102, type: 'Pakkun', color: 'Green', sprite: 'Enemy_Pakkun_Green' },
	{ id: 0x103, type: 'Koopa_Winged', color: 'Red', sprite: 'Enemy_Koopa_Winged_Red' },
	{ id: 0x104, type: 'Koopa_Winged', color: 'Green', sprite: 'Enemy_Koopa_Winged_Green' },
	{ id: 0x105, type: 'Koopa', color: 'Red', sprite: 'Enemy_Koopa_Red' },
	{ id: 0x106, type: 'Pakkun', color: 'Red', sprite: 'Enemy_Pakkun_Red' },
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
	maxMapOffsetX = 0; // Rastrea el máximo offset de la cámara hacia la izquierda
	tileScale = SPRITE_SCALE;
	tileSize = TILE_PIXEL_SIZE * this.tileScale;
	velocityY = 0;
	jumpHeld = false;
	jumpOriginY = 0;
	jumpForceUp = SMB_JUMP.standing.up;
	jumpForceDown = SMB_JUMP.standing.down;
	physicsAccumulator = 0;
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
	pipeTransition = null;
	timeAcc = 0;
	swimTimer = 0;
	hidden1UpFlag = false;
	levelCoinTally = 0;
	xSpeed = 0;            // velocidad horizontal: unidades de 1/16 px por cuadro, con 8 bits de fracción
	movingDir = 1;
	facingDir = 1;
	runningTimer = 0;
	isSkidding = false;
	blockedDir = 0;
	physicsSteps = 0;
	fk = 1;
	clockMs = 0;
	starTimer = 0;
	timeExpired = false;
	afterTimeUp = null;
	stompChain = 0;
	halfwayPage = 0;
	levelTimeAtFlag = 0;
	bonusTimer = 0;
	fireworksLeft = 0;
	nextWorldOverride = null; // reemplaza al nextWorld del nivel actual (p. ej. al salir del 1-2 por el final del 1-1)

	availableWorlds = [];
	enemies = [];
	activeCoins = [];
	bumpingBlocks = [];
	activePowerups = [];
	scorePopups = [];
	brickParticles = [];
	activeFireballs = [];
	frameDt = 0; // segundos del frame actual, para js2d.drawAnimatedSprite(name, dt, pivot)
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
		MT.Ground, MT.Brick, MT.BrickUnderground, MT.Hard,
		MT.QuestionPowerup, MT.QuestionCoin, 0x58, 0x5f, MT.Hidden1Up, MT.Used, MT.Coin,
		0x10, 0x11, 0x14, 0x15,                        // caño vertical
		0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x21,            // caño lateral
		MT.FlagpoleTop, MT.Flagpole,
		...ENEMY_MARKERS.map(m => m.id),
	];

	OVERWORLD_COLOR = "#5C94FC";
	UNDERGROUND_COLOR = "#000000";
	UNDERWATER_COLOR = "#4240FF";
	CASTLE_COLOR = "#000000";
	NIGHT_COLOR = "#000000";

	velocityXGround = BASE_VELOCITY_GROUND;
	velocityXTurbo  = BASE_VELOCITY_TURBO;
	velocityXSwim   = BASE_VELOCITY_SWIM;


	constructor(engine, textSize, spriteScale = SPRITE_SCALE) {
		this.engine = engine;
		this.tileScale = spriteScale;
		this.tileSize = TILE_PIXEL_SIZE * this.tileScale;
		this.updatePhysicsScaling();
		this.specialBlocks = {};
		this.foregroundBlocks = FOREGROUND_METATILES;
		
		this.availableWorlds = [...new Set(map.filter(m => !m.hidden).map(m => m.world))].sort();
		this.currentWorldIndex = 0;

		const savedHighscore = this.engine.getCookie("smb_highscore");
		this.highscore = savedHighscore ? parseInt(savedHighscore, 10) : 0;

		const savedVolume = this.engine.getCookie("smb_volume");
		this.volume = savedVolume !== null ? parseFloat(savedVolume) : DEFAULT_VOLUME;
		this.updateMusicVolume();

		// Settings Menu
		this.currentSettingsSelection = 0;
		const savedDifficulty = this.engine.getCookie("smb_difficulty");
		this.difficulty = (savedDifficulty || "NORMAL").toUpperCase() === "HARD" ? "HARD" : "NORMAL"; // NORMAL o HARD; HARD es el modo difícil primario del original (un EASY guardado antes pasa a NORMAL)
		// Al terminar el juego se desbloquean la selección de mundo y el modo difícil, como en el original
		this.beaten = this.engine.getCookie("smb_beaten") === "true";
		const savedSFX = this.engine.getCookie("smb_sfx");
		this.sfxEnabled = savedSFX !== "false";

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
			case World_Type.Castle:
				tilesetName = "Castle_Tiles";
				break;
			case World_Type.Underwater:
				tilesetName = "Water_Tiles";
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
		js2d.defineSpriteFromTileset("Block_Coral", tilesetName, 5, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cannon_Top", tilesetName, 10, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cannon_Mid", tilesetName, 11, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cannon_Base", tilesetName, 12, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Axe", tilesetName, 13, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Rope_Bridge", tilesetName, 3, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Rope_Rail", tilesetName, 4, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Platform", tilesetName, 5, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Chain", tilesetName, 14, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Bridge", tilesetName, 15, 2, 1, tileScale);
		for (let id = 0x45; id <= 0x4b; id++) js2d.defineSpriteFromTileset(`Block_Castle_${id.toString(16)}`, tilesetName, id - 0x45, 5, 1, tileScale);
		for (const [id, [c, r]] of Object.entries(SCENERY_CELL)) js2d.defineSpriteFromTileset(`Scenery_${Number(id).toString(16)}`, tilesetName, c, r, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Question",				tilesetName, 0, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Object_Coinbox_Multiple",	tilesetName, 0, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Block_Question_Used",		tilesetName, 1, 1, 1, tileScale);
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
		js2d.defineSpriteFromTileset("Object_Star", sceneryTileset, 0, 8, 4, tileScale);

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
			case World_Type.Castle:
				tilesetName = "Castle_Tiles";
				break;
			case World_Type.Underwater:
				tilesetName = "Water_Tiles";
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
		js2d.defineSpriteFromTileset("Block_Coral", tilesetName, 5, 0, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cannon_Top", tilesetName, 10, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cannon_Mid", tilesetName, 11, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cannon_Base", tilesetName, 12, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Axe", tilesetName, 13, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Rope_Bridge", tilesetName, 3, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Rope_Rail", tilesetName, 4, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Cloud_Platform", tilesetName, 5, 3, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Chain", tilesetName, 14, 2, 1, tileScale);
		js2d.defineSpriteFromTileset("Block_Bridge", tilesetName, 15, 2, 1, tileScale);
		for (let id = 0x45; id <= 0x4b; id++) js2d.defineSpriteFromTileset(`Block_Castle_${id.toString(16)}`, tilesetName, id - 0x45, 5, 1, tileScale);
		for (const [id, [c, r]] of Object.entries(SCENERY_CELL)) js2d.defineSpriteFromTileset(`Scenery_${Number(id).toString(16)}`, tilesetName, c, r, 1, tileScale);

		js2d.defineSpriteFromTileset("Block_Question",				tilesetName, 0, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Object_Coinbox_Multiple",	tilesetName, 0, 1, 3, tileScale);
		js2d.defineSpriteFromTileset("Block_Question_Used",		tilesetName, 1, 1, 1, tileScale);
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
		js2d.defineSpriteFromTileset("Object_Star", sceneryTileset, 0, 8, 4, tileScale);

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
		const offsetY = mapHeight * this.tileSize - this.engine.getCanvasHeight();
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
		const offsetY = mapHeight * this.tileSize - this.engine.getCanvasHeight();
		// Sin redondear: js2d ajusta los bordes de cada tile a píxeles físicos, y si cada tile se redondea por su cuenta antes
		// (con una densidad de píxeles fraccionaria, como 1,25 o 1,5) queda una rendija de 1 px entre tiles vecinos
		const x = tx * this.tileSize + this.mapOffset.x;
		const y = ty * this.tileSize + this.mapOffset.y - offsetY;
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

			this.createEnemies();
			// En el agua la gravedad es la liviana de la natación; en tierra, la del salto parado
			this.jumpForceUp = this.isWater ? SWIM_FORCE_UP : SMB_JUMP.standing.up;
			this.jumpForceDown = this.isWater ? SWIM_FORCE_DOWN : SMB_JUMP.standing.down;
			this.swimTimer = 0;
		} else {
			console.error(`[GAME] No se pudo encontrar el mapa: ${name}`);
		}
	}

	// Enemigos del nivel: currentMap.enemies es una lista { type, color, x, y } con x, y en celdas
	// del mapa; las plantas piraña van sobre la boca del caño.
	createEnemies() {
		this.enemies = [];
		// Resortes: el original los pone como un objeto sobre dos metatiles (0x67 arriba y 0x68 abajo)
		// (se sacan del mapa la primera vez y quedan anotados para cuando se reinicia el nivel)
		if (!this.currentMap.springDefs) {
			this.currentMap.springDefs = [];
			const mw2 = this.currentMap.dimensions.width, ids = this.currentMap.map || [];
			for (let i = 0; i < ids.length; i++) {
				if (ids[i] !== 0x67) continue;
				this.currentMap.springDefs.push({ tx: i % mw2, ty: Math.floor(i / mw2) });
				ids[i] = 0; if (ids[i + mw2] === 0x68) ids[i + mw2] = 0;
			}
		}
		this.springs = this.currentMap.springDefs.map(d => ({ ...d, anim: 0, timer: 0, force: SPRING_BOUNCE }));
		this.vines = [];
		this.climbVine = null;
		this.loopPrevRight = null; this.loopPass = 0; this.loopCorrect = 0;
		this.cameraY = 0;
		this.lakituStopped = false;
		this.frenzyFilter = 0;
		this.hasLakitu = (this.currentMap.enemies || []).some(e => e.type === 'Lakitu');
		this.lakituTimer = 0;
		const base = (this.currentMap.platforms || []).map((d0) => {
			let d = d0;
			if (this.secondaryHard && d.w === 48) d = { ...d, w: 32 };   // en el modo difícil las plataformas grandes miden 32 px
			const p = { ...d, ox: d.x, oy: d.y, vx: 0, vy: 0, rider: false, t: d.kind === 'vert' ? -Math.PI / 2 : 0, active: false, falling: false };
			// La que sube y baja (InitVertPlatform): si empieza en la mitad de arriba de la pantalla (y < 0x80 del NES) su centro
			// está 64 px más abajo y arranca desde arriba; si no, su centro está 64 px más arriba y arranca desde abajo
			if (d.kind === 'vert') p.cy = d.y + 32 < 0x80 ? d.y + PLATFORM_VERT_HALF : d.y - PLATFORM_VERT_HALF;
			p.pc = 0; p.sc = 0; p.f = 0;
			return p;
		});
		base.forEach((p, i) => { if (p.pair !== undefined) { p.partner = base[p.pair]; p.first = i < p.pair; } });
		this.platforms = [];
		for (const p of base) {
			this.platforms.push(p);
			// Los elevadores chicos van con un doble 128 px más abajo
			if (p.small && p.kind === 'lift') this.platforms.push({ ...p, y: p.y + 128, oy: p.y + 128 });
		}
		// Cañones: cada bloque de cañón superior (0x64) dispara Bullet Bills mientras está en pantalla
		this.cannons = [];
		const mw = this.currentMap.dimensions.width, mapIds = this.currentMap.map || [];
		for (let i = 0; i < mapIds.length; i++) {
			if (mapIds[i] === 0x64) this.cannons.push({ tx: i % mw, ty: Math.floor(i / mw), timer: 0 });
		}
		for (const e0 of this.currentMap.enemies || []) {
			const e = (this.primaryHard && e0.type === 'Goomba') ? { ...e0, type: 'Koopa', color: 'Buzzy' } : e0;
			const screenPos = this.tileToScreen(e.x, e.y);
			if (e.type === 'Bowser') {
				const k = this.tileScale;
				const x = screenPos.x - this.mapOffset.x;
				this.enemies.push({
					id: this.enemies.length, type: 'Bowser', color: null,
					x, y: this.bridgeFloorY() - BOWSER_H * k, origX: x, hp: BOWSER_HP,
					dir: -1, vx: -1, vy: 0, state: 'walking', feet: 0, feetTimer: 32, mouth: false,
					fireTimer: BOWSER_FIRST_FLAME_STEPS, flameIdx: 0, jumpTimer: BOWSER_RANGE[0] * 2, range: BOWSER_RANGE[0],
					speed: 1, frame: 0, anim: 0, active: false,
				});
				continue;
			}
			if (NPC_TYPES.has(e.type)) {
				this.enemies.push({ id: this.enemies.length, type: e.type, color: null, x: screenPos.x - this.mapOffset.x, y: this.tileToScreen(0, 13).y - 1.5 * this.tileSize, dir: -1, vx: -1, vy: 0, state: 'walking', active: false });
				continue;
			}
			if (e.type === 'Pakkun') {
				const worldY = e.y * this.tileSize + this.tileSize * 2;
				const screenPosX = screenPos.x + this.tileSize / 2;
				this.enemies.push({
					type: 'Pakkun',
					color: e.color ?? null,
					x: (screenPosX - this.mapOffset.x),
					y: worldY,
					initialY: worldY,
					state: 'hiding',
					delay: 0,
					active: false
				});
			} else {
				this.enemies.push({
					id: this.enemies.length,
					type: e.type,
					color: e.color ?? null,
					x: screenPos.x - this.mapOffset.x,
					y: screenPos.y,
					dir: -1,
					vx: -this.enemyWalkSpeed() * this.tileScale,
					vy: 0,
					state: "walking",
					stompTimer: 0,
					isWinged: e.type === "Koopa_Winged",
					kicked: false,
					shellChain: 0,
					active: false,
					// Peces: altura original, sentido del vaivén y ciclo de brazadas del Bloober
					fast: !!e.fast, ccw: !!e.ccw, long: !!e.long, spin: 0, timer: 21, anim: 0,
					edgeTurn: e.type === 'HammerBro', walkTimer: 128, jumpTimer: 192 + Math.floor(Math.random() * 64), throwTimer: HAMMER_THROW_STEPS,
					origY: screenPos.y,
					bobDown: e.x % 2 === 0,
					swimPhase: 0,
					force: 0,
					floatTimer: 0,
					frame: 0,
				});
			}
		}
	}

	// Nombre del sprite con el que se dibuja una celda del mapa (null si no se dibuja).
	spriteNameForCell(blockId, idx) {
		if (blockId >= 0x100) return ENEMY_MARKERS.find(m => m.id === blockId)?.sprite ?? null;
		if (HIDDEN_BLOCKS.has(blockId)) return this.isEditorMode ? 'Block_Invisible' : null;
		if (BLOCK_ITEM[blockId] === 'coins') {
			// Ladrillo con monedas: parece un ladrillo hasta el primer golpe y queda vacío al agotarse
			const info = this.specialBlocks[idx];
			if (info?.exhausted) return 'Block_Used';
			return info?.revealed ? 'Block_Question' : METATILE_SPRITE[blockId];
		}
		return METATILE_SPRITE[blockId] ?? (isSolidMetatile(blockId) ? 'Block_Stairs' : null);
	}

	saveGameState() {
		const player = this.engine.animatedSprites[PlayerName[this.player]];
		this.savedState = {
			playerPos: {x: player.position.x, y: player.position.y}, mapOffset: {x: this.mapOffset.x, y: this.mapOffset.y},
			player: this.player, velocityX: this.velocityX, velocityY: this.velocityY, time: this.time, score: this.score, lives: this.lives,
			coins: this.coins, isOnGround: this.isOnGround, currentAnimation: player.currentAnimation,
			mapState: JSON.parse(JSON.stringify(this.currentMap)), enemiesState: JSON.parse(JSON.stringify(this.enemies)),
			specialBlocksState: JSON.parse(JSON.stringify(this.specialBlocks)), nextWorldOverride: this.nextWorldOverride
		};
	}

	restoreGameState() {
		if (this.savedState) {
			this.currentMap = this.savedState.mapState;
			this.enemies = this.savedState.enemiesState;
			this.specialBlocks = this.savedState.specialBlocksState;
			this.nextWorldOverride = this.savedState.nextWorldOverride ?? null;
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
		this.playerSize = Player_Size.Small;
		this.halfwayPage = 0;
		this.hidden1UpFlag = true;   // en un juego nuevo aparece el primer 1UP oculto (el del 1-1)
		this.resetLevelState();
		this.transitionToBlackScreen(Black_Screen_Type.Start_Level, BLACK_SCREEN_DURATION);
	}

	damagePlayer() {
		if (this.isInvincible || this.starTimer > 0) return;

		if (this.playerSize > Player_Size.Small) {
			this.playerSize = Player_Size.Small;
			this.isInvincible = true;
			this.invincibleTimer = INJURY_INVINCIBLE_MS;
			this.engine.playAudio(audio["Player_Pipe"], false);
		} else {
			this.killPlayer();
		}
	}

	killPlayer() {
		if (this.state === Game_State.Playing) {
			this.state = Game_State.Player_Dying;
			this.deathTimer = 0;
			this.velocityY = -4 * this.tileScale;

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
		const timeUp = this.timeExpired;
		this.timeExpired = false;
		this.rememberHalfway();
		this.playerSize = Player_Size.Small;
		if (this.lives > 0) {
			this.resetLevelState();
			if (timeUp) {
				this.afterTimeUp = 'start';
				this.transitionToBlackScreen(Black_Screen_Type.Time_Up, 2500);
			} else {
				this.transitionToBlackScreen(Black_Screen_Type.Start_Level, BLACK_SCREEN_DURATION);
			}
		} else if (timeUp) {
			this.afterTimeUp = 'gameover';
			this.transitionToBlackScreen(Black_Screen_Type.Time_Up, 2500);
		} else {
			this.transitionToBlackScreen(Black_Screen_Type.Game_Over, 6500);
		}
	}

	// Al morir, si la pantalla ya pasó la página del punto de reinicio del nivel, se vuelve a empezar
	// desde ahí (HalfwayPageNybbles); si no, desde el principio.
	rememberHalfway() {
		const main = map.find(m => m.world === this.availableWorlds[this.currentWorldIndex]);
		if (!main || this.currentMap?.world !== main.world || !main.halfway) return;
		const page = Math.floor(-this.mapOffset.x / (16 * this.tileSize));
		this.halfwayPage = main.halfway <= page ? main.halfway : 0;
	}

	// El contador baja 1 unidad cada 24 cuadros del NES; al llegar a 0 Mario muere
	updateGameTimer(dt) {
		this.timeAcc += dt;
		while (this.timeAcc >= GAME_TIMER_TICK_MS) {
			this.timeAcc -= GAME_TIMER_TICK_MS;
			if (this.time > 0 && --this.time === 0 && this.state === Game_State.Playing) {
				this.timeExpired = true;
				this.killPlayer();
			}
		}
	}

	// Como en el original, el 1UP oculto sólo se dibuja si la bandera está activa, y sólo el primero del nivel
	applyHidden1Up() {
		const w = this.currentMap.dimensions.width, h = this.currentMap.dimensions.height, tiles = this.currentMap.map;
		let kept = false;
		for (let x = 0; x < w; x++) {
			for (let y = 0; y < h; y++) {
				if (tiles[y * w + x] !== MT.Hidden1Up) continue;
				if (this.hidden1UpFlag && !kept) { kept = true; this.hidden1UpFlag = false; }
				else tiles[y * w + x] = 0;
			}
		}
		this.pristineMapData = JSON.parse(JSON.stringify(tiles));
	}

	// Al terminar el nivel -3 con suficientes monedas, aparece el 1UP oculto del siguiente
	rewardHidden1Up() {
		const main = this.availableWorlds[this.currentWorldIndex] ?? '';
		const [world, level] = main.split('-').map(Number);
		if (level === 3 && this.levelCoinTally >= HIDDEN_1UP_COINS[world - 1]) this.hidden1UpFlag = true;
	}

	get isWater() { return this.currentMap?.type === World_Type.Underwater; }

	resetHorizontalMotion() {
		this.xSpeed = 0;
		this.movingDir = 1;
		this.facingDir = 1;
		this.runningTimer = 0;
		this.isSkidding = false;
		this.blockedDir = 0;
	}

	// Un paso de 1/60 s de la velocidad horizontal de Mario, como en PlayerPhysicsSub del original
	stepPlayerX(left, right, runButton) {
		const onGround = this.isOnGround;
		let dir = right ? 1 : (left ? -1 : 0);               // si se aprietan las dos, gana la derecha
		let absSpeed = Math.abs(Math.floor(this.xSpeed / 256));

		// Con velocidad baja, apretar el otro lado da media vuelta en el acto; con velocidad alta, derrapa
		if (onGround && dir !== 0 && dir !== this.movingDir && absSpeed < 0x0b) {
			this.movingDir = this.facingDir;
			this.xSpeed = 0;
			absSpeed = 0;
		}
		this.isSkidding = onGround && dir !== 0 && dir !== this.movingDir && absSpeed >= 0x0b;
		if ((onGround || this.isWater) && dir !== 0) this.facingDir = dir;   // en el agua también se gira

		// El choque con una pared del cuadro anterior anula el sentido en que se empujaba
		const pushed = (dir !== 0 && dir === this.blockedDir) ? 0 : dir;
		this.blockedDir = 0;

		if (this.runningTimer > 0) this.runningTimer--;

		// Límite de velocidad y fricción según el estado (X_Physics)
		let maxIdx = 0, fricIdx = 0;
		const sameDir = dir !== 0 && dir === this.movingDir;
		if (!onGround) {
			if (absSpeed < 0x19) { maxIdx = 1; fricIdx = 1; if (absSpeed >= 0x21) fricIdx = 2; }
		} else if (sameDir && (runButton || this.runningTimer > 0)) {
			if (runButton) this.runningTimer = RUNNING_TIMER_STEPS;
		} else {
			maxIdx = 1; fricIdx = (absSpeed >= 0x1c || absSpeed >= 0x21) ? 2 : 1;
		}
		if (this.isWater && onGround) { maxIdx = 2; fricIdx = absSpeed >= 0x21 ? 2 : 1; }
		let friction = X_FRICTION[fricIdx];
		if (this.facingDir !== this.movingDir) friction *= 2;   // frenar contra el sentido de marcha
		const maxRight = X_MAX_RIGHT[maxIdx] * 256, maxLeft = X_MAX_LEFT[maxIdx] * 256;

		// En el aire sólo hay fricción si se aprieta una dirección
		if (!onGround && pushed === 0) { /* conserva la velocidad */ }
		else if (pushed > 0) {
			this.xSpeed += friction;
			if (Math.floor(this.xSpeed / 256) >= X_MAX_RIGHT[maxIdx]) this.xSpeed = maxRight;
		} else if (pushed < 0) {
			this.xSpeed -= friction;
			if (Math.floor(this.xSpeed / 256) < X_MAX_LEFT[maxIdx]) this.xSpeed = maxLeft;
		} else if (this.xSpeed !== 0) {
			// Sin teclas, la fricción frena hasta quedar quieto
			const before = Math.sign(this.xSpeed);
			this.xSpeed -= before * friction;
			if (Math.sign(this.xSpeed) !== before) this.xSpeed = 0;
		}
		if (this.xSpeed !== 0) this.movingDir = Math.sign(this.xSpeed);
	}

	// Una vez por cuadro: cuántos pasos de 1/60 s de física hay que correr, igual para Mario, enemigos y objetos
	stepFrame(dt) {
		this.clockMs += dt;
		this.fk = Math.min(dt, 100) / PHYSICS_STEP_MS;
		this.physicsAccumulator = Math.min(this.physicsAccumulator + dt, PHYSICS_STEP_MS * 5);
		this.physicsSteps = Math.max(0, Math.floor((this.physicsAccumulator + PHYSICS_STEP_TOLERANCE_MS) / PHYSICS_STEP_MS));
		this.physicsAccumulator -= this.physicsSteps * PHYSICS_STEP_MS;
		if (this.starTimer > 0) this.starTimer = Math.max(0, this.starTimer - dt);
		this.swimTimer = Math.max(0, this.swimTimer - this.physicsSteps);
	}

	giveLife() {
		this.lives++;
		this.engine.playAudio(audio["Life"], false);
	}

	addCoin() {
		this.coins++;
		this.levelCoinTally++;
		this.score += 200;
		if (this.coins >= 100) {
			this.coins = 0;
			this.giveLife();
		}
	}

	// Puntos de la cadena de pisotones (se reinicia al tocar el suelo). first es el escalón de partida:
	// 1 al pisar, 3 al patear un caparazón. Devuelve el texto del puntaje.
	awardChain(first, x, y) {
		this.stompChain++;
		const step = Math.min(first - 1 + this.stompChain, SCORE_CHAIN.length - 1);
		const value = SCORE_CHAIN[step];
		if (value === 'life') {
			this.giveLife();
			this.spawnScorePopup('1UP', x, y);
		} else {
			this.score += value;
			this.spawnScorePopup(String(value), x, y);
		}
	}

	transitionToBlackScreen(type, duration) {
		this.state = Game_State.Black_Screen;
		this.screenType = type;
		this.screenTimer = 0;
		this.screenDuration = duration;
	}
	
	handleBlackScreenEnd() {
		if (this.screenType === Black_Screen_Type.Time_Up) {
			const next = this.afterTimeUp;
			this.afterTimeUp = null;
			if (next === 'gameover') this.transitionToBlackScreen(Black_Screen_Type.Game_Over, 6500);
			else this.transitionToBlackScreen(Black_Screen_Type.Start_Level, BLACK_SCREEN_DURATION);
			return;
		}
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
		this.engine.stopAudio(audio["Hurry_Theme"]);
		this.engine.stopAudio(audio["Star_Theme"]);
	}

	resetLevelState() {
		this.velocityY = 0;
		this.specialBlocks = {};
		this.flagpoleFlag = null;
		this.maxMapOffsetX = 0;
		this.nextWorldOverride = null;
		this.pipeTransition = null;
	
		if (this.currentMap && this.currentWorldIndex) {
			this.loadMap(this.availableWorlds[this.currentWorldIndex]);
		} else {
			this.loadMap("1-1");
		}

		this.time = this.currentMap.time ?? 400;
		this.timeAcc = 0;
		this.timeExpired = false;
		this.stompChain = 0;
		this.levelCoinTally = 0;
		this.applyHidden1Up();
		this.resetHorizontalMotion();

		// Mario arranca a 40 px (2,5 tiles) del borde izquierdo de la pantalla, en el punto de reinicio si lo hay
		const playerSprite = this.engine.animatedSprites[PlayerName[this.player]];
		if (this.halfwayPage > 0) {
			this.mapOffset.x = -(this.halfwayPage * 16 * this.tileSize);
			this.maxMapOffsetX = this.mapOffset.x;
		}
		playerSprite.position = {x: 2.5 * this.tileSize, y: 100};
	}

	resetLevel() {
		const player = this.engine.animatedSprites[PlayerName[this.player]];
		player.position.x = 300; player.position.y = 300;
		this.mapOffset.x = 0; this.maxMapOffsetX = 0; this.velocityY = 0; this.coins = 0; this.score = 0;
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
		this.halfwayPage = 0;

		this.resetLevelState();
		
		this.transitionToBlackScreen(Black_Screen_Type.Start_Level, BLACK_SCREEN_DURATION);
	}

	// --- Subniveles por caños ----------------------------------------------------------------------

	currentPlayerSpriteName() {
		switch (this.playerSize) {
			case Player_Size.Big: return PlayerName[this.player] + "_Big";
			case Player_Size.Fire: return PlayerName[this.player] + "_Fire";
			default: return PlayerName[this.player];
		}
	}

	currentPlayerAnimPrefix() {
		return PlayerName[this.player] + (this.playerSize === Player_Size.Fire ? "_Fire" : (this.playerSize > Player_Size.Small ? "_Big" : ""));
	}

	// Un warp está en el mapa como { type, x, y, to, spawn }: x, y es la celda superior izquierda del caño.
	// "down" se entra parado sobre la boca apretando abajo; "right" caminando contra la boca lateral.
	findPipeWarp(playerPos, playerHeight) {
		const warps = this.currentMap?.warps;
		if (!warps || !warps.length || (!this.isOnGround && !this.isWater)) return null;
		const ts = this.tileSize;
		const keys = this.engine.keysPressed;
		const down = keys['ArrowDown'] || keys['KeyS'];
		const right = keys['ArrowRight'] || keys['KeyD'];
		const worldLeft = playerPos.x - this.mapOffset.x;
		const feet = playerPos.y + playerHeight;
		for (const warp of warps) {
			const left = warp.x * ts;
			if (warp.type === 'down' && down) {
				const top = this.tileToScreen(warp.x, warp.y).y;
				const center = worldLeft + ts / 2;
				if (Math.abs(feet - top) < ts * 0.1 && center > left + ts * 0.25 && center < left + ts * 1.75) return warp;
			} else if (warp.type === 'right' && right) {
				const floor = this.tileToScreen(warp.x, warp.y + 2).y;
				const worldRight = worldLeft + ts;
				const touching = worldRight >= left - 2 && worldRight <= left + ts * 0.3;
				if (!touching) continue;
				// Sobre el piso, o nadando con el cuerpo a la altura de la boca (los dos tiles del caño)
				const mouthTop = this.tileToScreen(warp.x, warp.y).y;
				const centerY = playerPos.y + playerHeight / 2;
				if (Math.abs(feet - floor) < ts * 0.1 || (this.isWater && centerY > mouthTop && centerY < mouthTop + 2 * ts)) return warp;
			}
		}
		return null;
	}

	startPipeTransition(warp, playerHeight) {
		const sprite = this.engine.animatedSprites[this.currentPlayerSpriteName()];
		this.pipeTransition = {
			phase: 'enter', t: 0, warp, playerHeight,
			startX: sprite.position.x, startY: sprite.position.y,
		};
		this.state = Game_State.Pipe_Transition;
		this.velocityY = 0;
		this.isSliding = false;
		this.slideVelocityX = 0;
		this.skidTimer = 0;
		this.resetHorizontalMotion();
		this.engine.playAudio(audio["Player_Pipe"], false);
	}

	// Deja la cámara de modo que Mario quede donde está su spawn, sin mostrar nada más allá del fin del mapa.
	placePlayerAtSpawn(spawn, sprite, playerHeight) {
		const ts = this.tileSize;
		const cw = this.engine.getCanvasWidth();
		const mapPx = this.currentMap.dimensions.width * ts;
		const worldX = spawn.emerge === 'up' ? spawn.x * ts + ts / 2 : spawn.x * ts;
		if (mapPx >= cw) {
			let offset = worldX > cw / 2 ? -(worldX - cw / 2) : 0;
			offset = Math.max(offset, -(mapPx - cw));
			this.mapOffset.x = offset;
		}
		this.maxMapOffsetX = this.mapOffset.x;
		sprite.position.x = worldX + this.mapOffset.x;
		sprite.flipped = false;
		const cellTop = this.tileToScreen(spawn.x, spawn.y).y;
		if (spawn.emerge === 'up') {
			sprite.position.y = cellTop;
			return { fromY: cellTop, toY: cellTop - playerHeight };
		}
		sprite.position.y = cellTop;
		return null;
	}

	performPipeWarp(tr) {
		const warp = tr.warp;
		const spawn = warp.spawn;
		if (!map.some(m => m.world === warp.to)) {
			console.error(`[GAME] El warp apunta a un mapa inexistente: ${warp.to}`);
			this.finishPipeTransition();
			return;
		}
		if (spawn.start) {
			// Zona de atajos: se entra al caño y el otro mundo arranca desde el principio
			this.pipeTransition = null;
			this.state = Game_State.Playing;
			this.stopAllMusic();
			this.hidden1UpFlag = true;
			this.startNextLevel(warp.to);
			return;
		}
		this.stopAllMusic();
		this.loadMap(warp.to);
		this.specialBlocks = {};
		this.activeCoins = [];
		this.bumpingBlocks = [];
		this.activePowerups = [];
		this.scorePopups = [];
		this.brickParticles = [];
		this.activeFireballs = [];
		this.flagpoleFlag = null;
		this.flagpoleInfo = null;
		if (spawn.then) this.nextWorldOverride = spawn.then;

		const sprite = this.engine.animatedSprites[this.currentPlayerSpriteName()];
		const rise = this.placePlayerAtSpawn(spawn, sprite, tr.playerHeight);
		if (rise) {
			tr.phase = 'exit';
			tr.t = 0;
			tr.fromY = rise.fromY;
			tr.toY = rise.toY;
			this.engine.playAudio(audio["Player_Pipe"], false);
		} else {
			this.finishPipeTransition();
		}
	}

	finishPipeTransition() {
		this.pipeTransition = null;
		this.state = Game_State.Playing;
		this.velocityY = 0;
		this.isOnGround = false;
		this.jumpHeld = true;   // si sigue apretado el salto, no dispara uno al salir
		this.physicsAccumulator = 0;
		this.wasCrouching = false;
	}

	updateAndDrawPipeTransition(dt) {
		const tr = this.pipeTransition;
		if (!tr) { this.state = Game_State.Playing; return; }
		const ts = this.tileSize;
		const name = this.currentPlayerSpriteName();
		const prefix = this.currentPlayerAnimPrefix();
		const sprite = this.engine.animatedSprites[name];

		tr.t += dt;
		const p = Math.min(1, tr.t / PIPE_TRANSITION_MS);
		if (tr.phase === 'enter') {
			if (tr.warp.type === 'down') {
				sprite.position.y = tr.startY + tr.playerHeight * p;
				this.engine.setAnimationForSprite(name, `${prefix}_Idle`);
			} else {
				sprite.position.x = tr.startX + ts * 1.6 * p;
				sprite.flipped = false;
				this.engine.setAnimationForSprite(name, `${prefix}_Run`);
			}
			if (p >= 1) this.performPipeWarp(tr);
		} else {
			sprite.position.y = tr.fromY + (tr.toY - tr.fromY) * p;
			this.engine.setAnimationForSprite(name, `${prefix}_Idle`);
			if (p >= 1) {
				sprite.position.y = tr.toY;
				this.finishPipeTransition();
				this.isOnGround = true;
			}
		}

		this.drawBackground();
		this.drawBlocks();
		this.drawBumpingBlocksOverlay();
		this.drawEnemies(dt);
		this.engine.drawAnimatedSprite(name, this.frameDt, Pivot.Top_Left);
		this.drawForegroundBlocks();
		this.drawUI();
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
		const ts = this.tileSize, k = this.tileScale;
		const screenLeft = -this.mapOffset.x;
		const screenRight = screenLeft + this.engine.getCanvasWidth();
		this.updateCannons(player, screenLeft, screenRight);
		this.updateFrenzy(player, screenLeft, screenRight);
		this.updateLoops(player, screenRight);
		this.updateVines(player);
		this.updateBubbles(player);
		if (this.hasLakitu && !this.lakituStopped && !this.enemies.some(e => e.type === 'Lakitu') && (this.lakituTimer += this.physicsSteps) >= LAKITU_RESPAWN_STEPS) {
			// Si lo derrotan, otro Lakitu vuelve a aparecer por la derecha pasado un rato
			this.lakituTimer = 0;
			this.enemies.push({ id: this.enemies.length, type: 'Lakitu', color: null, x: screenRight + 2 * ts, y: ts * 1.4 - (this.cameraY || 0), dir: -1, vx: -1, vy: 0, vx0: 0, state: 'walking', throwTimer: LAKITU_EGG_STEPS, active: true, anim: 0 });
		}
		this.updatePlatforms(player, screenLeft, screenRight);
		this.updateSprings(player);

		for (let i = this.enemies.length - 1; i >= 0; i--) {
			const enemy = this.enemies[i];

			// Como en el original, los enemigos aparecen al acercarse la pantalla y se van al quedar atrás
			if (enemy.x + ts < screenLeft - ENEMY_DESPAWN_BEHIND * k) { this.enemies.splice(i, 1); continue; }
			if (!enemy.active) {
				if (enemy.x <= screenRight + ENEMY_ACTIVATE_AHEAD * ts) enemy.active = true;
				else continue;
			}

			let remove = false;
			for (let s = 0; s < this.physicsSteps; s++) {
				if (this.stepEnemy(enemy, player) === 'remove') { remove = true; break; }
			}
			if (remove || (enemy.state === 'falling' && enemy.y > this.engine.getCanvasHeight())) { this.enemies.splice(i, 1); continue; }

			this.playerVsEnemy(enemy, player);
		}
	}

	// Un paso de 1/60 s de un enemigo
	stepEnemy(enemy, player) {
		const ts = this.tileSize, k = this.tileScale, off = this.mapOffset.x;
		const W = this.currentMap.dimensions.width, tiles = this.currentMap.map;
		const solidAt = (worldX, screenY) => isSolidMetatile(tiles[this.engine.coordsToIndex(this.screenToTile(worldX + off, screenY), W)]);

		if (enemy.type === 'Pakkun') { this.stepPiranha(enemy, player); return; }
		if (SWIMMERS.has(enemy.type)) return this.stepSwimmer(enemy, player);
		if (enemy.type === 'Firebar') { this.stepFirebar(enemy); return; }
		if (enemy.type === 'BulletBill') return this.stepBulletBill(enemy);
		if (enemy.type === 'Bowser') { this.stepBowser(enemy, player); return; }
		if (enemy.type === 'BowserFlame') return this.stepBowserFlame(enemy);
		if (NPC_TYPES.has(enemy.type)) return;
		if (enemy.type === 'Podoboo') { this.stepPodoboo(enemy); return; }
		if (enemy.type === 'Lakitu') return this.stepLakitu(enemy, player);
		if (enemy.type === 'Hammer') return this.stepHammer(enemy);
		if (enemy.type === 'Spiny' || enemy.type === 'HammerBro') enemy.anim = (enemy.anim || 0) + 1;
		if (enemy.type === 'Spiny' && enemy.state === 'egg') { this.stepSpinyEgg(enemy, player); return; }
		if (enemy.type === 'HammerBro' && enemy.state === 'walking') this.hammerBroLogic(enemy, player);

		if (enemy.state === 'stomped') {
			enemy.stompTimer++;
			return enemy.stompTimer > STOMPED_GOOMBA_STEPS ? 'remove' : undefined;
		}

		const height = this.enemyHeight(enemy);
		const jumper = !!enemy.isWinged;

		// Un caparazón quieto se sacude y vuelve a ser un koopa que camina hacia un lado al azar
		if (enemy.state === 'shell' && !enemy.kicked && enemy.reviveTimer !== undefined) {
			if (--enemy.reviveTimer <= 0) {
				enemy.state = 'walking';
				enemy.dir = Math.random() < 0.5 ? -1 : 1;
				enemy.reviveTimer = undefined;
			}
		}

		// Velocidad horizontal según el estado: camina, el caparazón pateado corre y el quieto no se mueve
		const speed = enemy.state === 'shell' ? (enemy.kicked ? ENEMY_SHELL_SPEED : 0) : (enemy.walkSpeed ?? this.enemyWalkSpeed());
		enemy.vx = enemy.dir * speed * k;

		// Vertical: primero se mueve y después se suma la gravedad, como ImposeGravity
		enemy.y += enemy.vy;
		let onGroundLeft = false, onGroundRight = false, grounded = false;
		if (enemy.state !== 'falling') {
			const feetY = enemy.y + height;
			const feetLeft = this.screenToTile(enemy.x + off + 4, feetY);
			const feetRight = this.screenToTile(enemy.x + off + ts - 4, feetY);
			onGroundLeft = isSolidMetatile(tiles[this.engine.coordsToIndex(feetLeft, W)]);
			onGroundRight = isSolidMetatile(tiles[this.engine.coordsToIndex(feetRight, W)]);
			if (enemy.vy >= 0 && (onGroundLeft || onGroundRight)) {
				enemy.y = this.tileToScreen(feetLeft.x, feetLeft.y).y - height;
				enemy.vy = jumper ? ENEMY_JUMP_SPEED * k : 0;
				grounded = true;
			}
		}
		enemy.grounded = grounded;
		enemy.vy = Math.min(enemy.vy + (jumper ? JUMPER_GRAVITY : ENEMY_GRAVITY) * k, ENEMY_MAX_FALL * k);

		if (enemy.vx !== 0) {
			enemy.x += enemy.vx;
			if (enemy.state !== 'falling') {
				const wallX = enemy.vx > 0 ? enemy.x + ts : enemy.x;
				if (solidAt(wallX, enemy.y + height - 4)) {
					enemy.dir *= -1;
					if (enemy.edgeTurn) enemy.holdDir = 30;
					if (enemy.state === 'shell') enemy.x += enemy.dir;
				} else if (enemy.state === 'walking' && grounded && !jumper && (enemy.color === 'Red' || enemy.edgeTurn)) {
					// Sólo el Koopa rojo se frena en el borde; el verde se cae de las plataformas
					if (enemy.dir < 0 && !onGroundLeft) { enemy.dir = 1; enemy.holdDir = 30; }
					else if (enemy.dir > 0 && !onGroundRight) { enemy.dir = -1; enemy.holdDir = 30; }
				}
			}
		}

		// Un caparazón pateado se lleva puestos a los demás enemigos; cada uno vale más que el anterior
		if (enemy.state === 'shell' && enemy.kicked) {
			const rect = { x: enemy.x + off, y: enemy.y, w: ts, h: ts };
			for (const other of this.enemies) {
				if (other === enemy || !other.active || other.state === 'falling' || other.state === 'stomped') continue;
				const oh = this.enemyHeight(other);
				if (this.rectsOverlap(rect, { x: other.x + off, y: other.y, w: ts, h: oh })) {
					this.defeatEnemy(other, SCORE_CHAIN[Math.min(4 + enemy.shellChain++, SCORE_CHAIN.length - 1)]);
				}
			}
		}
	}

	// Lleva a Mario a otra área sin la animación del caño (enredadera o caída de una sala de nubes)
	warpTo(warp, playerHeight) {
		this.climbVine = null;
		const tr = { warp, playerHeight, phase: 'exit' };
		this.pipeTransition = tr;
		this.state = Game_State.Pipe_Transition;
		this.performPipeWarp(tr);
	}

	// Burbujas de Mario nadando: sale una cada 48 cuadros de la boca y sube hasta la superficie del agua
	updateBubbles(player) {
		if (!this.bubbles) this.bubbles = [];
		if (!this.isWater || this.state !== Game_State.Playing) { this.bubbles.length = 0; return; }
		const k = this.tileScale, ts = this.tileSize, pos = player.position, top = this.tileToScreen(0, 2).y;
		for (let st = 0; st < this.physicsSteps; st++) {
			this.bubbleTimer = (this.bubbleTimer ?? BUBBLE_STEPS) - 1;
			if (this.bubbleTimer <= 0) {
				this.bubbleTimer = BUBBLE_STEPS;
				const big = this.playerSize > Player_Size.Small;
				this.bubbles.push({ x: pos.x + (this.facingDir < 0 ? 0 : ts - 8 * k), y: pos.y + (big ? 6 : 2) * k });
			}
			for (const b of this.bubbles) b.y -= BUBBLE_SPEED * k;
		}
		this.bubbles = this.bubbles.filter(b => b.y > top);
	}

	drawBubbles() {
		const sprite = this.engine.sprites['Bubble'];
		if (!sprite) return;
		for (const b of this.bubbles || []) this.engine.drawSprite('Bubble', 0, { x: b.x, y: b.y }, sprite.scale, false, 0, Pivot.Top_Left);
	}

	// Texto de la zona de atajos: el título y, sobre cada caño, el mundo al que lleva
	drawWarpZoneText() {
		const pipes = (this.currentMap?.warps || []).filter(w => w.spawn && w.spawn.start);
		if (!pipes.length || this.state !== Game_State.Playing) return;
		const ts = this.tileSize, W = this.engine.getCanvasWidth();
		const shown = pipes.map(w => ({ w, pos: this.tileToScreen(w.x, w.y) })).filter(p => p.pos.x > -ts && p.pos.x < W);
		if (!shown.length) return;
		this.engine.drawTextCustom(font, 'WELCOME TO WARP ZONE!', TEXT_SIZE, Color.WHITE, { x: W / 2, y: ts * 2.4 }, "center");
		for (const { w, pos } of shown) this.engine.drawTextCustom(font, String(w.to).split('-')[0], TEXT_SIZE, Color.WHITE, { x: pos.x + ts, y: pos.y - ts * 0.7 }, "center");
	}

	// --- Enredaderas ---------------------------------------------------------------------------

	spawnVine(tx, ty) {
		this.vines.push({ tx, ty, h: 0 });
		this.engine.playAudioOverlap(audio["Vine"]);
	}

	// Crece, y Mario se agarra si la toca apretando arriba o abajo; trepa con arriba y abajo y sube al nivel de nubes
	updateVines(player) {
		if (!this.vines || !this.vines.length) return;
		const k = this.tileScale, ts = this.tileSize, pos = player.position;
		const h = this.playerHeightPx();
		const keys = this.engine.keysPressed;
		const up = !!(keys['ArrowUp'] || keys['KeyW']), down = !!(keys['ArrowDown'] || keys['KeyS']);
		const levelTop = this.tileToScreen(0, 2).y;
		for (const v of this.vines) {
			const base = this.tileToScreen(v.tx, v.ty);
			for (let st = 0; st < this.physicsSteps; st++) if (v.h < (v.max ?? VINE_MAX)) v.h = Math.min(v.max ?? VINE_MAX, v.h + VINE_GROW_SPEED);
			v.max = Math.min(VINE_MAX, (base.y - levelTop) / k);   // no pasa del borde de arriba del nivel
			v.h = Math.min(v.h, v.max);
			v.baseX = base.x; v.baseY = base.y;
		}
		if (this.state !== Game_State.Playing) return;
		if (!this.climbVine) {
			if (!up && !down) return;
			const box = this.playerHitbox(player);
			for (const v of this.vines) {
				if (v.h < 16) continue;
				const rect = { x: v.baseX + 4 * k, y: v.baseY - v.h * k, w: 8 * k, h: v.h * k };
				if (this.rectsOverlap(box, rect)) { this.climbVine = v; this.climbSide = 0; pos.x = v.baseX; this.velocityY = 0; this.isOnGround = false; break; }
			}
			return;
		}
		// Trepando
		const v = this.climbVine, top = v.baseY - v.h * k;
		this.climbMoving = up !== down;
		this.isOnGround = false; this.velocityY = 0;
		for (let st = 0; st < this.physicsSteps; st++) {
			if (up) pos.y -= CLIMB_SPEED * k; else if (down) pos.y += CLIMB_SPEED * k;
			if (keys['ArrowLeft'] || keys['KeyA']) { this.facingDir = -1; this.climbSide++; }
			else if (keys['ArrowRight'] || keys['KeyD']) { this.facingDir = 1; this.climbSide++; }
			else this.climbSide = 0;
		}
		// Soltarse: bajar hasta el ladrillo, o apretar a un costado un rato
		if (pos.y + h >= v.baseY || this.climbSide > 20) {
			if (pos.y + h >= v.baseY) { pos.y = v.baseY - h; this.isOnGround = true; }
			this.climbVine = null;
			return;
		}
		// Llegar arriba: en el nivel con sala de nubes, Mario sube a ella
		if (pos.y <= top - h * 0.3) {
			const warp = (this.currentMap.warps || []).find(w => w.type === 'vine' && Math.abs(w.x - v.tx) <= 1);
			if (warp && v.h >= v.max - 1) { this.warpTo(warp, h); return; }
			pos.y = top - h * 0.3;
		}
	}

	drawVines() {
		const k = this.tileScale, w = this.engine.getCanvasWidth();
		for (const v of this.vines || []) {
			if (v.baseX === undefined || v.h < 8 || v.baseX + this.tileSize < 0 || v.baseX > w) continue;
			const top = v.baseY - v.h * k;
			const n = Math.ceil(v.h / 8);
			for (let i = 0; i < n; i++) this.engine.drawSprite('Vine_Segment', i === 0 ? 1 : 0, { x: v.baseX + k, y: top + i * 8 * k }, k, false, 0, Pivot.Top_Left);
		}
	}

	// Laberintos de los castillos: cuando la pantalla llega al borde de una página marcada, Mario tiene que estar en el
	// suelo a la altura que pide el original (los pies, en px del NES: 16 de la barra de arriba más la altura en el nivel);
	// si no, vuelve cuatro páginas atrás y los enemigos se vuelven a armar
	updateLoops(player, screenRight) {
		const loops = this.currentMap.loops;
		if (!loops || !loops.length) return;
		const k = this.tileScale;
		const right = screenRight / k;
		const prev = this.loopPrevRight ?? right;
		this.loopPrevRight = right;
		if (right <= prev || right - prev > 64) return;   // sólo cuenta el avance continuo, no los saltos de un caño
		for (const L of loops) {
			const edge = L.page * 256;
			if (!(prev < edge && right >= edge)) continue;
			const feet = 16 + (player.position.y + this.playerHeightPx() - this.platformBaseY()) / k;
			const ok = this.isOnGround && Math.abs(feet - (L.y + 16)) <= LOOP_TOLERANCE;
			if (this.currentMap.multi) {
				this.loopPass = (this.loopPass || 0) + 1;
				if (ok) this.loopCorrect = (this.loopCorrect || 0) + 1;
				if (this.loopPass >= 3) {
					const failed = (this.loopCorrect || 0) < 3;
					this.loopPass = this.loopCorrect = 0;
					if (failed) this.loopBack();
				}
			} else if (!ok) this.loopBack();
		}
	}

	loopBack() {
		const d = LOOP_BACK_PAGES * 256 * this.tileScale;
		this.mapOffset.x = Math.min(0, this.mapOffset.x + d);
		this.maxMapOffsetX = this.mapOffset.x;
		this.loopPrevRight = null;
		this.createEnemies();
	}

	// Ataque continuo de los niveles (AreaFrenzy): cheep-cheeps que saltan, Bullet Bills desde la derecha o, en el agua,
	// cheep-cheeps que nadan desde la derecha. Rige desde que la pantalla llega a su marca hasta la marca de fin, y las
	// marcas de fin también retiran a Lakitu. Los que nadan o vuelan salen cada 32 cuadros o según FlyCCTimerData; el Bullet
	// Bill sale de a uno. La altura sale de Enemy17YPosData sin repetir hasta usar las ocho.
	updateFrenzy(player, screenLeft, screenRight) {
		const list = this.currentMap.frenzy;
		if (!list || !list.length) return;
		const ts = this.tileSize, k = this.tileScale, W = this.engine.getCanvasWidth(), H = this.engine.getCanvasHeight();
		let mode = null;
		for (const f of list) if (f.x * ts <= screenRight) mode = f.kind;
		if (mode === 'stop' && !this.lakituStopped) {
			this.lakituStopped = true;
			for (const e of this.enemies) if (e.type === 'Lakitu') e.state = 'leaving';
		}
		if (!mode || mode === 'stop') return;
		this.frenzyTimer = (this.frenzyTimer || 0) - this.physicsSteps;
		if (this.frenzyTimer > 0) return;
		const world = parseInt(this.currentMap.world, 10);
		const color = world === 2 ? 'Grey' : 'Red';
		const base = { id: this.enemies.length, color, state: 'walking', stompTimer: 0, isWinged: false, kicked: false, shellChain: 0, active: true, anim: 0, frame: 0, swimPhase: 0, force: 0, floatTimer: 0 };
		if (mode === 'fly') {
			this.frenzyTimer = FLY_CHEEP_TIMERS[Math.floor(Math.random() * 4)];
			if (this.enemies.filter(e => e.flying).length >= (this.secondaryHard ? 4 : 3)) return;
			const dir = Math.random() < 0.5 ? -1 : 1;
			this.enemies.push({ ...base, type: 'Cheep', flying: true, x: screenLeft + (0.15 + Math.random() * 0.7) * W, y: H + ts,
				dir, vx: dir * (0.9 + Math.random() * 1.1) * k, vy: -5 * k, origY: H, bobDown: false });
			return;
		}
		this.frenzyTimer = 32;
		// Altura: se sortea entre las que todavía no salieron
		if (this.frenzyFilter === undefined || this.frenzyFilter === 0xff) this.frenzyFilter = 0;
		let idx = Math.floor(Math.random() * 8);
		while (this.frenzyFilter & (1 << idx)) idx = (idx + 1) & 7;
		this.frenzyFilter |= 1 << idx;
		const y = ts * 1.2 + FRENZY_Y[idx] / 128 * (H - ts * 3.2);   // dentro de la parte visible
		if (this.currentMap.type === World_Type.Underwater) {
			if (this.enemies.filter(e => e.type === 'Cheep' && e.frenzy).length >= 3) return;
			this.enemies.push({ ...base, type: 'Cheep', frenzy: true, x: screenRight + ts, y, dir: -1, vx: -1, vy: 0, origY: y, bobDown: false });
		} else {
			if (this.enemies.some(e => e.type === 'BulletBill' && e.frenzy)) return;
			this.engine.playAudioOverlap(audio["Bowser_Fire"]);
			this.enemies.push({ ...base, type: 'BulletBill', frenzy: true, color: null, x: screenRight + ts, y, dir: -1, vx: -1, vy: 0 });
		}
	}

	// Cañones (ProcessCannons): por cada hueco libre (hay tres para Bullet Bills) se sortea cada cuadro un cañón de los seis de
	// la tabla; si el sorteado existe, está pasada la página 0 y su temporizador llegó a cero, dispara y lo reinicia en 14; si
	// no, el temporizador baja de a uno. Un Bullet Bill nace y muere enseguida si Mario está a menos de 40 px del cañón.
	updateCannons(player, screenLeft, screenRight) {
		const ts = this.tileSize, k = this.tileScale;
		const playerX = player.position.x - this.mapOffset.x;
		const visible = (this.cannons || []).filter(c => { const cx = c.tx * ts; return c.tx >= 16 && cx + ts >= screenLeft && cx <= screenRight; }).sort((a, b) => a.tx - b.tx).slice(0, 6);
		if (!visible.length) return;
		const mask = this.secondaryHard ? 8 : 16;
		for (let st = 0; st < this.physicsSteps; st++) {
			const free = CANNON_MAX_BILLS - this.enemies.filter(e => e.type === 'BulletBill' && !e.frenzy).length;
			for (let slot = 0; slot < free; slot++) {
				const c = visible[Math.floor(Math.random() * mask)];
				if (!c) continue;
				if (c.timer > 0) { c.timer--; continue; }
				c.timer = CANNON_TIMER;
				const cx = c.tx * ts;
				if (Math.abs(playerX - cx) < CANNON_NEAR * k) continue;
				const pos = this.tileToScreen(c.tx, c.ty);
				const dir = playerX < cx ? -1 : 1;
				this.enemies.push({ id: this.enemies.length, type: 'BulletBill', color: null, x: cx, y: pos.y, dir, vx: dir, vy: 0, state: 'walking', stompTimer: 0, isWinged: false, kicked: false, shellChain: 0, active: true });
				this.engine.playAudioOverlap(audio["Bowser_Fire"]);
			}
		}
	}

	// Huevo del Spiny: sale despedido por Lakitu, cae y al tocar el piso se rompe y sale el Spiny hacia Mario
	stepSpinyEgg(enemy, player) {
		const k = this.tileScale, W = this.currentMap.dimensions.width, tiles = this.currentMap.map;
		enemy.x += enemy.vx;
		enemy.y += enemy.vy;
		enemy.vy = Math.min(enemy.vy + ENEMY_GRAVITY * k, ENEMY_MAX_FALL * k);
		if (enemy.vy > 0) {
			const t = this.screenToTile(enemy.x + this.mapOffset.x + this.tileSize / 2, enemy.y + this.tileSize);
			if (isSolidMetatile(tiles[this.engine.coordsToIndex(t, W)])) {
				enemy.y = this.tileToScreen(t.x, t.y).y - this.tileSize;
				enemy.state = 'walking';
				enemy.vy = 0;
				enemy.dir = (player.position.x - this.mapOffset.x) < enemy.x ? -1 : 1;
			}
		}
	}

	// Lakitu (MoveLakitu / PlayerLakituDiff): flota arriba y se mueve hacia Mario más rápido cuanto más cerca está
	// (la velocidad es un valor base menos la distancia en cuartos, con la distancia limitada a 60 px) y más aún si
	// Mario corre con la pantalla avanzando. Si se aleja de más en el sentido contrario, frena y da la vuelta.
	// Cada 128 cuadros suelta un huevo de Spiny.
	stepLakitu(enemy, player) {
		const k = this.tileScale;
		if (enemy.state === 'falling') {
			enemy.y += enemy.vy;
			enemy.vy = Math.min(enemy.vy + ENEMY_GRAVITY * k, ENEMY_MAX_FALL * k);
			return;
		}
		enemy.anim++;
		if (enemy.state === 'leaving') {
			// Al llegar la marca de fin del ataque, Lakitu se va por la derecha y ya no vuelve
			enemy.x += 2 * k; enemy.vx = 1;
			return enemy.x + this.mapOffset.x > this.engine.getCanvasWidth() + this.tileSize * 2 ? 'remove' : undefined;
		}
		const playerX = player.position.x - this.mapOffset.x;
		const dx = (playerX - enemy.x) / k;
		const toward = dx < 0 ? -1 : 1;
		const dist = Math.min(Math.abs(dx), 60);
		if (enemy.moveDir === undefined) { enemy.moveDir = -1; enemy.moveSpeed = 0x10; }
		const xs = Math.abs(Math.floor(this.xSpeed / 256));
		const scrolling = xs !== 0 && player.position.x >= this.engine.getCanvasWidth() * 0.44;
		const idx = scrolling ? (xs >= 0x19 ? 2 : 1) : 0;
		let speed;
		if (Math.abs(dx) >= 60 && toward !== enemy.moveDir) {
			// Se pasó de largo: va frenando y, al llegar a cero, da la vuelta hacia Mario
			if (enemy.moveDir < 0 || --enemy.moveSpeed <= 0) enemy.moveDir = toward;
			speed = Math.max(0, enemy.moveSpeed);
		} else {
			speed = Math.max(0, LAKITU_DIFF_ADJ[idx] - ((Math.floor(dist) & 0x3c) >> 2));
			enemy.moveSpeed = speed;
		}
		enemy.x += enemy.moveDir * speed / 16 * k;
		enemy.vx = enemy.moveDir;
		// En el original flota en la fila de arriba de todo del nivel; acá se lo deja a 1,4 tiles del borde visible, que sigue a la cámara
		enemy.y = this.tileSize * 1.4 - (this.cameraY || 0);
		if (--enemy.throwTimer <= 0) {
			enemy.throwTimer = LAKITU_EGG_STEPS;
			const spinies = this.enemies.filter(e => e.type === 'Spiny').length;
			if (spinies < 4) {
				this.enemies.push({
					id: this.enemies.length, type: 'Spiny', color: null, x: enemy.x, y: enemy.y - 8 * k,
					dir: dx < 0 ? -1 : 1, vx: Math.max(-1.5, Math.min(1.5, dx / 60)) * k, vy: -3 * k,
					state: 'egg', stompTimer: 0, isWinged: false, kicked: false, shellChain: 0, active: true, anim: 0,
				});
			}
		}
	}

	// Hammer Bro (ProcHammerBro): mira a Mario y se mueve de un lado a otro (cada 64 cuadros cambia, a 1/4 px por cuadro);
	// pasados 128 cuadros, si Mario queda a su izquierda, camina hacia él a 1/2 px por cuadro. Salta cada 192 a 255
	// cuadros (más alto desde abajo) y tira un martillo cada 48 cuadros.
	hammerBroLogic(enemy, player) {
		const k = this.tileScale;
		const playerX = player.position.x - this.mapOffset.x;
		const face = playerX < enemy.x ? -1 : 1;
		enemy.facing = face;
		enemy.walkTimer = (enemy.walkTimer ?? 128) - 1;
		const shimmy = Math.floor((enemy.anim || 0) / 64) % 2 === 0 ? -1 : 1;
		// Si acaba de dar la vuelta en un borde o una pared, mantiene el rumbo un rato en vez de volver a caer
		if (enemy.holdDir > 0) enemy.holdDir--;
		else if (face < 0 && enemy.walkTimer <= 0) { enemy.dir = -1; enemy.walkSpeed = 0.5; }
		else { enemy.dir = shimmy; enemy.walkSpeed = 0.25; }
		if (enemy.grounded && --enemy.jumpTimer <= 0) {
			const low = enemy.y > this.engine.getCanvasHeight() / 2;
			enemy.vy = -(low ? 6 : 3) * k;
			enemy.jumpTimer = 192 + Math.floor(Math.random() * 64);
		}
		enemy.warning = enemy.throwTimer < 20;
		if (--enemy.throwTimer <= 0) {
			enemy.throwTimer = this.secondaryHard ? HAMMER_THROW_STEPS_HARD : HAMMER_THROW_STEPS;
			const sx = enemy.x + this.mapOffset.x;
			if (sx > -this.tileSize && sx < this.engine.getCanvasWidth()) {
				this.enemies.push({ id: this.enemies.length, type: 'Hammer', color: null, x: enemy.x + 2 * k, y: enemy.y - 10 * k, vx: face * 1 * k, vy: -HAMMER_UP_SPEED * k, dir: face, state: 'walking', active: true, anim: 0 });
			}
		}
	}

	// Martillo: sube y baja en arco hacia donde miraba el Hammer Bro, girando
	stepHammer(enemy) {
		const k = this.tileScale;
		enemy.anim++;
		enemy.x += enemy.vx;
		enemy.y += enemy.vy;
		enemy.vy += HAMMER_GRAVITY * k;
		if (enemy.y > this.engine.getCanvasHeight() + this.tileSize) return 'remove';
	}

	// Bullet Bill: vuela recto a 1,5 px por cuadro, atraviesa todo y se va al salir de la pantalla
	stepBulletBill(enemy) {
		const k = this.tileScale;
		if (enemy.state === 'falling') {
			enemy.y += enemy.vy;
			enemy.vy = Math.min(enemy.vy + ENEMY_GRAVITY * k, ENEMY_MAX_FALL * k);
			return;
		}
		enemy.x += enemy.dir * BULLET_BILL_SPEED * k;
		const sx = enemy.x + this.mapOffset.x;
		if (sx < -this.tileSize * 3 || sx > this.engine.getCanvasWidth() + this.tileSize * 3) return 'remove';
	}

	// --- Plataformas móviles -------------------------------------------------------------------
	// Posiciones en px del NES: x en el mundo e y desde la fila 0 del nivel. Mario sólo aterriza sobre ellas
	// (desde arriba): se lo lleva con la plataforma mientras está encima.

	// Superficie del resorte: su parte de arriba, que baja al comprimirse. Va 8 px sobre el metatile 0x67.
	springTop(sp) {
		const bottom = this.tileToScreen(sp.tx, sp.ty + 2).y;
		return bottom - 24 * this.tileScale + SPRING_OFFSETS[Math.max(0, sp.anim - 1)] * this.tileScale * (sp.anim > 0 ? 1 : 0);
	}

	// Mario cae sobre un resorte y lo comprime; al terminar rebota. Con el salto apretado durante la compresión sale más alto.
	updateSprings(player) {
		if (!this.springs || !this.springs.length || this.state !== Game_State.Playing) return;
		const k = this.tileScale, ts = this.tileSize, pos = player.position;
		const h = this.playerHeightPx();
		const jumpDown = !!(this.engine.keysPressed['ArrowUp'] || this.engine.keysPressed['KeyW']);
		for (const sp of this.springs) {
			const left = this.tileToScreen(sp.tx, sp.ty).x;
			for (let st = 0; st < this.physicsSteps; st++) {
				const top = this.springTop(sp);
				const overlap = pos.x + ts - 3 * k > left && pos.x + 3 * k < left + ts;
				if (sp.anim === 0) {
					const feet = pos.y + h;
					if (overlap && this.velocityY >= 0 && feet >= top - k && feet <= top + Math.max(5 * k, this.velocityY + 3 * k)) {
						sp.anim = 1; sp.timer = SPRING_STEPS_PER_FRAME; sp.force = SPRING_BOUNCE; sp.pressed = jumpDown;
						this.stompChain = 0;
					}
				}
				if (sp.anim > 0) {
					// Mario baja con la parte de arriba del resorte
					pos.y = this.springTop(sp) - h; this.velocityY = 0; this.isOnGround = true;
					if (jumpDown && !sp.pressed && sp.anim >= 2) sp.force = SPRING_BOUNCE_HIGH;
					sp.pressed = jumpDown;
					if (--sp.timer <= 0) {
						sp.timer = SPRING_STEPS_PER_FRAME;
						if (++sp.anim > 4) {
							sp.anim = 0;
							this.velocityY = -sp.force * k;
							this.jumpForceUp = this.jumpForceDown = SPRING_FORCE;
							this.jumpOriginY = pos.y;
							this.jumpHeld = true;
							this.isOnGround = false;
							this.engine.playAudioOverlap(audio["Player_Jump"]);
						}
					}
				}
			}
		}
	}

	drawSprings() {
		const w = this.engine.getCanvasWidth(), k = this.tileScale;
		for (const sp of this.springs || []) {
			const left = this.tileToScreen(sp.tx, sp.ty).x;
			if (left + this.tileSize < 0 || left > w) continue;
			const off = SPRING_OFFSETS[Math.max(0, sp.anim - 1)] * (sp.anim > 0 ? 1 : 0);
			const frame = off === 0 ? 0 : off === 8 ? 1 : 2;
			this.engine.drawSprite('Enemy_Spring', frame, { x: left, y: this.springTop(sp) }, k, false, 0, Pivot.Top_Left);
		}
	}

	platformBaseY() { return this.tileToScreen(0, 2).y; }

	platformRect(p) {
		const k = this.tileScale;
		return { x: p.x * k + this.mapOffset.x, y: this.platformBaseY() + p.y * k, w: p.w * k };
	}

	playerHeightPx() {
		return (this.playerSize > Player_Size.Small && !this.wasCrouching) ? this.tileSize * 2 : this.tileSize;
	}

	updatePlatforms(player, screenLeft, screenRight) {
		const k = this.tileScale;
		const near = p => { const wx = p.x * k; return wx + p.w * k > screenLeft - 3 * this.tileSize && wx < screenRight + 2 * this.tileSize; };
		for (const p of this.platforms || []) {
			if (!p.active) { if (near(p)) p.active = true; else continue; }
			for (let s = 0; s < this.physicsSteps; s++) this.stepPlatform(p, player);
		}
		this.platforms = (this.platforms || []).filter(p => !(p.falling && p.y > 260));
	}

	stepPlatform(p, player) {
		const k = this.tileScale;
		const prevX = p.x;
		switch (p.kind) {
			case 'vert':
				p.vy = Math.max(-PLATFORM_MAX_SPEED, Math.min(PLATFORM_MAX_SPEED, p.vy + (p.y < p.cy ? PLATFORM_ACCEL : -PLATFORM_ACCEL)));
				p.y += p.vy;
				break;
			case 'hori': {
				// Dos contadores: cada 4 cuadros la velocidad sube de a 1/16 px hasta 14/16 y vuelve a bajar; el bit 1 del primario
				// decide el sentido, así que recorre izquierda, vuelta, derecha y vuelta
				p.f++;
				if (p.f % 4 === 0) {
					if (!(p.pc & 1)) { if (p.sc === PLATFORM_HORI_MAX) p.pc++; else p.sc++; }
					else if (p.sc === 0) p.pc++; else p.sc--;
				}
				p.x += (p.pc & 2 ? 1 : -1) * p.sc / 16;
				break;
			}
			case 'lift':
				p.y += p.dir * PLATFORM_LIFT_SPEED;
				if (p.y >= 224) p.y -= 256; else if (p.y < -32) p.y += 256;
				break;
			case 'drop':
				if (p.rider) { p.vy = Math.min(p.vy + PLATFORM_DROP_GRAVITY, PLATFORM_DROP_MAX); p.y += p.vy; }
				break;
			case 'right':
				if (p.rider) p.vx = 1;
				p.x += p.vx;
				break;
			case 'balance': {
				const o = p.partner;
				if (p.falling) { p.vy += PLATFORM_FALL_GRAVITY; p.y += p.vy; break; }
				if (o && p.first && !o.falling) {
					// La de Mario baja y la otra sube, acelerando de a 5/256 hasta 3 px por cuadro; sin Mario frenan.
					// Si una llega arriba se sueltan las dos
					if (p.rider && !o.rider) p.vy = Math.min(PLATFORM_MAX_SPEED, p.vy + PLATFORM_ACCEL);
					else if (o.rider && !p.rider) p.vy = Math.max(-PLATFORM_MAX_SPEED, p.vy - PLATFORM_ACCEL);
					else p.vy = Math.abs(p.vy) <= PLATFORM_ACCEL ? 0 : p.vy - Math.sign(p.vy) * PLATFORM_ACCEL;
					p.y += p.vy; o.y -= p.vy;
					if (Math.min(p.y, o.y) <= PLATFORM_BALANCE_LIMIT) { p.falling = o.falling = true; p.vy = o.vy = 0; }
				}
				break;
			}
		}

		// Mario: aterriza desde arriba y viaja con la plataforma
		const ts = this.tileSize, h = this.playerHeightPx(), pos = player.position;
		const r = this.platformRect(p);
		const feet = pos.y + h, left = pos.x + 3 * k, right = pos.x + ts - 3 * k;
		const overlap = right > r.x && left < r.x + r.w;
		if (p.rider) {
			if (overlap && this.velocityY >= 0 && this.state === Game_State.Playing) {
				pos.x += (p.x - prevX) * k;
				pos.y = r.y - h; this.velocityY = 0; this.isOnGround = true;
			} else p.rider = false;
		} else if (overlap && this.velocityY >= 0 && this.state === Game_State.Playing && feet >= r.y - k && feet <= r.y + Math.max(5 * k, this.velocityY + 3 * k)) {
			p.rider = true; this.stompChain = 0;
			pos.y = r.y - h; this.velocityY = 0; this.isOnGround = true;
		}
	}

	// Tras la física del jugador: si va sobre una plataforma se lo vuelve a apoyar (la gravedad lo bajó un poco)
	snapToPlatform(playerPos, playerHeight) {
		for (const sp of this.springs || []) {
			if (sp.anim === 0) continue;
			playerPos.y = this.springTop(sp) - playerHeight; this.velocityY = 0; this.isOnGround = true;
		}
		for (const p of this.platforms || []) {
			if (!p.rider || this.velocityY < 0) continue;
			playerPos.y = this.platformRect(p).y - playerHeight;
			this.velocityY = 0; this.isOnGround = true;
		}
	}

	drawPlatforms() {
		const k = this.tileScale, tile = ['Platform_Tile_0', 'Platform_Tile_1', 'Platform_Tile_2', 'Platform_Tile_3'][this.currentMap?.type ?? 0];
		const sprite = this.engine.sprites[tile];
		if (!sprite) return;
		const w = this.engine.getCanvasWidth();
		for (const p of this.platforms || []) {
			const r = this.platformRect(p);
			if (r.x + r.w < 0 || r.x > w) continue;
			for (let i = 0; i < p.w / 8; i++) this.engine.drawSprite(tile, 0, { x: r.x + i * 8 * k, y: r.y }, sprite.scale, false, 0, Pivot.Top_Left);
		}
	}

	// Modo difícil primario (el de la segunda vuelta del original): los enemigos caminan a 3/4 px por cuadro, los Goombas
	// se vuelven Buzzy Beetles, los caparazones se reviven antes y más rápido, y rige también el secundario
	get primaryHard() { return this.difficulty === 'HARD'; }

	enemyWalkSpeed() { return this.primaryHard ? 0.75 : ENEMY_WALK_SPEED; }

	// Modo difícil secundario del original: rige desde el 5-3 y acelera el Hammer Bro, a las llamas de Bowser y a los
	// cheep-cheeps, y achica las plataformas grandes
	get secondaryHard() {
		if (this.primaryHard) return true;
		const m = /^(\d)-(\d)/.exec(this.currentMap?.world || '');
		if (!m) return false;
		const w = +m[1], l = +m[2];
		return w > 5 || (w === 5 && l >= 3);
	}

	// Altura (en pantalla) de la superficie del puente de Bowser: la fila del puente es dos más abajo que el hacha
	bridgeFloorY() {
		const ax = this.currentMap.axe;
		return this.tileToScreen(0, (ax ? ax.y : 8) + 2).y;
	}

	// Bowser (RunBowser / BowserControl): patrulla cerca de su lugar, se vuelve hacia Mario, salta cada tanto y
	// abre la boca antes de soltar una llama. Tiene 5 puntos de vida, que le quitan las bolas de fuego.
	stepBowser(enemy, player) {
		const k = this.tileScale;
		if (enemy.state === 'falling') {
			enemy.y += enemy.vy;
			enemy.vy = Math.min(enemy.vy + ENEMY_GRAVITY * k, ENEMY_MAX_FALL * k);
			return;
		}
		enemy.frame++;
		enemy.anim++;
		const playerX = player.position.x - this.mapOffset.x;
		const centerX = enemy.x + BOWSER_W * k / 2;

		if (--enemy.feetTimer <= 0) { enemy.feetTimer = 32; enemy.feet ^= 1; }

		// Mira a Mario; si Mario quedó a su derecha lo persigue hacia ese lado
		if (playerX > centerX + 8 * k) { enemy.dir = 1; enemy.speed = 2; }
		else if (enemy.frame % 16 === 0) enemy.dir = -1;

		// Patrulla: cada 4 cuadros avanza 1 px y da la vuelta al alejarse de su lugar de origen
		if (enemy.frame % 4 === 0) {
			const away = enemy.x - enemy.origX;
			if (Math.abs(away) >= enemy.range * k) { enemy.speed = away > 0 ? -1 : 1; enemy.range = BOWSER_RANGE[Math.floor(Math.random() * 4)]; }
			if (enemy.dir === 1 && enemy.speed < 0) enemy.speed = 1;
			enemy.x += enemy.speed * k;
			enemy.x = Math.max(enemy.origX - 0x40 * k, Math.min(enemy.origX + 0x40 * k, enemy.x));
		}

		// Salto
		const floor = this.bridgeFloorY() - BOWSER_H * k;
		if (enemy.y >= floor) {
			enemy.y = floor; enemy.vy = 0;
			if (--enemy.jumpTimer <= 0) {
				enemy.vy = -BOWSER_JUMP_SPEED * k;
				enemy.jumpTimer = BOWSER_RANGE[Math.floor(Math.random() * 4)] * 2;
			}
		} else {
			enemy.vy += BOWSER_GRAVITY * k;
		}
		enemy.y += enemy.vy;

		// Desde el mundo 6 Bowser también tira martillos mientras está en el aire, de a no más de tres
		const world = parseInt(this.currentMap.world, 10);
		if (world >= 6 && enemy.y < floor - k && enemy.frame % 8 === 0 && this.enemies.filter(e => e.type === 'Hammer').length < 3) {
			this.enemies.push({ id: this.enemies.length, type: 'Hammer', color: null, x: enemy.x + 4 * k, y: enemy.y - 6 * k, vx: enemy.dir * k, vy: -HAMMER_UP_SPEED * k, dir: enemy.dir, state: 'walking', active: true, anim: 0 });
		}
		// Llamas: en los mundos 1 a 5 y en el 8 (en el 6 y 7 sólo hay martillos)
		if (world <= 5 || world === 8) {
			if (--enemy.fireTimer <= 0) {
				if (!enemy.mouth) { enemy.mouth = true; enemy.fireTimer = 32; }
				else {
					enemy.mouth = false;
					enemy.fireTimer = BOWSER_FLAME_TIMER[enemy.flameIdx++ % BOWSER_FLAME_TIMER.length] - (this.secondaryHard ? 16 : 0);
					const target = this.bridgeFloorY() - BOWSER_FLAME_HEIGHTS[Math.floor(Math.random() * 4)] * k;
					this.enemies.push({ id: this.enemies.length, type: 'BowserFlame', color: null, x: enemy.x - 14 * k, y: enemy.y + 8 * k, targetY: target, dir: -1, vx: -1, vy: 0, state: 'walking', anim: 0, active: true });
					this.engine.playAudioOverlap(audio["Bowser_Fire"]);
				}
			}
		}
	}

	// Llama de Bowser: avanza a la izquierda y se acomoda de a 1 px por cuadro a la altura que eligió
	stepBowserFlame(enemy) {
		const k = this.tileScale;
		enemy.anim++;
		enemy.x -= BOWSER_FLAME_SPEED * k;
		const dy = enemy.targetY - enemy.y;
		if (Math.abs(dy) > k) enemy.y += Math.sign(dy) * k;
	}

	// Una bola de fuego de Mario le saca un punto de vida a Bowser; sin vidas cae y da 5000 puntos
	hitBowser(enemy) {
		this.engine.playAudioOverlap(audio["Player_Bump"]);
		if (--enemy.hp > 0) return;
		enemy.state = 'falling';
		enemy.vy = ENEMY_JUMP_SPEED * this.tileScale;
		this.score += BOWSER_SCORE;
		this.spawnScorePopup(String(BOWSER_SCORE), enemy.x + this.mapOffset.x, enemy.y);
		this.engine.playAudioOverlap(audio["Bowser_Falls"]);
	}

	// Barra de fuego: 6 bolas (12 la larga) separadas 8 px que giran alrededor del bloque; el estado de giro
	// va de 0 a 32 (una vuelta) y a 0 apunta hacia arriba. Gira a la derecha, o a la izquierda con ccw.
	stepFirebar(enemy) {
		const speed = enemy.fast ? FIREBAR_FAST : FIREBAR_SLOW;
		enemy.spin = (enemy.spin + (enemy.ccw ? -speed : speed) + 32) % 32;
		enemy.anim = (enemy.anim || 0) + 1;
	}

	// Posiciones en pantalla de las bolas de una barra de fuego (el centro de la primera es el del bloque)
	firebarBalls(enemy) {
		const k = this.tileScale, ts = this.tileSize;
		const cx = enemy.x + this.mapOffset.x + ts / 2, cy = enemy.y + ts / 2;
		const a = enemy.spin / 32 * Math.PI * 2, n = enemy.long ? 12 : 6;
		const balls = [];
		for (let i = 0; i < n; i++) {
			const r = i * FIREBAR_BALL_STEP * k;
			balls.push({ x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r });
		}
		return balls;
	}

	// El Podoboo sale de la lava, sube 7 px por cuadro frenándose y vuelve a caer; salta de nuevo cuando
	// vence su temporizador, de 6 a 21 intervalos (entre salto y salto puede quedar un rato escondido)
	stepPodoboo(enemy) {
		const k = this.tileScale;
		if (enemy.timer <= 0) {
			enemy.y = this.engine.getCanvasHeight();
			enemy.vy = -PODOBOO_SPEED * k;
			enemy.timer = (6 + Math.floor(Math.random() * 16)) * PODOBOO_INTERVAL_STEPS;
		}
		enemy.timer--;
		enemy.y += enemy.vy;
		enemy.vy = Math.min(enemy.vy + PODOBOO_GRAVITY * k, 3 * k);   // la caída tiene tope de 3 px por cuadro
	}

	// Cheep-cheep y Bloober (MoveSwimmingCheepCheep / MoveBloober). El cheep-cheep avanza a la izquierda
	// 1/4 px por cuadro (gris) o 1/2 (rojo) y sube y baja 15 px alrededor de su altura inicial. El Bloober
	// acelera y frena a brazadas (fuerza 0, 1, 2, 1, 0), sube y avanza hacia Mario con esa fuerza, y después
	// se deja caer de a medio píxel hasta quedar al nivel de Mario. Mario no los pisa: lo lastiman.
	stepSwimmer(enemy, player) {
		const k = this.tileScale;
		if (enemy.state === 'falling') {
			enemy.y += enemy.vy;
			enemy.vy = Math.min(enemy.vy + ENEMY_GRAVITY * k, ENEMY_MAX_FALL * k);
			return;
		}
		enemy.frame++;
		if (enemy.flying) {
			// Cheep-cheep que salta del agua: sube a 5 px por cuadro, se frena y vuelve a caer
			enemy.x += enemy.vx;
			enemy.y += enemy.vy;
			enemy.vy += FLY_CHEEP_GRAVITY * k;
			if (enemy.vy > 0 && enemy.y > this.engine.getCanvasHeight() + this.tileSize) return 'remove';
			return;
		}
		if (enemy.type === 'Cheep') {
			enemy.vx = -1;
			enemy.x -= (enemy.color === 'Red' ? 0.5 : 0.25) * k;
			enemy.y += (enemy.bobDown ? 1 : -1) * 0.125 * k;
			if (Math.abs(enemy.y - enemy.origY) >= 15 * k) enemy.bobDown = enemy.y < enemy.origY;
			return;
		}

		const player_ = player.position;
		// De vez en cuando se vuelve hacia Mario
		if (Math.random() < 1 / 64) enemy.dir = (player_.x - this.mapOffset.x) < enemy.x ? -1 : 1;
		const every8 = enemy.frame % 8 === 0;
		if (enemy.swimPhase === 0) {
			if (every8 && ++enemy.force === 2) enemy.swimPhase = 1;
		} else if (enemy.swimPhase === 1) {
			if (every8 && --enemy.force === 0) { enemy.swimPhase = 2; enemy.floatTimer = BLOOBER_FLOAT_STEPS; }
		} else {
			if (enemy.floatTimer > 0) enemy.floatTimer--;
			if (enemy.frame % 2 === 0 && (enemy.floatTimer > 0 || enemy.y + 16 * k < player_.y)) enemy.y += k;
			else if (enemy.floatTimer === 0 && enemy.y + 16 * k >= player_.y) enemy.swimPhase = 0;
		}
		enemy.y = Math.max(enemy.y - enemy.force * k, this.tileToScreen(0, 2).y);
		enemy.x += enemy.dir * enemy.force * k;
	}

	// La planta piraña sale y se esconde cada 64 cuadros, y no sale si Mario está cerca
	stepPiranha(enemy, player) {
		const k = this.tileScale;
		if (enemy.delay > 0) { enemy.delay--; return; }
		switch (enemy.state) {
			case 'hiding': {
				const near = Math.abs((player.position.x - this.mapOffset.x) - enemy.x) < PIRANHA_NEAR * k;
				if (!near) enemy.state = 'rising';
				break;
			}
			case 'rising':
				enemy.y -= PIRANHA_SPEED * k;
				if (enemy.y <= enemy.initialY - PIRANHA_RISE * k) {
					enemy.y = enemy.initialY - PIRANHA_RISE * k;
					enemy.state = 'showing';
					enemy.delay = PIRANHA_DELAY_STEPS;
				}
				break;
			case 'showing':
				enemy.state = 'sinking';
				break;
			case 'sinking':
				enemy.y += PIRANHA_SPEED * k;
				if (enemy.y >= enemy.initialY) {
					enemy.y = enemy.initialY;
					enemy.state = 'hiding';
					enemy.delay = PIRANHA_DELAY_STEPS;
				}
				break;
		}
	}

	// El enemigo muere girando hacia abajo (golpe de caparazón, bola de fuego o estrella) y da puntos
	defeatEnemy(enemy, points) {
		if (UNKILLABLE.has(enemy.type)) return;
		enemy.state = 'falling';
		enemy.kicked = false;
		enemy.vy = ENEMY_JUMP_SPEED * this.tileScale;
		const sx = enemy.x + this.mapOffset.x;
		if (points === 'life') {
			this.giveLife();
			this.spawnScorePopup('1UP', sx, enemy.y);
		} else if (points) {
			this.score += points;
			this.spawnScorePopup(String(points), sx, enemy.y);
		}
		this.engine.playAudioOverlap(audio["Shell"]);
	}

	// Caja de colisión de Mario contra enemigos y objetos: 10x12 px del NES si es chico o está agachado,
	// 12x24 si es grande (BoundBoxCtrlData); el resto del sprite no cuenta
	playerHitbox(player) {
		const k = this.tileScale;
		const bigStanding = this.playerSize > Player_Size.Small && !this.wasCrouching;
		return bigStanding
			? { x: player.position.x + 2 * k, y: player.position.y + 8 * k, w: 12 * k, h: 24 * k }
			: { x: player.position.x + 3 * k, y: player.position.y + 4 * k, w: 10 * k, h: 12 * k };
	}

	// Alto de la caja de un enemigo: el Koopa y el Hammer Bro miden 24 px mientras caminan (el Buzzy Beetle, 16)
	enemyHeight(enemy) {
		const tall = (enemy.type.includes('Koopa') && enemy.color !== 'Buzzy' && enemy.state === 'walking') || enemy.type === 'HammerBro';
		return tall ? this.tileSize * 1.5 : this.tileSize;
	}

	// Caja de choque de un enemigo, con los desplazamientos de BoundBoxCtrlData del original (en px del NES, respecto de
	// la esquina de arriba a la izquierda del sprite). La del Goomba y los que usan SmallBBox es de 10x6; la de los
	// koopas, de 12x12. Devuelve null si el enemigo usa la caja entera.
	enemyHitRect(enemy) {
		const k = this.tileScale, x = enemy.x + this.mapOffset.x, y = enemy.y;
		const r = (l, t, w, h) => ({ x: x + l * k, y: y + t * k, w: w * k, h: h * k });
		switch (enemy.type) {
			case 'Goomba': case 'Spiny': case 'Bloober': case 'Cheep': case 'Podoboo': case 'BulletBill': return r(3, 6, 10, 6);
			case 'Lakitu': return r(2, 1, 12, 12);
			case 'HammerBro': return r(4, 4, 8, 20);
			case 'Koopa': case 'Koopa_Winged':
				return (enemy.state === 'walking' && enemy.color !== 'Buzzy') ? r(2, 9, 12, 12) : r(2, 1, 12, 12);
			default: return null;
		}
	}

	enemyScreenRect(enemy) {
		const hit = this.enemyHitRect(enemy);
		if (hit) return hit;
		const k = this.tileScale, sx = enemy.x + this.mapOffset.x;
		if (enemy.type === 'Bowser') return { x: sx + 2 * k, y: enemy.y, w: (BOWSER_W - 4) * k, h: BOWSER_H * k };
		if (enemy.type === 'BowserFlame') return { x: sx, y: enemy.y, w: FLAME_W * k, h: FLAME_H * k };
		const h = this.enemyHeight(enemy);
		let y = enemy.y;
		if (enemy.type === 'Pakkun') {
			const offsetY = this.currentMap.dimensions.height * this.tileSize - this.engine.getCanvasHeight();
			y = enemy.y + this.mapOffset.y - offsetY;
		}
		return { x: enemy.x + this.mapOffset.x, y, w: this.tileSize, h };
	}

	// Al golpear o romper un bloque mueren los enemigos que están parados encima (KillEnemyAboveBlock)
	killEnemiesAbove(tx, ty) {
		const ts = this.tileSize;
		const top = this.tileToScreen(tx, ty).y;
		const left = tx * ts;
		for (const enemy of this.enemies) {
			if (!enemy.active || enemy.type === 'Pakkun' || enemy.state === 'falling' || enemy.state === 'stomped') continue;
			const h = this.enemyHeight(enemy);
			const center = enemy.x + ts / 2;
			if (center > left && center < left + ts && Math.abs(enemy.y + h - top) < ts * 0.3) {
				this.defeatEnemy(enemy, ENEMY_POINTS[enemy.type] ?? 200);
				enemy.vy = -4 * this.tileScale;
			}
		}
	}

	// Choque de Mario con un enemigo, una vez por cuadro
	playerVsEnemy(enemy, player) {
		if (NPC_TYPES.has(enemy.type)) return;
		if (enemy.type === 'Hammer') {
			const k = this.tileScale, sx = enemy.x + this.mapOffset.x;
			if (this.rectsOverlap(this.playerHitbox(player), { x: sx + 4 * k, y: enemy.y + 2 * k, w: 8 * k, h: 12 * k })) this.damagePlayer();
			return;
		}
		if (enemy.type === 'Bowser' || enemy.type === 'BowserFlame') {
			if (enemy.state === 'falling') return;
			if (this.rectsOverlap(this.playerHitbox(player), this.enemyScreenRect(enemy))) this.damagePlayer();
			return;
		}
		if (enemy.type === 'Firebar') {
			const box = this.playerHitbox(player), h = FIREBAR_HIT * this.tileScale;
			for (const b of this.firebarBalls(enemy)) {
				if (this.rectsOverlap(box, { x: b.x - h, y: b.y - h, w: 2 * h, h: 2 * h })) { this.damagePlayer(); return; }
			}
			return;
		}
		const enemyScreenX = enemy.x + this.mapOffset.x;
		const enemyHeight = this.enemyHeight(enemy);
		let enemyScreenY = enemy.y;
		if (enemy.type === 'Pakkun') {
			const offsetY = this.currentMap.dimensions.height * this.tileSize - this.engine.getCanvasHeight();
			// Se pasa de coordenadas de mundo a pantalla
			enemyScreenY = enemy.y + this.mapOffset.y - offsetY;
		}
		let enemyRect = { x: enemyScreenX, y: enemyScreenY, w: this.tileSize, h: enemyHeight };
		if (SWIMMERS.has(enemy.type) || enemy.type === 'Podoboo') { const m = 2 * this.tileScale; enemyRect = { x: enemyRect.x + m, y: enemyRect.y + m, w: enemyRect.w - 2 * m, h: enemyRect.h - 2 * m }; }

		const playerRect = this.playerHitbox(player);

		if (enemy.state === 'stomped' || enemy.state === 'falling' || !this.rectsOverlap(playerRect, this.enemyHitRect(enemy) ?? enemyRect)) return;

		// Con la estrella, Mario se lleva puesto a cualquier enemigo
		if (this.starTimer > 0) {
			this.defeatEnemy(enemy, ENEMY_POINTS[enemy.type] ?? 200);
			return;
		}

		if (enemy.state === 'shell' && !enemy.kicked) {
			// Un caparazón quieto se patea con cualquier contacto, hacia el lado contrario a Mario
			enemy.dir = (player.position.x < enemyRect.x) ? 1 : -1;
			enemy.kicked = true;
			enemy.shellChain = 0;
			this.awardChain(3, enemyScreenX, enemy.y);
			this.engine.playAudioOverlap(audio["Kick"]);
			return;
		}

		// Como en el original: cayendo sobre el enemigo se lo pisa; si no, la parte alta de Mario
		// tiene que estar bastante por encima (12 px del NES)
		const above = (playerRect.y + 12 * this.tileScale) < enemyRect.y;
		let isStomping = (!this.isOnGround && this.velocityY > 0) || above;
		if (enemy.type === 'Pakkun' || SWIMMERS.has(enemy.type) || enemy.type === 'Podoboo' || enemy.type === 'Spiny') isStomping = false;

		if (isStomping) {
			this.velocityY = SMB_STOMP_SPEED * this.tileScale;
			this.engine.playAudioOverlap(audio["Player_Stomp"]);
			if (enemy.type === 'BulletBill' || enemy.type === 'Lakitu' || enemy.type === 'HammerBro') {
				this.defeatEnemy(enemy, ENEMY_POINTS[enemy.type] ?? 200);
			} else if (enemy.type === 'Goomba') {
				enemy.state = 'stomped';
				this.awardChain(1, enemyScreenX, enemy.y);
			} else if (enemy.type.includes('Koopa')) {
				if (enemy.isWinged) {
					// El paratroopa pasa a Koopa común y da 400 fijos
					enemy.isWinged = false;
					this.score += 400;
					this.spawnScorePopup('400', enemyScreenX, enemy.y);
				} else {
					enemy.state = 'shell';
					enemy.kicked = false;
					enemy.reviveTimer = this.primaryHard ? SHELL_REVIVE_HARD : SHELL_REVIVE;
					this.awardChain(1, enemyScreenX, enemy.y);
				}
			}
		} else if (enemy.type === 'Pakkun' || enemy.state === 'walking' || enemy.state === 'egg' || (enemy.state === 'shell' && enemy.kicked)) {
			this.damagePlayer();
		}
	}

	drawEnemies() {
		this.drawVines();
		this.drawBubbles();
		this.drawPlatforms();
		this.drawSprings();
		const pakkunGreenAnim = this.engine.animatedSprites['Pakkun_Green'];
		const pakkunRedAnim = this.engine.animatedSprites['Pakkun_Red'];
		const biteAnim = pakkunGreenAnim.animations.Pakkun_Bite;

		this.pakkunAnimAcc = (this.pakkunAnimAcc || 0) + this.fk;
		if (this.pakkunAnimAcc >= biteAnim.frameSpeed) {
			this.pakkunAnimAcc -= biteAnim.frameSpeed;
			const nextFrame = (pakkunGreenAnim.currentFrame + 1) % biteAnim.frames.length;
			pakkunGreenAnim.currentFrame = nextFrame;
			pakkunRedAnim.currentFrame = nextFrame;
		}

		for (const enemy of this.enemies) {
			if (!enemy.active) continue;

			const screenX = enemy.x + this.mapOffset.x;

			if (enemy.type === 'Bowser') {
				this.engine.drawSprite('Enemy_Bowser', (enemy.mouth ? 2 : 0) + enemy.feet, { x: screenX, y: enemy.y }, this.tileScale, enemy.dir > 0, 0, Pivot.Top_Left);
				continue;
			}
			if (enemy.type === 'BowserFlame') {
				this.engine.drawSprite('Enemy_Flame', Math.floor(enemy.anim / 2) % 2, { x: screenX, y: enemy.y }, this.tileScale, false, 0, Pivot.Top_Left);
				continue;
			}
			if (enemy.type === 'Spiny') {
				const egg = enemy.state === 'egg';
				this.engine.drawSprite(egg ? 'Enemy_SpinyEgg' : 'Enemy_Spiny', Math.floor((enemy.anim || 0) / (egg ? 4 : 8)) % 2, { x: screenX, y: enemy.y }, this.tileScale, !egg && enemy.dir > 0, 0, Pivot.Top_Left);
				continue;
			}
			if (enemy.type === 'Lakitu') {
				this.engine.drawSprite('Enemy_Lakitu', enemy.throwTimer < 24 || enemy.throwTimer > LAKITU_EGG_STEPS - 12 ? 1 : 0, { x: screenX, y: enemy.y - this.tileSize / 2 }, this.tileScale, enemy.vx > 0, 0, Pivot.Top_Left);
				continue;
			}
			if (enemy.type === 'HammerBro') {
				this.engine.drawSprite('Enemy_HammerBro', (enemy.warning ? 2 : 0) + Math.floor((enemy.anim || 0) / 16) % 2, { x: screenX, y: enemy.y }, this.tileScale, (enemy.facing || -1) > 0, 0, Pivot.Top_Left);
				continue;
			}
			if (enemy.type === 'Hammer') {
				this.engine.drawSprite('Enemy_Hammer', Math.floor(enemy.anim / 4) % 4, { x: screenX, y: enemy.y }, this.tileScale, false, 0, Pivot.Top_Left);
				continue;
			}
			if (NPC_TYPES.has(enemy.type)) {
				this.engine.drawSprite(`Enemy_${enemy.type}`, 0, { x: screenX, y: enemy.y }, this.tileScale, false, 0, Pivot.Top_Left);
				continue;
			}
			if (enemy.type === 'Firebar') {
				const frame = Math.floor((enemy.anim || 0) / 4) % 4;
				for (const b of this.firebarBalls(enemy)) this.engine.drawSprite('Object_Fireball_Hit', frame, { x: b.x, y: b.y }, this.tileScale, false, 0, Pivot.Center);
				continue;
			}
			if (enemy.type === 'Podoboo') {
				this.engine.drawSprite('Enemy_Podoboo', enemy.vy > 0 ? 1 : 0, { x: screenX, y: enemy.y }, this.tileScale, false, 0, Pivot.Top_Left);
				continue;
			}

			// El paratroopa pisado pierde las alas y pasa a ser un koopa común
			const drawType = (enemy.type === 'Koopa_Winged' && !enemy.isWinged) ? 'Koopa' : enemy.type;
			let spriteNameToDraw = drawType;

			if (enemy.color) {
				spriteNameToDraw = `${drawType}_${enemy.color}`;
			}

			if (enemy.type === 'Pakkun') {

				const mapHeight = this.currentMap.dimensions.height;
				const offsetY = mapHeight * this.tileSize - this.engine.getCanvasHeight();
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
					this.engine.setAnimationForSprite(spriteNameToDraw, `${drawType}_Stomped`);
				} else if (enemy.state === 'shell') {
					 const shellSpriteName = `Koopa_Shell_${enemy.color}`;
					 const shellSprite = this.engine.animatedSprites[shellSpriteName];
					 if(shellSprite) {
						const wiggle = (!enemy.kicked && enemy.reviveTimer !== undefined && enemy.reviveTimer < SHELL_WIGGLE) ? (Math.floor(enemy.reviveTimer / 4) % 2 ? -1 : 1) * this.tileScale : 0;   // se sacude antes de levantarse
						shellSprite.position = { x: screenX + wiggle, y: enemy.y };
						this.engine.setAnimationForSprite(shellSpriteName, enemy.kicked ? 'Shell_Sliding' : 'Shell_Idle');
						this.engine.drawAnimatedSprite(shellSpriteName, this.frameDt, Pivot.Top_Left);
					 }
				} else {
					 this.engine.setAnimationForSprite(spriteNameToDraw, `${drawType}_Walk`);
				}

				if (enemy.state !== 'shell') {
					// Los peces se dibujan en celdas de 16x24 alineadas por abajo con su caja de 16x16
					animSprite.position = { x: screenX, y: SWIMMERS.has(enemy.type) ? enemy.y - this.tileSize / 2 : enemy.y };
					animSprite.flipped = enemy.vx > 0;
					this.engine.drawAnimatedSprite(spriteNameToDraw, this.frameDt, Pivot.Top_Left);
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
		const titlePosX = this.engine.getCanvasWidth() / 2;
		const titlePosY = this.tileSize * 1.5;
		const titleScale = (this.engine.getCanvasHeight() * 0.40) / titleImg.height;
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
		menuButtons.push({ name: "SETTINGS", action: () => { this.state = Game_State.Settings_Menu; this.currentSettingsSelection = 0; } });

		const executeMenuSelection = () => {
			const selection = menuButtons[this.currentSelection];
			if (selection?.action) {
				selection.action();
			}
		};

		const numButtons = menuButtons.length;
		const menuGap = this.engine.getCanvasHeight() * 0.1 / numButtons;
		const getMenuSelectionFromPointer = () => {
			const mousePos = this.engine.getMousePosition();
			if (!mousePos) return this.currentSelection;
			let closestIndex = this.currentSelection;
			let closestDistance = Infinity;
			for (let i = 0; i < numButtons; i++) {
				const menuPosY = this.engine.getCanvasHeight() * titleMaxY + menuGap * i + menuGap / 2 + TEXT_SIZE;
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
			this.engine.keysPressed['ArrowUp'] = false;
			this.engine.keysPressed['KeyW'] = false;
			this.currentSelection--;
		}
		if(this.engine.keysPressed['ArrowDown'] || this.engine.keysPressed['KeyS']){
			this.engine.keysPressed['ArrowDown'] = false;
			this.engine.keysPressed['KeyS'] = false;
			this.currentSelection++;
		}

		// Con el juego terminado, izquierda y derecha eligen el mundo de partida (siempre el primer nivel de cada uno)
		const worldStarts = this.availableWorlds.map((w, i) => (/-1$/.test(w) ? i : -1)).filter(i => i >= 0);
		let worldStep = 0;
		if(this.engine.keysPressed['ArrowLeft'] || this.engine.keysPressed['KeyA']){
			this.engine.keysPressed['ArrowLeft'] = false;
			this.engine.keysPressed['KeyA'] = false;
			worldStep = -1;
		}
		if(this.engine.keysPressed['ArrowRight'] || this.engine.keysPressed['KeyD']){
			this.engine.keysPressed['ArrowRight'] = false;
			this.engine.keysPressed['KeyD'] = false;
			worldStep = 1;
		}
		if (this.beaten && worldStep !== 0 && worldStarts.length) {
			let at = worldStarts.indexOf(this.currentWorldIndex);
			if (at < 0) at = worldStep > 0 ? -1 : 0;   // desde el título (sin mundo elegido) la primera flecha va al 1-1 o al 8-1
			this.currentWorldIndex = worldStarts[(at + worldStep + worldStarts.length) % worldStarts.length];
		} else if (!this.beaten) {
			this.currentWorldIndex = 0;
		}

		if(this.engine.keysPressed['Enter'] || this.engine.keysPressed['Space']){
			executeMenuSelection();
			delete this.engine.keysPressed['Enter'];
			delete this.engine.keysPressed['Space'];
		}

		if (this.engine.mouseButtons[0]) {
			handlePrimaryPress();
			this.engine.mouseButtons[0] = false;
		}

		this.currentSelection = ((this.currentSelection % numButtons) + numButtons) % numButtons;
		for(let i = 0; i < numButtons; i++){
			const menuPosY = this.engine.getCanvasHeight() * titleMaxY + menuGap * i + menuGap / 2 + TEXT_SIZE;
			const textPos = { x: this.engine.getCanvasWidth() / 2, y: menuPosY };
			const buttonLabel = menuButtons[i].name;
			const textWidth = this.engine.measureTextCustom(font, buttonLabel, TEXT_SIZE);
			if(this.currentSelection === i){
				const textLeft = textPos.x - textWidth / 2;
				const cursorOffset = this.tileSize * 1.5;
				// menuPosY es la línea base del texto: el centro visual de las mayúsculas queda ~0.47 del
				// tamaño de fuente más arriba, y el hongo se centra en vertical sobre ese punto.
				const cursorPos = { x: textLeft - cursorOffset, y: menuPosY - TEXT_SIZE * 0.47 };
				if(this.engine.sprites["Cursor"]) {
					this.engine.drawSprite("Cursor", 0, cursorPos, this.engine.sprites["Cursor"].scale, false, 0, Pivot.Center_Left);
				}
			}
			this.engine.drawTextCustom(font, buttonLabel, TEXT_SIZE, "#ffffff", textPos, "center");
		}

		const topScore = "TOP - " + this.highscore.toString().padStart(6, "0");
		const topScorePos = {
			x: this.engine.getCanvasWidth() / 2,
			y: this.engine.getCanvasHeight() * 0.65 + menuGap * numButtons + menuGap / 2 + TEXT_SIZE
		};
		this.engine.drawTextCustom(font, topScore, TEXT_SIZE, "#ffffff", topScorePos, "center");
		if (this.beaten) this.engine.drawTextCustom(font, "LEFT / RIGHT: SELECT WORLD", TEXT_SIZE * 0.6, "#ffffff", { x: topScorePos.x, y: topScorePos.y + TEXT_SIZE * 1.6 }, "center");

		const volumePercentage = Math.round(this.volume * 100);
		const volumeText = `VOL ${volumePercentage}%`;
		const volumePos = {
			x: 20,
			y: this.engine.getCanvasHeight() - 20
		};
		this.engine.drawTextCustom(font, volumeText, TEXT_SIZE, Color.WHITE, volumePos, "left");
	}

	drawSettingsMenu() {
		this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.OVERWORLD_COLOR);

		this.drawBackground();
		this.drawBlocks();
		this.drawForegroundBlocks();

		// Título
		const titleText = "SETTINGS";
		const titlePos = {
			x: this.engine.getCanvasWidth() / 2,
			y: this.engine.getCanvasHeight() * 0.15
		};
		this.engine.drawTextCustom(font, titleText, TEXT_SIZE * 2, "#ffffff", titlePos, "center");

		const settingsOptions = [
			{ label: "DIFFICULTY", values: ["NORMAL", "HARD"], getValue: () => this.difficulty, setValue: (v) => { this.difficulty = v; this.engine.setCookie("smb_difficulty", v, 365); } },
			{ label: "VOLUME", values: [], getValue: () => Math.round(this.volume * 100) + "%", setValue: null },
			{ label: "SOUND EFFECTS", values: ["ON", "OFF"], getValue: () => this.sfxEnabled ? "ON" : "OFF", setValue: (v) => { this.sfxEnabled = v === "ON"; this.engine.setCookie("smb_sfx", this.sfxEnabled, 365); } },
			{ label: "BACK", values: [], getValue: () => "", setValue: null }
		];

		const menuStartY = this.engine.getCanvasHeight() * 0.35;
		const menuGap = this.engine.getCanvasHeight() * 0.12;

		for (let i = 0; i < settingsOptions.length; i++) {
			const option = settingsOptions[i];
			const menuPosY = menuStartY + menuGap * i;

			// Dibujar selector
			if (this.currentSettingsSelection === i) {
				const cursorSprite = this.engine.sprites["Cursor"];
				if(cursorSprite) {
					// Mismo criterio que el menú principal: a la izquierda de la etiqueta y centrado
					// en vertical sobre las mayúsculas (menuPosY es la línea base del texto).
					const labelLeft = this.engine.getCanvasWidth() / 2 - this.tileSize * 4;
					const cursorPos = { x: labelLeft - this.tileSize * 1.5, y: menuPosY - TEXT_SIZE * 0.47 };
					this.engine.drawSprite("Cursor", 0, cursorPos, cursorSprite.scale, false, 0, Pivot.Center_Left);
				}
			}

			// Dibujar opción
			const optionTextPos = {
				x: this.engine.getCanvasWidth() / 2 - this.tileSize * 4,
				y: menuPosY
			};
			this.engine.drawTextCustom(font, option.label, TEXT_SIZE, "#ffffff", optionTextPos, "left");

			// Dibujar valores (si existen)
			const currentValue = option.getValue();
			if (currentValue !== "") {
				const valueTextPos = {
					x: this.engine.getCanvasWidth() / 2 + this.tileSize * 2,
					y: menuPosY
				};
				this.engine.drawTextCustom(font, currentValue, TEXT_SIZE, "#ffff00", valueTextPos, "right");
			}
		}

		// Controles de navegación
		if (this.engine.keysPressed['ArrowUp'] || this.engine.keysPressed['KeyW']) {
			this.engine.keysPressed['ArrowUp'] = false;
			this.engine.keysPressed['KeyW'] = false;
			this.currentSettingsSelection--;
		}
		if (this.engine.keysPressed['ArrowDown'] || this.engine.keysPressed['KeyS']) {
			this.engine.keysPressed['ArrowDown'] = false;
			this.engine.keysPressed['KeyS'] = false;
			this.currentSettingsSelection++;
		}

		this.currentSettingsSelection = ((this.currentSettingsSelection % settingsOptions.length) + settingsOptions.length) % settingsOptions.length;

		// Cambiar valores con left/right
		const currentOption = settingsOptions[this.currentSettingsSelection];
		if (currentOption.values.length > 0) {
			const currentValueIndex = currentOption.values.indexOf(currentOption.getValue());

			if (this.engine.keysPressed['ArrowLeft'] || this.engine.keysPressed['KeyA']) {
				this.engine.keysPressed['ArrowLeft'] = false;
				this.engine.keysPressed['KeyA'] = false;
				if (currentValueIndex > 0) {
					currentOption.setValue(currentOption.values[currentValueIndex - 1]);
				}
			}
			if (this.engine.keysPressed['ArrowRight'] || this.engine.keysPressed['KeyD']) {
				this.engine.keysPressed['ArrowRight'] = false;
				this.engine.keysPressed['KeyD'] = false;
				if (currentValueIndex < currentOption.values.length - 1) {
					currentOption.setValue(currentOption.values[currentValueIndex + 1]);
				}
			}
		} else if (this.currentSettingsSelection === 1) {
			// Controlar volumen con left/right cuando está seleccionada la opción de VOLUME
			if (this.engine.keysPressed['ArrowLeft'] || this.engine.keysPressed['KeyA']) {
				this.engine.keysPressed['ArrowLeft'] = false;
				this.engine.keysPressed['KeyA'] = false;
				this.volume = Math.max(0, this.volume - 0.05);
				this.engine.setMasterVolume(this.volume);
				this.engine.setCookie("smb_volume", this.volume, 365);
			}
			if (this.engine.keysPressed['ArrowRight'] || this.engine.keysPressed['KeyD']) {
				this.engine.keysPressed['ArrowRight'] = false;
				this.engine.keysPressed['KeyD'] = false;
				this.volume = Math.min(1, this.volume + 0.05);
				this.engine.setMasterVolume(this.volume);
				this.engine.setCookie("smb_volume", this.volume, 365);
			}
		}

		// Confirmar selección (Enter/Space solo en BACK)
		if ((this.engine.keysPressed['Enter'] || this.engine.keysPressed['Space']) && this.currentSettingsSelection === 3) {
			delete this.engine.keysPressed['Enter'];
			delete this.engine.keysPressed['Space'];
			this.state = Game_State.Title_Menu;
		}

		// Tecla ESC para volver
		if (this.engine.keysPressed['Escape']) {
			this.engine.keysPressed['Escape'] = false;
			this.state = Game_State.Title_Menu;
		}
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

	// Escenografía de fondo del nivel, tal como la deja el original: fija en el mapa y sin parallax
	drawScenery() {
		const list = this.currentMap?.scenery;
		if (!list) return;
		const ts = this.tileSize, w = this.engine.getCanvasWidth();
		for (let i = 0; i < list.length; i += 3) {
			const pos = this.tileToScreen(list[i], list[i + 1]);
			if (pos.x + ts < 0 || pos.x > w) continue;
			const id = list[i + 2];
			const name = SCENERY_CELL[id] ? `Scenery_${id.toString(16)}` : METATILE_SPRITE[id];
			const sprite = name && this.engine.sprites[name];
			if (sprite) this.engine.drawSprite(name, 0, pos, sprite.scale, false, 0, Pivot.Top_Left);
		}
	}

	// Color de fondo del nivel actual (el mismo que usa drawBackground)
	backgroundColor() {
		switch (this.currentMap?.type ?? World_Type.Overworld) {
			case World_Type.Underground: return this.UNDERGROUND_COLOR;
			case World_Type.Underwater: return this.UNDERWATER_COLOR;
			case World_Type.Castle: return this.CASTLE_COLOR;
			default: return this.currentMap?.night ? this.NIGHT_COLOR : this.OVERWORLD_COLOR;
		}
	}

	// Cámara vertical: la vista muestra el pie del nivel, pero al trepar una enredadera sube para seguir a Mario.
	// Es sólo un desplazamiento al dibujar el mundo; la lógica sigue en coordenadas de pantalla.
	beginWorldCamera() {
		const ts = this.tileSize, ctx = this.engine.ctx;
		const player = this.engine.animatedSprites[this.currentPlayerSpriteName()];
		const hidden = Math.max(0, -this.tileToScreen(0, 0).y);   // lo que queda por encima de la pantalla (hasta la fila 0 del mapa)
		// La cámara sube cuando Mario pasa por arriba del borde visible (trepando, saltando alto o sobre plataformas altas)
		const target = player ? Math.min(hidden, Math.max(0, ts * 2.5 - player.position.y)) : 0;
		this.cameraY = (this.cameraY || 0) + (target - (this.cameraY || 0)) * Math.min(1, 0.15 * this.fk);
		if (Math.abs(this.cameraY - target) < 0.5) this.cameraY = target;
		if (this.cameraY <= 0) { this.cameraShift = false; return; }
		// El borde de arriba que queda al desplazar se pinta con el color de fondo
		this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.backgroundColor());
		ctx.save();
		ctx.translate(0, this.cameraY);
		this.cameraShift = true;
	}

	endWorldCamera() {
		if (this.cameraShift) { this.engine.ctx.restore(); this.cameraShift = false; }
	}

	drawBackground() {
		switch(this.currentMap?.type ?? World_Type.Overworld) {
			case World_Type.Overworld:
				this.engine.drawRectangle(this.engine.getCanvasRectangle(), this.currentMap?.night ? this.NIGHT_COLOR : this.OVERWORLD_COLOR);
				if (this.currentMap?.scenery) break;   // los niveles traen su propia escenografía; el parallax es para el menú

				const parallaxSpeedClouds = 0.5;
				const parallaxSpeedHills = 0.8;
				const parallaxSpeedBushes = 1;

				const offsetX = this.mapOffset.x;
				const numObjects = Math.ceil(this.currentMap.dimensions.width * 0.35);
				const groundY = this.engine.getCanvasHeight() - this.tileSize * 2;

				const cloudY = 80;
				for (let i = 0; i < numObjects; i++) {
					const cloudWidth = 3 + (i % 2);
					const cloudPos = {
						x: (i * 500) + offsetX * parallaxSpeedClouds,
						y: cloudY + (i % 3) * 40
					};

					if (cloudPos.x + cloudWidth * this.tileSize < 0 || cloudPos.x > this.engine.getCanvasWidth()) continue;

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

					if (hillPos.x + hillWidth * this.tileSize < 0 || hillPos.x > this.engine.getCanvasWidth()) continue;

					this.drawCompositeObject(hillPos, pattern, this.HILL_SPRITE_MAP);
				}

				for (let i = 0; i < numObjects; i++) {
					const bushWidth = 2 + (i % 3);
					 const bushPos = {
						x: (i * 350) + offsetX * parallaxSpeedBushes,
						y: groundY + this.tileSize / 2
					};

					if (bushPos.x + bushWidth * this.tileSize < 0 || bushPos.x > this.engine.getCanvasWidth()) continue;

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
		this.drawScenery();
	}

	drawBlocks(){
		if (!this.currentMap) return;

		const mapWidth = this.currentMap.dimensions.width;
		for (let i = 0; i < this.currentMap.map.length; i++) {
			const blockId = this.currentMap.map[i];
			if (blockId === 0 || this.foregroundBlocks.includes(blockId)) continue;

			const spriteName = this.spriteNameForCell(blockId, i);
			const sprite = spriteName && this.engine.sprites[spriteName];
			if (!sprite) continue;

			const coords = this.engine.indexToCoords(i, mapWidth);
			const blockPos = this.tileToScreen(Math.floor(coords.x), Math.floor(coords.y));
			this.engine.drawSprite(spriteName, 0, blockPos, sprite.scale, false, 0, Pivot.Top_Left);
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
			const spriteName = this.spriteNameForCell(blockId, i);
			const sprite = spriteName && this.engine.sprites[spriteName];

			if (sprite) {
				this.engine.drawSprite(spriteName, 0, blockPos, sprite.scale, false, 0, Pivot.Top_Left);
			}
		}
	}

	spawnFireball() {
		// Como en el original, a lo sumo dos bolas de fuego a la vez
		if (this.activeFireballs.filter(f => f.state === 'moving').length >= MAX_FIREBALLS) return;

		const fireSprite = this.engine.animatedSprites[PlayerName[this.player] + "_Fire"];
		if (!fireSprite) return;

		const k = this.tileScale;
		const dir = fireSprite.flipped ? -1 : 1;
		const startX = fireSprite.position.x + (fireSprite.flipped ? -this.tileSize / 2 : this.tileSize);
		const startY = fireSprite.position.y + this.tileSize / 2;

		this.activeFireballs.push({
			x: startX - this.mapOffset.x,
			y: startY,
			vx: dir * FIREBALL_SPEED * k,
			vy: FIREBALL_MAX_FALL * k,
			state: 'moving',
			animTimer: 0
		});
		this.engine.playAudioOverlap(audio["Player_Fireball"]);

		this.isThrowing = true;
		this.throwTimer = 15;
	}

	updateAndDrawFireballs() {
		for (let i = this.activeFireballs.length - 1; i >= 0; i--) {
			const fb = this.activeFireballs[i];
			const k = this.tileScale, half = 4 * k;
			const screenPos = { x: fb.x + this.mapOffset.x, y: fb.y };

			if (fb.state === 'exploding') {
				const hitSprite = this.engine.animatedSprites["Fireball"];
				hitSprite.position = screenPos;
				
				if (fb.animTimer === 0) {

					this.engine.setAnimationForSprite("Fireball", "Explode", true);
				}

				this.engine.drawAnimatedSprite("Fireball", this.frameDt, Pivot.Center);

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

			// Física en pasos de 1/60 s: gravedad, rebote en el suelo, choque con paredes y enemigos
			const W = this.currentMap.dimensions.width, tiles = this.currentMap.map;
			for (let step = 0; step < this.physicsSteps && fb.state === 'moving'; step++) {
				fb.y += fb.vy;
				fb.vy = Math.min(fb.vy + FIREBALL_GRAVITY * k, FIREBALL_MAX_FALL * k);
				fb.x += fb.vx;
				const sx = fb.x + this.mapOffset.x;

				const groundTile = this.screenToTile(sx, fb.y + half);
				if (fb.vy > 0 && isSolidMetatile(tiles[this.engine.coordsToIndex(groundTile, W)])) {
					fb.y = this.tileToScreen(groundTile.x, groundTile.y).y - half;
					fb.vy = FIREBALL_BOUNCE * k;
				}

				const wallTile = this.screenToTile(sx + (fb.vx > 0 ? half : -half), fb.y);
				if (isSolidMetatile(tiles[this.engine.coordsToIndex(wallTile, W)]) || sx < 0 || sx > this.engine.getCanvasWidth()) {
					fb.state = 'exploding';
					this.engine.playAudioOverlap(audio["Player_Bump"]);
					break;
				}

				const fbRect = { x: sx - half, y: fb.y - half, w: 2 * half, h: 2 * half };
				for (const enemy of this.enemies) {
					if (!enemy.active || enemy.state === 'stomped' || enemy.state === 'shell' || enemy.state === 'falling') continue;
					if (NPC_TYPES.has(enemy.type) || enemy.type === 'BowserFlame' || enemy.type === 'Hammer') continue;
					if (this.rectsOverlap(fbRect, this.enemyScreenRect(enemy))) {
						if (enemy.type === 'Bowser') { this.hitBowser(enemy); fb.state = 'exploding'; break; }
						if (enemy.color === 'Buzzy') { fb.state = 'exploding'; break; }
						this.defeatEnemy(enemy, ENEMY_POINTS[enemy.type] ?? 200);
						fb.state = 'exploding';
						break;
					}
				}
			}

			if (fb.state === 'moving') {

				const moveSprite = this.engine.animatedSprites["Fireball_Hit"];
				moveSprite.position = { x: fb.x + this.mapOffset.x, y: fb.y };
				
				this.engine.drawAnimatedSprite("Fireball_Hit", this.frameDt, Pivot.Center);
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

			const kk = this.tileScale / SPRITE_SCALE;
			coin.y += coin.vY * kk * this.fk;
			coin.vY += 0.8 * kk * this.fk;
			coin.timer += this.fk;

			if (coin.timer > 30) {
				this.activeCoins.splice(i, 1);
			}
		}

		const coinSprite = this.engine.animatedSprites["Coin"];
		const coinAnim = coinSprite.animations["Coin_Shine"];
		this.coinAnimAcc = (this.coinAnimAcc || 0) + this.fk;
		if (this.coinAnimAcc >= coinAnim.frameSpeed) {
			this.coinAnimAcc -= coinAnim.frameSpeed;
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
			block.y += block.vY * this.fk;
			block.vY += this.gravity * 1.5 * this.fk;
			if (block.y >= block.originalY) {
				// Al terminar el golpe, el bloque que entregó su contenido queda vacío
				let finalId = block.originalId;
				const item = BLOCK_ITEM[block.originalId];
				if (item === 'coins') {
					if (this.specialBlocks[block.mapIndex]?.exhausted) finalId = MT.Used;
				} else if (item) {
					finalId = MT.Used;
				}

				this.currentMap.map[block.mapIndex] = finalId;
				this.bumpingBlocks.splice(i, 1);
				continue;
			}
			// Un bloque oculto se ve como bloque vacío mientras rebota
			let spriteNameToDraw = HIDDEN_BLOCKS.has(block.originalId) ? 'Block_Used' : this.spriteNameForCell(block.originalId, block.mapIndex);
			const spriteData = spriteNameToDraw && this.engine.sprites[spriteNameToDraw];
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

			const kk = this.tileScale / SPRITE_SCALE;
			p.vy += this.gravity * 1.5 * this.fk;
			p.x += p.vx * kk * this.fk;
			p.y += p.vy * this.fk;
			p.lifespan -= this.fk;

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
		const isSolid = isSolidMetatile;


			let isCrouching = false;
			const oldPlayerHeight = isBig ? (this.wasCrouching ? this.tileSize : this.tileSize * 2) : this.tileSize;

			if (isBig && !this.climbVine) {
				const isPressingCrouchKey = this.engine.keysPressed['KeyS'] || this.engine.keysPressed['ArrowDown'];
				const checkPos = { x: playerPos.x + this.tileSize / 2, y: playerPos.y - 1 };
				const tileAbove = this.screenToTile(checkPos.x, checkPos.y);
				const mapIndex = this.engine.coordsToIndex(tileAbove, this.currentMap.dimensions.width);
				const ceilingBlocksStand = isSolid(this.currentMap.map[mapIndex]);
				
				isCrouching = isPressingCrouchKey || (!isPressingCrouchKey && this.wasCrouching && ceilingBlocksStand);
			}
			
			let playerHeight = isBig ? (isCrouching ? this.tileSize : this.tileSize * 2) : this.tileSize;


			// Al agacharse o levantarse cambia la altura de la caja, pero los pies tienen que quedar
			// donde estaban. Antes solo se compensaba al levantarse, así que agacharse en el aire y
			// soltar subía a Mario un tile gratis por cada ciclo.
			if (oldPlayerHeight !== playerHeight) {
				playerPos.y += oldPlayerHeight - playerHeight;
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
				// Mario se queda quieto unos 15 cuadros y después sube y cae (PlayerKilled)
				if (this.deathTimer > DEATH_PAUSE_MS) {
					this.velocityY = Math.min(this.velocityY + DEATH_GRAVITY * this.tileScale * this.fk, ENEMY_MAX_FALL * 2 * this.tileScale);
					playerPos.y += this.velocityY * this.fk;
				}
				const drawPos = { x: playerPos.x, y: playerPos.y };
				const newScale = this.tileScale;
				if (playerPos.y > this.engine.getCanvasHeight() + this.tileSize) {
					this.handleDeath();
				}
				const deathFrameIndex = 6;
				this.engine.drawSprite(player.spriteName, deathFrameIndex, drawPos, newScale, player.flipped, 0, Pivot.Top_Left);
				return;
			}

			const mapWidth = this.currentMap.dimensions.width;
			const inBounds = (x, y) => x >= 0 && x < mapWidth;
			
			// Física vertical en pasos fijos de 1/60 s (ver stepFrame), igual que el original, sin importar los Hz de la pantalla.
			const physicsSteps = this.climbVine ? 0 : this.physicsSteps;

			for (let physicsStep = 0; physicsStep < physicsSteps; physicsStep++) {
			const newY = playerPos.y + this.velocityY;

			// Colisión con techo
			if (this.velocityY < 0) {

				const headCenterTile = this.screenToTile(playerPos.x + this.tileSize / 2, newY);
				let hitCeiling = false;
				if (inBounds(headCenterTile.x, headCenterTile.y)) {
					const idx = this.engine.coordsToIndex(headCenterTile, mapWidth);
					this.handleCoinCollision(idx); 
					const blockId = this.currentMap.map[idx] || 0;
					if (isSolid(blockId) || HIDDEN_BLOCKS.has(blockId)) {
						let ceilingSpeed = SMB_CEILING_SPEED;
						const { x: blockX, y: blockY } = this.tileToScreen(headCenterTile.x, headCenterTile.y);
						let blockSoundPlayed = false;

						if (PLAIN_BRICKS.has(blockId)) {
							const idxAbove = idx - mapWidth;
							if (isCoinMetatile(this.currentMap.map[idxAbove])) { // moneda sobre el ladrillo
								this.currentMap.map[idxAbove] = 0;

								this.addCoin();

								this.spawnCoin(blockX, blockY - this.tileSize); 
								this.engine.playAudioOverlap(audio["Coin"]);
							}
						}

						const isBreakableBrick = PLAIN_BRICKS.has(blockId);
						const canPlayerBreakBrick = this.playerSize > Player_Size.Small;

						if (isBreakableBrick && canPlayerBreakBrick) {
							this.currentMap.map[idx] = 0;
							this.spawnBrickParticles(blockX, blockY);
							this.score += 50;
							this.spawnScorePopup("50", blockX + this.tileSize / 2, blockY);
							ceilingSpeed = SMB_BRICK_BREAK_SPEED;


						} else {
							let blockSoundPlayed = false;

							const item = BLOCK_ITEM[blockId];
							let coinGivenNow = false;
							if (item === 'coins') {
								// Da una moneda por golpe durante unos 3,8 s desde el primero (BrickCoinTimer)
								if (!this.specialBlocks[idx]) { this.specialBlocks[idx] = { revealed: false, expiresAt: this.clockMs + BRICK_COIN_TIMER_MS }; }
								const info = this.specialBlocks[idx];
								info.revealed = true;
								if (!info.exhausted) {
									this.addCoin(); this.spawnCoin(blockX, blockY);
									this.engine.playAudioOverlap(audio["Coin"]); blockSoundPlayed = true; coinGivenNow = true;
									if (this.clockMs >= info.expiresAt) info.exhausted = true;
								}
							} else if (item === 'coin') {
								this.addCoin();
								this.spawnCoin(blockX, blockY);
								this.engine.playAudioOverlap(audio["Coin"]); blockSoundPlayed = true;
							} else if (item === 'powerup') {
								const powerupType = isBig ? Powerup_Type.Fire_Flower : Powerup_Type.Mushroom_Super;
								this.spawnPowerup(blockX, blockY, powerupType);
							} else if (item === 'vine') {
								this.spawnVine(headCenterTile.x, headCenterTile.y);
							} else if (item === 'star') {
								this.spawnPowerup(blockX, blockY, Powerup_Type.Invincible);
							} else if (item === '1up') {
								this.spawnPowerup(blockX, blockY, Powerup_Type.Mushroom_1UP);
							}

							const isAlreadyBumping = this.bumpingBlocks.some(b => b.mapIndex === idx);
							const justExhausted = (BLOCK_ITEM[blockId] === 'coins' && this.specialBlocks[idx]?.exhausted && !coinGivenNow);

							if (!isAlreadyBumping && !justExhausted) {
								this.bumpingBlocks.push({ x: blockX, y: blockY, originalY: blockY, vY: -6, mapIndex: idx, originalId: blockId });
								this.currentMap.map[idx] = 0;
								ceilingSpeed = SMB_BUMP_SPEED;
							}

							if (!blockSoundPlayed) {
								this.engine.playAudioOverlap(audio["Player_Bump"]);
							}
						}

						this.killEnemiesAbove(headCenterTile.x, headCenterTile.y);
						this.velocityY = ceilingSpeed * this.tileScale; playerPos.y = this.tileToScreen(headCenterTile.x, headCenterTile.y + 1).y; hitCeiling = true;
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
							this.isOnGround = true; this.velocityY = 0; this.stompChain = 0; foundGround = true; break;
						}
					}
				}
				if (!foundGround) { this.isOnGround = false; playerPos.y = newY; }
			}

			// La gravedad se aplica después de mover, como en el original. Subiendo con el salto
			// apretado (o sin haber subido todavía 1 px) rige la fuerza suave; soltando o cayendo, la fuerte.
			const rising = this.velocityY < 0;
			const risenEnough = (this.jumpOriginY - playerPos.y) >= this.tileScale;
			const force = (rising && (this.jumpHeld || !risenEnough)) ? this.jumpForceUp : this.jumpForceDown;
			this.velocityY = Math.min(this.velocityY + force * this.tileScale, SMB_MAX_FALL_SPEED * this.tileScale);
			}


			if (this.fireballCooldown > 0) this.fireballCooldown--;
			if (this.throwTimer > 0) this.throwTimer--; else this.isThrowing = false;

			const isShooting = this.engine.keysPressed['ControlLeft'] || this.engine.keysPressed['ControlRight'] || this.engine.keysPressed['Space'];
			if (isShooting && this.playerSize === Player_Size.Fire) {
				this.spawnFireball();

				this.engine.keysPressed['ControlLeft'] = false;
				this.engine.keysPressed['ControlRight'] = false;
			}

			const keys = this.engine.keysPressed;
			const isTurbo = keys['ShiftLeft'] || keys['ShiftRight'];
			let isTryingToMoveLeft = !!(keys['ArrowLeft'] || keys['KeyA']);
			let isTryingToMoveRight = !!(keys['ArrowRight'] || keys['KeyD']);
			// Apretar abajo en el suelo anula izquierda y derecha: agachado, Mario sólo se frena solo
			if ((keys['KeyS'] || keys['ArrowDown']) && this.isOnGround) { isTryingToMoveLeft = isTryingToMoveRight = false; }

			const wasSkidding = this.isSkidding;
			let dx = 0;
			for (let st = 0; st < physicsSteps; st++) {
				this.stepPlayerX(isTryingToMoveLeft, isTryingToMoveRight, isTurbo);
				dx += (this.xSpeed / 4096) * this.tileScale;
			}
			if (this.isSkidding && !wasSkidding) this.engine.playAudioOverlap(audio["Player_Skid"]);
			player.flipped = this.facingDir < 0;
			const isMoving = this.xSpeed !== 0;

			const animPrefix = PlayerName[this.player] + (this.playerSize === Player_Size.Fire ? "_Fire" : (isBig ? "_Big" : ""));
			if (this.climbVine) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_${this.climbMoving ? 'Fall' : 'Slide'}`);
			else if (isCrouching) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Crouch`);
			else if (this.isThrowing) { this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Shoot`); } 
			else if (this.isWater && !this.isOnGround) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Swim`);
			else if (this.velocityY < 0 && !this.isOnGround) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Jump`);
			else if (this.velocityY > this.gravity && !this.isOnGround) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Fall`);
			else if (this.isSkidding) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Stop`);
			else if (isMoving) this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Run`);
			else this.engine.setAnimationForSprite(currentSpriteName, `${animPrefix}_Idle`);

			// Se aplica el desplazamiento con colisiones; chocar con una pared anula la velocidad
			const cw = this.engine.getCanvasWidth();
			if (dx < 0) {
				const newX = playerPos.x + dx;
				const leftTop = this.screenToTile(newX + 4, playerPos.y);
				const leftBottom = this.screenToTile(newX + 4, playerPos.y + playerHeight - 1);
				let blocked = false;
				for (let ty = leftTop.y; ty <= leftBottom.y; ty++) {
					if (inBounds(leftTop.x, ty) && isSolid(this.currentMap.map[this.engine.coordsToIndex({x: leftTop.x, y: ty}, mapWidth)])) {
						blocked = true; break;
					}
				}
				// No se puede salir por el borde izquierdo de la pantalla
				if (blocked || newX < 0) { this.xSpeed = 0; this.blockedDir = -1; if (!blocked) playerPos.x = Math.max(0, playerPos.x); }
				else playerPos.x = newX;
			} else if (dx > 0) {
				const newX = playerPos.x + dx;
				const rightTop = this.screenToTile(newX + this.tileSize - 4, playerPos.y);
				const rightBottom = this.screenToTile(newX + this.tileSize - 4, playerPos.y + playerHeight - 1);
				let blocked = false;
				for (let ty = rightTop.y; ty <= rightBottom.y; ty++) {
					const tileCoords = { x: rightTop.x, y: ty };
					const mapIndex = this.engine.coordsToIndex(tileCoords, mapWidth);
					const blockId = this.currentMap.map[mapIndex];
					this.handleCoinCollision(mapIndex);
					if (blockId === MT.Flagpole) {
						const poleCoords = this.tileToScreen(tileCoords.x, tileCoords.y);
						playerPos.x = poleCoords.x - this.tileSize / 2;
						let groundYTile = ty;
						while (this.currentMap.map[this.engine.coordsToIndex({x: tileCoords.x, y: groundYTile + 1}, mapWidth)] === MT.Flagpole) {
							groundYTile++;
						}
						const finalLandingY = this.tileToScreen(tileCoords.x, groundYTile + 1).y - playerHeight + this.tileSize;
						this.flagpoleInfo = { topY: poleCoords.y, groundY: finalLandingY, castleDoorX: poleCoords.x + this.tileSize * 5 };
						this.flagpoleFlag = { x: poleCoords.x - this.tileSize / 2, y: playerPos.y };
						this.state = Game_State.Level_Complete; this.levelCompleteState = 'none'; 
						this.xSpeed = 0;
						return;
					}
					if (inBounds(rightTop.x, ty) && isSolid(this.currentMap.map[this.engine.coordsToIndex({x: rightTop.x, y: ty}, mapWidth)])) {
						blocked = true;
						break;
					}
				}
				if (blocked) { this.xSpeed = 0; this.blockedDir = 1; }
				else {
					// La pantalla empieza a seguir a Mario a los 80 px de 256 (un poco menos de lo que avanza) y
					// del todo a los 112 px; acá se usa la misma proporción del ancho de la ventana
					const k = this.tileScale;
					let scroll = 0;
					if (playerPos.x >= cw * (80 / 256)) {
						scroll = dx;
						if (playerPos.x < cw * (112 / 256) && dx >= 2 * k) scroll = dx - k;
					}
					playerPos.x += dx - scroll;
					if (scroll > 0) { this.mapOffset.x -= scroll; this.maxMapOffsetX = Math.min(this.maxMapOffsetX, this.mapOffset.x); }
				}
			}
			// Como en el original, el salto solo se dispara al apretar: mantener apretado no repite.
			const jumpDown = !!(this.engine.keysPressed['ArrowUp'] || this.engine.keysPressed['KeyW']);
			if (jumpDown && !this.jumpHeld && this.isWater) {
				// Brazada: se puede dar de nuevo enseguida, o al empezar a caer
				if (this.swimTimer > 0 || this.velocityY >= 0) {
					this.velocityY = SWIM_STROKE_SPEED * this.tileScale;
					this.jumpForceUp = SWIM_FORCE_UP;
					this.jumpForceDown = SWIM_FORCE_DOWN;
					this.jumpOriginY = playerPos.y;
					this.isOnGround = false;
					this.swimTimer = SWIM_TIMER_STEPS;
					this.engine.playAudioOverlap(audio["Player_Stomp"]);
				}
			} else if (jumpDown && !this.jumpHeld && this.isOnGround) {
				const absSpeed = Math.abs(Math.floor(this.xSpeed / 256));
				const jump = JUMP_BY_SPEED[absSpeed >= 28 ? 4 : absSpeed >= 25 ? 3 : absSpeed >= 16 ? 2 : absSpeed >= 9 ? 1 : 0];
				this.velocityY = -jump.speed * this.tileScale;
				this.jumpForceUp = jump.up;
				this.jumpForceDown = jump.down;
				this.jumpOriginY = playerPos.y;
				this.isOnGround = false;
				this.engine.playAudioOverlap(isTurbo ? audio["Player_Jump_Turbo"] : audio["Player_Jump"]);
			}
			this.jumpHeld = jumpDown;
			
			this.snapToPlatform(playerPos, playerHeight);

			// Hacha del castillo de Bowser: al tocarla se cae el puente y termina el nivel
			if (this.state === Game_State.Playing && this.currentMap.axe) {
				const ax = this.currentMap.axe, tp = this.tileToScreen(ax.x, ax.y);
				if (this.rectsOverlap(this.playerHitbox(player), { x: tp.x, y: tp.y, w: this.tileSize, h: this.tileSize })) this.startAxeEnding(playerPos, playerHeight);
			}

			// Caños que llevan a otro nivel (abajo sobre la boca, o derecha contra la boca lateral)
			if (this.state === Game_State.Playing) {
				const warp = this.findPipeWarp(playerPos, playerHeight);
				if (warp) this.startPipeTransition(warp, playerHeight);
			}

			// Verificar si el jugador cayó del mapa (usando coordenadas de mundo)
			const playerTile = this.screenToTile(playerPos.x + this.tileSize / 2, playerPos.y + this.tileSize / 2);
			if ((playerTile.y >= this.currentMap.dimensions.height || playerPos.y > this.engine.getCanvasHeight() + this.tileSize * 2) && this.state === Game_State.Playing) { 
				// Caerse de una sala de nubes lleva de vuelta al nivel; en cualquier otro lado, se muere
				if (this.currentMap.exit) this.warpTo(this.currentMap.exit, playerHeight);
				else this.killPlayer();
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

			// Con la estrella Mario cambia de colores rápidamente
			if (this.starTimer > 0) {
				this.engine.ctx.save();
				this.engine.ctx.filter = `hue-rotate(${Math.floor(this.clockMs / 50) % 6 * 60}deg) saturate(2)`;
			}
			this.engine.drawAnimatedSprite(currentSpriteName, this.frameDt, Pivot.Top_Left);
			if (this.starTimer > 0) this.engine.ctx.restore();

			player.position.y = originalY;

		}
	}

	spawnScorePopup(text, x, y) {
		this.scorePopups.push({ text: text, x: x, y: y, timer: 90 });
	}

	updateAndDrawScorePopups() {
		for (let i = this.scorePopups.length - 1; i >= 0; i--) {
			const popup = this.scorePopups[i];

			popup.y -= 0.5 * (this.tileScale / SPRITE_SCALE) * this.fk;
			popup.timer -= this.fk;
			this.engine.drawTextCustom(font, popup.text, TEXT_SIZE, Color.WHITE, {x: popup.x, y: popup.y}, "center");
			if (popup.timer <= 0) {
				this.scorePopups.splice(i, 1);
			}
		}
	}

	// Mario toca el hacha: desaparecen el hacha y la cadena, Bowser (si sigue) cae con el puente y Mario
	// camina hasta Toad (o la princesa en el 8-4)
	startAxeEnding(playerPos, playerHeight) {
		const ax = this.currentMap.axe, mw = this.currentMap.dimensions.width, map = this.currentMap.map;
		this.stopAllMusic();
		if (parseInt(this.currentMap.world, 10) === 8) this.completeGame();
		this.state = Game_State.Level_Complete;
		this.levelCompleteState = 'axe_collapse';
		this.axeTimer = 0;
		this.levelTimeAtFlag = 0;        // sin fuegos artificiales
		this.flagpoleFlag = null;
		this.xSpeed = 0; this.velocityX = 0; this.velocityY = 0;
		map[ax.y * mw + ax.x] = 0;
		map[(ax.y + 1) * mw + ax.x - 1] = 0;
		// El puente se deshace de a un tile, desde el hacha hacia afuera
		this.bridgeTiles = [];
		for (let x = ax.x - 1; x >= 0; x--) {
			const i = (ax.y + 2) * mw + x;
			if (map[i] !== 0x89) { if (this.bridgeTiles.length) break; else continue; }
			this.bridgeTiles.push(i);
		}
		this.enemies = this.enemies.filter(e => e.type === 'Bowser' || NPC_TYPES.has(e.type));
		for (const e of this.enemies) e.active = true;
		this.engine.playAudio(audio["Level_Clear"], false);
		// Mario se queda parado sobre el apoyo del hacha
		playerPos.y = this.tileToScreen(ax.x, ax.y + 1).y - playerHeight;
	}

	// Terminar el 8-4 desbloquea la selección de mundo y el modo difícil, que queda puesto
	completeGame() {
		this.beaten = true;
		this.difficulty = "HARD";
		this.engine.setCookie("smb_beaten", "true", 3650);
		this.engine.setCookie("smb_difficulty", "HARD", 365);
	}

	// Mensaje de Toad o de la princesa al final del castillo
	drawAxeMessage() {
		const world = parseInt(this.currentMap.world, 10);
		const who = PlayerName[this.player].toUpperCase();
		const lines = world === 8
			? [`THANK YOU ${who}!`, 'YOUR QUEST IS OVER.', 'WE PRESENT YOU A NEW QUEST.', 'PRESS LEFT OR RIGHT AT THE TITLE', 'TO SELECT A WORLD.']
			: [`THANK YOU ${who}!`, 'BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!'];
		const cx = this.engine.getCanvasWidth() / 2;
		lines.forEach((t, i) => this.engine.drawTextCustom(font, t, TEXT_SIZE, Color.WHITE, { x: cx, y: this.tileSize * (2.2 + i * 0.8) }, "center"));
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
                const slideSpeed = 1 * this.tileScale * this.fk;   // baja 1 px por cuadro, como en el original
                const playerHeight = isBig ? this.tileSize * 2 : this.tileSize;

                switch(this.levelCompleteState) {
                    case 'axe_collapse': {
                        this.axeTimer += dt;
                        while (this.bridgeTiles.length && this.axeTimer >= BRIDGE_COLLAPSE_MS) {
                            this.axeTimer -= BRIDGE_COLLAPSE_MS;
                            this.currentMap.map[this.bridgeTiles.shift()] = 0;
                            this.engine.playAudioOverlap(audio["Brick_Break"]);
                        }
                        if (!this.bridgeTiles.length) {
                            const bowser = this.enemies.find(e => e.type === 'Bowser');
                            if (bowser && bowser.state !== 'falling') { bowser.state = 'falling'; bowser.vy = 0; this.engine.playAudioOverlap(audio["Bowser_Falls"]); }
                            this.levelCompleteState = 'axe_fall';
                            this.axeTimer = 0;
                        }
                        break;
                    }
                    case 'axe_fall': {
                        for (const e of this.enemies) if (e.type === 'Bowser' && e.state === 'falling') for (let i = 0; i < Math.max(1, Math.round(this.fk)); i++) this.stepBowser(e, player);
                        this.axeTimer += dt;
                        if (this.axeTimer > 1500) {
                            this.axeTimer = 0;
                            const pfx = PlayerName[this.player] + (this.playerSize === Player_Size.Fire ? "_Fire" : (isBig ? "_Big" : ""));
                            this.engine.setAnimationForSprite(currentSpriteName, `${pfx}_Run`);
                            player.flipped = false;
                            this.axeVy = 0;
                            this.levelCompleteState = 'axe_walk';
                        }
                        break;
                    }
                    case 'axe_walk': {
                        // Camina a 1,5 px por cuadro hasta quedar al lado de Toad, con la cámara siguiéndolo y cayendo de la plataforma
                        const k = this.tileScale, steps = Math.max(1, Math.round(this.fk));
                        const npc = this.enemies.find(e => NPC_TYPES.has(e.type));
                        const stopX = npc ? npc.x + this.mapOffset.x - this.tileSize * 1.2 : playerPos.x + this.tileSize * 4;
                        const mw = this.currentMap.dimensions.width, tiles = this.currentMap.map;
                        for (let i = 0; i < steps && playerPos.x < stopX; i++) {
                            const dx = 1.5 * k;
                            const minOffset = this.engine.getCanvasWidth() - mw * this.tileSize;
                            if (playerPos.x > this.engine.getCanvasWidth() * 0.45 && this.mapOffset.x > minOffset) {
                                this.mapOffset.x = Math.max(minOffset, this.mapOffset.x - dx);
                            } else playerPos.x += dx;
                            // Gravedad simple hasta el primer tile sólido bajo los pies
                            const feet = playerPos.y + playerHeight;
                            const t = this.screenToTile(playerPos.x + this.tileSize / 2, feet + 1);
                            const solid = isSolidMetatile(tiles[this.engine.coordsToIndex(t, mw)]);
                            if (solid && this.axeVy >= 0) { this.axeVy = 0; playerPos.y = this.tileToScreen(t.x, t.y).y - playerHeight; }
                            else { this.axeVy = Math.min(this.axeVy + BASE_GRAVITY_NES * k, 4 * k); playerPos.y += this.axeVy; }
                        }
                        if (playerPos.x >= stopX) {
                            const pfx = PlayerName[this.player] + (this.playerSize === Player_Size.Fire ? "_Fire" : (isBig ? "_Big" : ""));
                            this.engine.setAnimationForSprite(currentSpriteName, `${pfx}_Idle`);
                            this.axeTimer = 0;
                            this.levelCompleteState = 'axe_message';
                        }
                        break;
                    }
                    case 'axe_message':
                        this.axeTimer += dt;
                        if (this.axeTimer > 4500) { this.levelCompleteState = 'time_bonus'; this.bonusTimer = 0; }
                        break;
                    case 'none':
                        this.stopAllMusic();
                        this.engine.playAudio(audio["Flagpole"], false);

                        // Premio según la altura (en píxeles del NES) a la que Mario tocó el mástil
                        const offsetY = this.currentMap.dimensions.height * this.tileSize - this.engine.getCanvasHeight();
                        const nesY = ((playerPos.y - this.mapOffset.y + offsetY) / this.tileSize) * 16;
                        let flagZone = 0;
                        for (let z = 4; z >= 1; z--) { if (nesY >= FLAGPOLE_Y_DATA[z]) { flagZone = z; break; } }
                        const points = FLAGPOLE_SCORES[flagZone];
                        this.levelTimeAtFlag = this.time;

				this.score += points;
				this.spawnScorePopup(points.toString(), playerPos.x + this.tileSize, playerPos.y);
				
				player.flipped = false;   // mira hacia el mástil
				
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
				playerPos.x += 1.5 * this.tileScale * this.fk;   // camina a 1,5 px por cuadro
				if (playerPos.x >= this.flagpoleInfo.castleDoorX) {
					this.playerIsVisible = false;
					this.levelCompleteState = 'time_bonus';
					this.bonusTimer = 0;
				}
				break;

			case 'time_bonus': {
				// 50 puntos por cada unidad de tiempo que sobra, una por cuadro del NES
				if (this.time > 0) {
					const n = Math.min(this.time, Math.max(1, Math.round(dt / (1000 / NES_FPS))));
					this.time -= n;
					this.score += 50 * n;
				} else {
					// Fuegos artificiales si la última cifra del tiempo con que se llegó es 1, 3 o 6
					const digit = this.levelTimeAtFlag % 10;
					this.fireworksLeft = (digit === 1 || digit === 3 || digit === 6) ? digit : 0;
					this.fireworksTotal = this.fireworksLeft;
					this.fireworkBursts = [];
					this.levelCompleteState = 'fireworks';
					this.bonusTimer = 0;
				}
				break;
			}

			case 'fireworks':
				this.bonusTimer += dt;
				if (this.fireworksLeft > 0 && this.bonusTimer > 400) {
					// Cada cohete explota en un lugar distinto sobre el castillo, en el orden de las tablas del original
					const i = (this.fireworksTotal - this.fireworksLeft) % FIREWORK_X.length;
					const ts = this.tileSize, k = this.tileScale;
					this.fireworkBursts.push({
						x: this.flagpoleInfo.castleDoorX + (FIREWORK_X[i] - 0x30) * k,
						y: ts * 1.0 + (FIREWORK_Y[i] - 0x28) / 0x48 * ts * 3.2,
						t: 0,
					});
					this.engine.playAudioOverlap(audio["Fireworks"]);
					this.fireworksLeft--;
					this.score += 500;
					this.bonusTimer = 0;
				} else if (this.fireworksLeft === 0 && this.bonusTimer > 800) {
					this.levelCompleteState = 'finished';
					this.rewardHidden1Up();
					const nextWorldName = this.nextWorldOverride || this.currentMap.nextWorld;
					this.nextWorldOverride = null;
					if (nextWorldName) {
						this.startNextLevel(nextWorldName);
					} else {
						this.currentWorldIndex = 0;
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

			this.engine.drawAnimatedSprite(currentSpriteName, this.frameDt, Pivot.Top_Left);
		}
		if (this.levelCompleteState === 'axe_message') this.drawAxeMessage();
		this.drawFireworks(dt);
	}

	// Explosiones de los fuegos artificiales: tres cuadros, al doble de tamaño
	drawFireworks(dt) {
		if (!this.fireworkBursts || !this.fireworkBursts.length) return;
		const sprite = this.engine.sprites['Object_Fireball'];
		for (const b of this.fireworkBursts) {
			b.t += dt;
			const frame = Math.floor(b.t / FIREWORK_FRAME_MS);
			if (frame > 2 || !sprite) continue;
			this.engine.drawSprite('Object_Fireball', frame, { x: b.x, y: b.y }, sprite.scale * 2, false, 0, Pivot.Center);
		}
		this.fireworkBursts = this.fireworkBursts.filter(b => b.t < FIREWORK_FRAME_MS * 3);
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

			this.engine.drawAnimatedSprite(PlayerName[this.player], this.frameDt, Pivot.Top_Left);
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
			dir: 1,
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
		if (isCoinMetatile(this.currentMap.map[idx])) {
			this.currentMap.map[idx] = 0;
			this.addCoin();
			this.engine.playAudioOverlap(audio["Coin"]);
			return true;
		}
		return false;
	};

	updatePowerups() {
		const k = this.tileScale, ts = this.tileSize, W = this.currentMap.dimensions.width, tiles = this.currentMap.map;

		for (let i = this.activePowerups.length - 1; i >= 0; i--) {
			const p = this.activePowerups[i];

			for (let step = 0; step < this.physicsSteps; step++) {
				if (p.state === "emerging") {
					// Sube un píxel del NES cada 4 cuadros
					p.y -= 0.25 * k;
					p.emergeCounter -= 0.25 * k;
					if (p.emergeCounter <= 0) p.state = "moving";
				} else if (p.type !== Powerup_Type.Fire_Flower) {
					// Hongos y estrella: caminan a 1 px por cuadro; la estrella además rebota
					const star = p.type === Powerup_Type.Invincible;
					p.y += p.vy;
					const groundTile = this.screenToTile(p.x + ts / 2 + this.mapOffset.x, p.y + ts);
					const onGround = isSolidMetatile(tiles[this.engine.coordsToIndex(groundTile, W)]);
					if (p.vy >= 0 && onGround) {
						p.y = this.tileToScreen(groundTile.x, groundTile.y).y - ts;
						p.vy = star ? ENEMY_JUMP_SPEED * k : 0;
					}
					p.vy = Math.min(p.vy + (star ? JUMPER_GRAVITY : ENEMY_GRAVITY) * k, ENEMY_MAX_FALL * k);

					p.x += p.dir * MUSHROOM_SPEED * k;
					const wallTile = this.screenToTile((p.dir > 0 ? p.x + ts : p.x) + this.mapOffset.x, p.y + ts / 2);
					if (isSolidMetatile(tiles[this.engine.coordsToIndex(wallTile, W)])) p.dir *= -1;
				}
			}

			const player = this.engine.animatedSprites[PlayerName[this.player]];
			const playerRect = this.playerHitbox(player);

			const screenX = p.x + this.mapOffset.x;
			const powerupRect = { x: screenX, y: p.y, w: this.tileSize, h: this.tileSize };

			// Colisión con el objeto
			if (p.state !== "emerging" && this.rectsOverlap(playerRect, powerupRect)) {
				switch (p.type) {
					// 1UP
					case Powerup_Type.Mushroom_1UP:
						this.giveLife();
						break;
					// Super
					case Powerup_Type.Mushroom_Super:
						this.score += 1000;
						this.spawnScorePopup('1000', screenX, p.y);
						if (this.playerSize === Player_Size.Small) {
							this.state = Game_State.Player_Growing;
							this.growTimer = 0;
							const currentTheme = this.getCurrentThemeAudio();
							if (currentTheme) {
								this.engine.pauseAudio(currentTheme);
							}
							this.engine.playAudio(audio["Player_Pipe"], false);
						} else {
							this.engine.playAudio(audio["Life"], false);
						}
						this.activePowerups.splice(i, 1);
						continue;
					// Fire
					case Powerup_Type.Fire_Flower:
						this.score += 1000;
						this.spawnScorePopup('1000', screenX, p.y);
						if (this.playerSize >= Player_Size.Big) {
							this.playerSize = Player_Size.Fire;
						} else {
							this.playerSize = Player_Size.Big;
						}
						this.syncPlayerSpritesOnPowerup();
						this.engine.playAudio(audio["Life"], false);
						break;
					// Estrella
					case Powerup_Type.Invincible:
						this.score += 1000;
						this.spawnScorePopup('1000', screenX, p.y);
						this.starTimer = STAR_INVINCIBLE_MS;
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
				case Powerup_Type.Invincible:
					this.engine.drawSprite('Object_Star', Math.floor(this.clockMs / 80) % 4, { x: screenX, y: p.y }, this.tileScale, false, 0, Pivot.Top_Left);
					continue;
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
		const scaleX = this.engine.getCanvasWidth() / rect.width;
		const scaleY = this.engine.getCanvasHeight() / rect.height;
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

	// Música del nivel. Con la estrella suena la de la invencibilidad. Con 100 de tiempo o menos suena primero el aviso
	// y después la versión apurada: en el exterior, una pista aparte; en los demás tipos de nivel, la misma melodía
	// más rápida.
	getCurrentThemeAudio() {
		if (!this.currentMap) return null;
		const playing = this.state === Game_State.Playing;
		const star = playing && this.starTimer > 0;
		const hurry = playing && this.time > 0 && this.time <= HURRY_TIME;
		const mode = star ? 'star' : hurry ? 'hurry' : 'normal';
		if (mode !== this.musicMode) {
			// Al cambiar de modo se corta la música; pasar a "apurado" dispara el aviso de tiempo
			const warn = mode === 'hurry' && this.musicMode === 'normal';
			this.musicMode = mode;
			this.stopAllMusic();
			for (const t of [audio["Overworld_Theme"], audio["Underground_Theme"], audio["Underwater_Theme"], audio["Castle_Theme"]]) if (t) t.playbackRate = 1;
			if (warn) { this.engine.playAudio(audio["Time_Warning"], false); this.musicResumeAt = this.clockMs + TIME_WARNING_MS; }
		}
		if (this.musicResumeAt && this.clockMs < this.musicResumeAt) return null;
		if (star) return audio["Star_Theme"];
		let theme = null;
		switch (this.currentMap.type) {
			case World_Type.Overworld: theme = hurry ? audio["Hurry_Theme"] : audio["Overworld_Theme"]; break;
			case World_Type.Underground: theme = audio["Underground_Theme"]; break;
			case World_Type.Underwater: theme = audio["Underwater_Theme"]; break;
			case World_Type.Castle: theme = audio["Castle_Theme"]; break;
		}
		if (theme && hurry && this.currentMap.type !== World_Type.Overworld) theme.playbackRate = HURRY_PLAYBACK_RATE;
		return theme;
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
            
            this.enemiesToMarkers();

            console.log("[GAME] Modo editor activado. Mapa restaurado.");

        } else if (this.state === Game_State.Editor) {
            this.isEditorMode = false;
            this.state = Game_State.Playing;
            
            this.pristineMapData = JSON.parse(JSON.stringify(this.currentMap.map));
            
            console.log("[GAME] Saliendo. Generando enemigos...");
            this.reloadEnemiesFromMap();
        }
    }

	// Al entrar al editor, los enemigos del nivel se vuelven marcadores en la grilla para poder moverlos.
	enemiesToMarkers() {
		const w = this.currentMap.dimensions.width;
		for (const e of this.currentMap.enemies || []) {
			const marker = ENEMY_MARKERS.find(m => m.type === e.type && (m.color ?? null) === (e.color ?? null));
			if (marker && e.x >= 0 && e.x < w && e.y >= 0 && e.y < this.currentMap.dimensions.height) {
				this.currentMap.map[e.y * w + e.x] = marker.id;
			}
		}
		this.currentMap.enemies = [];
		this.enemies = [];
	}

	// Al salir del editor, los marcadores vuelven a ser la lista de enemigos del nivel.
	reloadEnemiesFromMap() {
		const w = this.currentMap.dimensions.width;
		this.currentMap.enemies = [];
		for (let i = 0; i < this.currentMap.map.length; i++) {
			const marker = ENEMY_MARKERS.find(m => m.id === this.currentMap.map[i]);
			if (!marker) continue;
			const e = { type: marker.type, x: i % w, y: Math.floor(i / w) };
			if (marker.color) e.color = marker.color;
			this.currentMap.enemies.push(e);
			// Se borra el marcador para que no sea un obstáculo
			this.currentMap.map[i] = 0;
		}
		this.pristineMapData = JSON.parse(JSON.stringify(this.currentMap.map));
		this.createEnemies();
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
                const ghostSpriteName = this.spriteNameForCell(tileToPlace, -1);
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
            let spriteName = this.spriteNameForCell(blockId, -1) ?? "Unknown";
            
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