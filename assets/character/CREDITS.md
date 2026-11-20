# Mountain man character: sources and licence

All third-party sources are **CC0 1.0 (public domain)** by Quaternius (https://quaternius.com):

- Universal Base Characters [Standard]: `Superhero_Male_FullBody` (head, eyes, eyebrows), `Hair_Beard`, `Hair_Long`. https://quaternius.itch.io/universal-base-characters
- Modular Character Outfits - Fantasy [Standard]: `Male_Peasant` body/arms/legs, `Male_Ranger` boots and belt. https://quaternius.itch.io/modular-character-outfits-fantasy
- Universal Animation Library [Standard] (Unreal skeleton version): Idle, Walk, Jog, Sprint, Jump start/loop/land, Interact, Sitting idle, Pick up. https://opengameart.org/content/universal-animation-library

What was changed for this project (`assets_src/character/mountain_man.blend`):

- Body below the neck removed (the outfits cover it, as the pack's readme recommends).
- Hair, beard and eyebrows recoloured to chestnut, and the tunic recoloured to buckskin (`assets_src/character/textures/`).
- New meshes: a coonskin cap with a ringed tail, a fur mantle, a leather strap and a felling axe on the back. These are skinned to the same rig (weights copied from the tunic) with painted fur textures.
- The animation clips were renamed and re-targeted by bone name onto the character rig (same UE-style skeleton).
- Textures were downscaled for the web (2048 outfit colour, 1024 others), and the file was exported as GLB with JPEG textures.
- 2026-11-19 (v2 polish): the coonskin cap was tilted back 14° and lifted 1.2 cm so the brim sits on the hairline (it covered the eyes in close-ups); MikkTSpace tangents were added to the GLB with `gltf-transform tangents` (clears the generated-tangent-space validator warnings).
