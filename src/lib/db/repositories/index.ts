export { ProjectRepository } from './project.repository';
export { JourneyRepository } from './journey.repository';
export { StoryRepository } from './story.repository';
export { TaskRepository } from './task.repository';
export { StatusChangeRepository } from './status-change.repository';

// 单例实例
import { ProjectRepository } from './project.repository';
import { StatusChangeRepository } from './status-change.repository';

let projectRepo: ProjectRepository | null = null;
let statusChangeRepo: StatusChangeRepository | null = null;

export function getProjectRepository(): ProjectRepository {
  if (!projectRepo) {
    projectRepo = new ProjectRepository();
  }
  return projectRepo;
}

export function getStatusChangeRepository(): StatusChangeRepository {
  if (!statusChangeRepo) {
    statusChangeRepo = new StatusChangeRepository();
  }
  return statusChangeRepo;
}
