let font;


// https://downloads.khinsider.com/game-soundtracks/album/super-mario-bros
const audio = {
	"Main_Theme": js2d.loadAudio("assets/audios/main_theme.mp3"),
	"Sub_Theme": js2d.loadAudio("assets/audios/sub_theme.mp3"),
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
			smb.drawPlayer(PlayerName[smb.player], dt);
			smb.drawForegroundBlocks();
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
			if (audio["Main_Theme"].paused && !audio["Main_Theme"].ended) {
				js2d.playAudio(audio["Main_Theme"], true);
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

	const spriteList = [
		["Player_Mario", "assets/images/mario.png", tileScale, 16, 16],
		["Player_Luigi", "assets/images/luigi.png", tileScale, 16, 16],
		["Enemy_Goomba", "assets/images/goomba.png", tileScale, 16, 16],
		["Enemy_Koopa", "assets/images/koopa.png", tileScale, 16, 24],
		["Enemy_Koopa_Winged_Red", "assets/images/koopa_winged_red.png", tileScale, 16, 24],
		["Enemy_Koopa_Winged_Green", "assets/images/koopa_winged_green.png", tileScale, 16, 24],
		["Koopa_Shell_Red", "assets/images/koopa_shell_red.png", tileScale, 16, 16],
		["Koopa_Shell_Green", "assets/images/koopa_shell_green.png", tileScale, 16, 16],
		["Enemy_Pakkun", "assets/images/pakkun.png", tileScale, 16, 24],
		["Object_Mushroom_Grow", "assets/images/mushroom_grow.png", tileScale],
		["Object_Mushroom_1UP", "assets/images/mushroom_life.png", tileScale],
		["UI_Title_Image", "assets/images/title.png", tileScale, 176, 88],
		["Block_Empty", "assets/images/empty.png", tileScale],
		["Block_Ground", "assets/images/ground.png", tileScale],
		["Block_Brick", "assets/images/brick.png", tileScale],
		["Object_Question", "assets/images/question_block.png", tileScale],
		["Object_Question_Used", "assets/images/block_used.png", tileScale],
		["Object_Coin", "assets/images/coin.png", tileScale, 16, 16],
		["UI_Coin", "assets/images/coin_score.png", fontSize / tileSize, 8, 8],
		["Cursor", "assets/images/cursor.png", fontSize / tileScale / 2, 8, 8],
		["Block_Stairs", "assets/images/stair_block.png", tileScale],
		["Block_Pipe_Top_Left", "assets/images/pipe_top_left.png", tileScale],
		["Block_Pipe_Top_Right", "assets/images/pipe_top_right.png", tileScale],
		["Block_Pipe_Body_Left", "assets/images/pipe_body_left.png", tileScale],
		["Block_Pipe_Body_Right", "assets/images/pipe_body_right.png", tileScale],
		["Block_Invisible", "assets/images/empty.png", tileScale],
		["Block_Flagpole", "assets/images/post.png", tileScale],
		["Block_Flagpole_Top", "assets/images/post_top.png", tileScale],
		["Block_Brick_Middle", "assets/images/brick_middle.png", tileScale],
		["Block_Brick_Zigzag", "assets/images/brick_zigzag.png", tileScale],
		["Block_Brick_Zigzag_Filled", "assets/images/brick_zigzag_filled.png", tileScale],
		["Block_Brick_Break", "assets/images/brick_break.png", tileScale],
		["Block_Brick_Cut", "assets/images/brick_cut.png", tileScale],
		["Block_Brick_Arch", "assets/images/brick_arch.png", tileScale],
		["Block_Black", "assets/images/black.png", tileScale],
		["Block_Cloud_Left", "assets/images/cloud_left_top.png", tileScale],
		["Block_Cloud_Middle", "assets/images/cloud_top.png", tileScale],
		["Block_Cloud_Right", "assets/images/cloud_right_top.png", tileScale],
		["Block_Cloud_Bottom_Left", "assets/images/cloud_left_bottom.png", tileScale],
		["Block_Cloud_Bottom", "assets/images/cloud_bottom.png", tileScale],
		["Block_Cloud_Bottom_Right", "assets/images/cloud_right_bottom.png", tileScale],
		["Block_Bush_Left", "assets/images/bush_left.png", tileScale],
		["Block_Bush_Middle", "assets/images/bush_middle.png", tileScale],
		["Block_Bush_Right", "assets/images/bush_right.png", tileScale],
		["Block_Multi_Coin", "assets/images/brick.png", tileScale],
		["Block_Used", "assets/images/block_used.png", tileScale],
		["Block_Life_Used", "assets/images/block_life_used.png", tileScale],
	];
	await js2d.loadSprites(spriteList);

	js2d.createAnimatedSprite("Mario", "Player_Mario", playerPos, tileScale);
	js2d.createAnimatedSprite("Luigi", "Player_Luigi", playerPos, tileScale);
	js2d.createAnimatedSprite("Goomba", "Enemy_Goomba", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa", "Enemy_Koopa", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Winged", "Enemy_Koopa_Winged_Red", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Winged", "Enemy_Koopa_Winged_Green", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Shell_Red", "Koopa_Shell_Red", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Koopa_Shell_Green", "Koopa_Shell_Green", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Pakkun", "Enemy_Pakkun", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Mushroom_Grow", "Object_Mushroom_Grow", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Mushroom_1UP", "Object_Mushroom_1UP", {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("Coin", "Object_Coin",  {x: 0, y: 0}, tileScale);
	js2d.createAnimatedSprite("UICoin", "UI_Coin",  {x: 0, y: 0}, fontSize / tileSize);
	js2d.createAnimatedSprite("Cursor", "Cursor",  {x: 0, y: 0}, fontSize / tileSize);

	js2d.addAnimationToSprite("Mario", "Mario_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Run", [1, 2, 3], true, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Stop", [4], true, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Jump", [5], false, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Fail", [6], true, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Slide", [14], false, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Fall", [7, 8], true, 16);
	js2d.addAnimationToSprite("Mario", "Mario_Swim", [9, 10, 11, 12, 13], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Run", [1, 2, 3], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Stop", [4], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Jump", [5], false, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Fail", [6], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Slide", [14], false, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Fall", [7, 8], true, 16);
	js2d.addAnimationToSprite("Luigi", "Luigi_Swim", [9, 10, 11, 12, 13], true, 16);
	js2d.addAnimationToSprite("Goomba", "Goomba_Walk", [0, 1], true, 16);
	js2d.addAnimationToSprite("Goomba", "Goomba_Stomped", [2], false, 16);
	js2d.addAnimationToSprite("Koopa", "Koopa_Walk", [0, 1], true, 16);
	js2d.addAnimationToSprite("Koopa", "Koopa_Stomped", [2], false, 16);
	js2d.addAnimationToSprite("Koopa_Winged", "Koopa_Winged_Walk", [0, 1], true, 16);
	js2d.addAnimationToSprite("Koopa", "Koopa_Shell_Red", [0, 1], false, 16);
	js2d.addAnimationToSprite("Koopa", "Koopa_Shell_Green", [0, 1], false, 16);
	js2d.addAnimationToSprite("Pakkun", "Pakkun_Bite", [0, 1], true, 16);
	js2d.addAnimationToSprite("Coin", "Coin_Shine", [0, 1, 2], true, 8);
	js2d.addAnimationToSprite("UICoin", "Coin_Score", [0, 1, 2], true, 8);

	js2d.setAnimationForSprite("Mario", "Mario_Idle");
	js2d.setAnimationForSprite("Luigi", "Luigi_Idle");
	js2d.setAnimationForSprite("Goomba", "Goomba_Walk");
	js2d.setAnimationForSprite("Koopa", "Koopa_Walk");
	js2d.setAnimationForSprite("Koopa_Winged", "Koopa_Winged_Walk");
	js2d.setAnimationForSprite("Pakkun", "Pakkun_Bite");
	js2d.setAnimationForSprite("Coin", "Coin_Shine");
	js2d.setAnimationForSprite("UICoin", "Coin_Score");

	js2d.addAnimationToSprite("Koopa_Shell_Green", "Shell_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Koopa_Shell_Green", "Shell_Sliding", [0, 1], true, 16);
	js2d.setAnimationForSprite("Koopa_Shell_Green", "Shell_Idle");

	js2d.addAnimationToSprite("Koopa_Shell_Red", "Shell_Idle", [0], true, 16);
	js2d.addAnimationToSprite("Koopa_Shell_Red", "Shell_Sliding", [0, 1], true, 16);
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