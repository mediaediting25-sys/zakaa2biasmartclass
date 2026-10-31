import { describe, expect, it } from "vitest";
import { installPlatform } from "./install-platform";

describe("mobile install support", () => {
  it("recognizes Android browsers", () => {
    expect(installPlatform("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36", 5).mobile).toBe(true);
  });
  it("recognizes iPhones", () => {
    expect(installPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1", 5).ios).toBe(true);
  });
  it("recognizes iPad desktop mode", () => {
    expect(installPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1", 5).ios).toBe(true);
  });
  it("does not automatically prompt desktop visitors", () => {
    expect(installPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1", 0).mobile).toBe(false);
  });
  it("recognizes in-app browsers requiring an external browser", () => {
    expect(installPlatform("Mozilla/5.0 (Linux; Android 14; wv) Mobile Instagram", 5).embedded).toBe(true);
  });
});