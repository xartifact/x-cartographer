## Dark Matter: Hidden Couplings

Found 20 file pairs that frequently co-change but have no import relationship:

| File A | File B | NPMI | Co-Changes | Lift |
|--------|--------|------|------------|------|
| src/features/requirements/components/journey-suggestions.tsx | src/features/requirements/components/requirement-input.tsx | 1.000 | 3 | 6.67 |
| .user-stories/story-map-x-product-roadmap-mvp.toml | .user-stories/tasks-x-product-roadmap-mvp.toml | 1.000 | 3 | 6.67 |
| .user-stories/story-map-x-product-roadmap-mvp.toml | src/features/story-map/components/story-detail-panel.tsx | 1.000 | 3 | 6.67 |
| .user-stories/story-map-x-product-roadmap-mvp.toml | src/features/story-map/components/story-map-canvas.tsx | 1.000 | 3 | 6.67 |
| .user-stories/story-map-x-product-roadmap-mvp.toml | src/types/project.ts | 1.000 | 3 | 6.67 |
| .user-stories/tasks-x-product-roadmap-mvp.toml | src/features/story-map/components/story-detail-panel.tsx | 1.000 | 3 | 6.67 |
| .user-stories/tasks-x-product-roadmap-mvp.toml | src/features/story-map/components/story-map-canvas.tsx | 1.000 | 3 | 6.67 |
| .user-stories/tasks-x-product-roadmap-mvp.toml | src/types/project.ts | 1.000 | 3 | 6.67 |
| src/features/projects/api/project-storage.ts | src/features/projects/stores/project-store.ts | 1.000 | 4 | 5.00 |
| src/features/story-map/components/story-detail-panel.tsx | src/types/project.ts | 1.000 | 3 | 6.67 |
| src/features/story-map/components/story-map-canvas.tsx | src/types/project.ts | 1.000 | 3 | 6.67 |
| .gitignore | src/app/projects/[id]/page.tsx | 1.000 | 3 | 6.67 |
| .gitignore | src/app/projects/page.tsx | 1.000 | 3 | 6.67 |
| .gitignore | src/features/projects/components/project-list.tsx | 1.000 | 3 | 6.67 |
| src/app/projects/[id]/page.tsx | src/features/projects/components/project-list.tsx | 1.000 | 3 | 6.67 |
| src/app/projects/page.tsx | src/features/projects/components/project-list.tsx | 1.000 | 3 | 6.67 |
| package.json | src/features/projects/api/project-storage.ts | 0.861 | 4 | 4.00 |
| package.json | src/features/projects/stores/project-store.ts | 0.861 | 4 | 4.00 |
| .user-stories/story-map-x-product-roadmap-mvp.toml | src/features/projects/api/project-storage.ts | 0.848 | 3 | 5.00 |
| .user-stories/story-map-x-product-roadmap-mvp.toml | src/features/projects/stores/project-store.ts | 0.848 | 3 | 5.00 |

These pairs likely share an architectural concern invisible to static analysis.
Consider adding explicit documentation or extracting the shared concern.