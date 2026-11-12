import { describe, expect, it } from "vitest";
import { INTERVENTION_TRANSITIONS } from "./Intervention.js";

describe("transitions d'intervention", () => {
  it("autorise les parcours nominaux", () => {
    expect(INTERVENTION_TRANSITIONS.planned).toContain("todo");
    expect(INTERVENTION_TRANSITIONS.todo).toContain("in_progress");
    expect(INTERVENTION_TRANSITIONS.in_progress).toContain("completed");
    expect(INTERVENTION_TRANSITIONS.completed).toEqual([]);
    expect(INTERVENTION_TRANSITIONS.cancelled).toEqual([]);
  });

  it("interdit de terminer depuis planned", () => {
    expect(INTERVENTION_TRANSITIONS.planned).not.toContain("completed");
  });
});
