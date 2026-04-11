import type { PromptContext } from './types';

export function buildPrompt(ctx: PromptContext): string {
  const sections: string[] = [];

  if (ctx.project) {
    const techStack = ctx.project.tech_stack.length > 0
      ? ctx.project.tech_stack.join(', ')
      : '未指定';
    sections.push(`## 项目背景
项目名称：${ctx.project.name}${ctx.project.description ? `\n描述：${ctx.project.description}` : ''}
技术栈：${techStack}`);
  }

  if (ctx.story) {
    const criteria = ctx.story.acceptance_criteria.length > 0
      ? ctx.story.acceptance_criteria.map((c, i) => `  ${i + 1}. ${c}`).join('\n')
      : '  无';
    sections.push(`## 所属用户故事
ID：${ctx.story.id}
标题：${ctx.story.title}
描述：${ctx.story.description}
验收标准：
${criteria}`);
  }

  const deps = ctx.task.dependencies.length > 0
    ? `\n依赖任务：${ctx.task.dependencies.join(', ')}`
    : '';
  const tags = ctx.task.tags.length > 0
    ? `\n标签：${ctx.task.tags.join(', ')}`
    : '';

  sections.push(`## 当前任务
ID：${ctx.task.id}
标题：${ctx.task.title}
类型：${ctx.task.type}
优先级：${ctx.task.priority}${tags}${deps}

任务描述：
${ctx.task.description}`);

  sections.push(`## 执行要求
请根据以上任务描述，在当前工作目录下完成开发工作：
1. 分析任务需求，理解实现目标
2. 编写符合项目技术栈的代码，遵循现有代码风格
3. 确保代码质量，逻辑清晰
4. 完成后简要说明所做的修改和关键决策

工作目录即为当前代码仓库根目录，请直接操作文件系统完成任务。`);

  return sections.join('\n\n');
}
