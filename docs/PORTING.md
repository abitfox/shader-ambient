# PORTING.md — 20_HackerEnglish → shader-ambient

| 原位置 | 新位置 | 改动 |
|---|---|---|
| `frontend/src/components/shader-background.tsx`（React 组件 + shader 内联） | `src/core/shader-ambient.ts`（`createShaderAmbience(canvas, options)` 工厂） | 组件拆为框架无关核心；`CONFIG` 常量 → `options` 参数；`lib/fx` 的全局开关 → `handle.setEnabled(bool)`（控制权交给调用方）；返回 `null` 表示 WebGL 不可用（新增 `onUnavailable` 回调）；注释中文化→英文；FRAGMENT_SRC 导出供测试 |
| `frontend/src/lib/fx.ts`（localStorage 持久化 + 移动端默认关） | `src/react/fx-preference.ts`（`useFxPreference()` / `requestFx()` / `isFxOn()`） | localStorage key 改为 `shader-ambient.fx`；发布订阅 + useSyncExternalStore 模式原样保留 |
| （新增） | `src/react/index.tsx` | `<ShaderAmbience />` 组件：fixed 定位包装 + enabled prop 映射到定格模式 |
| （新增） | `test/shader.test.ts` | 着色器源码静态检查（粒子循环上限为字面量、uniform 声明完整） |

关键设计保留：

- `preserveDrawingBuffer: true`（定格帧驻留的前提，注释已说明黑屏陷阱）
- 尺寸变化补画静态帧的逻辑放在异步回调（避免 TDZ）
- StrictMode 双挂载下不主动 loseContext（注释已说明）
- 移动端/触屏默认关特效，用户手动开启后记忆选择
