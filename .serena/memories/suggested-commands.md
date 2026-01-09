# 开发命令参考

## 开发相关

```bash
# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

## 代码质量检查

```bash
# ESLint 检查
pnpm lint

# Prettier 格式化
pnpm format

# TypeScript 类型检查
pnpm type-check
```

## 系统工具 (macOS/Darwin)

```bash
# Git 相关
git status
git add .
git commit -m "message"
git push

# 文件操作
ls -la
cat <filename>
grep -r "pattern" .

# 进程管理
ps aux | grep node
kill <pid>

# 环境变量
echo $NODE_ENV
export NODE_ENV=development
```

## shadcn/ui 组件管理

```bash
# 添加组件
pnpm dlx shadcn@latest add <component-name>

# 查看可用组件
pnpm dlx shadcn@latest add
```

## 常用组件列表

- button, input, textarea, label
- card, dialog, sheet, popover, tooltip
- tabs, dropdown-menu, select
- checkbox, radio-group, switch
- toast, alert, badge, progress
- table, separator, scroll-area, avatar
