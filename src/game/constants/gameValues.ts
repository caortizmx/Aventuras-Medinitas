// ─── Player ───────────────────────────────────────────────────────────────────
export const PLAYER_WIDTH  = 32;
export const PLAYER_HEIGHT = 48;
export const PLAYER_SPRITE_SCALE = 2;
export const PLAYER_RUN_ANIMATION_THRESHOLD = 1;
export const PLAYER_SPEED  = 220;   // px/s horizontal
export const JUMP_FORCE    = -480;  // px/s vertical (negative = up)
export const PLAYER_COLOR  = 0xe74c3c;
export const HURT_RECOVERY_DELAY_MS = 350;
export const CELEBRATION_EXIT_DELAY_MS = 2500;
export const PLAYER_INITIAL_LIVES = 3;
export const PLAYER_INVULNERABILITY_MS = 1200;
export const PLAYER_KNOCKBACK_X = 230;
export const PLAYER_KNOCKBACK_Y = -260;

// ─── Physics ──────────────────────────────────────────────────────────────────
export const GRAVITY = 800; // px/s²

// ─── World / Camera / Level ───────────────────────────────────────────────────
export const GAME_WIDTH   = 800;
export const GAME_HEIGHT  = 450;
export const WORLD_WIDTH  = 3200;
export const WORLD_HEIGHT = 450;

// ─── Ground ───────────────────────────────────────────────────────────────────
export const GROUND_WIDTH  = 600;
export const GROUND_HEIGHT = 40;
export const GROUND_COLOR  = 0x7d5a3c;
/** Center Y of the ground strip. */
export const GROUND_Y = WORLD_HEIGHT - GROUND_HEIGHT / 2;

// ─── Platforms [centerX, centerY, width] ──────────────────────────────────────
export const PLATFORM_HEIGHT = 20;
export const PLATFORM_COLOR  = 0x27ae60;

export const PLATFORMS: ReadonlyArray<[number, number, number]> = [
    [  750, 350, 160 ],
    [ 1000, 290, 140 ],
    [ 1240, 230, 130 ],
    [ 1460, 290, 150 ],
    [ 1720, 340, 160 ],
    [ 1960, 270, 140 ],
    [ 2200, 310, 150 ],
    [ 2450, 250, 140 ],
    [ 2700, 330, 160 ],
    [ 2960, 285, 130 ],
];

// ─── Spawn ────────────────────────────────────────────────────────────────────
export const SPAWN_X = 120;
/** Player center Y just above the ground surface. */
export const SPAWN_Y = WORLD_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT / 2;

// ─── Kill zone ────────────────────────────────────────────────────────────────
/** Respawn when player center falls below this Y. */
export const KILL_ZONE_Y = WORLD_HEIGHT + 60;

// ─── Goal ─────────────────────────────────────────────────────────────────────
export const GOAL_WIDTH  = 70;
export const GOAL_HEIGHT = 100;
export const GOAL_X      = 3080;
export const GOAL_Y      = WORLD_HEIGHT - GROUND_HEIGHT - GOAL_HEIGHT / 2;
export const GOAL_COLOR  = 0xf1c40f;

// ─── Camera ───────────────────────────────────────────────────────────────────
export const CAMERA_LERP_X = 0.1;
/** 0 = no vertical follow (horizontal-only camera). */
export const CAMERA_LERP_Y = 0;
