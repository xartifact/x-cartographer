/**
 * TOML 序列化系统的专用类型。
 * TomlParsed* 前缀表示解析后的中间格式，Toml* 前缀表示 TOML 文件的原始格式。
 */
/**
 * 用户故事验收标准
 */
export interface TomlParsedAcceptanceCriterion {
    description: string;
    completed?: boolean;
}
/**
 * 标签
 */
export type Tag = string;
/**
 * 优先级
 */
export type TomlPriority = 'high' | 'medium' | 'low';
/**
 * 用户故事
 */
export interface TomlParsedUserStory {
    id: string;
    title: string;
    description: string;
    priority: TomlPriority;
    estimation: number;
    acceptance_criteria: TomlParsedAcceptanceCriterion[];
    tags: Tag[];
    status?: 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';
}
/**
 * 用户旅程
 */
export interface TomlParsedUserJourney {
    id: string;
    name: string;
    description: string;
    persona: string;
    stories: TomlParsedUserStory[];
    order?: number;
}
/**
 * TOML 格式的用户故事验收标准
 */
export type TomlAcceptanceCriterion = string | {
    description: string;
    completed?: boolean;
};
/**
 * TOML 格式的用户故事
 */
export interface TomlUserStory {
    id: string;
    title: string;
    description: string;
    priority: TomlPriority;
    estimation: number;
    acceptance_criteria: TomlAcceptanceCriterion[];
    tags?: string[];
    status?: 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';
}
/**
 * TOML 格式的用户旅程
 */
export interface TomlUserJourney {
    id: string;
    name: string;
    description: string;
    persona: string;
    stories?: TomlUserStory[];
    order?: number;
}
/**
 * TOML 格式的项目元数据
 */
export interface TomlProjectMetadata {
    name: string;
    version: string;
    created_at: string;
    description: string;
    tech_stack: string[];
}
/**
 * TOML 格式的完整故事地图数据
 */
export interface TomlStoryMap {
    project: TomlProjectMetadata;
    user_journeys: TomlUserJourney[];
}
/**
 * 项目数据
 */
export interface TomlParsedProject {
    id: string;
    name: string;
    description: string;
    version: string;
    tech_stack: string[];
    created_at: string;
    updated_at: string;
    user_journeys: TomlParsedUserJourney[];
}
/**
 * 项目创建/更新表单数据
 */
export interface ProjectFormData {
    name: string;
    description: string;
    version?: string;
    tech_stack?: string[];
}
