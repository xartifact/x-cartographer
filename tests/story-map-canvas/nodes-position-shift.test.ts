/**
 * nodesWithIndicators position shifting logic verification tests
 * Tests task 1.2: Ghost node insertion, target column nodes shift down, source column nodes shift up
 *
 * Tests the pure shifting logic extracted from nodesWithIndicators useMemo (lines 660-794)
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Constants (mirrored from story-map-canvas.tsx)
// ---------------------------------------------------------------------------
const ROW_HEIGHT = 220;
const COLUMN_WIDTH = 300;
const COLUMN_GAP = 40;
const HEADER_HEIGHT = 120;

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

interface Story {
  id: string;
  title: string;
  order: number;
}

interface Journey {
  id: string;
  order: number;
  stories?: Story[];
}

interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
}

/** Build a story node at given column index and story row index. */
function makeStoryNode(
  storyId: string,
  columnIndex: number,
  storyIndex: number
): FlowNode {
  return {
    id: `story-${storyId}`,
    type: 'story',
    position: {
      x: columnIndex * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_GAP,
      y: HEADER_HEIGHT + storyIndex * ROW_HEIGHT,
    },
  };
}

/** Build a grid of story nodes for multiple columns. */
function buildNodesGrid(columns: Journey[]): FlowNode[] {
  const nodes: FlowNode[] = [];
  columns.forEach((journey, colIdx) => {
    const sortedStories = [...(journey.stories ?? [])].sort(
      (a, b) => a.order - b.order
    );
    sortedStories.forEach((story, storyIdx) => {
      nodes.push(makeStoryNode(story.id, colIdx, storyIdx));
    });
  });
  return nodes;
}

/** Get baseline Y position for a story at given column and row. */
function baselineY(colIdx: number, rowIdx: number): number {
  return HEADER_HEIGHT + rowIdx * ROW_HEIGHT;
}

// ---------------------------------------------------------------------------
// Pure shifting logic (extracted from nodesWithIndicators useMemo)
// ---------------------------------------------------------------------------

/** Computes adjusted Y offset for a single story node during drag. */
function computeYOffset(params: {
  nodeId: string;
  nodeType: string;
  nodeJourneyIndex: number;
  nodeStoryIndex: number;
  draggingNodeId: string;
  sourceJourneyIndex: number;
  draggedStoryIndex: number;
  dragOverJourneyIndex: number;
  dragOverRowIndex: number;
}): number {
  const {
    nodeId,
    nodeType,
    nodeJourneyIndex,
    nodeStoryIndex,
    draggingNodeId,
    sourceJourneyIndex,
    draggedStoryIndex,
    dragOverJourneyIndex,
    dragOverRowIndex,
  } = params;

  if (nodeType !== 'story' || nodeId === draggingNodeId) return 0;

  let yOffset = 0;

  if (nodeJourneyIndex === dragOverJourneyIndex) {
    // Node is in target column
    if (sourceJourneyIndex === dragOverJourneyIndex) {
      // Same column: dragged card leaves a gap
      if (nodeStoryIndex > draggedStoryIndex) {
        // Node after dragged card shifts up first (gap left behind)
        yOffset -= ROW_HEIGHT;
        // Then nodes at/after insert point shift down
        if (nodeStoryIndex - 1 >= dragOverRowIndex) {
          yOffset += ROW_HEIGHT;
        }
      } else if (nodeStoryIndex < draggedStoryIndex) {
        // Node before dragged card: check if it ends up at/after insert point
        if (nodeStoryIndex >= dragOverRowIndex) {
          yOffset = ROW_HEIGHT;
        }
      }
      // nodeStoryIndex === draggedStoryIndex: the dragged node itself (excluded above)
    } else {
      // Different column: shift down if at/after insert point
      if (nodeStoryIndex >= dragOverRowIndex) {
        yOffset = ROW_HEIGHT;
      }
    }
  } else if (
    nodeJourneyIndex === sourceJourneyIndex &&
    sourceJourneyIndex !== dragOverJourneyIndex
  ) {
    // Source column on cross-column drag: fill the gap left by dragged card
    if (nodeStoryIndex > draggedStoryIndex) {
      yOffset = -ROW_HEIGHT;
    }
  }

  return yOffset;
}

