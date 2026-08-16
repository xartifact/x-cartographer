/**
 * 导航菜单项类型定义
 */

export interface NavItem {
  /** 唯一标识符 */
  id: string;
  /** 显示标签 */
  label: string;
  /** 路由路径 */
  href?: string;
  /** 图标组件 */
  icon?: React.ComponentType<{ className?: string }>;
  /** 子菜单 */
  children?: NavItem[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否依赖当前活动项目动态解析路由 */
  hidden?: boolean;
}

export interface NavGroup {
  /** 分组标题 */
  title?: string;
  /** 分组下的菜单项 */
  items: NavItem[];
}

export interface User {
  /** 用户 ID */
  id: string;
  /** 用户名 */
  name: string;
  /** 邮箱 */
  email?: string;
  /** 头像 URL */
  avatar?: string;
}

export interface HeaderProps {
  /** Logo 点击跳转路径 */
  logoHref?: string;
  /** 当前用户信息 */
  user?: User | null;
  /** 搜索占位文本 */
  searchPlaceholder?: string;
  /** 通知数量 */
  notificationCount?: number;
  /** Logo 组件 */
  logo?: React.ReactNode;
  /** 自定义右侧操作区 */
  actions?: React.ReactNode;
  /** 移动端菜单按钮点击事件 */
  onMenuClick?: () => void;
}

export interface SidebarProps {
  /** 导航菜单配置 */
  items: NavItem[];
  /** 当前项目（有活动项目时侧边栏显示"当前项目"分组） */
  currentProject?: { id: string; name: string } | null;
  /** 当前路径，用于高亮 */
  currentPath?: string;
  /** 侧边栏折叠状态 */
  collapsed?: boolean;
  /** 折叠状态变化事件 */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** 底部自定义内容 */
  footer?: React.ReactNode;
}

export interface AppLayoutProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 侧边栏菜单配置 */
  navItems?: NavItem[];
  /** 是否显示侧边栏 */
  showSidebar?: boolean;
  /** 是否折叠侧边栏 */
  sidebarCollapsed?: boolean;
  /** 移动端侧边栏打开状态 */
  mobileSidebarOpen?: boolean;
  /** 移动端侧边栏切换事件 */
  onMobileSidebarToggle?: (open: boolean) => void;
}

export interface ProjectNavProps {
  /** 项目 ID */
  projectId: string;
  /** 项目名称 */
  projectName?: string;
  /** 当前路径 */
  currentPath?: string;
  /** 项目内导航菜单 */
  items?: NavItem[];
  /** 返回项目列表的链接 */
  backHref?: string;
  /** 额外操作按钮 */
  actions?: React.ReactNode;
}

export interface BreadcrumbItem {
  /** 标签 */
  label: string;
  /** 路径 */
  href?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

export interface BreadcrumbProps {
  /** 面包屑项列表 */
  items: BreadcrumbItem[];
  /** 自定义分隔符 */
  separator?: React.ReactNode;
}