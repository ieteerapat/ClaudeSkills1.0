---
name: hyperframes-video
description: Create deterministic MP4 videos from HTML/CSS and seekable animations using HeyGen's HyperFrames framework. Use whenever the user wants to generate a video, animation, product intro, social clip, data viz, chart race, captions, or docs-to-video / PDF-to-video / website-to-video with HyperFrames, or mentions hyperframes, GSAP timelines, or composition rendering.
metadata:
  version: "1.0.0"
  last-updated: "2026-06-05"
  author: ieteerapat
  upstream: heygen-com/hyperframes
  upstream-version: "v0.6.73"
---

# HyperFrames Video

Turn HTML + CSS + seekable animations into deterministic MP4 videos. HyperFrames is HTML-native (no React, no build step) and built for AI agents.

This skill captures the HyperFrames-specific patterns that generic web docs miss — the rules the agent gets wrong without them. For the full official skill set, install upstream (see Setup).

## When to use

- Generating any video: product intro, feature announcement, social clip (TikTok/Reels), explainer
- Data visualizations, chart races, map animations
- Docs-to-video, PDF-to-video, website-to-video
- Adding captions, lower-thirds, kinetic text, overlays, music to a composition
- Anything mentioning HyperFrames, GSAP timelines, or composition rendering

## Setup (Do This First)

### Install the official HyperFrames skills

```bash
npx skills add heygen-com/hyperframes
```

This installs the full upstream skill set and registers slash commands in Claude Code:
- `/hyperframes` — composition authoring
- `/hyperframes-cli` — dev-loop commands (init, lint, preview, render)
- `/hyperframes-media` — asset preprocessing (TTS, transcription, background removal)
- `/tailwind` — for `init --tailwind` projects
- `/gsap`, `/animejs`, `/css-animations`, `/lottie`, `/three`, `/waapi` — per-runtime animation help

Invoke the slash command explicitly (e.g. "Using `/hyperframes`, create...") to load skill context and get correct output the first time.

### Prerequisites for the CLI

- **Node.js 22+** — runtime for CLI and dev server
- **FFmpeg** — video encoding for local renders
- **Docker** (optional) — deterministic, reproducible renders

This skill is a lightweight quickstart. When a composition needs deep runtime work (complex GSAP, Three.js, Lottie), defer to the upstream slash command for that runtime.

## CLI Workflow (the dev loop)

```bash
# 1. Scaffold a project (interactive wizard)
npx hyperframes init my-video
cd my-video

# Non-interactive (CI or agent-driven):
npx hyperframes init my-video --non-interactive --example blank

# With a source video (auto transcription + captions):
npx hyperframes init my-video --example warm-grain --video ./intro.mp4

# 2. Preview in browser with hot reload
npx hyperframes preview

# 3. Render to MP4
npx hyperframes render --output output.mp4

# Add catalog blocks (transitions, overlays, charts)
npx hyperframes add data-chart
npx hyperframes add flash-through-white
npx hyperframes add instagram-follow
```

`hyperframes init` installs AI agent skills automatically, so you can hand off to the agent at any point.

## Core Composition Rules (CRITICAL — agent gets these wrong without them)

A composition is an HTML file with data attributes. Three rules are non-negotiable:

### Rule 1: Root element attributes

The root element MUST have:
- `data-composition-id` — unique ID for this composition
- `data-width` — pixel width (e.g. 1920)
- `data-height` — pixel height (e.g. 1080)
- `data-start` — start time in seconds (usually 0)

### Rule 2: Timed elements need clip markers

Any element that appears/disappears on a timeline MUST have:
- `class="clip"` — REQUIRED, or the element won't be tracked on the timeline
- `data-start` — when it appears (seconds)
- `data-duration` — how long it stays (seconds)
- `data-track-index` — which track (0, 1, 2...) — higher tracks layer on top

### Rule 3: GSAP timelines must be paused and registered

- Create the timeline with `{ paused: true }` — HyperFrames seeks it frame-by-frame
- Register it on `window.__timelines[compositionId]`
- Never use wall-clock animation (setTimeout, autoplay) — only seekable/library-clock animation renders deterministically

## Minimal Composition Template

