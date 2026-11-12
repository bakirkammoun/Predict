import { describe, expect, it } from "vitest";
import { ALERT_TRANSITIONS } from "./Alert.js";

describe("transitions d'alerte", () => {
  it("permet de reconnaître ou résoudre une alerte nouvelle", () => {
    expect(ALERT_TRANSITIONS.new).toContain("acknowledged");
    expect(ALERT_TRANSITIONS.new).toContain("resolved");
  });

  it("interdit de rouvrir une alerte résolue par simple PATCH", () => {
    expect(ALERT_TRANSITIONS.resolved).toEqual([]);
  });
});
