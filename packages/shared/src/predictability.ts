/**
 * PI predictability (SAFe Program Predictability Measure).
 *
 * Cancelled stories are explicitly removed from both numerator and denominator;
 * accepted stories count as done; missing estimations count as zero.
 */
export interface MilestonePredictability {
  milestone_id: string;
  planned_stories: number;
  done_stories: number;
  planned_estimation: number;
  done_estimation: number;
  /** done/planned (0–1), rounded to two decimals; null when no stories were planned. */
  predictability: number | null;
}

export interface PredictabilityInput {
  id: string;
  status?: string;
  estimation?: number;
  milestone_id?: string;
}

type PredictabilityStory = Omit<PredictabilityInput, 'id'>;

export interface UnassignedPredictability {
  planned_stories: number;
  done_stories: number;
  planned_estimation: number;
  done_estimation: number;
}

interface PredictabilityCollection {
  byMilestone: Map<string, MilestonePredictability>;
  unassigned: UnassignedPredictability;
}

function createMilestonePredictability(milestone_id: string): MilestonePredictability {
  return {
    milestone_id,
    planned_stories: 0,
    done_stories: 0,
    planned_estimation: 0,
    done_estimation: 0,
    predictability: null,
  };
}

function addStory(
  bucket: UnassignedPredictability | MilestonePredictability,
  story: PredictabilityStory,
): void {
  const estimation = typeof story.estimation === 'number' ? story.estimation : 0;
  bucket.planned_stories += 1;
  bucket.planned_estimation += estimation;
  if (story.status === 'accepted') {
    bucket.done_stories += 1;
    bucket.done_estimation += estimation;
  }
}

function calculatePredictability(bucket: MilestonePredictability): void {
  bucket.predictability = bucket.planned_stories > 0
    ? Math.round((bucket.done_stories / bucket.planned_stories) * 100) / 100
    : null;
}

function collectPredictability(
  stories: Iterable<PredictabilityStory>,
  milestoneIds?: readonly string[],
): PredictabilityCollection {
  const byMilestone = new Map<string, MilestonePredictability>();
  const isRestricted = milestoneIds !== undefined;
  for (const id of milestoneIds ?? []) {
    byMilestone.set(id, createMilestonePredictability(id));
  }
  const unassigned: UnassignedPredictability = {
    planned_stories: 0,
    done_stories: 0,
    planned_estimation: 0,
    done_estimation: 0,
  };

  for (const story of stories) {
    if (story.status === 'cancelled') continue;
    if (!story.milestone_id) {
      if (!isRestricted) addStory(unassigned, story);
      continue;
    }
    let bucket = byMilestone.get(story.milestone_id);
    if (!bucket && !isRestricted) {
      bucket = createMilestonePredictability(story.milestone_id);
      byMilestone.set(story.milestone_id, bucket);
    }
    if (bucket) addStory(bucket, story);
  }

  for (const bucket of byMilestone.values()) calculatePredictability(bucket);
  return { byMilestone, unassigned };
}

/**
 * Aggregate a caller-selected, ordered set of milestones. Stories that are
 * unassigned or belong to another milestone are excluded from the result.
 */
export function aggregateMilestonePredictability(
  stories: Iterable<PredictabilityStory>,
  milestoneIds: readonly string[],
): MilestonePredictability[] {
  return [...collectPredictability(stories, milestoneIds).byMilestone.values()];
}

/**
 * Aggregate every assigned milestone found in the input and separately report
 * unassigned stories. This preserves CLI overview semantics without a second
 * implementation of the predictability calculation.
 */
export function aggregateAssignedMilestonePredictability(
  stories: Iterable<PredictabilityStory>,
): {
  byMilestone: Record<string, MilestonePredictability>;
  unassigned: UnassignedPredictability;
} {
  const { byMilestone, unassigned } = collectPredictability(stories);
  return { byMilestone: Object.fromEntries(byMilestone), unassigned };
}
