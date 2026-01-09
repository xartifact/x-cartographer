# Lib 工具库

本目录包含与框架无关的工具函数和服务。

## 目录结构

- **llm/**: LLM 集成相关
  - `providers/`: LLM 提供商实现 (OpenAI, Anthropic)
  - `prompts/`: Prompt 模板
- **toml/**: TOML 解析和序列化
- **storage/**: 数据持久化 (localStorage, 加密)
- **markdown/**: Markdown 处理
- **validation/**: 数据验证 (Zod schemas)
- **utils.ts**: 通用工具函数 (cn 函数等)

## 开发原则

1. 所有函数应该是纯函数，易于测试
2. 避免依赖 React 或 Next.js 特定 API
3. 使用 TypeScript 严格模式
