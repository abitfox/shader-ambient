// src/core/shader-ambient.ts
var VERTEX_SRC = "attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}";
var FRAGMENT_SRC = [
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
  "}"
].join("\n");
function hexToRgb(hex) {
  const t = hex.trim().replace("#", "");
  if (t.length !== 6) return [1, 1, 1];
  const n = parseInt(t, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function createShaderAmbience(canvas, options = {}) {
  if (typeof window === "undefined") return null;
  const cfg = {
    color: options.color ?? "#66d9e0",
    gridLines: options.gridLines ?? 40,
    dotScale: options.dotScale ?? 150,
    intensity: options.intensity ?? 0.03,
    vignette: options.vignette ?? true,
    mouseInteractive: options.mouseInteractive ?? true
  };
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: "low-power",
    // Static-frame mode draws only one frame; if the buffer gets reclaimed
    // by the compositor the picture would turn black without this flag.
    preserveDrawingBuffer: true
  }) || canvas.getContext("experimental-webgl");
  if (!gl) {
    options.onUnavailable?.();
    return null;
  }
  const glCtx = gl;
  function compile(type, src) {
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
    glCtx.STATIC_DRAW
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
  function updateSize() {
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
  function onResize() {
    if (updateSize() && !enabled) render(performance.now());
  }
  let resizeObserver = null;
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
  function onMouseMove(e) {
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
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let isVisible = true;
  let io = null;
  let rafId = 0;
  let frameStart = performance.now();
  let animTime = 0;
  const rgb = hexToRgb(cfg.color);
  function render(now) {
    animTime = now - frameStart;
    curX += 0.05 * (tgtX - curX);
    curY += 0.05 * (tgtY - curY);
    glCtx.uniform2f(uResolution, bw, bh);
    glCtx.uniform1f(uTime, animTime / 1e3);
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
  function frame(t) {
    render(t);
    if (isVisible && !reducedMotion) {
      rafId = requestAnimationFrame(frame);
    }
  }
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
          render(performance.now());
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);
  }
  function onContextLost(e) {
    e.preventDefault();
    cancelAnimationFrame(rafId);
  }
  canvas.addEventListener("webglcontextlost", onContextLost);
  return {
    setEnabled(next) {
      enabled = next;
      applyEnabled();
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      resizeObserver?.disconnect();
      io?.disconnect();
    }
  };
}
export {
  createShaderAmbience
};
//# sourceMappingURL=core.js.map