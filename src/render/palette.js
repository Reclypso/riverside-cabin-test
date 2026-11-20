// Art-direction palette (sRGB hex; THREE.Color converts to linear). See ART_DIRECTION.md.
export const PALETTE = {
  ground: {
    uGrassA: 0x467f30, // deep meadow green
    uGrassB: 0x7aad3b, // mid meadow
    uGrassC: 0xb3c853, // sunny yellow-green patches
    uDirt: 0xc49a62,
    uDirtEdge: 0x8e6a43,
    uSand: 0xd9c49a,
    uSandWet: 0x9c8664,
    uBed: 0x8f8a62,
    uBedDeep: 0x3f6d5d,
    uRock: 0x8d969a,
    uMoss: 0x6a8f3a,
  },
  grass: {
    base: 0x2f5f35, // root, in the blade shade
    midA: 0x5c9a35, // deep patch body
    midB: 0x8bbd42, // light patch body
    tipA: 0xb0d35e,
    tipB: 0xd9e67c,
    dry: 0xe2d98a,
  },
  water: {
    shallow: 0x7fe9da,
    mid: 0x2bb8c8,
    deep: 0x16809f,
    foam: 0xf6fdff,
  },
  wood: {
    log: 0x8a5a36,
    logDark: 0x5e3a22,
    plank: 0xa8774a,
    roof: 0x7a4632,
    end: 0xd9b27a,
  },
  stone: { lit: 0xa3abae, shade: 0x5f6f7d, moss: 0x6f9a3c },
};
