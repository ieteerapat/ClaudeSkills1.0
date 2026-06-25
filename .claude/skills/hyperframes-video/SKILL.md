---
name: hyperframes-video
description: Create deterministic MP4 videos from HTML/CSS and seekable animations using the HyperFrames framework. Self-contained — no plugin required. Use whenever the user wants to generate a video, animation, product intro, social clip, data viz, chart race, captions, lower-thirds, or docs-to-video / PDF-to-video / website-to-video, or mentions hyperframes, GSAP timelines, or composition rendering.
metadata:
  version: "2.1.0"
  last-updated: "2026-06-08"
  author: ieteerapat
  based-on: heygen-com/hyperframes v0.7.6
---

# HyperFrames Video (Local Skill)

Turn HTML + CSS + seekable animations into deterministic MP4 videos. HyperFrames is HTML-native (no React, no build step). This skill is **self-contained** — it embeds every rule you need to author correct compositions without installing any plugin.

## When to use

- Generating any video: product intro, feature announcement, social clip (TikTok/Reels), explainer
- Data visualizations, chart races, map animations
- Docs-to-video, PDF-to-video, website-to-video
- Adding captions, lower-thirds, kinetic text, overlays, music to a composition
- Anything mentioning HyperFrames, GSAP timelines, or composition rendering

## Prerequisites (CLI only — for preview/render)

- **Node.js 22+** — runtime for the CLI and dev server
- **FFmpeg** — video encoding for local renders
- **Docker** (optional) — deterministic, reproducible renders

The `hyperframes` CLI runs via `npx hyperframes ...` (no global install needed). You do NOT need to install agent skills/plugins — this skill carries all the authoring knowledge.

## Mental Model

A HyperFrames video is **one or more HTML files** ("compositions"). Each visible/audible element is a **clip** placed on a **track** at a **start time** for a **duration**. Animation is **seekable**: the renderer steps frame-by-frame through headless Chrome, so animations must be driven by a paused, registered timeline — never by wall-clock (autoplay / setTimeout).

```
HTML composition → headless Chrome seeks each frame → FFmpeg encodes → MP4
```

Same input → same frames → same output. Determinism is the core contract.

## The 3 Non-Negotiable Rules

The agent gets these wrong without explicit instruction. Always enforce them.

### Rule 1 — Root element attributes

```html
<div id="root" data-composition-id="UNIQUE_ID"
     data-start="0" data-width="1920" data-height="1080">
```
- `data-composition-id` — unique ID (must match the timeline key, see Rule 3)
- `data-width`, `data-height` — pixel dimensions
- `data-start` — start time in seconds (usually 0)

### Rule 2 — Timed elements need clip markers

Every element that appears/disappears on the timeline MUST have:
```html
<h1 class="clip" data-start="0" data-duration="5" data-track-index="0">…</h1>
```
- `class="clip"` — **REQUIRED**. Without it the element is not tracked and won't render on the timeline.
- `data-start` — when it appears (seconds)
- `data-duration` — how long it stays (seconds)
- `data-track-index` — track number; **higher index layers on top**

### Rule 3 — Animation timelines must be paused + registered

```html
<script>
  const tl = gsap.timeline({ paused: true });   // MUST be paused
  tl.from("#title", { opacity: 0, y: -50, duration: 1 }, 0);
  window.__timelines = window.__timelines || {};
  window.__timelines["UNIQUE_ID"] = tl;          // key MUST match data-composition-id
</script>
```
- Create with `{ paused: true }` — the renderer seeks it, it must not auto-play
- Register on `window.__timelines[compositionId]`
- The key MUST equal the root's `data-composition-id`
- NEVER use `setTimeout`, autoplay, `Date.now()`, or unseeded `Math.random()` — they break determinism

## Minimal Composition (copy-paste starting point)

```html
<div id="root" data-composition-id="my-video"
     data-start="0" data-width="1920" data-height="1080">

  <h1 id="title" class="clip"
      data-start="0" data-duration="5" data-track-index="0"
      style="font-size: 72px; color: white; text-align: center;
             position: absolute; top: 50%; left: 50%;
             transform: translate(-50%, -50%);">
    Hello, HyperFrames!
  </h1>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.from("#title", { opacity: 0, y: -50, duration: 1 }, 0);
    window.__timelines = window.__timelines || {};
    window.__timelines["my-video"] = tl;
  </script>
</div>
```

## Media Elements (video / audio)

Media are clips too — same `class="clip"` + timing:

