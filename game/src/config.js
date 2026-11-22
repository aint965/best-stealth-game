// Starlight Archive — shared tuning constants.
// One place for every number the game balances on, so a revision round
// changes a value here instead of hunting through the other files.
export const TILE = 32;
export const COLS = 25;
export const ROWS = 19;
export const VIEW_W = 800;
export const VIEW_H = 608;

export const PLAYER_RADIUS = 13;
export const GUARD_RADIUS = 14;
export const WALK_SPEED = 150;
export const SNEAK_SPEED = 85;
export const SPRINT_SPEED = 215;
export const PATROL_SPEED = 62;
export const INVESTIGATE_SPEED = 108;
export const CHASE_SPEED = 188;
export const NOISE_RADIUS = 240;
export const NOISE_PULSE_INTERVAL = 0.45;

export const CATCH_RADIUS = 26;
export const PICKUP_RADIUS = 30;
export const WIN_RADIUS = 30;

export const CONE_RANGE = 210;
export const CONE_HALF_ANGLE = 0.66; // ~38 degrees each side
export const SNEAK_RANGE_FACTOR = 0.65;
export const SHADOW_RANGE_FACTOR = 0.55;
export const LAMP_RANGE_FACTOR = 1.3; // standing in lamplight: seen from further away
export const LAMP_RADIUS = 95;

export const CAMERA_RANGE = 190;
export const CAMERA_HALF_ANGLE = 0.55;
export const CAMERA_RISE = 55;
export const CAMERA_DECAY = 30;

export const TRIPWIRE_ALARM = 55; // suspicion a tripped wire sets on nearby sentries

export const SCORE_CHART = 100;
export const GHOST_BONUS = 500;
export const TIME_BONUS_MAX = 300; // seconds counted for the time bonus
export const TIME_BONUS_RATE = 2;
export const MAX_STRIKES = 3;

export const SUSPICION_RISE_BASE = 34;
export const SUSPICION_RISE_CLOSE = 62;
export const SUSPICION_DECAY = 26;
export const INVESTIGATE_AT = 55;
export const CHASE_LOSE_TIME = 4;

export const LURE_RADIUS = 300;
export const LURE_COOLDOWN = 3;
