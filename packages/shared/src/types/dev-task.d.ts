/**
 * 研发任务（DevTask）声明镜像 —— 与 dev-task.ts 保持同步；type 字段已废除
 */
import { TaskPriority, TaskStatus, Timestamp } from './common';
export interface DevTask {
    id: string;
    title: string;
    description: string;
    priority: TaskPriority;
    estimation: number;
    status: TaskStatus;
    dependencies: string[];
    story_id: string | null;
    product_id: string;
    tags: string[];
    created_at: Timestamp;
    updated_at: Timestamp;
    started_at?: Timestamp;
    completed_at?: Timestamp;
    assignee?: string;
    affected_modules?: string[];
}
export interface CreateDevTaskDTO {
    title: string;
    description: string;
    priority: TaskPriority;
    estimation: number;
    dependencies?: string[];
    story_id?: string;
    product_id?: string;
    tags?: string[];
}
export interface UpdateDevTaskDTO {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    estimation?: number;
    status?: TaskStatus;
    dependencies?: string[];
    tags?: string[];
    assignee?: string;
    product_id?: string;
    affected_modules?: string[];
}
