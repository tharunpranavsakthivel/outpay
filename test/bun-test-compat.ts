/**
 * Compatibility exports for the repository's existing Bun-native test files.
 * Vitest owns execution while this module preserves the small `bun:test`
 * surface already used by the suites, including deferred module mocking.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
} from "vitest";

export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
};

export const mock = Object.assign(vi.fn, { module: vi.doMock });
