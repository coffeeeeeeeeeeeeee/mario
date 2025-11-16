let font;


// https://downloads.khinsider.com/game-soundtracks/album/super-mario-bros
const audio = {
	"Overworld_Theme": js2d.loadAudio("assets/audios/overworld_theme.mp3"),
	"Underground_Theme": js2d.loadAudio("assets/audios/underground_theme.mp3"),
	"Underwater_Theme": js2d.loadAudio("assets/audios/underwater_theme.mp3"),
	"Castle_Theme": js2d.loadAudio("assets/audios/castle_theme.mp3"),
	"Win_Theme": js2d.loadAudio("assets/audios/win_theme.mp3"),
	"Game_Over_Theme": js2d.loadAudio("assets/audios/game_over.mp3"),
	"Player_Bump": js2d.loadAudio("assets/audios/bump.mp3"),
	"Player_Skid": js2d.loadAudio("assets/audios/skid.mp3"),
	"Player_Stomp": js2d.loadAudio("assets/audios/stomp.mp3"),
	"Player_Jump": js2d.loadAudio("assets/audios/jump_small.mp3"),
	"Player_Jump_Turbo": js2d.loadAudio("assets/audios/jump_super.mp3"),
	"Player_Die": js2d.loadAudio("assets/audios/die.mp3"),
	"Player_Pipe": js2d.loadAudio("assets/audios/pipe.mp3"),
	"Coin": js2d.loadAudio("assets/audios/coin.mp3"),
	"Life": js2d.loadAudio("assets/audios/1_up.mp3"),
	"Pause": js2d.loadAudio("assets/audios/pause.mp3"),
	"Powerup_Appears": js2d.loadAudio("assets/audios/powerup_appears.mp3"),
	"Flagpole": js2d.loadAudio("assets/audios/flagpole.mp3"),
	"Level_Clear": js2d.loadAudio("assets/audios/level_clear.mp3"),
	"Shell": js2d.loadAudio("assets/audios/shell.mp3"),
};

function update(dt) {
	if (!smb) return;

	switch(smb.state) {
		case Game_State.Title_Menu:
			smb.drawMenu();
			break;

		case Game_State.Black_Screen:
			smb.drawBlackScreen();
			smb.screenTimer += dt;
			if (smb.screenTimer > smb.screenDuration) {
				smb.handleBlackScreenEnd();
			}
			break;

		case Game_State.Player_Dying:
			smb.drawBackground();
			smb.drawBlocks();
			smb.updateAndDrawCoins();
			smb.updateAndDrawPowerups();
			smb.drawBumpingBlocksOverlay();
			smb.drawEnemies(dt);
			smb.drawForegroundBlocks();
			smb.drawPlayer(PlayerName[smb.player], dt);
			smb.drawUI();
			break;

		case Game_State.Level_Complete:
			smb.drawBackground();
			smb.drawBlocks();
			smb.updateAndDrawCoins();
			smb.updateAndDrawPowerups();
			smb.drawBumpingBlocksOverlay();
			smb.drawEnemies(dt);
			smb.updateAndDrawLevelComplete(dt);
			smb.drawForegroundBlocks();
			smb.updateAndDrawScorePopups();
			smb.drawUI();
			break;

		case Game_State.Playing:
			smb.time -= dt / 1000;

			if (smb.currentMap) {
				switch (smb.currentMap.type) {
					case World_Type.Overworld:
						if (audio["Overworld_Theme"].paused && !audio["Overworld_Theme"].ended) {
							js2d.playAudio(audio["Overworld_Theme"], true);
						}
						break;
					case World_Type.Underground:
						if (audio["Underground_Theme"].paused && !audio["Underground_Theme"].ended) {
							js2d.setVolume(audio["Player_Jump"], 0.5);
							js2d.playAudio(audio["Underground_Theme"], true);
						}
						break;
					case World_Type.Underwater:
						if (audio["Underwater_Theme"].paused && !audio["Underwater_Theme"].ended) {
							js2d.playAudio(audio["Underwater_Theme"], true);
						}
						break;
					case World_Type.Castle:
						if (audio["Castle_Theme"].paused && !audio["Castle_Theme"].ended) {
							js2d.playAudio(audio["Castle_Theme"], true);
						}
						break;
				}
			}

			smb.updateEnemies(dt);
			smb.drawBackground();
			smb.drawBlocks();
			smb.updateAndDrawCoins();
			smb.updateAndDrawPowerups();
			smb.drawBumpingBlocksOverlay();
			smb.drawEnemies(dt);
			smb.drawPlayer(PlayerName[smb.player], dt);
			smb.drawForegroundBlocks();
			smb.updateAndDrawScorePopups();
			smb.drawUI();
			break;
	}
}

