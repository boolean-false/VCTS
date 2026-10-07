# gamekit

TypeScript project for VoxelCore 0.32.1.

Start with [VCTS_GUIDE.md](VCTS_GUIDE.md), including external Lua API dependencies.

Install dependencies with `npm install`, then use `npm run check`, `npm run build`, `npm run watch`, `npm test`.

Content for installation is in `build/content/gamekit`. Launch VC with --project pointing to build. project.basePacks selects the content used by your game.

To update a pack directly in your game, fill in the generated `packOutDirs` in vcts.config.json, mapping the pack ID to its exact directory, e.g. {"gamekit": "/path/to/VoxelCore/content/gamekit"}. Paths may be absolute or relative to the config. build and watch update selected packs; check and test do not write to these destinations. Use a new destination: existing files and manual changes are protected. The full test project stays in outDir.

Each world opens its own Scope and Store. Persist only schema-validated values; dispose listeners and timers on quit.

The development toolchain points to /Users/dartyukhov/Desktop/Projects/vcts. Change the file dependency when moving it to another computer. API declarations are vendored under vendor/sdk.
