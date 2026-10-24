/**
 * ShaderAmbient core — a raw-WebGL ambient background in one fragment shader:
 * flickering grid + mouse-follow dot ripple field + floating particles.
 * No three.js, no dependencies.
 *
 * Full performance guards:
 * - DPR capped at 2, canvas bounded at 4096px
 * - low-power GPU context, offscreen pause (IntersectionObserver)
 * - prefers-reduced-motion → renders a single static frame
 * - enabled=false → freeze the current frame (zero GPU work, picture stays)
 * - context-lost handled silently; the context is released with the canvas
 *
 * Ported from the HackerEnglish project's shader-background.tsx (MIT).
 */

export interface ShaderAmbientOptions {
  /** Accent color as a hex string (default: eDEX teal) */
  color?: string;
  /** Grid line count across the viewport (default: 40) */
  gridLines?: number;
  /** Dot-field density scale (default: 150) */
  dotScale?: number;
  /** Overall brightness of the effect — keep it ambient (default: 0.03) */
  intensity?: number;
  /** Edge vignette so content stays readable (default: true) */
  vignette?: boolean;
  /** Follow the mouse with a ripple glow (default: true) */
  mouseInteractive?: boolean;
  /** Called when WebGL is unavailable or shader compilation fails */
  onUnavailable?: () => void;
}

export interface ShaderAmbienceHandle {
  /**
   * true = animation loop; false = freeze the current frame (static picture,
   * zero GPU work). Resuming continues from the frozen timestamp.
   */
  setEnabled(enabled: boolean): void;
  /** Stop everything and detach listeners (the context dies with the canvas). */
  destroy(): void;
}

const VERTEX_SRC = "attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}";

export const FRAGMENT_SRC = [
  "precision highp float;",
  "",
  "uniform vec2  u_resolution;",
  "uniform float u_time;",
  "uniform vec2  u_mouse;",
  "uniform vec3  u_color;",
  "uniform float u_grid_lines;",
  "uniform float u_dot_scale;",
  "uniform float u_intensity;",
  "uniform float u_vignette;",
  "",
  "float rand(vec2 n) {",
  "  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);",
  "}",
  "",
  "void main() {",
  "  vec2 st     = gl_FragCoord.xy / u_resolution.xy;",
  "  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);",
  "  vec2 uv     = st * aspect;",
  "  vec2 mouse  = u_mouse * aspect;",
  "",
  "  float dist = distance(uv, mouse);",
  "  float glow = exp(-dist * 6.0);",
  "",
  "  vec3 c = u_color;",
  "",
  "  // 1) Flickering Grid",
  "  vec2  gridUv        = uv * u_grid_lines;",
  "  float lineThickness = 0.98;",
  "  float gridX         = step(lineThickness, fract(gridUv.x));",
  "  float gridY         = step(lineThickness, fract(gridUv.y));",
  "  float grid          = max(gridX, gridY);",
  "  float flicker       = abs(sin(u_time * 3.0 + uv.y * 10.0)) * 0.5 + 0.1;",
  "  vec3  finalGrid     = c * grid * flicker * 0.15;",
  "",
  "  // 2) Dotted Ripple Field",
  "  vec2  dotUv    = fract(uv * u_dot_scale);",
  "  vec2  cellId   = floor(uv * u_dot_scale);",
  "  float wave     = sin(length(cellId * 0.1 - mouse * u_dot_scale * 0.1) * 2.0 - u_time * 4.0);",
  "  float baseSize = 0.15;",
  "  float dotSize  = baseSize + (wave * 0.08) + (glow * 0.25);",
  "  float circle   = 1.0 - smoothstep(dotSize, dotSize + 0.05, length(dotUv - vec2(0.5)));",
  "  vec3  colorMix = mix(c * 0.2, c * 1.2, wave * 0.5 + 0.5);",
  "  colorMix      += c * glow * 1.5;",
  "  vec3  finalDot = colorMix * circle;",
  "",
  "  // 3) Floating Particles (loop bound must be a literal for some GPU drivers)",
  "  float particleGlow = 0.0;",
  "  for (float i = 0.0; i < 15.0; i++) {",
  "    vec2  pos = vec2(rand(vec2(i, 1.0)), rand(vec2(i, 2.0)));",
  "    pos.y    += fract(u_time * 0.05 * (rand(vec2(i, 3.0)) + 0.5));",
  "    pos.y     = fract(pos.y);",
  "    pos.x    += sin(u_time * 0.5 + i) * 0.02;",
  "    pos      *= aspect;",
  "    float pDist = distance(uv, pos);",
  "    float pSize = 0.005 + rand(vec2(i, 4.0)) * 0.01;",
  "    particleGlow += smoothstep(pSize, 0.0, pDist) * (0.5 + sin(u_time * 2.0 + i) * 0.5);",
  "  }",
  "  vec3 finalParticles = c * particleGlow * 1.5;",
  "",
  "  // 4) Composite + Vignette",
  "  vec3 composite = (finalGrid + finalDot + finalParticles) * u_intensity;",
  "",
  "  float vig = smoothstep(0.0, 0.2, st.x) * smoothstep(1.0, 0.8, st.x) *",
  "              smoothstep(0.0, 0.2, st.y) * smoothstep(1.0, 0.6, st.y);",
  "  float edgeFade = mix(1.0, vig, u_vignette);",
  "",
  "  gl_FragColor = vec4(",
  "    composite * edgeFade,",
  "    (composite.r + composite.g + composite.b) * 0.5",
  "  );",
  "}",
].join("\n");

