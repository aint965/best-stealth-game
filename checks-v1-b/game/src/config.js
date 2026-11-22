// Quiet Vault: tuning constants. One place for every number the game
// balances on, so a revision round changes behaviour here, not in logic.
export const TILE = 32;
export const COLS = 25;
export const ROWS = 19;
export const VIEW_W = COLS * TILE; // 800
export const VIEW_H = ROWS * TILE; // 608

// Player: a courier in a hurry, quieter when sneaking.
export const PLAYER_RADIUS = 11;
export const PLAYER_WALK_SPEED = 150; // px per second
export const PLAYER_SNEAK_SPEED = 78;
export const PICKUP_RANGE = 28;
export const EXIT_RANGE = 22;

// Guards: wardens on patrol. A cone is a range and a half-angle.
export const GUARD_RADIUS = 12;
export const GUARD_PATROL_SPEED = 55;
export const GUARD_CHASE_SPEED = 96;
export const GUARD_VISION_RANGE = 178;
export const GUARD_VISION_HALF_ANGLE = 0.62; // radians, ~35 degrees
export const GUARD_CAUGHT_RANGE = 18;

// Suspicion 0..100. Seen: rises; hidden: decays. 100 is the alarm.
export const SUSPICION_RISE = 9; // per second at point blank, scaled by closeness
export const SUSPICION_DECAY = 0.55;
export const SUSPICION_INVESTIGATE_AT = 60;
export const SNEAK_DETECTION = 0.5; // sneaking halves how fast suspicion rises
export const SHADOW_DETECTION = 0.5; // hiding in shadow halves it too
export const CHASE_LOSE_TIME = 2.5; // seconds without sight before the chase gives up
export const SEARCH_TIME = 3.0; // seconds a guard looks around the last-seen spot
export const INVESTIGATE_TIME = 2.0;
export const LURE_RANGE = 230; // guards nearer than this hear a thrown lure
export const LURES_PER_LEVEL = 3;
export const LURE_LIFE = 4.0; // seconds a thrown lure sits on the floor

export const OBJECTIVES_PER_LEVEL = 3;

export const PALETTE = {
  backdrop: '#0b0e13',
  floorA: '#20262e',
  floorB: '#1b2027',
  shadow: '#16241c',
  wall: '#3a4350',
  wallTop: '#4d5866',
  crate: '#6b4f2a',
  crateEdge: '#8a6a3c',
  exit: '#2e7d5b',
  exitOpen: '#f2c94c',
  objective: '#f2c94c',
  player: '#4fc3a5',
  guard: '#d95f4b',
  guardEye: '#ffffff',
  coneCalm: 'rgba(242, 201, 76, 0.20)',
  coneSuspicious: 'rgba(242, 140, 60, 0.35)',
  coneAlarm: 'rgba(217, 95, 75, 0.42)',
  lure: '#e8e8e8',
  text: '#eef1f5',
  muted: '#9aa3b0',
  panel: '#1c222b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
