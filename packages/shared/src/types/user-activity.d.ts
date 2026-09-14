/**
 * 用户活动（UserActivity）声明镜像 —— 与 user-activity.ts 保持同步
 */
import { Timestamp } from './common';
import { UserStory } from './user-story';
import { UserTask } from './user-task';
export interface UserActivity {
    id: string;
    name: string;
    description: string;
    product_id: string;
    stories: UserStory[];
    user_tasks?: UserTask[];
    order: number;
    created_at: Timestamp;
    updated_at: Timestamp;
}
export interface CreateUserActivityDTO {
    name: string;
    description?: string;
    product_id: string;
    order?: number;
}
export interface UpdateUserActivityDTO {
    name?: string;
    description?: string;
    order?: number;
}
