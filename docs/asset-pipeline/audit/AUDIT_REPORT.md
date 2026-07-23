# Character Atlas Audit and Rebuild Report

## Root cause

- The old pipeline divided each 1448×1086 sheet into a uniform 6×6 grid.
- The sheet height is divisible by six, but the generated sprite rows were not actually confined to those equal 181-pixel bands.
- Lower animation rows extend upward into the previous nominal row. The old crop therefore removed heads/torsos from one frame and inserted those pixels as detached fragments into the preceding animation frame.
- The sheet width is not divisible by six (1448 / 6 = 241.333…), which produced alternating 241/242 logical source widths.
- The previous validator only checked JSON rectangles and bounds. It did not reconstruct logical frames or inspect image content.

## Corrected strategy

- Manually reviewed, explicit animation row regions are used for each character.
- Components are assigned to one of six known frame columns inside each reviewed row; this is used only within those explicit regions.
- Enclosed white and gray pixels are restored after checkerboard removal.
- Character mass is centered horizontally, the main character is aligned to baseline y=175, and every logical frame is 242×181.
- Detached hurt/celebrate effects remain with their owning frame.
- Frames are trimmed only during atlas packing; Phaser `sourceSize` remains 242×181 for all frames.

## Damaged-frame audit

- **Emma**: 30 old frames affected (18 severe, 4 moderate, 8 minor).
  - Moderate/severe: emma_jump_00, emma_jump_01, emma_jump_02, emma_jump_03, emma_fall_00, emma_fall_01, emma_fall_02, emma_fall_03, emma_fall_04, emma_fall_05, emma_hurt_00, emma_hurt_01, emma_hurt_02, emma_hurt_03, emma_hurt_04, emma_hurt_05, emma_celebrate_00, emma_celebrate_01, emma_celebrate_02, emma_celebrate_03, emma_celebrate_04, emma_celebrate_05
- **Orel**: 30 old frames affected (20 severe, 10 moderate, 0 minor).
  - Moderate/severe: orel_run_00, orel_run_01, orel_run_02, orel_run_03, orel_run_04, orel_run_05, orel_jump_00, orel_jump_01, orel_jump_02, orel_jump_03, orel_jump_04, orel_jump_05, orel_fall_00, orel_fall_01, orel_fall_02, orel_fall_03, orel_fall_04, orel_fall_05, orel_hurt_00, orel_hurt_01, orel_hurt_02, orel_hurt_03, orel_hurt_04, orel_hurt_05, orel_celebrate_00, orel_celebrate_01, orel_celebrate_02, orel_celebrate_03, orel_celebrate_04, orel_celebrate_05
- **Israel**: 26 old frames affected (18 severe, 8 moderate, 0 minor).
  - Moderate/severe: israel_run_01, israel_run_02, israel_run_03, israel_run_04, israel_jump_01, israel_jump_02, israel_jump_03, israel_jump_04, israel_fall_00, israel_fall_01, israel_fall_02, israel_fall_03, israel_fall_04, israel_fall_05, israel_hurt_00, israel_hurt_01, israel_hurt_02, israel_hurt_03, israel_hurt_04, israel_hurt_05, israel_celebrate_00, israel_celebrate_01, israel_celebrate_02, israel_celebrate_03, israel_celebrate_04, israel_celebrate_05

The complete per-frame pixel audit is in `damaged_frames.json`.

## New atlas dimensions

- `emma_atlas.png`: 2000×420
- `orel_atlas.png`: 2044×492
- `israel_atlas.png`: 2024×468

## Validation result

- Enhanced image-aware validation: **PASS**
- Frames requiring manual review after validation: **0**
- All corrected atlas textures are below 2048×2048.
- All manifest references exist.
- All logical `sourceSize` values are 242×181.
- All main characters align to the common baseline.

## Contact sheets

- Before: `contact_sheets/before/`
- After: `contact_sheets/after/`
- Per-animation before/after sheets: each directory’s `animations/` subfolder.

## Phaser runtime acceptance note

- JSON Hash schema and image compatibility checks passed.
- An actual Phaser browser boot was not run because the Phaser runtime package was unavailable in the offline build environment. This remains the only external acceptance step.
