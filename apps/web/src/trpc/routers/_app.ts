import { createTRPCRouter } from '../init';
import { projectRouter } from './project';
import { journeyRouter } from './journey';
import { storyRouter } from './story';
import { taskRouter } from './task';
import { statusRouter } from './status';

export const appRouter = createTRPCRouter({
  project: projectRouter,
  journey: journeyRouter,
  story: storyRouter,
  task: taskRouter,
  status: statusRouter,
});

export type AppRouter = typeof appRouter;
