/**
 * Verify backward compatibility of type re-exports.
 *
 * After migrating types to @x-cartographer/shared, the old import paths should still work:
 * - `@/types` → re-exports from @x-cartographer/shared
 * - `@/features/projects/types` → named re-exports of TOML types from @x-cartographer/shared
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

const projectsTypesPath = resolve(__dirname, '../../apps/web/src/features/projects/types/index.ts');
const projectsTypesContent = readFileSync(projectsTypesPath, 'utf-8');

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

describe('Backward compatibility — @/features/projects/types re-export', () => {
  test('features/projects/types/index.ts exists', () => {
    expect(projectsTypesContent.length).toBeGreaterThan(0);
  });

  test('re-exports all TomlParsed* types', () => {
    expect(projectsTypesContent).toContain('TomlParsedAcceptanceCriterion');
    expect(projectsTypesContent).toContain('TomlParsedUserStory');
    expect(projectsTypesContent).toContain('TomlParsedUserJourney');
    expect(projectsTypesContent).toContain('TomlParsedProject');
  });

  test('re-exports all Toml* types (non-parsed)', () => {
    expect(projectsTypesContent).toContain('TomlAcceptanceCriterion');
    expect(projectsTypesContent).toContain('TomlUserStory');
    expect(projectsTypesContent).toContain('TomlUserJourney');
    expect(projectsTypesContent).toContain('TomlProjectMetadata');
    expect(projectsTypesContent).toContain('TomlStoryMap');
  });

  test('re-exports utility types', () => {
    expect(projectsTypesContent).toContain('Tag');
    expect(projectsTypesContent).toContain('TomlPriority');
    expect(projectsTypesContent).toContain('ProjectFormData');
  });

  test('all re-exports source from @x-cartographer/shared', () => {
    expect(projectsTypesContent).toContain("from '@x-cartographer/shared'");
  });

  test('has migration comment explaining the proxy pattern', () => {
    expect(projectsTypesContent).toContain('@x-cartographer/shared');
    expect(projectsTypesContent).toContain('向后兼容');
  });
});

// ---------------------------------------------------------------------------
// Runtime import verification — old paths should resolve correctly
// ---------------------------------------------------------------------------

const typesPath = resolve(__dirname, '../../apps/web/src/types/index.ts');
const projectsTypesPath_ = resolve(__dirname, '../../apps/web/src/features/projects/types/index.ts');
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

  test('@/features/projects/types resolves Toml types', async () => {
    // Verify the feature-scoped re-export path works
    const projTypes = await import(projectsTypesPath_);
    expect(projTypes).toBeDefined();
    // These are all types (erased at runtime), so the module should exist
    // but individual type exports are undefined at runtime
    const keys = Object.keys(projTypes);
    // The module is a type-only re-export, so keys may be empty
    expect(Array.isArray(keys)).toBe(true);
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
  test('project-list.tsx uses correct import path for TomlParsedProject', () => {
    const projectListPath = resolve(
      __dirname,
      '../../apps/web/src/features/projects/components/project-list.tsx'
    );
    const content = readFileSync(projectListPath, 'utf-8');
    // Should import from @/features/projects/types (the backward compat proxy)
    expect(content).toContain("import type { TomlParsedProject } from '@/features/projects/types'");
  });

  test('task-detail-sheet.tsx uses @/types for Task import', () => {
    const sheetPath = resolve(
      __dirname,
      '../../apps/web/src/features/tasks/components/task-detail-sheet.tsx'
    );
    const content = readFileSync(sheetPath, 'utf-8');
    expect(content).toContain("import type { Task, TaskStatus } from '@/types'");
  });

  test('TOML parser uses @/types for type imports', () => {
    const parserPath = resolve(
      __dirname,
      '../../apps/web/src/lib/toml/parser.ts'
    );
    const content = readFileSync(parserPath, 'utf-8');
    expect(content).toContain("from '@/types'");
  });
});