```html
<video class="clip" data-start="0" data-duration="6" data-track-index="0"
       src="assets/intro.mp4" muted playsinline></video>

<audio data-start="0" data-duration="6" data-track-index="2"
       data-volume="0.5" src="assets/music.wav"></audio>
```
- `muted playsinline` on video avoids autoplay/seek issues
- `data-volume` (0–1) controls audio level in the final mix

## CLI Dev Loop

```bash
# Scaffold (interactive wizard)
npx hyperframes init my-video
cd my-video

# Non-interactive (CI / agent-driven)
npx hyperframes init my-video --non-interactive --example blank

# With a source video → auto transcription + captions
npx hyperframes init my-video --example warm-grain --video ./intro.mp4

# Preview in browser with hot reload
npx hyperframes preview

# Lint composition for timing/clip errors
npx hyperframes lint

# Render to MP4
npx hyperframes render --output output.mp4

# Add catalog blocks (transitions, overlays, charts)
npx hyperframes add data-chart
npx hyperframes add flash-through-white
npx hyperframes add instagram-follow
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

Reference a sub-composition from the root:
```html
<div class="clip" data-start="0" data-duration="5" data-track-index="0"
     data-composition-src="compositions/intro.html"></div>
```

## Authoring Workflow (follow this order)

1. **Plan** — clarify duration, aspect ratio (16:9 = 1920×1080, 9:16 = 1080×1920, 1:1 = 1080×1080), beats, and assets.
2. **Scaffold** — `npx hyperframes init` (or hand-write `index.html` for simple clips).
3. **Compose** — write HTML following the 3 rules. One clip per visual element, layered by track index.
4. **Animate** — add a paused GSAP timeline, register it. See `references/animation-patterns.md`.
5. **Add media** — video/audio clips, with `data-volume` for audio.
6. **Lint** — `npx hyperframes lint` catches missing clip markers and timing gaps.
7. **Preview** — `npx hyperframes preview`, iterate with hot reload.
8. **Render** — `npx hyperframes render --output output.mp4`.

For multi-beat videos, see the 7-step pipeline in `references/pipeline.md`.

## Aspect Ratios

| Format | Dimensions | Use |
|---|---|---|
| Landscape 16:9 | 1920×1080 | YouTube, product demos, web |
| Vertical 9:16 | 1080×1920 | TikTok, Reels, Shorts, Stories |
| Square 1:1 | 1080×1080 | Instagram feed |

Set via root `data-width` / `data-height`.

## Animation Runtimes

GSAP is the default. HyperFrames supports other seekable runtimes via adapters, each registered on a `window.__hf*` registry. For non-GSAP runtimes (Lottie, Three.js, Anime.js, WAAPI, CSS) read `references/animation-patterns.md` for the exact registration pattern — the registration differs per runtime and is the #1 thing agents get wrong.

## Example Prompts (how users will ask)

```
Create a 10-second product intro with a fade-in title over a dark
background and subtle background music.

Turn this CSV into an animated bar chart race.

Make a 9:16 TikTok-style hook video about [topic] with bouncy captions
synced to a TTS narration.

Summarize the attached PDF into a 45-second pitch video.
```

Iterate like a video editor:
```
Make the title 2x bigger, swap to dark mode, add a fade-out at the end.
Add a lower third at 0:03 with my name and title.
```

## Common Failures & Fixes

- **Element missing from render** → missing `class="clip"`. Add it.
- **Animation works in preview but not render** → timeline not `{ paused: true }`, or not registered on `window.__timelines`.
- **Timeline does nothing** → key in `window.__timelines[key]` doesn't match root `data-composition-id`.
- **Render fails immediately** → FFmpeg not installed, or Node < 22.
- **Non-deterministic / flickering output** → autoplay, `setTimeout`, `Date.now()`, or unseeded random. Use only seekable timeline animation.
- **Wrong layering** → adjust `data-track-index` (higher = on top), not DOM order.
- **Audio too loud/quiet** → set `data-volume` (0–1) on the `<audio>` clip.
- **Captions out of sync** → caption clip `data-start`/`data-duration` must match the narration timing.

## Reference Files (load when needed)

- `references/animation-patterns.md` — GSAP recipes (fade, slide, scale, stagger, lower-third, caption sync) + non-GSAP adapter registration (Lottie, Three.js, Anime.js, WAAPI, CSS)
- `references/cli-reference.md` — full CLI command/flag reference
- `references/pipeline.md` — the 7-step pipeline for multi-beat videos (DESIGN → SCRIPT → STORYBOARD → …) and frame.md design-system notes

## Source

Based on heygen-com/hyperframes (Apache 2.0, v0.7.6). Docs: https://hyperframes.heygen.com/introduction · GitHub: https://github.com/heygen-com/hyperframes
