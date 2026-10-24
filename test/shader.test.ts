import { describe, expect, it } from "vitest";
import { FRAGMENT_SRC_TESTABLE } from "./helpers";

describe("shader source sanity", () => {
  it("keeps the particle loop bound as a literal (GPU driver requirement)", () => {
    expect(FRAGMENT_SRC_TESTABLE).toMatch(/for \(float i = 0\.0; i < \d+\.0; i\+\+\)/);
  });

  it("declares every uniform it uses", () => {
    const uniforms = [...FRAGMENT_SRC_TESTABLE.matchAll(/uniform\s+\w+\s+(u_\w+)/g)].map((m) => m[1]);
    for (const u of uniforms) {
      expect(FRAGMENT_SRC_TESTABLE).toContain(u);
    }
  });

  it("colors the fragment from composite * edgeFade", () => {
    expect(FRAGMENT_SRC_TESTABLE).toContain("gl_FragColor");
    expect(FRAGMENT_SRC_TESTABLE).toContain("composite * edgeFade");
  });
});
