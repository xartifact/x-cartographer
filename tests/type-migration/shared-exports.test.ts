/**
 * Verify that @xpm/shared index.ts exports all expected types.
 *
 * These are the core types migrated to packages/shared in Phase 2.
 * Tests use static analysis + compile-time import checks.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Static verification of packages/shared/src/index.ts
// ---------------------------------------------------------------------------

const indexFilePath = resolve(
  __dirname,
  '../../packages/shared/src/index.ts'
);
const indexContent = readFileSync(indexFilePath, 'utf-8');

describe('@xpm/shared index — export declarations', () => {
  test('exports from types/common', () => {
    expect(indexContent).toContain("export * from './types/common'");
  });

  test('exports from types/task', () => {
    expect(indexContent).toContain("export * from './types/task'");
  });

  test('exports from types/user-story', () => {
    expect(indexContent).toContain("export * from './types/user-story'");
  });

  test('exports from types/user-journey', () => {
    expect(indexContent).toContain("export * from './types/user-journey'");
  });

  test('exports from types/project', () => {
    expect(indexContent).toContain("export * from './types/project'");
  });

  test('exports from types/toml', () => {
    expect(indexContent).toContain("export * from './types/toml'");
  });
});

// ---------------------------------------------------------------------------
// Static verification of individual type files exist and export expected types
// ---------------------------------------------------------------------------

const typesDir = resolve(__dirname, '../../packages/shared/src/types');

describe('@xpm/shared types — file existence and key exports', () => {
  test('common.ts exports Priority, TaskPriority, TaskType, TaskStatus enums', () => {
    const content = readFileSync(resolve(typesDir, 'common.ts'), 'utf-8');
    expect(content).toContain('export enum Priority');
    expect(content).toContain('export enum TaskPriority');
    expect(content).toContain('export enum TaskType');
    expect(content).toContain('export enum TaskStatus');
    expect(content).toContain('export enum LLMProvider');
    expect(content).toContain('export interface Position');
    expect(content).toContain('export type StoryStatus');
    expect(content).toContain('export type Timestamp');
  });

  test('task.ts exports Task interface and DTOs', () => {
    const content = readFileSync(resolve(typesDir, 'task.ts'), 'utf-8');
    expect(content).toContain('export interface Task');
    expect(content).toContain('export interface CreateTaskDTO');
    expect(content).toContain('export interface UpdateTaskDTO');
  });

  test('project.ts exports Project interface and DTOs', () => {
    const content = readFileSync(resolve(typesDir, 'project.ts'), 'utf-8');
    expect(content).toContain('export interface Project');
    expect(content).toContain('export interface ProjectMetadata');
    expect(content).toContain('export interface ProjectSettings');
    expect(content).toContain('export interface DisplayPreferences');
    expect(content).toContain('export interface CreateProjectDTO');
    expect(content).toContain('export interface UpdateProjectDTO');
  });

  test('toml.ts exports TomlParsed* and Toml* types', () => {
    const content = readFileSync(resolve(typesDir, 'toml.ts'), 'utf-8');
    // TomlParsed* types (parsed/normalized format)
    expect(content).toContain('export interface TomlParsedAcceptanceCriterion');
    expect(content).toContain('export type TomlPriority');
    expect(content).toContain('export interface TomlParsedUserStory');
    expect(content).toContain('export interface TomlParsedUserJourney');
    expect(content).toContain('export interface TomlParsedProject');
    expect(content).toContain('export type Tag');
    expect(content).toContain('export interface ProjectFormData');
    // Toml* types (original TOML format)
    expect(content).toContain('export type TomlAcceptanceCriterion');
    expect(content).toContain('export interface TomlUserStory');
    expect(content).toContain('export interface TomlUserJourney');
    expect(content).toContain('export interface TomlProjectMetadata');
    expect(content).toContain('export interface TomlStoryMap');
  });

  test('user-story.ts exports UserStory interface', () => {
    const content = readFileSync(resolve(typesDir, 'user-story.ts'), 'utf-8');
    expect(content).toContain('export interface UserStory');
  });

  test('user-journey.ts exports UserJourney interface', () => {
    const content = readFileSync(resolve(typesDir, 'user-journey.ts'), 'utf-8');
    expect(content).toContain('export interface UserJourney');
  });
});

// ---------------------------------------------------------------------------
// Runtime import verification (compile-time check via bun)
// ---------------------------------------------------------------------------

const sharedIndexPath = resolve(__dirname, '../../packages/shared/src/index.ts');

describe('@xpm/shared — runtime import accessibility', () => {
  test('can import core enums from packages/shared', async () => {
    const shared = await import(sharedIndexPath);
    expect(shared.Priority).toBeDefined();
    expect(shared.TaskPriority).toBeDefined();
    expect(shared.TaskType).toBeDefined();
    expect(shared.TaskStatus).toBeDefined();
  });

  test('can import Task interface shape', async () => {
    // TypeScript interfaces are erased at runtime, but we can verify the module loads
    const shared = await import(sharedIndexPath);
    // The module should load without error
    expect(shared).toBeDefined();
  });

  test('can import Project interface shape', async () => {
    const shared = await import(sharedIndexPath);
    expect(shared).toBeDefined();
  });

  test('can import TomlParsedProject type', async () => {
    const shared = await import(sharedIndexPath);
    // TomlParsedProject is a type (erased at runtime), but module load confirms accessibility
    expect(shared.TomlParsedUserStory).toBeUndefined(); // type, not value
    expect(shared).toBeDefined();
  });

  test('can import TomlParsedProject via named type export', async () => {
    // Verify the module doesn't throw when accessing the exports object
    const shared = await import(sharedIndexPath);
    const keys = Object.keys(shared);
    // Should have enums and constants (runtime values), not types
    expect(keys.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Property: No circular dependencies in type files
// ---------------------------------------------------------------------------

describe('@xpm/shared — no circular import issues', () => {
  test('index.ts does not contain circular patterns', () => {
    // Simple check: no self-referencing imports
    expect(indexContent).not.toContain("from './index'");
  });

  test('project.ts imports from common and user-journey (valid chain)', () => {
    const content = readFileSync(resolve(typesDir, 'project.ts'), 'utf-8');
    expect(content).toContain("from './common'");
    expect(content).toContain("from './user-journey'");
    // Should NOT import from toml.ts (separate domain)
    expect(content).not.toContain("from './toml'");
  });

  test('task.ts imports from common only', () => {
    const content = readFileSync(resolve(typesDir, 'task.ts'), 'utf-8');
    expect(content).toContain("from './common'");
    // Should NOT import from project.ts or toml.ts
    expect(content).not.toContain("from './project'");
    expect(content).not.toContain("from './toml'");
  });
});
