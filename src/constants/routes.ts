/**
 * 路由常量
 */

export const ROUTES = {
  HOME: '/',
  PROJECTS: '/projects',
  PROJECT_DETAIL: (id: string) => `/projects/${id}`,
  PROJECT_REQUIREMENTS: (id: string) => `/projects/${id}/requirements`,
  PROJECT_STORY_MAP: (id: string) => `/projects/${id}/story-map`,
  PROJECT_TASKS: (id: string) => `/projects/${id}/tasks`,
  SETTINGS: '/settings',
  SETTINGS_API: '/settings/api',
} as const;
