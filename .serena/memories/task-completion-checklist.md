# 任务完成检查清单

## 代码提交前检查

### 1. 类型检查

```bash
pnpm type-check
```

必须通过，无任何类型错误。

### 2. Lint 检查

```bash
pnpm lint
```

必须通过，无任何 lint 错误。

### 3. 代码格式化

```bash
pnpm format
```

确保代码格式一致。

### 4. 构建检查

```bash
pnpm build
```

确保生产构建成功。

## 代码质量检查

- [ ] 移除所有 `console.log` (保留 `console.warn` 和 `console.error`)
- [ ] 移除所有未使用的导入
- [ ] 移除所有注释掉的代码
- [ ] 检查是否有 `any` 类型 (应该使用具体类型)
- [ ] 检查是否有硬编码的字符串/数字 (应该提取为常量)

## 功能检查

- [ ] 功能是否按需求实现
- [ ] 边界情况是否处理
- [ ] 错误处理是否完善
- [ ] 加载状态是否展示
- [ ] 空状态是否处理

## 安全检查

- [ ] API 密钥是否正确加密存储
- [ ] 用户输入是否验证
- [ ] LLM 响应是否验证
- [ ] 敏感信息是否提交到 Git (检查 `.env.local`)

## 性能检查

- [ ] 是否有不必要的重渲染
- [ ] 是否有内存泄漏 (useEffect 清理)
- [ ] 大列表是否使用虚拟化
- [ ] 图片是否优化

## 提交前最后检查

```bash
# 1. 查看变更
git status

# 2. 查看具体改动
git diff

# 3. 添加文件
git add .

# 4. 提交 (使用 Conventional Commits 格式)
git commit -m "feat: 添加 XXX 功能"

# 5. 推送 (如果需要)
git push
```

## 常见问题

### Q: 类型检查报错 "Cannot find module"

A: 检查 `tsconfig.json` 中的路径别名配置是否正确。

### Q: ESLint 报错 "unused vars"

A: 删除未使用的变量，或使用 `_` 前缀标记。

### Q: 构建失败

A: 检查是否有语法错误或类型错误，运行 `pnpm type-check` 排查。

### Q: shadcn/ui 组件无法导入

A: 检查 `components.json` 配置，确保路径别名正确。
