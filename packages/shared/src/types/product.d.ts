/**
 * 产品（Product）类型声明镜像 —— 与 product.ts 保持同步
 */
import { Timestamp } from './common';
import { UserActivity } from './user-activity';
export interface Product {
    id: string;
    name: string;
    description?: string;
    created_at: Timestamp;
    updated_at: Timestamp;
    user_activities: UserActivity[];
    metadata: ProductMetadata;
    settings: ProductSettings;
}
export interface ProductMetadata {
    tech_stack: string[];
    version: string;
    tags: string[];
    total_stories?: number;
    total_tasks?: number;
    total_estimation?: number;
}
export interface ProductSettings {
    auto_save: boolean;
    display_preferences: DisplayPreferences;
    workspace_dir?: string;
}
export interface DisplayPreferences {
    show_priority_colors: boolean;
    show_estimation: boolean;
    default_view: 'map' | 'list' | 'kanban';
}
export interface CreateProductDTO {
    name: string;
    description?: string;
    tech_stack?: string[];
    workspace_dir?: string;
}
export interface UpdateProductDTO {
    name?: string;
    description?: string;
    settings?: Partial<ProductSettings>;
    metadata?: Partial<ProductMetadata>;
    user_activities?: UserActivity[];
}
