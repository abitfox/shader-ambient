/**
 * Persisted FX preference hook (port of HackerEnglish lib/fx.ts).
 *
 * - Minimal pub/sub synced across components via useSyncExternalStore
 * - Persisted to localStorage ("shader-ambient.fx"); storage failures (private
 *   mode) degrade to session-only
 * - Platform-aware default: desktop on, touch/mobile off (a static frame saves
 *   GPU/battery on devices that likely can't keep up) — once the user toggles
 *   manually, their choice wins over the platform default
 */

import { useSyncExternalStore } from "react";

const KEY = "shader-ambient.fx";

let on = true;
let hydrated = false;
const listeners = new Set<() => void>();

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    /* private mode: fall back to the platform default */
  }
  if (stored !== null) {
    on = stored !== "0";
  } else {
    on = !isTouchDevice();
  }
}

function notify() {
  for (const l of Array.from(listeners)) l();
}

export function subscribeFxPreference(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function isFxOn(): boolean {
  ensureHydrated();
  return on;
}

/** User-facing toggle: flips the preference and persists it. */
export function requestFx(v: boolean): void {
  ensureHydrated();
  if (on === v) return;
  on = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* session-only */
  }
  notify();
}

/** React hook: current preference (synced across components). */
export function useFxPreference(): boolean {
  return useSyncExternalStore(subscribeFxPreference, isFxOn, () => true);
}
