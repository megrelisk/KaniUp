import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({}));
vi.mock("./mail", () => ({}));
vi.mock("./push", () => ({}));
vi.mock("./sms", () => ({}));

const { ergative } = await import("./notify");

describe("ergative", () => {
  it("adds the right Georgian ending", () => {
    expect(ergative("ნიკა")).toBe("ნიკამ");
    expect(ergative("გიორგი")).toBe("გიორგიმ");
    expect(ergative("ლევან")).toBe("ლევანმა");
    expect(ergative("Admin")).toBe("Admin-მა");
  });
});
