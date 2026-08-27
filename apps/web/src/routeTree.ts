// 手写路由树（替代 file-based 自动生成）
// 原因：@tanstack/router-plugin 1.168 不自动嵌套 $projectId._layout，
// 导致项目子页（data/requirements/story-map/tasks/index）无法共享 ProjectNav。
// 这里显式构造嵌套关系，稳定不被插件覆盖。

import { createRootRoute, createRoute } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';

// ─── 根路由 ───────────────────────────────────────────────
import { RootComponent } from './routes/__root';
import { HomePage } from './routes/index';
import { ActiveRoutePage } from './routes/active';
import { SettingsPage } from './routes/settings';
import { ProjectsPage } from './routes/projects/index';
import { ProjectDetailLayout } from './routes/projects/$projectId._layout';
import { ProjectOverviewPage } from './routes/projects/$projectId.index';
import { StoryMapRoutePage } from './routes/projects/$projectId.story-map';
import { TasksRoutePage } from './routes/projects/$projectId.tasks';
import { RoadmapRoutePage } from './routes/projects/$projectId.roadmap';
import { DataRoutePage } from './routes/projects/$projectId.data';
import { JourneysRoutePage } from './routes/projects/$projectId.journeys';
import { StoriesRoutePage } from './routes/projects/$projectId.stories';
export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRoute<RouterContext>({
  component: RootComponent,
});

// ─── 静态路由 ─────────────────────────────────────────────
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const activeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/active',
  component: ActiveRoutePage,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsPage,
});

// ─── 项目嵌套路由（layout + 子页）────────────────────────
const projectLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectDetailLayout,
});

const projectOverviewRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: '/',
  component: ProjectOverviewPage,
});


const projectStoryMapRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: '/story-map',
  component: StoryMapRoutePage,
});

const projectTasksRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: '/tasks',
  component: TasksRoutePage,
});

const projectRoadmapRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: '/roadmap',
  component: RoadmapRoutePage,
});
const projectDataRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: '/data',
  component: DataRoutePage,
});

const projectJourneysRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: '/journeys',
  component: JourneysRoutePage,
});

const projectStoriesRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: '/stories',
  component: StoriesRoutePage,
});

// ─── 路由树 ──────────────────────────────────────────────
const routeTree = rootRoute.addChildren([
  indexRoute,
  settingsRoute,
  activeRoute,
  projectsRoute,
  projectLayoutRoute.addChildren([
    projectOverviewRoute,
    projectStoryMapRoute,
    projectTasksRoute,
    projectRoadmapRoute,
    projectDataRoute,
    projectJourneysRoute,
    projectStoriesRoute,
  ]),
]);

export { routeTree };
