# 7-Step Pipeline (Multi-Beat Videos)

For anything beyond a single clip (explainers, pitches, multi-scene promos), follow this structured pipeline. Each step produces an artifact the next step builds on. This prevents the agent from jumping straight to HTML and producing an incoherent video.

## The Steps

### 1. DESIGN
Establish the visual system: colors, typography, spacing, motion feel. If the project has a `design.md` / `DESIGN.md` / `frame.md`, read it first and use its tokens (see frame.md note below). Output: a short design spec (palette, fonts, scale).

### 2. SCRIPT
Write the narration / on-screen copy with timing. Every number downstream (durations, caption timing) comes from the script. Output: a timed script (line → start time → duration).

### 3. STORYBOARD
Break the script into beats/scenes. For each beat: what's on screen, which track, entrance/exit animation, duration. Output: a beat list mapping script lines to compositions.

### 4. SCAFFOLD
`npx hyperframes init` the project. Create one sub-composition per beat under `compositions/`, referenced from `index.html` via `data-composition-src`.

### 5. COMPOSE
Write the HTML for each beat following the 3 rules (clip markers, root attributes, paused+registered timelines). Layer elements by `data-track-index`.

### 6. ANIMATE + MEDIA
Add GSAP timelines per composition. Add video/audio clips. Sync captions to the script timing from step 2. For TTS narration, generate audio first, then align caption `data-start` to word timestamps.

### 7. LINT → PREVIEW → RENDER
`npx hyperframes lint`, fix issues, `npx hyperframes preview` to review, iterate, then `npx hyperframes render --output output.mp4`.

## Beat Timing Example

| Beat | Composition | Start | Duration | Content |
|---|---|---|---|---|
| 1 | intro.html | 0s | 3s | Logo pop + title |
| 2 | problem.html | 3s | 5s | Problem statement, bullet stagger |
| 3 | solution.html | 8s | 6s | Product shot + features |
| 4 | cta.html | 14s | 3s | Call to action + URL |

Root composition stitches them by track/time; sub-composition clips carry their own internal timelines.

## frame.md (design system for the camera)

Every brand has a `design.md`, but it's written for the web (web chrome, web scale). `frame.md` is the translation layer: same tokens and rules, rewritten for the frame so an agent can compose a promo video without guessing at scale.

- If a `frame.md` exists, **prefer it over `design.md`** for video specs.
- Output is a `DESIGN.md` superset the whole toolchain can read.
- Principle: "Atoms stay sacred, composition stays free, numbers come from the script."
- Template gallery: https://www.hyperframes.dev/design

## Warm Start vs Cold Start

- **Cold start** — user describes the video from scratch ("10-second product intro with..."). Run the full pipeline.
- **Warm start** — turn existing context into a video (a repo, PDF, CSV, website). Extract the content first (summarize the PDF, parse the CSV), then run SCRIPT → STORYBOARD → ... on that material.

## Determinism Reminder

Through every step, keep animation seekable: paused timelines, registered on `window.__*`, values derived from time or the script. No autoplay, no wall-clock, no unseeded random. This is what lets the same project render identically every time.
