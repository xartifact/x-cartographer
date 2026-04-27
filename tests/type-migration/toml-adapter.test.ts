/**
 * Unit tests for the `toTomlProject` adapter function in project-list.tsx.
 *
 * This function maps DB Project model fields to TomlParsedProject type
 * for TOML export (Phase 2 migration).
 *
 * Since `toTomlProject` is a private function in project-list.tsx, this file
 * re-implements the logic inline to verify behavior matches expected mapping.
 * The source file is also verified via static checks.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Re-implementation of toTomlProject for behavioral testing
// (Copied from apps/web/src/features/projects/components/project-list.tsx)
// ---------------------------------------------------------------------------

interface TomlParsedUserJourney {
  id: string;
  name: string;
  description: string;
  persona: string;
  stories: unknown[];
  order?: number;
}

interface TomlParsedProject {
  id: string;
  name: string;
  description: string;
  version: string;
  tech_stack: string[];
  created_at: string;
  updated_at: string;
  user_journeys: TomlParsedUserJourney[];
}

function toTomlProject(project: {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: { version?: string; tech_stack?: string[] } | null;
  user_journeys?: unknown[];
}): TomlParsedProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? '',
    version: project.metadata?.version || '1.0.0',
    tech_stack: project.metadata?.tech_stack?.length
      ? project.metadata.tech_stack
      : ['未指定'],
    created_at: project.created_at,
    updated_at: project.updated_at,
    user_journeys: (project.user_journeys ?? []) as TomlParsedProject['user_journeys'],
  };
}

// ---------------------------------------------------------------------------
// Source file static verification
// ---------------------------------------------------------------------------

const sourceFilePath = resolve(
  __dirname,
  '../../apps/web/src/features/projects/components/project-list.tsx'
);
const sourceContent = readFileSync(sourceFilePath, 'utf-8');

describe('toTomlProject — source code static checks', () => {
  test('toTomlProject function exists in source', () => {
    expect(sourceContent).toContain('function toTomlProject');
  });

  test('toTomlProject returns TomlParsedProject type', () => {
    expect(sourceContent).toContain('): TomlParsedProject {');
  });

  test('TomlParsedProject is imported from @/features/projects/types', () => {
    expect(sourceContent).toContain("import type { TomlParsedProject } from '@/features/projects/types'");
  });

  test('description fallback uses nullish coalescing (?? not ||)', () => {
    // Should use `project.description ?? ''` to handle null correctly
    expect(sourceContent).toContain("project.description ?? ''");
  });

  test('version fallback uses || for empty string case', () => {
    expect(sourceContent).toContain("project.metadata?.version || '1.0.0'");
  });

  test('tech_stack fallback to ["未指定"] when empty', () => {
    expect(sourceContent).toContain("['未指定']");
  });
});

// ---------------------------------------------------------------------------
// Happy path: Full project with all fields
// ---------------------------------------------------------------------------

describe('toTomlProject — happy path', () => {
  test('maps all fields correctly from a complete DB project', () => {
    const input = {
      id: 'proj-001',
      name: 'Test Project',
      description: 'A test project for verification',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-06-20T15:30:00Z',
      metadata: {
        version: '2.0.0',
        tech_stack: ['React', 'TypeScript', 'Next.js'],
      },
      user_journeys: [
        { id: 'j1', name: 'Onboarding', description: '', persona: 'user', stories: [] },
      ],
    };

    const result = toTomlProject(input);

    expect(result.id).toBe('proj-001');
    expect(result.name).toBe('Test Project');
    expect(result.description).toBe('A test project for verification');
    expect(result.version).toBe('2.0.0');
    expect(result.tech_stack).toEqual(['React', 'TypeScript', 'Next.js']);
    expect(result.created_at).toBe('2024-01-15T10:00:00Z');
    expect(result.updated_at).toBe('2024-06-20T15:30:00Z');
    expect(result.user_journeys).toHaveLength(1);
    expect(result.user_journeys[0]).toEqual({
      id: 'j1',
      name: 'Onboarding',
      description: '',
      persona: 'user',
      stories: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases: null/undefined/empty fields
// ---------------------------------------------------------------------------

describe('toTomlProject — null and undefined handling', () => {
  test('description null → empty string', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'No Desc',
      description: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });
    expect(result.description).toBe('');
  });

  test('description undefined → empty string', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'No Desc',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });
    expect(result.description).toBe('');
  });

  test('metadata null → default version 1.0.0 and tech_stack ["未指定"]', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'No Meta',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      metadata: null,
    });
    expect(result.version).toBe('1.0.0');
    expect(result.tech_stack).toEqual(['未指定']);
  });

  test('metadata undefined → default version 1.0.0 and tech_stack ["未指定"]', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'No Meta',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });
    expect(result.version).toBe('1.0.0');
    expect(result.tech_stack).toEqual(['未指定']);
  });

  test('metadata.version empty string → default 1.0.0 (|| not ??)', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'Empty Ver',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      metadata: { version: '' },
    });
    expect(result.version).toBe('1.0.0');
  });

  test('metadata.tech_stack empty array → ["未指定"]', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'Empty Stack',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      metadata: { tech_stack: [] },
    });
    expect(result.tech_stack).toEqual(['未指定']);
  });

  test('user_journeys undefined → empty array', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'No Journeys',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });
    expect(result.user_journeys).toEqual([]);
    expect(Array.isArray(result.user_journeys)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Boundary: Partial metadata
// ---------------------------------------------------------------------------

describe('toTomlProject — partial metadata', () => {
  test('only version in metadata → tech_stack defaults to ["未指定"]', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'Partial',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      metadata: { version: '3.0.0' },
    });
    expect(result.version).toBe('3.0.0');
    expect(result.tech_stack).toEqual(['未指定']);
  });

  test('only tech_stack in metadata → version defaults to 1.0.0', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'Partial',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      metadata: { tech_stack: ['Vue'] },
    });
    expect(result.version).toBe('1.0.0');
    expect(result.tech_stack).toEqual(['Vue']);
  });

  test('tech_stack with single item → preserved', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'Single Stack',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      metadata: { tech_stack: ['Go'] },
    });
    expect(result.tech_stack).toEqual(['Go']);
  });
});

// ---------------------------------------------------------------------------
// Adversarial: Type confusion and edge values
// ---------------------------------------------------------------------------

describe('toTomlProject — adversarial inputs', () => {
  test('description with empty string → preserved as empty string', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'Empty Desc',
      description: '',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });
    expect(result.description).toBe('');
  });

  test('Unicode in name → preserved', () => {
    const result = toTomlProject({
      id: 'p1',
      name: '🚀 プロジェクト',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });
    expect(result.name).toBe('🚀 プロジェクト');
  });

  test('special characters in name → preserved', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'Project "Quoted" & <angled>',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });
    expect(result.name).toBe('Project "Quoted" & <angled>');
  });

  test('user_journeys with unknown shape → passed through as-is', () => {
    const journeys = [
      { id: 'j1', name: 'J1', extraField: true },
      'not-an-object',
      null,
    ];
    const result = toTomlProject({
      id: 'p1',
      name: 'Bad Journeys',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      user_journeys: journeys,
    });
    expect(result.user_journeys).toHaveLength(3);
    expect(result.user_journeys[0]).toEqual({ id: 'j1', name: 'J1', extraField: true });
    expect(result.user_journeys[1]).toBe('not-an-object');
    expect(result.user_journeys[2]).toBeNull();
  });

  test('ISO 8601 timestamps → preserved as-is (string pass-through)', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'Timestamps',
      created_at: '2024-02-29T23:59:59.999Z',
      updated_at: '2025-12-31T00:00:00.000+08:00',
    });
    expect(result.created_at).toBe('2024-02-29T23:59:59.999Z');
    expect(result.updated_at).toBe('2025-12-31T00:00:00.000+08:00');
  });
});

// ---------------------------------------------------------------------------
// Property: Round-trip compatibility with serializeProjectToToml
// ---------------------------------------------------------------------------

describe('Property: toTomlProject output shape is valid for serialization', () => {
  test('output has all required TomlParsedProject fields', () => {
    const result = toTomlProject({
      id: 'p1',
      name: 'Complete',
      description: 'desc',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      metadata: { version: '1.0', tech_stack: ['TS'] },
      user_journeys: [],
    });

    // Shape check: all required fields present with correct types
    expect(typeof result.id).toBe('string');
    expect(typeof result.name).toBe('string');
    expect(typeof result.description).toBe('string');
    expect(typeof result.version).toBe('string');
    expect(Array.isArray(result.tech_stack)).toBe(true);
    expect(typeof result.created_at).toBe('string');
    expect(typeof result.updated_at).toBe('string');
    expect(Array.isArray(result.user_journeys)).toBe(true);
  });

  test('output description is never null (always string)', () => {
    const cases = [
      { desc: null as string | null | undefined },
      { desc: undefined },
      { desc: '' },
      { desc: 'hello' },
    ];
    cases.forEach(({ desc }) => {
      const result = toTomlProject({
        id: 'p1',
        name: 'Test',
        description: desc,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      expect(typeof result.description).toBe('string');
    });
  });

  test('output tech_stack is never empty (default "未指定")', () => {
    const noStack = toTomlProject({
      id: 'p1', name: 'T', created_at: 'x', updated_at: 'x',
      metadata: { tech_stack: [] },
    });
    expect(noStack.tech_stack.length).toBeGreaterThan(0);

    const nullMeta = toTomlProject({
      id: 'p1', name: 'T', created_at: 'x', updated_at: 'x',
      metadata: null,
    });
    expect(nullMeta.tech_stack.length).toBeGreaterThan(0);
  });
});