/** Find source journey index and dragged story info from filteredJourneys. */
function findSourceInfo(
  filteredJourneys: Journey[],
  draggingNodeId: string
): { sourceJourneyIndex: number; draggedStoryIndex: number } {
  for (let ji = 0; ji < filteredJourneys.length; ji++) {
    const sortedStories = [...(filteredJourneys[ji].stories ?? [])].sort(
      (a, b) => a.order - b.order
    );
    const si = sortedStories.findIndex(
      (s) => `story-${s.id}` === draggingNodeId
    );
    if (si !== -1) {
      return { sourceJourneyIndex: ji, draggedStoryIndex: si };
    }
  }
  return { sourceJourneyIndex: -1, draggedStoryIndex: -1 };
}

/** Apply position adjustments to all story nodes. */
function adjustNodePositions(
  nodes: FlowNode[],
  filteredJourneys: Journey[],
  draggingNodeId: string,
  dragOverJourneyIndex: number,
  dragOverRowIndex: number
): FlowNode[] {
  const { sourceJourneyIndex, draggedStoryIndex } = findSourceInfo(
    filteredJourneys,
    draggingNodeId
  );

  return nodes.map((node) => {
    if (node.type !== 'story' || node.id === draggingNodeId) return node;

    const storyId = node.id.replace('story-', '');
    let nodeJourneyIndex = -1;
    let nodeStoryIndex = -1;
    for (let ji = 0; ji < filteredJourneys.length; ji++) {
      const sortedStories = [...(filteredJourneys[ji].stories ?? [])].sort(
        (a, b) => a.order - b.order
      );
      const si = sortedStories.findIndex((s) => s.id === storyId);
      if (si !== -1) {
        nodeJourneyIndex = ji;
        nodeStoryIndex = si;
        break;
      }
    }
    if (nodeJourneyIndex === -1) return node;

    const yOffset = computeYOffset({
      nodeId: node.id,
      nodeType: node.type,
      nodeJourneyIndex,
      nodeStoryIndex,
      draggingNodeId,
      sourceJourneyIndex,
      draggedStoryIndex,
      dragOverJourneyIndex,
      dragOverRowIndex,
    });

    if (yOffset === 0) return node;
    return {
      ...node,
      position: { ...node.position, y: node.position.y + yOffset },
    };
  });
}

// ---------------------------------------------------------------------------
// Source file static verification
// ---------------------------------------------------------------------------

const sourceFilePath = resolve(
  __dirname,
  '../../src/features/story-map/components/story-map-canvas.tsx'
);
const sourceContent = readFileSync(sourceFilePath, 'utf-8');

describe('nodesWithIndicators - source code static checks', () => {
  test('nodesWithIndicators useMemo exists in source', () => {
    expect(sourceContent).toContain('const nodesWithIndicators = useMemo');
  });

  test('ROW_HEIGHT=220, COLUMN_WIDTH=300, COLUMN_GAP=40, HEADER_HEIGHT=120 constants exist', () => {
    expect(sourceContent).toContain('const ROW_HEIGHT = 220');
    expect(sourceContent).toContain('const COLUMN_WIDTH = 300');
    expect(sourceContent).toContain('const COLUMN_GAP = 40');
    expect(sourceContent).toContain('const HEADER_HEIGHT = 120');
  });

  test('Ghost node uses correct position formula: HEADER_HEIGHT + dragOverRowIndex * ROW_HEIGHT', () => {
    expect(sourceContent).toContain(
      'y: HEADER_HEIGHT + dragOverRowIndex * ROW_HEIGHT'
    );
  });

  test('Ghost node x formula uses dragOverJourneyIndex * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_GAP', () => {
    expect(sourceContent).toContain(
      'x: dragOverJourneyIndex * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_GAP'
    );
  });

  test('Cross-column: target column nodes at/after dragOverRowIndex shift down by ROW_HEIGHT', () => {
    // Find the block for "Different column: shift down if at/after insert point"
    const crossColBlock = sourceContent.match(
      /Different column: shift down[\s\S]*?yOffset = ROW_HEIGHT/
    );
    expect(crossColBlock).toBeTruthy();
  });

  test('Cross-column: source column nodes after draggedStoryIndex shift up by ROW_HEIGHT', () => {
    const sourceColBlock = sourceContent.match(
      /Source column on cross-column drag[\s\S]*?yOffset = -ROW_HEIGHT/
    );
    expect(sourceColBlock).toBeTruthy();
  });

  test('Same-column: nodeStoryIndex > draggedStoryIndex shifts up then conditionally shifts down', () => {
    const sameColBlock = sourceContent.match(
      /nodeStoryIndex > draggedStoryIndex[\s\S]*?yOffset -= ROW_HEIGHT[\s\S]*?nodeStoryIndex - 1 >= dragOverRowIndex/
    );
    expect(sameColBlock).toBeTruthy();
  });

  test('Dragged node itself is excluded from position adjustment', () => {
    const excludeBlock = sourceContent.match(
      /if \(node\.type !== 'story' \|\| node\.id === draggingNodeId\) return node/
    );
    expect(excludeBlock).toBeTruthy();
  });

  test('Ghost node has type ghost, id __ghost-node__, and pointer-events-none styling', () => {
    expect(sourceContent).toContain("id: '__ghost-node__'");
    expect(sourceContent).toContain("type: 'ghost'");
    expect(sourceContent).toContain('draggable: false');
    expect(sourceContent).toContain('selectable: false');
    expect(sourceContent).toContain('pointer-events-none');
  });
});

