// Solmar Bay — central tuning and world constants.
// Every number the game balances on lives here so the rest of the code
// reads like the design, not like magic numbers.

export const WORLD = {
  blocks: 8, // city blocks per side
  block: 44, // metres per block (building plot + road)
  road: 14, // metres of road between blocks
  coast: 60, // metres of beach + water south of the city
  bound: 420, // playable half-extent; the city + beach fit inside
};

export const CITY = {
  // Palette: sun-soaked coastal city — warm plaster, glass blue, terracotta.
  buildingColors: [0xd9c9a8, 0xc9b18c, 0x9fb8c8, 0xe8dcc8, 0xb8a88f, 0x7fa3b8, 0xd8b48f, 0xa8c0b0],
  roofColors: [0x8a7a5e, 0x6e7f80, 0x9c8a70, 0x5e6e7a],
  roadColor: 0x3a3f46,
  sidewalkColor: 0x9a938a,
  sandColor: 0xe0c98f,
  seaColor: 0x2e7f9e,
  grassColor: 0x7fae6a,
  skyColor: 0x9fd4e8,
  fogColor: 0xa8cfe0,
  sunColor: 0xfff2d8,
};

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10,
  radius: 0.7,
  maxHealth: 100,
  punchDamage: 12,
  pistolDamage: 34,
  pistolCooldown: 0.28,
  punchCooldown: 0.45,
  punchRange: 2.2,
  shootRange: 60,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 34,
  maxReverse: 9,
  steerRate: 1.9,
  grip: 6.5,
  colors: [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x222831, 0xd97b2e, 0x7a4fb5],
};

export const TRAFFIC = {
  count: 14,
  speed: 9,
  despawnDistance: 260,
  spawnDistance: 150,
};

export const PEDESTRIANS = {
  count: 22,
  walkSpeed: 1.6,
  fleeSpeed: 4.5,
};

export const WANTED = {
  maxStars: 5,
  decayQuietSeconds: 25, // no crime for this long, then stars start falling
  decayStepSeconds: 5, // one star per this many quiet seconds after that
  policePerStar: [0, 1, 2, 3, 4, 4],
  policeSpeed: 26,
  bustDistance: 4.5,
  bustSeconds: 2.0,
  bustFine: 200,
  wastedFine: 100,
};

export const MISSIONS = [
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    payout: 500,
    intro: 'Lena: "A cherry-red Veloce is parked by the marina. Bring it to my garage — no scratches, no cops."',
    steps: [
      { kind: 'goto', text: 'Steal the red Veloce at the marina', at: 'marina' },
      { kind: 'deliver', text: 'Deliver the Veloce to Lena\u2019s garage', at: 'garage' },
    ],
  },
  {
    id: 'the-package',
    name: 'The Package',
    payout: 1200,
    intro: 'Lena: "A package is waiting at the docks. Pick it up and run it north — do not open it."',
    steps: [
      { kind: 'goto', text: 'Pick up the package at the docks', at: 'docks' },
      { kind: 'deliver', text: 'Deliver the package to the north drop', at: 'northDrop' },
    ],
  },
  {
    id: 'vault-run',
    name: 'Vault Run',
    payout: 5000,
    intro: 'Lena: "One last job. Crack the vault at Solmar National, then lose the heat and get to the safehouse."',
    steps: [
      { kind: 'goto', text: 'Reach the Solmar National Bank', at: 'bank' },
      { kind: 'hold', text: 'Crack the vault — stay inside the marker', at: 'bank', holdSeconds: 6 },
      { kind: 'deliver', text: 'Escape to the safehouse', at: 'safehouse' },
    ],
  },
];

// Named places on the map, in world metres (x east, z south; y is up).
// The city grid is centred on (0,0); the beach and sea are to the south (+z).
// Every place sits ON an avenue (a road line at x or z in ROAD_LINES), never
// inside a building block, so cars and police can always reach it.
export const PLACES = {
  spawn: { x: 29, z: 120 },
  marina: { x: -139, z: 152 },
  garage: { x: 145, z: -40 },
  docks: { x: 148, z: 150 },
  northDrop: { x: -90, z: -160 },
  bank: { x: 20, z: -90 },
  safehouse: { x: -145, z: -20 },
};

export const SAVE_KEY = 'solmar-bay-save-v1';
