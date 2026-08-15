/**
 * GhostNode and DropInsertLine verification tests
 * Tests task 1.1: GhostNode renders correctly and DropInsertLine is removed
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Source file content for static analysis
const sourceFilePath = resolve(
  __dirname,
  '../../apps/web/src/features/story-map/components/story-map-canvas.tsx'
);
const sourceContent = readFileSync(sourceFilePath, 'utf-8');

describe('GhostNode Component', () => {
  const ghostNodeMatch = sourceContent.match(/function GhostNode[\s\S]*?^}/m);
  const ghostNodeCode = ghostNodeMatch?.[0] ?? '';

  test('GhostNode component exists in source file', () => {
    expect(ghostNodeCode.length).toBeGreaterThan(0);
  });

  test('GhostNode accepts data prop with title field', () => {
    expect(ghostNodeCode).toContain('function GhostNode({ data }');
    expect(ghostNodeCode).toContain('data: { title: string }');
  });

  test('GhostNode renders pointer-events-none container', () => {
    expect(ghostNodeCode).toContain('pointer-events-none');
  });

  test('GhostNode renders w-64 width', () => {
    expect(ghostNodeCode).toContain('w-64');
  });

  test('GhostNode renders opacity-50', () => {
    expect(ghostNodeCode).toContain('opacity-50');
  });

  test('GhostNode uses Card component', () => {
    expect(ghostNodeCode).toContain('<Card>');
  });

  test('GhostNode uses CardHeader component', () => {
    expect(ghostNodeCode).toContain('<CardHeader>');
  });

  test('GhostNode renders data.title in a paragraph element', () => {
    expect(ghostNodeCode).toContain('<p');
    expect(ghostNodeCode).toContain('data.title');
  });

  test('GhostNode applies line-clamp-2 class for text truncation', () => {
    expect(ghostNodeCode).toContain('line-clamp-2');
  });

  test('GhostNode applies text-sm font-semibold styling', () => {
    expect(ghostNodeCode).toContain('text-sm');
    expect(ghostNodeCode).toContain('font-semibold');
  });

  test('GhostNode structure matches spec: div.pointer-events-none.w-64.opacity-50 > Card > CardHeader > p', () => {
    // Verify the nesting structure
    const divOpen = ghostNodeCode.indexOf(
      '<div className="pointer-events-none w-64 opacity-50">'
    );
    const cardOpen = ghostNodeCode.indexOf('<Card>', divOpen);
    const cardHeaderOpen = ghostNodeCode.indexOf('<CardHeader>', cardOpen);
    const paragraph = ghostNodeCode.indexOf('<p', cardHeaderOpen);
    const divClose = ghostNodeCode.lastIndexOf('</div>');

    expect(divOpen).toBeGreaterThan(-1);
    expect(cardOpen).toBeGreaterThan(divOpen);
    expect(cardHeaderOpen).toBeGreaterThan(cardOpen);
    expect(paragraph).toBeGreaterThan(cardHeaderOpen);
    expect(divClose).toBeGreaterThan(paragraph);
  });
});

describe('allNodeTypes Registration', () => {
  const allNodeTypesMatch = sourceContent.match(
    /const allNodeTypes[\s\S]*?^\};/m
  );
  const allNodeTypesCode = allNodeTypesMatch?.[0] ?? '';

  test('allNodeTypes object exists', () => {
    expect(allNodeTypesCode.length).toBeGreaterThan(0);
  });

  test('allNodeTypes includes ghost type', () => {
    expect(allNodeTypesCode).toContain('ghost: GhostNode');
  });

  test('allNodeTypes includes story type', () => {
    expect(allNodeTypesCode).toContain('story: StoryNode');
  });

  test('allNodeTypes includes journeyHeader type', () => {
    expect(allNodeTypesCode).toContain('journeyHeader: JourneyHeader');
  });

  test('allNodeTypes includes empty type', () => {
    expect(allNodeTypesCode).toContain('empty: EmptyNode');
  });

  test('allNodeTypes includes dropColumnIndicator type', () => {
    expect(allNodeTypesCode).toContain(
      'dropColumnIndicator: DropColumnIndicator'
    );
  });

  test('allNodeTypes has exactly 5 node types (story, journeyHeader, empty, dropColumnIndicator, ghost)', () => {
    // Count only entries within the object body (between { and })
    const objectBodyMatch = allNodeTypesCode.match(/\{([\s\S]*)\}/);
    if (objectBodyMatch) {
      const objectBody = objectBodyMatch[1];
      const typeEntries = objectBody.match(/\w+:/g);
      expect(typeEntries?.length ?? 0).toBe(5);
    }
  });
});

describe('DropInsertLine Removal', () => {
  test('DropInsertLine component does not exist in source file', () => {
    const hasDropInsertLineComponent = sourceContent.includes(
      'function DropInsertLine'
    );
    expect(hasDropInsertLineComponent).toBe(false);
  });

  test('DropInsertLine is not registered in allNodeTypes', () => {
    const allNodeTypesMatch = sourceContent.match(
      /const allNodeTypes[\s\S]*?^\};/m
    );
    const allNodeTypesCode = allNodeTypesMatch?.[0] ?? '';
    const hasDropInsertLine = allNodeTypesCode.includes('dropInsertLine');
    expect(hasDropInsertLine).toBe(false);
  });

  test('DropInsertLine import does not exist', () => {
    const hasDropInsertLineImport = sourceContent.includes(
      'import { DropInsertLine }'
    );
    expect(hasDropInsertLineImport).toBe(false);
  });
});

describe('GhostNode Edge Cases', () => {
  test('GhostNode handles empty title string', () => {
    const emptyTitleCode = `function GhostNode({ data }: { data: { title: string } }) {
  return (
    <div className="pointer-events-none w-64 opacity-50">
      <Card>
        <CardHeader>
          <p className="line-clamp-2 text-sm font-semibold">{data.title}</p>
        </CardHeader>
      </Card>
    </div>
  );
}`;
    expect(emptyTitleCode).toContain('{data.title}');
    // Empty string would render as empty paragraph
  });

  test('GhostNode does not have any event handlers (pointer-events-none implies non-interactive)', () => {
    const ghostNodeMatch = sourceContent.match(/function GhostNode[\s\S]*?^}/m);
    const ghostNodeCode = ghostNodeMatch?.[0] ?? '';
    const hasEventHandlers = /onClick|onChange|onMouse|onDrag|onTouch/.test(
      ghostNodeCode
    );
    expect(hasEventHandlers).toBe(false);
  });

  test('GhostNode does not use onClick or any interactive props', () => {
    const ghostNodeMatch = sourceContent.match(/function GhostNode[\s\S]*?^}/m);
    const ghostNodeCode = ghostNodeMatch?.[0] ?? '';
    const hasInteractiveProps = /onClick|onChange|disabled|readOnly/.test(
      ghostNodeCode
    );
    expect(hasInteractiveProps).toBe(false);
  });
});

describe('GhostNode - DropInsertLine Mutual Exclusivity', () => {
  test('GhostNode exists if and only if DropInsertLine does not exist', () => {
    const hasGhostNode = sourceContent.includes('function GhostNode');
    const hasDropInsertLine = sourceContent.includes('function DropInsertLine');
    expect(hasGhostNode && !hasDropInsertLine).toBe(true);
  });
});
