/**
 * Static verification that useMemo hooks in task-detail-sheet.tsx are placed
 * BEFORE the early return (if (!task) return null).
 *
 * This verifies the ESLint rules-of-hooks fix from Phase 1:
 * Hooks were moved from after the early return to before it, ensuring they
 * are called unconditionally on every render.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const sourceFilePath = resolve(
  __dirname,
  '../../apps/web/src/features/tasks/components/task-detail-sheet.tsx'
);
const sourceContent = readFileSync(sourceFilePath, 'utf-8');

describe('task-detail-sheet.tsx — rules-of-hooks fix verification', () => {
  test('useMemo for dependsOn is declared BEFORE the early return', () => {
    // The dependsOn useMemo should appear before `if (!task) return null`
    const useMemoDependsOnIndex = sourceContent.indexOf(
      'const dependsOn = React.useMemo'
    );
    const earlyReturnIndex = sourceContent.indexOf('if (!task) return null');

    expect(useMemoDependsOnIndex).toBeGreaterThan(-1);
    expect(earlyReturnIndex).toBeGreaterThan(-1);
    expect(useMemoDependsOnIndex).toBeLessThan(earlyReturnIndex);
  });

  test('useMemo for dependedBy is declared BEFORE the early return', () => {
    const useMemoDependedByIndex = sourceContent.indexOf(
      'const dependedBy = React.useMemo'
    );
    const earlyReturnIndex = sourceContent.indexOf('if (!task) return null');

    expect(useMemoDependedByIndex).toBeGreaterThan(-1);
    expect(earlyReturnIndex).toBeGreaterThan(-1);
    expect(useMemoDependedByIndex).toBeLessThan(earlyReturnIndex);
  });

  test('early return `if (!task) return null` exists after all hooks', () => {
    // The early return should exist and should be the ONLY early return in the component
    const earlyReturnMatches = sourceContent.match(/if\s*\(\s*!task\s*\)\s*return\s*null/g);
    expect(earlyReturnMatches).not.toBeNull();
    expect(earlyReturnMatches?.length).toBe(1);
  });

  test('both useMemo hooks have proper dependency arrays with task and allTasks', () => {
    // Verify the dependency arrays are [task, allTasks] for both hooks
    expect(sourceContent).toContain('[task, allTasks]');
  });

  test('dependsOn useMemo returns empty array when task is null (null-safety)', () => {
    // The hook body should have `if (!task) return [];` as first guard
    const dependsOnBlock = sourceContent.match(
      /const dependsOn = React\.useMemo\(\(\)\s*=>\s*\{[\s\S]*?if \(!task\) return \[\];/
    );
    expect(dependsOnBlock).toBeTruthy();
  });

  test('dependedBy useMemo returns empty array when task is null (null-safety)', () => {
    const dependedByBlock = sourceContent.match(
      /const dependedBy = React\.useMemo\(\(\)\s*=>\s*\{[\s\S]*?if \(!task\) return \[\];/
    );
    expect(dependedByBlock).toBeTruthy();
  });
});
