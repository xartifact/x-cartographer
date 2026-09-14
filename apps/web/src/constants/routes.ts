/**
 * 路由常量
 */

export const ROUTES = {
  HOME: '/',
  PROJECTS: '/products',
  PROJECT_DETAIL: (id: string) => `/products/${id}`,
  PROJECT_STORY_MAP: (id: string) => `/products/${id}/story-map`,
  PROJECT_TASKS: (id: string) => `/products/${id}/tasks`,
  SETTINGS: '/settings',
  SETTINGS_API: '/settings/api',
} as const;
