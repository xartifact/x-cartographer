# 故事地图拖拽视觉反馈改进
Swarm: default
Phase: 1 [COMPLETE] | Updated: 2026-04-17T09:47:05.009Z

---
## Phase 1: 幽灵卡片节点与位置预计算 [COMPLETE]
- [x] 1.1: 在 story-map-canvas.tsx 中新增 GhostNode 组件并注册到 allNodeTypes：渲染为半透明（opacity-50）的故事卡片样式，宽度 w-64，显示被拖拽卡片的标题文本，pointer-events-none；同时移除 DropInsertLine 组件及其在 allNodeTypes 中的注册 (FR-001, FR-006) [MEDIUM]
- [x] 1.2: 修改 nodesWithIndicators useMemo：当拖拽故事时，在目标列的 dragOverRowIndex 位置插入 ghost 节点，目标列中 order >= dragOverRowIndex 的故事节点 y 坐标增加 ROW_HEIGHT；如果源列与目标列不同，源列中被拖拽卡片之后的节点 y 坐标减少 ROW_HEIGHT (FR-001, FR-002, FR-003) [MEDIUM] (depends: 1.1)
- [x] 1.3: 为故事节点位置变化添加 CSS transition 动画：在 story-map-canvas.tsx 的 ReactFlow 节点样式或 StoryNode 组件中添加 transition: transform 200ms ease 使卡片让位时有平滑过渡效果 (FR-004) [SMALL] (depends: 1.2)
