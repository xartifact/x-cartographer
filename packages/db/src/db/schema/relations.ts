import { relations } from 'drizzle-orm';
import { products } from './products';
import { userActivities } from './user-activities';
import { userTasks } from './user-tasks';
import { userStories } from './user-stories';
import { milestones } from './milestones';
import { devTasks } from './dev-tasks';
import { adrRecords } from './adr-records';

export const productsRelations = relations(products, ({ many }) => ({
  userActivities: many(userActivities),
  milestones: many(milestones),
  adrRecords: many(adrRecords),
}));

export const userActivitiesRelations = relations(userActivities, ({ one, many }) => ({
  product: one(products, {
    fields: [userActivities.productId],
    references: [products.id],
  }),
  stories: many(userStories),
  userTasks: many(userTasks),
}));

export const devTasksRelations = relations(devTasks, ({ one }) => ({
  story: one(userStories, {
    fields: [devTasks.storyId],
    references: [userStories.id],
  }),
}));

export const userTasksRelations = relations(userTasks, ({ one }) => ({
  activity: one(userActivities, {
    fields: [userTasks.activityId],
    references: [userActivities.id],
  }),
}));

export const userStoriesRelations = relations(userStories, ({ one, many }) => ({
  activity: one(userActivities, {
    fields: [userStories.activityId],
    references: [userActivities.id],
  }),
  userTask: one(userTasks, {
    fields: [userStories.userTaskId],
    references: [userTasks.id],
  }),
  milestone: one(milestones, {
    fields: [userStories.milestoneId],
    references: [milestones.id],
  }),
  devTasks: many(devTasks),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
  product: one(products, {
    fields: [milestones.projectId],
    references: [products.id],
  }),
}));
export const adrRecordsRelations = relations(adrRecords, ({ one }) => ({
  product: one(products, {
    fields: [adrRecords.projectId],
    references: [products.id],
  }),
  milestone: one(milestones, {
    fields: [adrRecords.milestoneId],
    references: [milestones.id],
  }),
  /** 被本条替代的旧 ADR（信息性关联，不建 DB 外键） */
  supersedesRecord: one(adrRecords, {
    fields: [adrRecords.supersedes],
    references: [adrRecords.id],
    relationName: 'adr_supersedes',
  }),
}));