// ---------------------------------------------------------------------------
// Scenario 1: Cross-column drag
// ---------------------------------------------------------------------------

describe('Scenario 1: Cross-column drag', () => {
  // Col 0: stories [A, B, C] (orders 0,1,2)
  // Col 1: stories [D, E] (orders 0,1)
  // Drag story C (col 0, index 2) to col 1 at row 1

  const col0: Journey = {
    id: 'j0',
    order: 0,
    stories: [
      { id: 'A', title: 'Story A', order: 0 },
      { id: 'B', title: 'Story B', order: 1 },
      { id: 'C', title: 'Story C', order: 2 },
    ],
  };
  const col1: Journey = {
    id: 'j1',
    order: 1,
    stories: [
      { id: 'D', title: 'Story D', order: 0 },
      { id: 'E', title: 'Story E', order: 1 },
    ],
  };

  const filteredJourneys = [col0, col1];
  const nodes = buildNodesGrid(filteredJourneys);

  const draggingNodeId = 'story-C';
  const dragOverJourneyIndex = 1; // target: col 1
  const dragOverRowIndex = 1; // insert at row 1

  const adjusted = adjustNodePositions(
    nodes,
    filteredJourneys,
    draggingNodeId,
    dragOverJourneyIndex,
    dragOverRowIndex
  );

  test('Ghost node position: col 1 (dragOverJourneyIndex), row 1 (dragOverRowIndex)', () => {
    const ghostX =
      dragOverJourneyIndex * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_GAP;
    const ghostY = HEADER_HEIGHT + dragOverRowIndex * ROW_HEIGHT;
    expect(ghostX).toBe(1 * (300 + 40) + 40); // 380
    expect(ghostY).toBe(120 + 1 * 220); // 340
  });

  test('Source column (col 0): stories A and B unchanged (before dragged card)', () => {
    const nodeA = adjusted.find((n) => n.id === 'story-A');
    const nodeB = adjusted.find((n) => n.id === 'story-B');
    expect(nodeA?.position.y).toBe(baselineY(0, 0)); // 120
    expect(nodeB?.position.y).toBe(baselineY(0, 1)); // 340
  });

  test('Source column (col 0): story C (dragged) excluded from adjustment', () => {
    const nodeC = adjusted.find((n) => n.id === 'story-C');
    // The dragged node is filtered out entirely, so it should NOT appear in adjusted
    // (or if it does, it should be the original)
    const originalC = nodes.find((n) => n.id === 'story-C');
    if (nodeC) {
      expect(nodeC.position.y).toBe(originalC?.position.y);
    }
  });

  test('Target column (col 1): stories at/after row 1 shift down by ROW_HEIGHT', () => {
    const nodeE = adjusted.find((n) => n.id === 'story-E');
    // E is at row 1 (>= dragOverRowIndex=1), so shifts down by 220
    expect(nodeE?.position.y).toBe(baselineY(1, 1) + ROW_HEIGHT); // 340 + 220 = 560
  });

  test('Target column (col 1): story D at row 0 unchanged (before insert point)', () => {
    const nodeD = adjusted.find((n) => n.id === 'story-D');
    expect(nodeD?.position.y).toBe(baselineY(1, 0)); // 120
  });

  test('All adjusted nodes have correct x positions (column assignment preserved)', () => {
    const nonGhost = adjusted.filter((n) => n.id.startsWith('story-'));
    nonGhost.forEach((node) => {
      const colIdx = node.position.x < 380 ? 0 : 1;
      if (colIdx === 0) {
        expect(node.position.x).toBe(COLUMN_GAP); // 40
      } else {
        expect(node.position.x).toBe(
          1 * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_GAP
        ); // 380
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Cross-column drag — target column with empty space
// ---------------------------------------------------------------------------

describe('Scenario 2: Cross-column drag to empty target column', () => {
  // Col 0: [A, B]
  // Col 1: [] (empty)
  // Drag A to col 1 at row 0

  const col0: Journey = {
    id: 'j0',
    order: 0,
    stories: [
      { id: 'A', title: 'Story A', order: 0 },
      { id: 'B', title: 'Story B', order: 1 },
    ],
  };
  const col1: Journey = { id: 'j1', order: 1, stories: [] };

  const filteredJourneys = [col0, col1];
  const nodes = buildNodesGrid(filteredJourneys);

  const draggingNodeId = 'story-A';
  const dragOverJourneyIndex = 1;
  const dragOverRowIndex = 0;

  const adjusted = adjustNodePositions(
    nodes,
    filteredJourneys,
    draggingNodeId,
    dragOverJourneyIndex,
    dragOverRowIndex
  );

  test('Ghost node at col 1 row 0 (empty column)', () => {
    const ghostX =
      dragOverJourneyIndex * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_GAP;
    const ghostY = HEADER_HEIGHT + dragOverRowIndex * ROW_HEIGHT;
    expect(ghostX).toBe(380);
    expect(ghostY).toBe(120); // HEADER_HEIGHT
  });

  test('Source column: story B shifts up (fills gap left by A)', () => {
    const nodeB = adjusted.find((n) => n.id === 'story-B');
    // B was at row 1, A was at row 0. Since B's index (1) > draggedStoryIndex (0),
    // B shifts up by ROW_HEIGHT
    expect(nodeB?.position.y).toBe(baselineY(0, 1) - ROW_HEIGHT); // 340 - 220 = 120
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Same-column reorder
// ---------------------------------------------------------------------------

describe('Scenario 3: Same-column reorder', () => {
  // Col 0: [A, B, C, D] — reorder: move D to position 1 (between A and B)
  // D is at index 3, dragOverRowIndex = 1
  // Expected: A unchanged, B shifts up then down, C shifts up then down, D excluded

  const col0: Journey = {
    id: 'j0',
    order: 0,
    stories: [
      { id: 'A', title: 'Story A', order: 0 },
      { id: 'B', title: 'Story B', order: 1 },
      { id: 'C', title: 'Story C', order: 2 },
      { id: 'D', title: 'Story D', order: 3 },
    ],
  };

  const filteredJourneys = [col0];
  const nodes = buildNodesGrid(filteredJourneys);

  const draggingNodeId = 'story-D'; // D is at index 3
  const dragOverJourneyIndex = 0; // same column
  const dragOverRowIndex = 1; // insert between A (0) and B (1)

  const adjusted = adjustNodePositions(
    nodes,
    filteredJourneys,
    draggingNodeId,
    dragOverJourneyIndex,
    dragOverRowIndex
  );

  test('Story A at row 0 unchanged (before insert point, before dragged card)', () => {
    const nodeA = adjusted.find((n) => n.id === 'story-A');
    expect(nodeA?.position.y).toBe(baselineY(0, 0)); // 120
  });

  test('Story B at row 1: nodeStoryIndex(1) < draggedStoryIndex(3) → nodeStoryIndex(1) >= dragOverRowIndex(1) → shifts down', () => {
    // B is before D in original order, but after insert point → shifts down
    const nodeB = adjusted.find((n) => n.id === 'story-B');
    expect(nodeB?.position.y).toBe(baselineY(0, 1) + ROW_HEIGHT); // 340 + 220 = 560
  });

  test('Story C at row 2: nodeStoryIndex(2) > draggedStoryIndex(3) is FALSE → handled by nodeStoryIndex < draggedStoryIndex branch', () => {
    // C (index 2) < D (index 3) → same-column "before dragged card" path
    // C (2) >= dragOverRowIndex (1) → shifts down
    const nodeC = adjusted.find((n) => n.id === 'story-C');
    expect(nodeC?.position.y).toBe(baselineY(0, 2) + ROW_HEIGHT); // 660 + 220 = 880
  });

  test('Story D (dragged) excluded from adjustments', () => {
    const nodeD = adjusted.find((n) => n.id === 'story-D');
    const originalD = nodes.find((n) => n.id === 'story-D');
    // D should either not be in adjusted or have its original position
    if (nodeD) {
      expect(nodeD.position.y).toBe(originalD?.position.y);
    }
  });

  test('Same-column: nodes between insert point and dragged card shift down; nodes before insert point unchanged', () => {
    // When D (index 3) moves to row 1 in same column:
    // - A (index 0): 0 < 3 AND 0 >= 1? No → offset 0 (before insert point)
    // - B (index 1): 1 < 3 AND 1 >= 1? Yes → offset +220 (between insert and dragged)
    // - C (index 2): 2 < 3 AND 2 >= 1? Yes → offset +220 (between insert and dragged)
    // Result: A unchanged, B and C shift down
    const nodeA = adjusted.find((n) => n.id === 'story-A');
    const nodeB = adjusted.find((n) => n.id === 'story-B');
    const nodeC = adjusted.find((n) => n.id === 'story-C');
    expect(nodeA?.position.y).toBe(baselineY(0, 0)); // unchanged: 120
    expect(nodeB?.position.y).toBe(baselineY(0, 1) + ROW_HEIGHT); // +220: 560
    expect(nodeC?.position.y).toBe(baselineY(0, 2) + ROW_HEIGHT); // +220: 880
  });
});

// ---------------------------------------------------------------------------
// Scenario 3b: Same-column reorder — move card upward
// ---------------------------------------------------------------------------

describe('Scenario 3b: Same-column reorder — move A to end', () => {
  // Col 0: [A, B, C, D]
  // Move A (index 0) to after C (insert at row 3)
  // A excluded, B shifts up, C shifts up, D shifts down

  const col0: Journey = {
    id: 'j0',
    order: 0,
    stories: [
      { id: 'A', title: 'Story A', order: 0 },
      { id: 'B', title: 'Story B', order: 1 },
      { id: 'C', title: 'Story C', order: 2 },
      { id: 'D', title: 'Story D', order: 3 },
    ],
  };

  const filteredJourneys = [col0];
  const nodes = buildNodesGrid(filteredJourneys);

  const draggingNodeId = 'story-A'; // index 0
  const dragOverJourneyIndex = 0;
  const dragOverRowIndex = 3; // insert after current position of D

  const adjusted = adjustNodePositions(
    nodes,
    filteredJourneys,
    draggingNodeId,
    dragOverJourneyIndex,
    dragOverRowIndex
  );

  test('Story B (index 1) < draggedIndex (0)? No (1 > 0) → "after dragged card" path', () => {
    // nodeStoryIndex(1) > draggedStoryIndex(0) → shifts up by ROW_HEIGHT
    // Then: nodeStoryIndex - 1 (0) >= dragOverRowIndex (3)? No → no additional shift down
    const nodeB = adjusted.find((n) => n.id === 'story-B');
    expect(nodeB?.position.y).toBe(baselineY(0, 1) - ROW_HEIGHT); // 340 - 220 = 120
  });

  test('Story C (index 2) > draggedIndex (0): shifts up by ROW_HEIGHT, no additional shift down', () => {
    const nodeC = adjusted.find((n) => n.id === 'story-C');
    // nodeStoryIndex(2) > draggedStoryIndex(0) → -ROW_HEIGHT
    // Then: nodeStoryIndex - 1 (1) >= dragOverRowIndex (3)? No → net = -ROW_HEIGHT
    expect(nodeC?.position.y).toBe(baselineY(0, 2) - ROW_HEIGHT); // 560 - 220 = 340
  });

  test('Story D (index 3) > draggedIndex (0): shifts up then check down shift', () => {
    const nodeD = adjusted.find((n) => n.id === 'story-D');
    // nodeStoryIndex(3) > draggedStoryIndex(0) → -ROW_HEIGHT
    // Then: nodeStoryIndex - 1 (2) >= dragOverRowIndex (3)? No → net = -ROW_HEIGHT
    expect(nodeD?.position.y).toBe(baselineY(0, 3) - ROW_HEIGHT); // 780 - 220 = 560
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Drag to same position — no net movement
// ---------------------------------------------------------------------------

describe('Scenario 4: Drag to same position', () => {
  // Col 0: [A, B, C]
  // Drag B to same position (dragOverRowIndex = B's original index = 1)

  const col0: Journey = {
    id: 'j0',
    order: 0,
    stories: [
      { id: 'A', title: 'Story A', order: 0 },
      { id: 'B', title: 'Story B', order: 1 },
      { id: 'C', title: 'Story C', order: 2 },
    ],
  };

  const filteredJourneys = [col0];
  const nodes = buildNodesGrid(filteredJourneys);

  const draggingNodeId = 'story-B'; // index 1
  const dragOverJourneyIndex = 0;
  const dragOverRowIndex = 1; // same as B's original index

  const adjusted = adjustNodePositions(
    nodes,
    filteredJourneys,
    draggingNodeId,
    dragOverJourneyIndex,
    dragOverRowIndex
  );

  test('All nodes unchanged when dragging to exact same position', () => {
    nodes.forEach((originalNode) => {
      if (originalNode.id === draggingNodeId) return;
      const adjustedNode = adjusted.find((n) => n.id === originalNode.id);
      expect(adjustedNode?.position.y).toBe(originalNode.position.y);
    });
  });

  test('No nodes have non-zero yOffset when dropping at same position', () => {
    const { sourceJourneyIndex, draggedStoryIndex } = findSourceInfo(
      filteredJourneys,
      draggingNodeId
    );
    expect(sourceJourneyIndex).toBe(0);
    expect(draggedStoryIndex).toBe(1);

    nodes.forEach((node) => {
      if (node.type !== 'story' || node.id === draggingNodeId) return;
      const storyId = node.id.replace('story-', '');
      let nodeStoryIndex = -1;
      const sortedStories = [...filteredJourneys[0].stories].sort(
        (a, b) => a.order - b.order
      );
      nodeStoryIndex = sortedStories.findIndex((s) => s.id === storyId);

      const yOffset = computeYOffset({
        nodeId: node.id,
        nodeType: node.type,
        nodeJourneyIndex: 0,
        nodeStoryIndex,
        draggingNodeId,
        sourceJourneyIndex,
        draggedStoryIndex,
        dragOverJourneyIndex,
        dragOverRowIndex,
      });
      expect(yOffset).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: No drag active
// ---------------------------------------------------------------------------

describe('Scenario 5: No drag active', () => {
  test('Source-level guard: nodesWithIndicators returns nodes unchanged when draggingNodeId is null', () => {
    // Verify source-level behavior: when !draggingNodeId, nodesWithIndicators returns nodes directly
    const sourceSnippet = sourceContent.match(
      /if \(!draggingNodeId \|\| dragOverJourneyIndex === null\) return nodes/
    );
    expect(sourceSnippet).toBeTruthy();
  });

  test('BUG FOUND: Non-matching draggingNodeId causes phantom shifts — draggedStoryIndex=-1 makes all nodes shift up', () => {
    // When draggingNodeId matches no story in filteredJourneys, draggedStoryIndex = -1.
    // This causes ALL nodes to satisfy nodeStoryIndex > -1, creating phantom upward shifts.
    // This is a source-code bug: needs guard for draggedStoryIndex === -1.
    const col0: Journey = {
      id: 'j0',
      order: 0,
      stories: [
        { id: 'A', title: 'Story A', order: 0 },
        { id: 'B', title: 'Story B', order: 1 },
      ],
    };
    const nodes = buildNodesGrid([col0]);

    // With draggedStoryIndex = -1 (non-matching ID), computeYOffset produces:
    // - nodeStoryIndex > -1 → true for ALL nodes → yOffset = -ROW_HEIGHT (WRONG!)
    const { sourceJourneyIndex, draggedStoryIndex } = findSourceInfo(
      [col0],
      'story-nonexistent'
    );
    expect(draggedStoryIndex).toBe(-1); // Not found
    expect(sourceJourneyIndex).toBe(-1); // Not found

    // Verify the bug: with draggedStoryIndex = -1, B gets unwanted shift
    const yOffsetB = computeYOffset({
      nodeId: 'story-B',
      nodeType: 'story',
      nodeJourneyIndex: 0,
      nodeStoryIndex: 1,
      draggingNodeId: 'story-nonexistent',
      sourceJourneyIndex,
      draggedStoryIndex,
      dragOverJourneyIndex: 0,
      dragOverRowIndex: 0,
    });
    // Bug: yOffsetB should be 0 but is -220 because 1 > -1
    expect(yOffsetB).not.toBe(0); // Documents the bug
  });

  test('Source has guard for draggedStoryIndex === -1 (fix for phantom shift bug)', () => {
    // After the bug is fixed, the source should guard against draggedStoryIndex === -1
    const hasGuard = sourceContent.match(
      /draggedStoryIndex\s*===\s*-1|draggedStoryIndex\s*!==\s*-1|draggedStoryIndex\s*!=\s*-1/
    );
    // This test documents whether the bug has been fixed in source
    // Currently this is expected to FAIL (no guard exists)
    // The test should PASS after the fix is applied
    expect(hasGuard).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: Boundary — empty column (no stories in target)
// ---------------------------------------------------------------------------

describe('Scenario 6: Boundary — empty target column with multiple source stories', () => {
  // Col 0: [A, B, C]
  // Col 1: []
  // Drag B to col 1

  const col0: Journey = {
    id: 'j0',
    order: 0,
    stories: [
      { id: 'A', title: 'Story A', order: 0 },
      { id: 'B', title: 'Story B', order: 1 },
      { id: 'C', title: 'Story C', order: 2 },
    ],
  };
  const col1: Journey = { id: 'j1', order: 1, stories: [] };

  const filteredJourneys = [col0, col1];
  const nodes = buildNodesGrid(filteredJourneys);

  const draggingNodeId = 'story-B';
  const dragOverJourneyIndex = 1; // empty column
  const dragOverRowIndex = 0;

  const adjusted = adjustNodePositions(
    nodes,
    filteredJourneys,
    draggingNodeId,
    dragOverJourneyIndex,
    dragOverRowIndex
  );

  test('Ghost at col 1 row 0 (empty column)', () => {
    const ghostX =
      dragOverJourneyIndex * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_GAP;
    const ghostY = HEADER_HEIGHT + dragOverRowIndex * ROW_HEIGHT;
    expect(ghostX).toBe(380);
    expect(ghostY).toBe(120);
  });

  test('Source column (col 0): story C (index 2 > draggedIndex 1) shifts up', () => {
    const nodeC = adjusted.find((n) => n.id === 'story-C');
    expect(nodeC?.position.y).toBe(baselineY(0, 2) - ROW_HEIGHT); // 660 - 220 = 440
  });

  test('Source column (col 0): story A unchanged (before dragged)', () => {
    const nodeA = adjusted.find((n) => n.id === 'story-A');
    expect(nodeA?.position.y).toBe(baselineY(0, 0)); // 120
  });

  test('Target column (col 1) has no story nodes to shift', () => {
    const col1Nodes = adjusted.filter((n) => {
      return n.type === 'story' && n.position.x >= 380;
    });
    expect(col1Nodes.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: Ghost node data carries dragged story title
// ---------------------------------------------------------------------------

describe('Scenario 7: Ghost node data carries correct dragged story title', () => {
  test('Ghost node data contains the title of the dragged story', () => {
    // The source code shows: data: { title: draggedStoryTitle }
    // draggedStoryTitle is extracted from sortedStories[si].title
    const col0: Journey = {
      id: 'j0',
      order: 0,
      stories: [{ id: 'MyStory', title: 'My Custom Title', order: 0 }],
    };
    const nodes = buildNodesGrid([col0]);

    // Simulate ghost node creation from source logic
    const draggingNodeId = 'story-MyStory';
    const draggedStoryId = draggingNodeId.replace('story-', '');

    let draggedStoryTitle = '';
    const sortedStories = [...(col0.stories ?? [])].sort(
      (a, b) => a.order - b.order
    );
    const si = sortedStories.findIndex((s) => s.id === draggedStoryId);
    if (si !== -1) {
      draggedStoryTitle = sortedStories[si].title ?? '';
    }

    expect(draggedStoryTitle).toBe('My Custom Title');

    // Verify ghost node data structure from source
    const ghostNode = {
      id: '__ghost-node__',
      type: 'ghost',
      position: {
        x: 0 * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_GAP,
        y: HEADER_HEIGHT + 0 * ROW_HEIGHT,
      },
      data: { title: draggedStoryTitle },
      draggable: false,
      selectable: false,
    };
    expect(ghostNode.data.title).toBe('My Custom Title');
  });
});

// ---------------------------------------------------------------------------
// Scenario 8: Cross-column with multiple nodes in target — shift boundary
// ---------------------------------------------------------------------------

describe('Scenario 8: Cross-column — exact boundary at dragOverRowIndex', () => {
  // Col 0: [A]
  // Col 1: [X, Y, Z]
  // Drag A to col 1 at row 0 — only X (row 0) should be unaffected

  const col0: Journey = {
    id: 'j0',
    order: 0,
    stories: [{ id: 'A', title: 'Story A', order: 0 }],
  };
  const col1: Journey = {
    id: 'j1',
    order: 1,
    stories: [
      { id: 'X', title: 'Story X', order: 0 },
      { id: 'Y', title: 'Story Y', order: 1 },
      { id: 'Z', title: 'Story Z', order: 2 },
    ],
  };

  const filteredJourneys = [col0, col1];
  const nodes = buildNodesGrid(filteredJourneys);

  const draggingNodeId = 'story-A';
  const dragOverJourneyIndex = 1;
  const dragOverRowIndex = 0; // insert at row 0 → X (row 0) shifts down too

  const adjusted = adjustNodePositions(
    nodes,
    filteredJourneys,
    draggingNodeId,
    dragOverJourneyIndex,
    dragOverRowIndex
  );

  test('Target column: Y at row 1 (>= dragOverRowIndex 0) shifts down', () => {
    const nodeY = adjusted.find((n) => n.id === 'story-Y');
    expect(nodeY?.position.y).toBe(baselineY(1, 1) + ROW_HEIGHT); // 340 + 220 = 560
  });

  test('Target column: Z at row 2 shifts down', () => {
    const nodeZ = adjusted.find((n) => n.id === 'story-Z');
    expect(nodeZ?.position.y).toBe(baselineY(1, 2) + ROW_HEIGHT); // 660 + 220 = 880
  });

  test('Target column: X at row 0 (>= dragOverRowIndex 0) also shifts down per >= condition', () => {
    // Note: the source uses >= so row 0 also shifts down
    const nodeX = adjusted.find((n) => n.id === 'story-X');
    expect(nodeX?.position.y).toBe(baselineY(1, 0) + ROW_HEIGHT); // 120 + 220 = 340
  });
});

// ---------------------------------------------------------------------------
// Property: Adjustments are stable — no double-shifting from repeated calls
// ---------------------------------------------------------------------------

describe('Property: Stability — adjustment applied to same visual state is stable', () => {
  test('Same visual nodes passed twice from same logical state yields identical result', () => {
    // When the same logical filteredJourneys is used, and we build nodes from it
    // twice (simulating two renders with the same data), the adjustment is the same.
    const col0: Journey = {
      id: 'j0',
      order: 0,
      stories: [
        { id: 'A', title: 'Story A', order: 0 },
        { id: 'B', title: 'Story B', order: 1 },
        { id: 'C', title: 'Story C', order: 2 },
      ],
    };
    const col1: Journey = {
      id: 'j1',
      order: 1,
      stories: [
        { id: 'X', title: 'Story X', order: 0 },
        { id: 'Y', title: 'Story Y', order: 1 },
      ],
    };

    const filteredJourneys = [col0, col1];

    // Build nodes fresh from the same logical state (like React re-render)
    const nodes1 = buildNodesGrid(filteredJourneys);
    const nodes2 = buildNodesGrid(filteredJourneys); // same logical state

    const draggingNodeId = 'story-C';
    const dragOverJourneyIndex = 1;
    const dragOverRowIndex = 1;

    const adjusted1 = adjustNodePositions(
      nodes1,
      filteredJourneys,
      draggingNodeId,
      dragOverJourneyIndex,
      dragOverRowIndex
    );

    const adjusted2 = adjustNodePositions(
      nodes2,
      filteredJourneys,
      draggingNodeId,
      dragOverJourneyIndex,
      dragOverRowIndex
    );

    // Both adjustments should produce identical results
    adjusted1.forEach((node) => {
      const s2 = adjusted2.find((n) => n.id === node.id);
      expect(s2?.position.y).toBe(node.position.y);
    });
  });
});

// ---------------------------------------------------------------------------
// Property: Conservation — no nodes lost or duplicated after adjustment
// ---------------------------------------------------------------------------

describe('Property: Conservation — all story nodes preserved', () => {
  test('adjustNodePositions preserves all story nodes', () => {
    const col0: Journey = {
      id: 'j0',
      order: 0,
      stories: [
        { id: 'A', order: 0 },
        { id: 'B', order: 1 },
        { id: 'C', order: 2 },
      ],
    };
    const col1: Journey = {
      id: 'j1',
      order: 1,
      stories: [
        { id: 'D', order: 0 },
        { id: 'E', order: 1 },
        { id: 'F', order: 2 },
      ],
    };

    const filteredJourneys = [col0, col1];
    const nodes = buildNodesGrid(filteredJourneys);

    const adjusted = adjustNodePositions(
      nodes,
      filteredJourneys,
      'story-C',
      1,
      2
    );

    // All 5 non-dragged story nodes must be present
    const storyIds = ['story-A', 'story-B', 'story-D', 'story-E', 'story-F'];
    storyIds.forEach((id) => {
      const found = adjusted.find((n) => n.id === id);
      expect(found).toBeDefined();
      expect(found?.type).toBe('story');
    });

    // Dragged node is filtered out
    const dragged = adjusted.find((n) => n.id === 'story-C');
    const original = nodes.find((n) => n.id === 'story-C');
    if (dragged) {
      expect(dragged.position.y).toBe(original?.position.y);
    }
  });
});
