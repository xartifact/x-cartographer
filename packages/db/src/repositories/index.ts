export { ProductRepository } from './product.repository';
export { UserActivityRepository } from './user-activity.repository';
export { StoryRepository } from './story.repository';
export { DevTaskRepository } from './dev-task.repository';
export { MilestoneRepository } from './milestone.repository';
export { StatusChangeRepository } from './status-change.repository';
export { AdrRepository, foldConstitution } from './adr.repository';
export { SystemModuleRepository } from './system-module.repository';
export type { SystemModuleInput } from './system-module.repository';
export { AppSettingsRepository } from './app-settings.repository';

// 单例实例
import { ProductRepository } from './product.repository';
import { StatusChangeRepository } from './status-change.repository';
import { AdrRepository } from './adr.repository';

let productRepo: ProductRepository | null = null;
let statusChangeRepo: StatusChangeRepository | null = null;
let adrRepo: AdrRepository | null = null;

export function getProductRepository(): ProductRepository {
  if (!productRepo) {
    productRepo = new ProductRepository();
  }
  return productRepo;
}

export function getStatusChangeRepository(): StatusChangeRepository {
  if (!statusChangeRepo) {
    statusChangeRepo = new StatusChangeRepository();
  }
  return statusChangeRepo;
}

export function getAdrRepository(): AdrRepository {
  if (!adrRepo) {
    adrRepo = new AdrRepository();
  }
  return adrRepo;
}
