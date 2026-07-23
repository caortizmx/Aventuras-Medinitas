# The Adventures of Emma, Orel, and Israel — Phaser Atlases

These files use Phaser-compatible JSON Hash texture atlases.

## Files

- `emma_atlas.png` / `emma_atlas.json`
- `orel_atlas.png` / `orel_atlas.json`
- `israel_atlas.png` / `israel_atlas.json`
- `gameplay_assets_atlas.png` / `gameplay_assets_atlas.json`
- `environment_atlas.png` / `environment_atlas.json`
- `animations_manifest.json`
- `atlas_manifest.json`

All frames are trimmed and include `spriteSourceSize` and `sourceSize`.
A one-pixel edge extrusion is included around packed frames to reduce texture bleeding.

## Phaser loading

```js
preload() {
  this.load.atlas("emma", "assets/emma_atlas.png", "assets/emma_atlas.json");
  this.load.atlas("orel", "assets/orel_atlas.png", "assets/orel_atlas.json");
  this.load.atlas("israel", "assets/israel_atlas.png", "assets/israel_atlas.json");

  this.load.atlas(
    "gameplay-assets",
    "assets/gameplay_assets_atlas.png",
    "assets/gameplay_assets_atlas.json"
  );

  this.load.atlas(
    "environment",
    "assets/environment_atlas.png",
    "assets/environment_atlas.json"
  );
}
```

## Character animation example

```js
this.anims.create({
  key: "emma-run",
  frames: this.anims.generateFrameNames("emma", {
    prefix: "emma_run_",
    start: 0,
    end: 5,
    zeroPad: 2
  }),
  frameRate: 12,
  repeat: -1
});
```

## Recommended frame rates

- idle: 6 fps
- run: 12 fps
- jump: 10 fps
- fall: 8 fps
- hurt: 10 fps
- celebrate: 8 fps
- small enemy walk: 10 fps
- large enemy walk: 8 fps
- collectible: 10 fps
- checkpoint: 8 fps
- goal portal: 8 fps

## Notes

The uploaded source images contained a visible checkerboard rather than real alpha.
The converter removed border-connected checkerboard pixels and exported true RGBA atlases.
The final environment source combines its lowest two landscape bands visually, so the atlas
provides `background_hills_foliage_combined` as a single parallax frame.
