// Species tables. Shape identity lives here; seeds only vary within a species.
export const SPECIES = {
  oak: {
    leaf: 'oak', bark: 'oak', leafColor: 0x67b04c, barkColor: 0xc2a58a, moss: true,
    tints: [0xffffff, 0xe6f0c8, 0xd2e8d8],
    trunkLen: 2.7, leader: 0, trunkR: 0.36, trunkSegs: 5, trunkGnarl: 0.1, flare: 0.65,
    limbs: [4, 6], limbStart: 0.72, limbSpread: 0.35, limbAngle: [0.6, 1.15], limbLen: 4.4, limbTaper: 0.2,
    gnarl: 0.22, upward: 0.1, subs: [2, 3], clusterR: 1.9, cards: 85, cardSize: 1.45, squash: 0.75, midCluster: true,
    leafTex: { count: 70, leafLen: 0.24 },
  },
  maple: {
    leaf: 'maple', bark: 'maple', leafColor: 0xffffff, barkColor: 0xb8a493,
    tints: [0xf06a2e, 0xf59a38, 0xd9452a, 0xf2b443],
    trunkLen: 2.3, leader: 2.6, trunkR: 0.25, trunkSegs: 6, trunkGnarl: 0.07, flare: 0.45,
    limbs: [6, 8], limbStart: 0.5, limbAngle: [0.55, 1.0], limbLen: 2.9, limbTaper: 0.35,
    gnarl: 0.16, upward: 0.16, subs: [1, 2], clusterR: 1.75, cards: 80, cardSize: 1.25, squash: 0.85, midCluster: true,
    leafTex: { count: 55, leafLen: 0.26 },
  },
  birch: {
    leaf: 'oval', bark: 'birch', leafColor: 0xb4dc5e, barkColor: 0xffffff,
    tints: [0xffffff, 0xf2f7c8, 0xe2f0b0],
    multiTrunk: [1, 3], trunkLen: 3.2, leader: 5.2, trunkR: 0.16, trunkSegs: 7, trunkGnarl: 0.06, flare: 0.25,
    limbs: [6, 9], limbStart: 0.35, limbAngle: [0.35, 0.75], limbLen: 2.3, limbTaper: 0.5,
    gnarl: 0.14, upward: 0.05, droop: 0.1, subs: [0, 1], clusterR: 1.2, cards: 56, cardSize: 1.0, squash: 0.95, cardRandom: 0.6,
    leafTex: { count: 85, leafLen: 0.16 },
  },
  pine: {
    leaf: 'fir', bark: 'pine', leafColor: 0x3f8a64, barkColor: 0xd0b0a0,
    tints: [0xffffff, 0xd8ecd8, 0xc8e0e8],
    height: 12, trunkR: 0.28, crownStart: 0.16, tiers: 15, branches: 11, baseR: 3.1, droop: 0.38, flare: 0.4,
  },
};
