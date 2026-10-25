<div align="center">

# ShaderAmbient

**Zero-dependency WebGL ambient background — flickering grid, mouse ripple field and floating particles in one raw fragment shader, with full performance guards.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/abitfox/shader-ambient/actions/workflows/ci.yml/badge.svg)](./.github/workflows/ci.yml)

[中文文档](./README.zh-CN.md)

</div>

---

> ▶ **Live site: [www.hackerenglish.com](https://www.hackerenglish.com)** — its ambient background is this shader running in production.

Ambient backgrounds for dark, techy landing pages are usually three.js demos:
heavy, opinionated, and without a plan for laptops that can't keep up.
ShaderAmbient is one raw fragment shader (~330 lines, zero dependencies) with
**the boring parts done right**:
<div align="center">
  <img src="docs/media/demo.png" alt="ShaderAmbient live demo" width="820" />
</div>


```tsx
import { ShaderAmbience } from "shader-ambient";

// Fixed, pointer-events-none canvas behind your app
<ShaderAmbience color="#66d9e0" intensity={0.03} />
```

## Features

- **One shader, three layers** — flickering grid + mouse-follow dot ripple field + floating particles, composed with an edge vignette so content stays readable.
- **Zero dependencies** — raw WebGL, no three.js, no regl. The core is a single file.
- **Performance guards built in** — DPR capped at 2, canvas bounded at 4096px, low-power GPU context, offscreen pause via IntersectionObserver, `prefers-reduced-motion` renders a static frame.
- **Freeze mode** — `enabled={false}` parks the animation at the current frame: zero GPU work, picture retained. Pair with the persisted `useFxPreference()` toggle.
- **SSR-safe** — guarded browser APIs; on the server nothing runs.

## Install

```bash
npm install shader-ambient
```

| Stack | Import |
| --- | --- |
| React / Next.js | `import { ShaderAmbience } from "shader-ambient"` |
| Any framework / plain JS | `import { createShaderAmbience } from "shader-ambient/core"` |

## Usage

### React

```tsx
import { ShaderAmbience, useFxPreference, requestFx } from "shader-ambient";

function App() {
  const fx = useFxPreference(); // persisted toggle (localStorage)
  return (
    <>
      <ShaderAmbience enabled={fx} color="#66d9e0" intensity={0.03} />
      <button onClick={() => requestFx(!fx)}>FX {fx ? "ON" : "OFF"}</button>
      {/* your content */}
    </>
  );
}
```

### Framework-free

```ts
import { createShaderAmbience } from "shader-ambient/core";

const handle = createShaderAmbience(canvas, {
  color: "#66d9e0",
  intensity: 0.03,
  gridLines: 40,
  dotScale: 150,
  vignette: true,
  mouseInteractive: true,
});
if (handle) {
  handle.setEnabled(false); // freeze frame
  handle.destroy();         // detach listeners
}
```

Returns `null` when WebGL is unavailable or shader compilation fails — decide
your own fallback (a plain CSS gradient works well).

### Options

| Option | Default | Description |
| --- | --- | --- |
| `color` | `#66d9e0` | Accent color (hex) |
| `gridLines` | `40` | Grid density |
| `dotScale` | `150` | Dot-field density |
| `intensity` | `0.03` | Overall brightness — keep it ambient, don't fight your content |
| `vignette` | `true` | Edge fade so corners don't compete with UI |
| `mouseInteractive` | `true` | Ripple glow follows the pointer |
| `onUnavailable` | — | Called when WebGL / compilation fails |

## Origin

Extracted from the HackerEnglish project, which adapted the shader from a
Bitget builder-section demo and added the performance guards. See
[`docs/PORTING.md`](./docs/PORTING.md).

## License

[MIT](./LICENSE).
