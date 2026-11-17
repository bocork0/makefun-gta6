// Solmar Bay — configuration: city layout, tuning, missions, save key.
// All names, places and people here are original inventions for this game.
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmarbay-save-v1';

// City grid: streets run at these coordinates (metres); blocks sit between them.
export const STREETS = [-140, -100, -60, -20, 20, 60, 100, 140];
export const CITY_HALF = 168; // drivable/pedestrian extent
export const STREET_HALF = 6; // half-width of a street
export const LANE = 3; // lane offset from a street centre line

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 7.2,
  radius: 0.55,
  hp: 100,
  punchDamage: 34,
  punchRange: 2.4,
  punchCooldown: 0.45,
  shootCooldown: 0.28,
  gunDamage: 25,
  gunRange: 90,
};

export const CAR = {
  accel: 13,
  brake: 26,
  maxSpeed: 30,
  reverseMax: 9,
  turnRate: 2.1,
  trafficSpeed: 9,
  policeSpeed: 33,
};

export const WANTED = {
  max: 5,
  decaySeconds: 25, // no crime for this long drops one star
  copSpawnAt: 2, // on-foot cops appear from 2 stars
  bustSeconds: 3, // a cop touching you on foot this long = busted
};

// Named places on the map (all at street intersections, so cars can reach them).
export const PLACES = {
  plaza: { x: 0, z: 0, name: 'Marina Plaza' },
  garage: { x: -140, z: -100, name: "Venn's Garage" },
  docks: { x: 140, z: 140, name: 'Solmar Docks' },
  gull: { x: -100, z: 140, name: 'The Gull Bar' },
  bank: { x: 100, z: -100, name: 'Solmar Bank' },
  safehouse: { x: 140, z: 100, name: 'Safehouse' },
  hospital: { x: 20, z: -20, name: 'Solmar General' },
};

// The three chained story missions. stages: 'go' (reach marker), 'grab' (hold E),
// 'deliver' (reach marker in a car / on foot as noted).
export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Mission 1 — Hot Wheels',
    story:
      "Lena Cross needs wheels for a job tonight. Steal any car on the street and bring it to Venn's Garage.",
    stages: [{ kind: 'deliverCar', place: 'garage', text: "Steal a car, then drive it to Venn's Garage" }],
    reward: 500,
  },
  {
    id: 'the-package',
    title: 'Mission 2 — The Package',
    story:
      'A crate landed at the Solmar Docks with no name on it. Lena wants it at The Gull Bar before sundown. It is hot — expect company.',
    stages: [
      { kind: 'go', place: 'docks', text: 'Get to the Solmar Docks' },
      { kind: 'grab', place: 'docks', text: 'On foot: walk into the marker to pick up the package' },
      { kind: 'deliver', place: 'gull', text: 'Deliver the package to The Gull Bar' },
    ],
    reward: 1200,
  },
  {
    id: 'the-vault-run',
    title: 'Mission 3 — The Vault Run',
    story:
      'The big one. Solmar Bank keeps a cash cart by the vault door every morning. Grab it, and run — every cop in the bay will be on you.',
    stages: [
      { kind: 'go', place: 'bank', text: 'Get to Solmar Bank' },
      { kind: 'grab', place: 'bank', text: 'On foot: hold E at the vault to grab the cash' },
      { kind: 'deliver', place: 'safehouse', text: 'Escape to the Safehouse — lose the cops!' },
    ],
    reward: 5000,
  },
];
