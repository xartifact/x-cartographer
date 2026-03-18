# Layout 组件目录

## 组件说明

### AppLayout
全局应用布局组件，包含顶部栏、侧边栏和内容区域。

```tsx
import { AppLayout } from '@/components/layout';

export default function Layout({ children }) {
  return <AppLayout>{children}</AppLayout>;
}
```

### Header
顶部导航栏组件，包含 Logo、搜索、通知和用户菜单。

```tsx
import { Header } from '@/components/layout';

<Header
  user={currentUser}
  searchPlaceholder="搜索..."
  notificationCount={3}
/>
```

### Sidebar
侧边栏导航组件，支持折叠和移动端适配。

```tsx
import { Sidebar } from '@/components/layout';
import { mainNavItems } from '@/components/layout/navigation';

<Sidebar
  items={mainNavItems}
  collapsed={false}
  onCollapsedChange={(collapsed) => setCollapsed(collapsed)}
/>
```

### ProjectNav
项目内导航组件，用于项目详情页面的标签页式导航。

```tsx
import { ProjectNav } from '@/components/layout';

<ProjectNav
  projectId="123"
  projectName="我的项目"
  backHref="/projects"
/>
```

### Breadcrumb
面包屑导航组件。

```tsx
import { Breadcrumb } from '@/components/layout';

<Breadcrumb
  items={[
    { label: '首页', href: '/' },
    { label: '项目列表', href: '/projects' },
    { label: '项目详情' },
  ]}
/>
```

## 类型导出

所有类型定义在 `types.ts` 中导出：

- `NavItem` - 导航项
- `NavGroup` - 导航分组
- `User` - 用户信息
- `HeaderProps` - 顶部栏属性
- `SidebarProps` - 侧边栏属性
- `AppLayoutProps` - 布局属性
- `ProjectNavProps` - 项目导航属性
- `BreadcrumbItem` - 面包屑项
- `BreadcrumbProps` - 面包屑属性

## 导航配置

导航数据结构在 `navigation.ts` 中定义：

- `mainNavItems` - 主导航菜单
- `projectNavItems` - 项目内导航菜单
- `getNavItemByPath()` - 根据路径获取导航项
- `isPathMatch()` - 路径匹配检查
- `getActiveNavItem()` - 获取当前激活项
- `generateBreadcrumbs()` - 生成面包屑

## 使用示例

### 1. 在根布局中使用

```tsx
// src/app/layout.tsx
import { AppLayout } from '@/components/layout';

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
```

### 2. 在项目详情页面使用

```tsx
// src/app/projects/[id]/layout.tsx
import { ProjectNav } from '@/components/layout';
import { mainNavItems } from '@/components/layout/navigation';

export default function ProjectLayout({ children, params }) {
  return (
    <AppLayout navItems={mainNavItems} showSidebar={false}>
      <ProjectNav projectId={params.id}>
        {children}
      </ProjectNav>
    </AppLayout>
  );
}
```

### 3. 自定义侧边栏

```tsx
import { Sidebar } from '@/components/layout';
import { mainNavItems } from '@/components/layout/navigation';

<Sidebar
  items={mainNavItems}
  collapsed={sidebarCollapsed}
  onCollapsedChange={setSidebarCollapsed}
  footer={<div className="p-2">自定义内容</div>}
/>
```

## 响应式设计

| 断点 | 侧边栏状态 | 说明 |
|------|-----------|------|
| `< md` | 隐藏 | 通过汉堡菜单控制移动端侧边栏 |
| `>= md` | 显示 | 可折叠 |
| `>= lg` | 展开 | 默认展开状态 |

## 主题支持

组件支持深色模式，通过 Tailwind 的 `dark:` 前缀和 CSS 变量实现。