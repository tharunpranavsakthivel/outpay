/**
 * Bun runtime-specific ambient types used by standalone worker entrypoints and
 * the existing Bun-native test import compatibility layer.
 */

interface ImportMeta {
  main?: boolean;
}

/**
 * Provides TypeScript declarations for the `bun:test` imports that Vitest
 * resolves to `test/bun-test-compat.ts` at runtime.
 */
declare module "bun:test" {
  export * from "vitest";
  type BunTestMock = {
    <T extends (...args: never[]) => unknown>(implementation?: T): {
      (...args: Parameters<T>): ReturnType<T>;
      mock: {
        calls: unknown[][];
      };
    };
    module: typeof import("vitest").vi.doMock;
  };

  export const mock: BunTestMock;
}
