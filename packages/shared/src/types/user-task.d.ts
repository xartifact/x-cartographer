/**
 * 用户任务（UserTask）声明镜像 —— 与 user-task.ts 保持同步
 */
import { Timestamp } from './common';
export interface UserTask {
    id: string;
    activity_id: string;
    name: string;
    description: string;
    order: number;
    created_at: Timestamp;
    updated_at: Timestamp;
}
export interface CreateUserTaskDTO {
    activity_id: string;
    name: string;
    description?: string;
    order?: number;
}
export interface UpdateUserTaskDTO {
    name?: string;
    description?: string;
    order?: number;
}
