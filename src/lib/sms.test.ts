import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { normalizePhone } = await import("./sms");

describe("normalizePhone", () => {
  it("normalizes Georgian mobile numbers", () => {
    expect(normalizePhone("+995 555 12 34 56")).toBe("995555123456");
    expect(normalizePhone("555123456")).toBe("995555123456");
    expect(normalizePhone("00995555123456")).toBe("995555123456");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});