function animate(timestamp) {
	if (!js2d.last_timestamp) { js2d.last_timestamp = timestamp; }
	let dt = timestamp - js2d.last_timestamp;
	js2d.last_timestamp = timestamp;
	
	update(dt);
	requestAnimationFrame(animate);
}

async function init() {
	const fontSize = 20;
	font = await js2d.loadFont("SMB2_Font", "assets/fonts/Super-Mario-Bros-NES.ttf");
	
	const tileSize = 16;
	const tileScale = 4;
	const playerPos = {x: 300, y: 300};

	await js2d.loadTileset("World_Tiles", overworldTileset, 16, 16);
	await js2d.loadTileset("Player_Mario_Tiles", marioSmallTileset, 16, 16);
	await js2d.loadTileset("Enemy_Short_Tiles", enemiesShortTileset, 16, 16);
	await js2d.loadTileset("Enemy_Tall_Tiles", enemiesTallTileset, 16, 24);
	await js2d.loadTileset("UI_Tiles", uiImage, 8, 8);

	// Bloques Comunes
	js2d.defineSpriteFromTileset("Block_Black", "World_Tiles", 0, 0, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Ground", "World_Tiles", 1, 0, 1, tileScale);
    js2d.defineSpriteFromTileset("Block_Stairs", "World_Tiles", 2, 0, 1, tileScale);
    js2d.defineSpriteFromTileset("Block_Brick", "World_Tiles", 3, 0, 1, tileScale);
    js2d.defineSpriteFromTileset("Block_Brick_Middle", "World_Tiles", 4, 0, 1, tileScale);
    js2d.defineSpriteFromTileset("Block_Brick_Zigzag", "World_Tiles", 5, 0, 1, tileScale);
    js2d.defineSpriteFromTileset("Block_Brick_Zigzag_Filled", "World_Tiles", 6, 0, 1, tileScale);
    js2d.defineSpriteFromTileset("Block_Brick_Arch", "World_Tiles", 7, 0, 1, tileScale);
    js2d.defineSpriteFromTileset("Block_Brick_Break", "World_Tiles", 8, 0, 1, tileScale);
    js2d.defineSpriteFromTileset("Block_Brick_Cut", "World_Tiles", 9, 0, 1, tileScale);

	// Objetos Interactivos
    js2d.defineSpriteFromTileset("Object_Question",				"World_Tiles", 0, 1, 3, tileScale);
	js2d.defineSpriteFromTileset("Object_Question_Multiple",	"World_Tiles", 0, 1, 3, tileScale);
	js2d.defineSpriteFromTileset("Object_Question_Used",		"World_Tiles", 1, 1, 1, tileScale);
	js2d.defineSpriteFromTileset("Object_Twentyfive",			"World_Tiles", 2, 1, 3, tileScale);
	js2d.defineSpriteFromTileset("Object_Coin",					"World_Tiles", 7, 1, 3, tileScale);

    js2d.defineSpriteFromTileset("Block_Used",		"World_Tiles", 3, 1, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Invisible",	"World_Tiles", 15, 15, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Empty",		"World_Tiles", 15, 15, 1, tileScale);

	// Enemigos bajos
    js2d.defineSpriteFromTileset("Enemy_Goomba", "Enemy_Short_Tiles", 0, 0, 3, tileScale);
    js2d.defineSpriteFromTileset("Koopa_Shell_Green", "Enemy_Short_Tiles", 3, 0, 2, tileScale);
    js2d.defineSpriteFromTileset("Koopa_Shell_Red", "Enemy_Short_Tiles", 4, 5, 2, tileScale);

    // Enemigos altos
    js2d.defineSpriteFromTileset("Enemy_Koopa_Green", "Enemy_Tall_Tiles", 0, 0, 2, tileScale);
    js2d.defineSpriteFromTileset("Enemy_Koopa_Red", "Enemy_Tall_Tiles", 2, 0, 2, tileScale);
    js2d.defineSpriteFromTileset("Enemy_Koopa_Winged_Green", "Enemy_Tall_Tiles", 4, 0, 2, tileScale);
    js2d.defineSpriteFromTileset("Enemy_Koopa_Winged_Red", "Enemy_Tall_Tiles", 6, 0, 2, tileScale);
	js2d.defineSpriteFromTileset("Enemy_Pakkun_Green", "Enemy_Tall_Tiles", 8, 0, 2, tileScale);
	js2d.defineSpriteFromTileset("Enemy_Pakkun_Red", "Enemy_Tall_Tiles", 10, 0, 2, tileScale);

	// Tuberías
	js2d.defineSpriteFromTileset("Block_Pipe_Top_Left", "World_Tiles", 0, 2, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Pipe_Top_Right", "World_Tiles", 1, 2, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Pipe_Body_Left", "World_Tiles", 2, 2, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Pipe_Body_Right", "World_Tiles", 3, 2, 1, tileScale);
	
	// Nivel Subterráneo (VER: crear otro tileset y cambiar según 'type' en el mapa)
	js2d.defineSpriteFromTileset("Block_Ground_Underground", "World_Tiles", 4, 0, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Brick_Underground", "World_Tiles", 5, 0, 1, tileScale);
	js2d.defineSpriteFromTileset("Object_Question_Underground", "World_Tiles", 4, 1, 3, tileScale);
	js2d.defineSpriteFromTileset("Object_Question_Used_Underground", "World_Tiles", 2, 0, 1, tileScale);
	js2d.defineSpriteFromTileset("Object_Coin_Underground", "World_Tiles", 0, 10, 3, tileScale);
	
	// Nubes
	js2d.defineSpriteFromTileset("Block_Cloud_Top_Left", "World_Tiles", 0, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Cloud_Top_Middle", "World_Tiles", 1, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Cloud_Top_Right", "World_Tiles", 2, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Left", "World_Tiles", 3, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Middle", "World_Tiles", 4, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Cloud_Bottom_Right", "World_Tiles", 5, 4, 1, tileScale);

	// Arbustos
	js2d.defineSpriteFromTileset("Block_Bush_Left", "World_Tiles", 12, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Bush_Middle", "World_Tiles", 13, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Bush_Right", "World_Tiles", 14, 4, 1, tileScale);
	
	// Colinas
	js2d.defineSpriteFromTileset("Block_Hill_Left", "World_Tiles", 6, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Hill_Middle_Hole_1", "World_Tiles", 7, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Hill_Middle", "World_Tiles", 8, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Hill_Middle_Hole_2", "World_Tiles", 9, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Hill_Right", "World_Tiles", 10, 4, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Hill_Top", "World_Tiles", 11, 4, 1, tileScale);

	// Bandera
	js2d.defineSpriteFromTileset("Block_Flagpole_Top", "World_Tiles", 0, 3, 1, tileScale);
	js2d.defineSpriteFromTileset("Block_Flagpole", "World_Tiles", 1, 3, 1, tileScale);
	js2d.defineSpriteFromTileset("Object_Flag", "World_Tiles", 2, 3, 1, tileScale);

	await js2d.loadSprite("UI_Title_Image", titleImage, tileScale);
    js2d.defineSpriteFromTileset("Player_Mario", "Player_Mario_Tiles", 0, 0, 15, tileScale);
    
    js2d.defineSpriteFromTileset("UI_Coin", "UI_Tiles", 0, 0, 1, fontSize / tileScale / 2);
    js2d.defineSpriteFromTileset("Cursor", "UI_Tiles", 1, 0, 1, fontSize / tileScale / 2);
    js2d.defineSpriteFromTileset("Object_Mushroom_Grow", "World_Tiles", 0, 6, 1, tileScale);
	js2d.defineSpriteFromTileset("Object_Mushroom_1UP", "World_Tiles", 1, 6, 1, tileScale);

	js2d.createAnimatedSprite("Mario", "Player_Mario", playerPos, tileScale);
	js2d.createAnimatedSprite("Luigi", "Player_Mario", playerPos, tileScale); // Usa el mismo tileset de Mario para Luigi por ahora

	js2d.createAnimatedSprite("Goomba", "Enemy_Goomba", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Green", "Enemy_Koopa_Green", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Red", "Enemy_Koopa_Red", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Winged_Red", "Enemy_Koopa_Winged_Red", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Winged_Green", "Enemy_Koopa_Winged_Green", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Shell_Red", "Koopa_Shell_Red", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Shell_Green", "Koopa_Shell_Green", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Pakkun_Green", "Enemy_Pakkun_Green", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Pakkun_Red", "Enemy_Pakkun_Red", {x: 0, y: 0}, tileScale);

	js2d.createAnimatedSprite("Mushroom_Grow", "Object_Mushroom_Grow", {x: 0, y: 0}, tileScale); // CORREGIDO
	js2d.createAnimatedSprite("Mushroom_1UP", "Object_Mushroom_1UP", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Coin", "Object_Coin",  {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("UICoin", "UI_Coin",  {x: 0, y: 0}, fontSize / tileSize);
	js2d.createAnimatedSprite("Cursor", "Cursor",  {x: 0, y: 0}, fontSize / tileSize);

	// Animaciones
	js2d.addAnimationToSprite("Mario", "Mario_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Run", [1, 2, 3], true, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Stop", [4], true, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Jump", [5], false, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Fail", [6], true, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Slide", [7], false, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Fall", [7, 8], true, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Swim", [9, 10, 11, 12, 13], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Run", [1, 2, 3], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Stop", [4], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Jump", [5], false, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Fail", [6], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Slide", [7], false, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Fall", [7, 8], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Swim", [9, 10, 11, 12, 13], true, 16);
	js2d.addAnimationToSprite("Goomba", "Goomba_Walk", [0, 1], true, 16);
	js2d.addAnimationToSprite("Goomba", "Goomba_Stomped", [2], false, 16);
	js2d.addAnimationToSprite("Koopa_Green", "Koopa_Walk", [0, 1], true, 16);
	js2d.addAnimationToSprite("Koopa_Red", "Koopa_Walk", [0, 1], true, 16);
	js2d.addAnimationToSprite("Koopa_Green", "Koopa_Stomped", [2], false, 16);
	js2d.addAnimationToSprite("Koopa_Red", "Koopa_Stomped", [2], false, 16);
	js2d.addAnimationToSprite("Koopa_Winged_Red", "Koopa_Winged_Walk", [0, 1], true, 16);
	js2d.addAnimationToSprite("Koopa_Winged_Green", "Koopa_Winged_Walk", [0, 1], true, 16);
	js2d.addAnimationToSprite("Koopa_Shell_Red", "Shell_Sliding", [0, 1], false, 16);
	js2d.addAnimationToSprite("Koopa_Shell_Green", "Shell_Sliding", [0, 1], false, 16);
	js2d.addAnimationToSprite("Pakkun_Green", "Pakkun_Bite", [0, 1], true, 16);
	js2d.addAnimationToSprite("Pakkun_Red", "Pakkun_Bite", [0, 1], true, 16);
	js2d.addAnimationToSprite("Coin", "Coin_Shine", [0, 1, 2], true, 8);
	js2d.addAnimationToSprite("UICoin", "Coin_Score", [0, 1, 2], true, 8);

	js2d.setAnimationForSprite("Mario", "Mario_Idle");
	js2d.setAnimationForSprite("Luigi", "Luigi_Idle");
	js2d.setAnimationForSprite("Goomba", "Goomba_Walk");
	js2d.setAnimationForSprite("Koopa_Green", "Koopa_Walk");
	js2d.setAnimationForSprite("Koopa_Red", "Koopa_Walk");
	js2d.setAnimationForSprite("Koopa_Winged_Green", "Koopa_Winged_Walk");
	js2d.setAnimationForSprite("Koopa_Winged_Red", "Koopa_Winged_Walk");
	js2d.setAnimationForSprite("Pakkun_Red", "Pakkun_Bite");
	js2d.setAnimationForSprite("Pakkun_Green", "Pakkun_Bite");
	js2d.setAnimationForSprite("Coin", "Coin_Shine");
	js2d.setAnimationForSprite("UICoin", "Coin_Score");

	// Animaciones adicionales
	js2d.addAnimationToSprite("Koopa_Shell_Green", "Shell_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Koopa_Shell_Green", "Shell_Sliding", [0, 1], true, 16);
	js2d.addAnimationToSprite("Koopa_Shell_Red", "Shell_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Koopa_Shell_Red", "Shell_Sliding", [0, 1], true, 16);

	// Animaciones por defecto
	js2d.setAnimationForSprite("Koopa_Shell_Green", "Shell_Idle");
	js2d.setAnimationForSprite("Koopa_Shell_Red", "Shell_Idle");

	js2d.resizeCanvas();
	smb = new Game(js2d, fontSize);
	smb.loadMap("0-0");
}

init().then(() => {
	requestAnimationFrame(animate);
}).catch(error => {
	console.error("[SMB] No se pudo cargar el juego.", error);
});