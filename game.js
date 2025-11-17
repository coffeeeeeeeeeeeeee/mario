let font;


// https://downloads.khinsider.com/game-soundtracks/album/super-mario-bros
// https://archive.org/details/super-mario-bros-ost-sfx
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
	"Brick_Break": js2d.loadAudio("assets/audios/break.mp3"),
};

function update(dt) {
	if (!smb) return;

	if (js2d.keysPressed['KeyE'] || js2d.keysPressed['E']) {
		js2d.keysPressed['KeyE'] = false; // Consumir la tecla
		js2d.keysPressed['E'] = false; // Consumir la tecla
		smb.toggleEditor();
	}

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
			smb.updateCoins();
			smb.updatePowerups();
			smb.drawBumpingBlocksOverlay();
			smb.drawEnemies(dt);
			smb.drawForegroundBlocks();
			smb.drawPlayer(PlayerName[smb.player], dt);
			smb.drawUI();
			break;

		case Game_State.Level_Complete:
			smb.drawBackground();
			smb.drawBlocks();
			smb.updateCoins();
			smb.updatePowerups();
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
            smb.updatePowerups();
			smb.updateCoins();
            smb.updateAndDrawScorePopups();
			smb.drawBackground();
            smb.drawPowerups();
            smb.updateAndDrawBrickParticles();
            smb.drawCoins();
			smb.drawBlocks();
			smb.drawBumpingBlocksOverlay();
			smb.drawEnemies(dt);
			smb.drawPlayer(PlayerName[smb.player], dt);
			smb.drawForegroundBlocks();
			smb.drawUI();
			break;

		case Game_State.Editor:
			smb.updateAndDrawEditor();
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

	await js2d.loadTileset("Overworld_Tiles", overworldTileset, 16, 16);
	await js2d.loadTileset("Underground_Tiles", undergroundTileset, 16, 16);

	await js2d.loadTileset("Player_Mario_Tiles", marioSmallTileset, 16, 16);
	await js2d.loadTileset("Player_Mario_Big_Tiles", marioBigTileset, 16, 32);
	await js2d.loadTileset("Player_Mario_Grow_Tiles", marioGrowTileset, 16, 16);
	await js2d.loadTileset("Player_Luigi_Grow_Tiles", luigiGrowTileset, 16, 16);
	await js2d.loadTileset("Player_Mario_Fire_Tiles", marioFireTileset, 16, 32);
	await js2d.loadTileset("Player_Luigi_Tiles", luigiSmallTileset, 16, 32);
	await js2d.loadTileset("Player_Luigi_Big_Tiles", luigiBigTileset, 16, 32);
	await js2d.loadTileset("Player_Luigi_Fire_Tiles", luigiFireTileset, 16, 32);
	await js2d.loadTileset("Enemy_Short_Tiles", enemiesShortTileset, 16, 16);
	await js2d.loadTileset("Enemy_Tall_Tiles", enemiesTallTileset, 16, 24);
	await js2d.loadTileset("UI_Tiles", uiImage, 8, 8);

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

	await js2d.loadSprite("UI_Title_Image", titleImage, tileScale);
    js2d.defineSpriteFromTileset("Player_Mario_Grow", "Player_Mario_Grow_Tiles", 0, 0, 3, tileScale);
    js2d.defineSpriteFromTileset("Player_Luigi_Grow", "Player_Luigi_Grow_Tiles", 0, 0, 3, tileScale);
    js2d.defineSpriteFromTileset("Player_Mario", "Player_Mario_Tiles", 0, 0, 15, tileScale);
    js2d.defineSpriteFromTileset("Player_Luigi", "Player_Luigi_Tiles", 0, 0, 15, tileScale);
    js2d.defineSpriteFromTileset("Player_Mario_Big", "Player_Mario_Big_Tiles", 0, 0, 15, tileScale);
    js2d.defineSpriteFromTileset("Player_Luigi_Big", "Player_Luigi_Big_Tiles", 0, 0, 15, tileScale); // Reutiliza el tileset
    js2d.defineSpriteFromTileset("Player_Mario_Fire", "Player_Mario_Fire_Tiles", 0, 0, 15, tileScale);
    js2d.defineSpriteFromTileset("Player_Luigi_Fire", "Player_Luigi_Fire_Tiles", 0, 0, 15, tileScale);
    
    js2d.defineSpriteFromTileset("UI_Coin", "UI_Tiles", 0, 0, 1, fontSize / tileScale / 2);
    js2d.defineSpriteFromTileset("Cursor", "UI_Tiles", 1, 0, 1, fontSize / tileScale / 2);

	js2d.createAnimatedSprite("Mario_Grow", "Player_Mario_Grow", playerPos, tileScale);
	js2d.createAnimatedSprite("Luigi_Grow", "Player_Luigi_Grow", playerPos, tileScale);
	js2d.createAnimatedSprite("Mario", "Player_Mario", playerPos, tileScale);
	js2d.createAnimatedSprite("Luigi", "Player_Mario", playerPos, tileScale);
	js2d.createAnimatedSprite("Mario_Big", "Player_Mario_Big", playerPos, tileScale);
	js2d.createAnimatedSprite("Luigi_Big", "Player_Luigi_Big", playerPos, tileScale);
	js2d.createAnimatedSprite("Mario_Fire", "Player_Mario_Fire", playerPos, tileScale);
	js2d.createAnimatedSprite("Luigi_Fire", "Player_Luigi_Fire", playerPos, tileScale);

	js2d.createAnimatedSprite("Goomba", "Enemy_Goomba", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Green", "Enemy_Koopa_Green", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Red", "Enemy_Koopa_Red", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Winged_Red", "Enemy_Koopa_Winged_Red", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Winged_Green", "Enemy_Koopa_Winged_Green", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Shell_Red", "Koopa_Shell_Red", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Shell_Green", "Koopa_Shell_Green", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Pakkun_Green", "Enemy_Pakkun_Green", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Pakkun_Red", "Enemy_Pakkun_Red", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Mushroom_Super", "Object_Mushroom_Super", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Fire_Flower", "Object_Fire_Flower", {x: 0, y: 0}, tileScale);

	// Animaciones
	// Small
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

	// Grow
	js2d.addAnimationToSprite("Mario_Grow", "Mario_Growing", [0, 1, 2], true, 16);
	js2d.addAnimationToSprite("Luigi_Grow", "Luigi_Growing", [0, 1, 2], true, 16);
	
	// Big
	js2d.addAnimationToSprite("Mario_Big", "Mario_Big_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Mario_Big", "Mario_Big_Run", [1, 2, 3], true, 16);
	js2d.addAnimationToSprite("Mario_Big", "Mario_Big_Stop", [4], true, 16);
	js2d.addAnimationToSprite("Mario_Big", "Mario_Big_Jump", [5], false, 16);
	js2d.addAnimationToSprite("Mario_Big", "Mario_Big_Crouch", [6], true, 16);
	js2d.addAnimationToSprite("Mario_Big", "Mario_Big_Slide", [7], false, 16);

	js2d.addAnimationToSprite("Luigi_Big", "Luigi_Big_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Luigi_Big", "Luigi_Big_Run", [1, 2, 3], true, 16);
	js2d.addAnimationToSprite("Luigi_Big", "Luigi_Big_Stop", [4], true, 16);
	js2d.addAnimationToSprite("Luigi_Big", "Luigi_Big_Jump", [5], false, 16);
	js2d.addAnimationToSprite("Luigi_Big", "Luigi_Big_Crouch", [6], true, 16);
	js2d.addAnimationToSprite("Luigi_Big", "Luigi_Big_Slide", [7], false, 16);

	// Fire
	js2d.addAnimationToSprite("Mario_Fire", "Mario_Fire_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Mario_Fire", "Mario_Fire_Run", [1, 2, 3], true, 16);
	js2d.addAnimationToSprite("Mario_Fire", "Mario_Fire_Stop", [4], true, 16);
	js2d.addAnimationToSprite("Mario_Fire", "Mario_Fire_Jump", [5], false, 16);
	js2d.addAnimationToSprite("Mario_Fire", "Mario_Fire_Crouch", [6], true, 16);
	js2d.addAnimationToSprite("Mario_Fire", "Mario_Fire_Slide", [8], false, 16);
	js2d.addAnimationToSprite("Mario_Fire", "Mario_Fire_Fall", [7, 8], false, 16);
	js2d.addAnimationToSprite("Mario_Fire", "Mario_Fire_Swimg", [9, 10, 11, 12, 13, 14], false, 16);

	js2d.addAnimationToSprite("Luigi_Fire", "Luigi_Fire_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Luigi_Fire", "Luigi_Fire_Run", [1, 2, 3], true, 16);
	js2d.addAnimationToSprite("Luigi_Fire", "Luigi_Fire_Stop", [4], true, 16);
	js2d.addAnimationToSprite("Luigi_Fire", "Luigi_Fire_Jump", [5], false, 16);
	js2d.addAnimationToSprite("Luigi_Fire", "Luigi_Fire_Crouch", [6], true, 16);
	js2d.addAnimationToSprite("Luigi_Fire", "Luigi_Fire_Slide", [7], false, 16);
	js2d.addAnimationToSprite("Luigi_Fire", "Luigi_Fire_Fall", [7, 8], false, 16);
	js2d.addAnimationToSprite("Luigi_Fire", "Luigi_Fire_Swimg", [9, 10, 11, 12, 13, 14], false, 16);

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

	js2d.setAnimationForSprite("Mario", "Mario_Idle");
	js2d.setAnimationForSprite("Luigi", "Luigi_Idle");
	js2d.setAnimationForSprite("Mario_Grow", "Mario_Growing");
	js2d.setAnimationForSprite("Luigi_Grow", "Luigi_Growing");
	js2d.setAnimationForSprite("Mario_Big", "Mario_Big_Idle");
	js2d.setAnimationForSprite("Luigi_Big", "Luigi_Big_Idle");
	js2d.setAnimationForSprite("Mario_Fire", "Mario_Fire_Idle");
	js2d.setAnimationForSprite("Luigi_Fire", "Luigi_Fire_Idle");
	js2d.setAnimationForSprite("Goomba", "Goomba_Walk");
	js2d.setAnimationForSprite("Koopa_Green", "Koopa_Walk");
	js2d.setAnimationForSprite("Koopa_Red", "Koopa_Walk");
	js2d.setAnimationForSprite("Koopa_Winged_Green", "Koopa_Winged_Walk");
	js2d.setAnimationForSprite("Koopa_Winged_Red", "Koopa_Winged_Walk");
	js2d.setAnimationForSprite("Pakkun_Red", "Pakkun_Bite");
	js2d.setAnimationForSprite("Pakkun_Green", "Pakkun_Bite");
	js2d.setAnimationForSprite("Koopa_Shell_Green", "Shell_Idle");
	js2d.setAnimationForSprite("Koopa_Shell_Red", "Shell_Idle");

	// Animaciones adicionales
	js2d.addAnimationToSprite("Koopa_Shell_Green", "Shell_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Koopa_Shell_Green", "Shell_Sliding", [0, 1], true, 16);
	js2d.addAnimationToSprite("Koopa_Shell_Red", "Shell_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Koopa_Shell_Red", "Shell_Sliding", [0, 1], true, 16);

	js2d.resizeCanvas();
	smb = new Game(js2d, fontSize);
	smb.loadMap("0-0");
}

init().then(() => {
	requestAnimationFrame(animate);
}).catch(error => {
	console.error("[SMB] No se pudo cargar el juego.", error);
});