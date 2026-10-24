/**
 * ShaderAmbient React entry.
 *
 * `<ShaderAmbience />` renders a fixed, pointer-events-none canvas behind the
 * app (z -10). The `enabled` prop maps to the core's static-frame mode; pair
 * it with `useFxPreference()` for a persisted user toggle.
 */

import { useEffect, useRef } from "react";
import {
  createShaderAmbience,
  type ShaderAmbienceHandle,
  type ShaderAmbientOptions,
} from "../core/shader-ambient";

export interface ShaderAmbienceProps extends ShaderAmbientOptions {
  /**
   * false = freeze the frame (zero GPU work). Persisted toggles via
   * `useFxPreference()` are a natural pair. Default: true.
   */
  enabled?: boolean;
  /** Optional class for the wrapper (defaults to fixed inset-0 -z-10). */
  className?: string;
}

export function ShaderAmbience({
  enabled = true,
  className = "pointer-events-none fixed inset-0 -z-10",
  ...options
}: ShaderAmbienceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<ShaderAmbienceHandle | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    handleRef.current = createShaderAmbience(canvas, optionsRef.current);
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  // No handle = WebGL unavailable; enabling/disabling is a no-op then.
  useEffect(() => {
    handleRef.current?.setEnabled(enabled);
  }, [enabled]);

  return (
    <div aria-hidden className={className}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

export { useFxPreference } from "./fx-preference";