function hexToRgb(hex: string): [number, number, number] {
  const t = hex.trim().replace("#", "");
  if (t.length !== 6) return [1, 1, 1];
  const n = parseInt(t, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Attach the ambience to a canvas. Returns null when WebGL is unavailable
 * (the caller decides what to fall back to).
 */
export function createShaderAmbience(
  canvas: HTMLCanvasElement,
  options: ShaderAmbientOptions = {},
): ShaderAmbienceHandle | null {
  if (typeof window === "undefined") return null;

  const cfg = {
    color: options.color ?? "#66d9e0",
    gridLines: options.gridLines ?? 40,
    dotScale: options.dotScale ?? 150,
    intensity: options.intensity ?? 0.03,
    vignette: options.vignette ?? true,
    mouseInteractive: options.mouseInteractive ?? true,
  };

  const gl =
    canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "low-power",
      // Static-frame mode draws only one frame; if the buffer gets reclaimed
      // by the compositor the picture would turn black without this flag.
      preserveDrawingBuffer: true,
    }) || canvas.getContext("experimental-webgl");
  if (!gl) {
    options.onUnavailable?.();
    return null;
  }
  const glCtx = gl as WebGLRenderingContext;

  function compile(type: number, src: string) {
    const shader = glCtx.createShader(type);
    if (!shader) return null;
    glCtx.shaderSource(shader, src);
    glCtx.compileShader(shader);
    if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
      glCtx.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compile(glCtx.VERTEX_SHADER, VERTEX_SRC);
  const fs = compile(glCtx.FRAGMENT_SHADER, FRAGMENT_SRC);
  if (!vs || !fs) {
    options.onUnavailable?.();
    return null;
  }
  const program = glCtx.createProgram();
  if (!program) {
    options.onUnavailable?.();
    return null;
  }
  glCtx.attachShader(program, vs);
  glCtx.attachShader(program, fs);
  glCtx.linkProgram(program);
  if (!glCtx.getProgramParameter(program, glCtx.LINK_STATUS)) {
    options.onUnavailable?.();
    return null;
  }
  glCtx.useProgram(program);

  const buffer = glCtx.createBuffer();
  glCtx.bindBuffer(glCtx.ARRAY_BUFFER, buffer);
  glCtx.bufferData(
    glCtx.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    glCtx.STATIC_DRAW,
  );

  const posLoc = glCtx.getAttribLocation(program, "position");
  const uResolution = glCtx.getUniformLocation(program, "u_resolution");
  const uTime = glCtx.getUniformLocation(program, "u_time");
  const uMouse = glCtx.getUniformLocation(program, "u_mouse");
  const uColor = glCtx.getUniformLocation(program, "u_color");
  const uGridLines = glCtx.getUniformLocation(program, "u_grid_lines");
  const uDotScale = glCtx.getUniformLocation(program, "u_dot_scale");
  const uIntensity = glCtx.getUniformLocation(program, "u_intensity");
  const uVignette = glCtx.getUniformLocation(program, "u_vignette");

  glCtx.enableVertexAttribArray(posLoc);
  glCtx.vertexAttribPointer(posLoc, 2, glCtx.FLOAT, false, 0, 0);

  let bw = 0;
  let bh = 0;
  // Returns whether the size changed. Redrawing the static frame is NOT done
  // here — render depends on `curX`/`frameStart` declared below (TDZ), so it
  // can only be called from async callbacks.
  function updateSize(): boolean {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.min(4096, Math.max(1, Math.floor(rect.width * dpr)));
    const h = Math.min(4096, Math.max(1, Math.floor(rect.height * dpr)));
    if (w === bw && h === bh) return false;
    bw = w;
    bh = h;
    canvas.width = w;
    canvas.height = h;
    glCtx.viewport(0, 0, w, h);
    return true;
  }

  let enabled = true;
  // Resizing clears the drawing buffer: when frozen (static-frame mode) repaint
  // one frame to avoid a black canvas. Async callback — no TDZ risk by then.
  function onResize() {
    if (updateSize() && !enabled) render(performance.now());
  }
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", onResize);
  }
  updateSize();

  let curX = 0.5;
  let curY = 0.5;
  let tgtX = 0.5;
  let tgtY = 0.5;
  function onMouseMove(e: MouseEvent) {
    if (!cfg.mouseInteractive) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(rect.width, 1);
    const y = 1 - (e.clientY - rect.top) / Math.max(rect.height, 1);
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      tgtX = x;
      tgtY = y;
    } else {
      tgtX = 0.5;
      tgtY = 0.5;
    }
  }
  window.addEventListener("mousemove", onMouseMove, { passive: true });

  const reducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let isVisible = true;
  let io: IntersectionObserver | null = null;
  let rafId = 0;
  let frameStart = performance.now();
  let animTime = 0;
  const rgb = hexToRgb(cfg.color);

  function render(now: number) {
    animTime = now - frameStart;
    curX += 0.05 * (tgtX - curX);
    curY += 0.05 * (tgtY - curY);
    glCtx.uniform2f(uResolution, bw, bh);
    glCtx.uniform1f(uTime, animTime / 1000);
    glCtx.uniform2f(uMouse, curX, curY);
    glCtx.uniform3f(uColor, rgb[0], rgb[1], rgb[2]);
    glCtx.uniform1f(uGridLines, cfg.gridLines);
    glCtx.uniform1f(uDotScale, cfg.dotScale);
    glCtx.uniform1f(uIntensity, cfg.intensity);
    glCtx.uniform1f(uVignette, cfg.vignette ? 1 : 0);
    glCtx.clearColor(0, 0, 0, 0);
    glCtx.clear(glCtx.COLOR_BUFFER_BIT);
    glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4);
  }

  function frame(t: number) {
    render(t);
    if (isVisible && !reducedMotion) {
      rafId = requestAnimationFrame(frame);
    }
  }

  // enabled=false freezes the frame at the current animation time (zero GPU
  // work, picture retained); true resumes in place from the frozen timestamp.
  function applyEnabled() {
    if (enabled) {
      frameStart = performance.now() - animTime;
      cancelAnimationFrame(rafId);
      if (isVisible && !reducedMotion) rafId = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(rafId);
      render(performance.now());
    }
  }

  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver(
      (entries) => {
        isVisible = entries.some((e) => e.isIntersecting);
        if (!isVisible) return;
        if (enabled && !reducedMotion) {
          frameStart = performance.now() - animTime;
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(frame);
        } else if (!enabled) {
          // Static-frame fallback: the buffer may be reclaimed by the GPU,
          // repaint once when re-entering the viewport (cost is negligible).
          render(performance.now());
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);
  }

  function onContextLost(e: Event) {
    e.preventDefault();
    cancelAnimationFrame(rafId);
  }
  canvas.addEventListener("webglcontextlost", onContextLost);

  return {
    setEnabled(next: boolean) {
      enabled = next;
      applyEnabled();
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      resizeObserver?.disconnect();
      io?.disconnect();
      // Do NOT call WEBGL_lose_context.loseContext(): under React StrictMode
      // double-invoked effects the second mount would receive a lost context
      // and the whole background would silently fail. The context is reclaimed
      // naturally with the canvas element.
    },
  };
}
