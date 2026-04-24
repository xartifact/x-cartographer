# Features 功能模块

本目录包含所有业务功能模块，每个模块按照 Bulletproof React 规范组织。

## 模块列表

- **requirements**: 需求分析功能
- **user-journeys**: 用户旅程管理
- **user-stories**: 用户故事 CRUD
- **story-map**: 可视化故事地图
- **tasks**: 任务拆解和管理
- **export**: 数据导出功能
- **projects**: 项目管理
- **settings**: 系统设置
- **onboarding**: 用户引导

## 模块结构

每个模块包含以下子目录：

```
feature-name/
├── components/       # UI 组件
├── api/             # API 调用
├── hooks/           # 自定义 Hooks
├── stores/          # 状态管理 (Zustand)
├── types/           # 类型定义
└── index.ts         # 导出入口
```

## 开发指南

1. 功能模块之间应该尽量独立
2. 共享的组件放在 `src/components/`
3. 共享的类型放在 `src/types/`
4. 每个模块通过 `index.ts` 导出公共 API
