/**
 * Verify backward compatibility of type re-exports.
 *
 * After migrating types to @x-cartographer/shared, the old import paths should still work:
 * - `@/types` → re-exports from @x-cartographer/shared
 *
 * This ensures existing code using old import paths doesn't break.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Static verification of re-export files
// ---------------------------------------------------------------------------

const typesIndexPath = resolve(__dirname, '../../apps/web/src/types/index.ts');
const typesIndexContent = readFileSync(typesIndexPath, 'utf-8');

const projectReexportPath = resolve(__dirname, '../../apps/web/src/types/project.ts');
const projectReexportContent = readFileSync(projectReexportPath, 'utf-8');

describe('Backward compatibility — @/types re-export', () => {
  test('@/types/index.ts exists and re-exports from @x-cartographer/shared', () => {
    expect(typesIndexContent).toContain("export * from '@x-cartographer/shared'");
  });

  test('@/types/index.ts has migration comment', () => {
    expect(typesIndexContent).toContain('@x-cartographer/shared');
    expect(typesIndexContent).toContain('向后兼容'); // "backward compatibility"
  });

  test('@/types/project.ts exists and re-exports from @x-cartographer/shared', () => {
    expect(projectReexportContent).toContain("export * from '@x-cartographer/shared'");
  });
});

// ---------------------------------------------------------------------------
// Runtime import verification — old paths should resolve correctly
// ---------------------------------------------------------------------------

const typesPath = resolve(__dirname, '../../apps/web/src/types/index.ts');
const sharedPath = resolve(__dirname, '../../packages/shared/src/index.ts');

describe('Backward compatibility — runtime module resolution', () => {
  test('@/types resolves and exports core types', async () => {
    // This verifies the path alias @/types resolves to the re-export file
    // and that it successfully re-exports from @x-cartographer/shared
    const types = await import(typesPath);
    expect(types).toBeDefined();
    // Should have runtime exports (enums, constants)
    expect(types.TaskStatus).toBeDefined();
    expect(types.TaskType).toBeDefined();
    expect(types.Priority).toBeDefined();
  });

  test('@/types/project.ts re-export does not cause duplicate exports', async () => {
    // Verify the standalone project.ts re-export works
    const projectReexportPath = resolve(__dirname, '../../apps/web/src/types/project.ts');
    const projectTypes = await import(projectReexportPath);
    expect(projectTypes).toBeDefined();
    expect(projectTypes.TaskStatus).toBeDefined(); // inherited from @x-cartographer/shared
  });
});

// ---------------------------------------------------------------------------
// Property: Re-export completeness — all shared types accessible via old paths
// ---------------------------------------------------------------------------

describe('Property: Re-export parity — @/types exposes same as @x-cartographer/shared', () => {
  test('both modules load without error', async () => {
    const shared = await import(sharedPath);
    const local = await import(typesPath);
    // Both should be objects with the same runtime keys
    expect(typeof shared).toBe('object');
    expect(typeof local).toBe('object');
  });

  test('runtime exports from @/types match @x-cartographer/shared', async () => {
    const shared = await import(sharedPath);
    const local = await import(typesPath);

    // Compare runtime-visible exports (enums, values)
    const sharedKeys = Object.keys(shared).sort();
    const localKeys = Object.keys(local).sort();

    expect(localKeys).toEqual(sharedKeys);
  });
});

// ---------------------------------------------------------------------------
// Adversarial: Import path variations used in the codebase
// ---------------------------------------------------------------------------

describe('Adversarial — import pattern coverage', () => {
  test('task-detail-sheet.tsx uses @/types for Task import', () => {
    const sheetPath = resolve(
      __dirname,
      '../../apps/web/src/features/tasks/components/task-detail-sheet.tsx'
    );
    const content = readFileSync(sheetPath, 'utf-8');
    expect(content).toContain("import type { Task, TaskStatus } from '@/types'");
  });
});
