# Animation Patterns

All animation in HyperFrames must be **seekable** — driven by a paused timeline the renderer steps through frame by frame. Never use autoplay, `setTimeout`, CSS `animation` that auto-runs, or wall-clock time.

## GSAP (default runtime)

GSAP is the recommended runtime. Always: create `{ paused: true }`, register on `window.__timelines[compositionId]`.

### Fade in

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script>
  const tl = gsap.timeline({ paused: true });
  tl.from("#title", { opacity: 0, duration: 1 }, 0);
  window.__timelines = window.__timelines || {};
  window.__timelines["my-video"] = tl;
</script>
```

### Slide + fade (entrance)

```js
tl.from("#title", { opacity: 0, y: -50, duration: 1, ease: "power2.out" }, 0);
```

### Scale pop

```js
tl.from("#logo", { scale: 0, opacity: 0, duration: 0.6, ease: "back.out(1.7)" }, 0);
```

### Fade out at the end

```js
// at 4s, fade out over 1s
tl.to("#title", { opacity: 0, duration: 1 }, 4);
```

### Stagger (multiple items in sequence)

```js
tl.from(".bullet", { opacity: 0, x: -30, duration: 0.5, stagger: 0.2 }, 1);
```

### Lower third (name/title bar at 0:03)

```html
<div id="lower-third" class="clip"
     data-start="3" data-duration="4" data-track-index="2"
     style="position:absolute; left:80px; bottom:120px; color:white;">
  <div style="font-size:42px; font-weight:700;">Jane Doe</div>
  <div style="font-size:28px; opacity:.8;">Product Designer</div>
</div>
<script>
  tl.from("#lower-third", { x: -400, opacity: 0, duration: 0.6, ease: "power3.out" }, 3);
  tl.to("#lower-third",   { x: -400, opacity: 0, duration: 0.5 }, 6.5);
</script>
```

### Caption sync (bouncy captions to TTS)

Each caption is a clip whose `data-start`/`data-duration` matches the narration word/phrase timing:

```html
<span class="clip caption" data-start="0.0" data-duration="0.8" data-track-index="3">Build</span>
<span class="clip caption" data-start="0.8" data-duration="0.7" data-track-index="3">faster</span>
<script>
  tl.from(".caption", { scale: 0.5, opacity: 0, duration: 0.25, ease: "back.out(2)",
                        stagger: { each: 0.0, from: "start" } }, 0);
</script>
```
For real sync, set each caption's `data-start` to the transcribed word timestamp (use `npx hyperframes init --video` to auto-generate captions from a source video).

### Chart race / data viz

Animate width/height/transform of bars from data. Keep values from the script, not hardcoded:

```js
gsap.utils.toArray(".bar").forEach((bar, i) => {
  tl.to(bar, { width: bar.dataset.value + "px", duration: 1.5, ease: "power2.out" }, i * 0.1);
});
```

## Non-GSAP Adapters

Each alternative runtime registers on its own `window.__hf*` registry. This registration is the #1 thing agents get wrong. Use the exact pattern below.

### CSS animations

Mark CSS-animated elements and let HyperFrames drive the clock. Use `animation-play-state: paused` and a CSS variable / negative `animation-delay` the engine seeks. Prefer GSAP unless the effect is trivial.

```html
<div class="clip" data-start="0" data-duration="3" data-track-index="0"
     style="animation: spin 3s linear infinite; animation-play-state: paused;">…</div>
```
HyperFrames seeks CSS animations via the document timeline — keep them declarative (no JS triggers).

### Lottie

```html
<div id="lottie-box" class="clip" data-start="0" data-duration="5" data-track-index="0"></div>
<script src="https://cdn.jsdelivr.net/npm/lottie-web@5/build/player/lottie.min.js"></script>
<script>
  const anim = lottie.loadAnimation({
    container: document.getElementById("lottie-box"),
    renderer: "svg", loop: false, autoplay: false,   // autoplay MUST be false
    path: "assets/animation.json",
  });
  window.__hfLottie = window.__hfLottie || [];
  window.__hfLottie.push(anim);   // register so the renderer can seek it
</script>
```

### Three.js (3D)

```html
<canvas id="scene" class="clip" data-start="0" data-duration="6" data-track-index="0"></canvas>
<script type="module">
  import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
  // ... set up scene/camera/renderer ...
  window.__hfThree = window.__hfThree || [];
  // register a seek function: given time t (seconds), update the scene then render
  window.__hfThree.push((t) => {
    mesh.rotation.y = t * Math.PI;     // deterministic from t, never from clock
    renderer.render(scene, camera);
  });
</script>
```
Key: drive everything from the passed time `t`, never `performance.now()` or `requestAnimationFrame` time.

### Anime.js

```html
<script src="https://cdn.jsdelivr.net/npm/animejs@3/lib/anime.min.js"></script>
<script>
  const a = anime({ targets: "#box", translateX: 250, duration: 1000, autoplay: false });
  window.__hfAnime = window.__hfAnime || [];
  window.__hfAnime.push(a);   // seek via a.seek(t * 1000)
</script>
```

### WAAPI (Web Animations API)

```html
<script>
  const anim = document.getElementById("box").animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 1000, fill: "both" }
  );
  anim.pause();                              // MUST pause
  window.__hfWAAPI = window.__hfWAAPI || [];
  window.__hfWAAPI.push(anim);               // renderer sets anim.currentTime per frame
</script>
```

## Easing Cheat Sheet (GSAP)

| Feel | Ease |
|---|---|
| Smooth entrance | `power2.out` / `power3.out` |
| Snappy / overshoot | `back.out(1.7)` |
| Bouncy | `bounce.out` |
| Elastic | `elastic.out(1, 0.5)` |
| Linear (loops, rotation) | `none` |

## Golden Rules

1. Every timeline: `{ paused: true }` + registered on the right `window.__*` registry.
2. Animation values come from time `t` or the script — never from wall-clock or random.
3. Timeline key === `data-composition-id`.
4. Prefer GSAP. Reach for another runtime only when the asset demands it (Lottie JSON, 3D scene).
