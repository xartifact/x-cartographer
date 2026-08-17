import { relations } from 'drizzle-orm';
import { projects } from './projects';
import { userJourneys } from './user-journeys';
import { userStories } from './user-stories';
import { milestones } from './milestones';
import { tasks } from './tasks';

export const projectsRelations = relations(projects, ({ many }) => ({
  userJourneys: many(userJourneys),
  milestones: many(milestones),
}));

export const userJourneysRelations = relations(
  userJourneys,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [userJourneys.projectId],
      references: [projects.id],
    }),
    stories: many(userStories),
  })
);
export const userStoriesRelations = relations(userStories, ({ one, many }) => ({
  journey: one(userJourneys, {
    fields: [userStories.journeyId],
    references: [userJourneys.id],
  }),
  milestone: one(milestones, {
    fields: [userStories.milestoneId],
    references: [milestones.id],
  }),
  tasks: many(tasks),
}));
export const milestonesRelations = relations(milestones, ({ one }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
}));
export const tasksRelations = relations(tasks, ({ one }) => ({
  story: one(userStories, {
    fields: [tasks.storyId],
    references: [userStories.id],
  }),
}));
