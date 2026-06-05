# HyperFrames CLI Reference

Run via `npx hyperframes <command>` — no global install required. Requires Node.js 22+ and FFmpeg.

## init — scaffold a project

```bash
npx hyperframes init <project-name> [flags]
```

| Flag | Description |
|---|---|
| `--non-interactive` | Skip the wizard (for CI / agent-driven runs) |
| `--example <name>` | Start from an example (`blank`, `warm-grain`, etc.) |
| `--video <path>` | Import a source video → auto transcription + captions |
| `--tailwind` | Set up a Tailwind v4 browser-runtime project |

Examples:
```bash
npx hyperframes init my-video
npx hyperframes init my-video --non-interactive --example blank
npx hyperframes init promo --example warm-grain --video ./raw.mp4
```

Generates: `meta.json`, `index.html`, `compositions/`, `assets/`. Also installs agent skills into the project automatically (you can ignore these — this local skill already covers authoring).

## preview — dev server with hot reload

```bash
npx hyperframes preview
```

Starts HyperFrames Studio and opens the composition in the browser. Saving the HTML reloads the preview instantly (no manual refresh).

## lint — validate a composition

```bash
npx hyperframes lint
```

Catches the common errors before render:
- Timed elements missing `class="clip"`
- Missing `data-start` / `data-duration` / `data-track-index`
- Timeline key not matching `data-composition-id`
- Timing gaps / overlaps

Run this before every render.

## render — produce the MP4

```bash
npx hyperframes render --output output.mp4 [flags]
```

| Flag | Description |
|---|---|
| `--output <path>` | Output file path (default `output.mp4`) |
| `--fps <n>` | Frames per second (default 30) |

Expected output:
```
✔ Capturing frames... 150/150
✔ Encoding MP4...
✔ output.mp4 (1920x1080, 5.0s, 30fps)
```

The renderer seeks each frame in headless Chrome and encodes with FFmpeg — deterministic, same input → same output.

## add — install catalog blocks

```bash
npx hyperframes add <block-name>
```

Examples:
```bash
npx hyperframes add data-chart            # animated chart
npx hyperframes add flash-through-white   # shader transition
npx hyperframes add instagram-follow      # social overlay
```

Browse the catalog: https://hyperframes.heygen.com/catalog/blocks/data-chart

## Prerequisite install (one-time)

```bash
# Node.js 22+
winget install OpenJS.NodeJS          # Windows
brew install node@22                  # macOS

# FFmpeg
winget install Gyan.FFmpeg            # Windows
brew install ffmpeg                   # macOS
sudo apt install ffmpeg               # Ubuntu/Debian
```

Verify:
```bash
node --version    # must be >= 22
ffmpeg -version
```

## Docker (optional, deterministic renders)

For reproducible renders across machines/CI, render inside Docker. See the upstream repo's `Dockerfile` examples under `examples/`.
