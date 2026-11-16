import assert from "node:assert/strict";
import test from "node:test";
import { sessionCookieOptions } from "../src/lib/auth";

test("remembered sessions persist for 30 days and allow top-level links", () => {
  const options = sessionCookieOptions(true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.maxAge, 30 * 86_400);
  assert.ok(options.expires instanceof Date);
});

test("unchecked remember-me creates a browser-session cookie", () => {
  const options = sessionCookieOptions(false);
  assert.equal(options.sameSite, "lax");
  assert.equal("maxAge" in options, false);
  assert.equal("expires" in options, false);
});
