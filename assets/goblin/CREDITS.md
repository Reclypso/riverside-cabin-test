# Goblin enemy: source and licence

- **Model + animations**: "Orc" from **Quaternius – Ultimate Monsters** pack, **CC0 1.0 (public domain)**.
  Downloaded from Poly Pizza (https://poly.pizza/m/5vO2YJsPEf, licence shown there: "CC0 1.0"; tags: Goblin, Enemy, Monster).
  Pack page: https://quaternius.com/packs/ultimatemonsters.html (licence: CC0).
- Original file kept unmodified at `assets_src/goblin/Orc_Quaternius_UltimateMonsters.glb`.
- `assets/goblin/goblin.glb` is produced by `node tools/prep_goblin.mjs`: clips renamed
  (`CharacterArmature|Run` -> `Run`), nodes/meshes renamed to `Goblin_*`. Geometry, rig, materials and
  animation data are unchanged. In the game it is scaled to 1.22 m and restyled at runtime with the
  project's stylised Lambert + outline (`src/enemies/goblin.js`).
- Clips: Death, Duck, HitReact, Idle, Jump, Jump_Idle, Jump_Land, No, Punch, Run, Walk, Wave, Weapon, Yes.
  Used: Idle, Run (chase), Weapon (club attack), HitReact, Death, Jump_Land (spawn).
