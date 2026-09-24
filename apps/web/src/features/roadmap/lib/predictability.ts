export {
  aggregateMilestonePredictability,
  type MilestonePredictability,
  type PredictabilityInput,
} from '@x-cartographer/shared';

import type { PredictabilityInput } from '@x-cartographer/shared';

/** 从产品深树提取全部故事（跨活动展平） */
export function flattenStories(
  activities: readonly { stories?: readonly PredictabilityInput[] }[] | null | undefined
): PredictabilityInput[] {
  const out: PredictabilityInput[] = [];
  for (const activity of activities ?? []) {
    for (const story of activity.stories ?? []) out.push(story);
  }
  return out;
}