```html
<div id="root" data-composition-id="my-video"
     data-start="0" data-width="1920" data-height="1080">

  <!-- Timed text clip on track 0 -->
  <h1 id="title" class="clip"
      data-start="0" data-duration="5" data-track-index="0"
      style="font-size: 72px; color: white; text-align: center;
             position: absolute; top: 50%; left: 50%;
             transform: translate(-50%, -50%);">
    Hello, HyperFrames!
  </h1>

  <!-- Load GSAP -->
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>

  <!-- Paused timeline, registered on window.__timelines -->
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.from("#title", { opacity: 0, y: -50, duration: 1 }, 0);
    window.__timelines = window.__timelines || {};
    window.__timelines["my-video"] = tl;
  </script>
</div>
```

## Media Elements (video / audio)

Video and audio are clips too — same `class="clip"` + timing attributes:

```html
<video class="clip" data-start="0" data-duration="6" data-track-index="0"
       src="intro.mp4" muted playsinline></video>

<audio data-start="0" data-duration="6" data-track-index="2"
       data-volume="0.5" src="music.wav"></audio>
```

## Project Structure

```
my-video/
├── meta.json          # name, ID, creation date
├── index.html         # root composition (entry point)
├── compositions/      # sub-compositions loaded via data-composition-src
│   ├── intro.html
│   └── captions.html
└── assets/            # video, audio, images
```

Sub-compositions are referenced from the root with `data-composition-src`.

## The 7-Step Pipeline (multi-beat videos)

For anything beyond a single clip, AI agents follow this structure (DESIGN → SCRIPT → STORYBOARD → ...). Use `/hyperframes` and ask for a multi-beat video; it scaffolds the pipeline. See the upstream pipeline guide for the full 7 steps.

## frame.md (design system for video)

If the project has a `design.md` or `DESIGN.md`, HyperFrames uses `frame.md` to invert web design tokens for the camera (scale, no web chrome). Prefer `frame.md` over `design.md` for video specs. Browse templates at hyperframes.dev/design.

## Adapter Runtimes (beyond GSAP)

HyperFrames supports multiple seekable animation runtimes via adapters. Each registers on a `window.__hf*` registry (e.g. `window.__hfLottie`). Use the matching slash command when a composition uses one:

| Runtime | Slash command | Use for |
|---|---|---|
| GSAP | `/gsap` | General timeline animation (default) |
| CSS animations | `/css-animations` | Simple keyframe effects |
| Anime.js | `/animejs` | Lightweight JS animation |
| Lottie | `/lottie` | After Effects / JSON animations |
| Three.js | `/three` | 3D scenes |
| WAAPI | `/waapi` | Web Animations API |

## Example Prompts

```
Using /hyperframes, create a 10-second product intro with a fade-in title
over a dark background and subtle background music.

Turn this CSV into an animated bar chart race using /hyperframes.

Make a 9:16 TikTok-style hook video about [topic] using /hyperframes,
with bouncy captions synced to a TTS narration.

Summarize the attached PDF into a 45-second pitch video using /hyperframes.
```

Iterate like a video editor:
```
Make the title 2x bigger, swap to dark mode, and add a fade-out at the end.
Add a lower third at 0:03 with my name and title.
```

## Common Edge Cases / Gotchas

- **Element not appearing in render**: Missing `class="clip"`. Timed elements without it are not tracked.
- **Animation plays in preview but not render**: Timeline wasn't created with `{ paused: true }` or wasn't registered on `window.__timelines`. The renderer seeks frames — wall-clock animation won't work.
- **Timeline key mismatch**: The key in `window.__timelines[key]` must match the root's `data-composition-id`.
- **Render fails / no FFmpeg**: Install FFmpeg (it's required for local renders).
- **Non-deterministic output**: Avoid `Date.now()`, `Math.random()` without seed, autoplay, or `setTimeout`-driven animation. Use seekable adapters only.
- **Layering wrong**: Higher `data-track-index` layers on top. Reorder tracks, not DOM order.
- **Deep runtime work**: For complex GSAP/Three.js/Lottie, invoke the matching upstream slash command rather than improvising — those skills carry the adapter-specific registration details.

## References

- Quickstart: https://hyperframes.heygen.com/quickstart
- GitHub: https://github.com/heygen-com/hyperframes
- Playground: https://www.hyperframes.dev
- Catalog: https://hyperframes.heygen.com/catalog/blocks/data-chart
- Full docs: https://hyperframes.heygen.com/introduction
