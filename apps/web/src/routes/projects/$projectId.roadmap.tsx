import { useParams } from '@tanstack/react-router';
import { RoadmapPage } from '@/features/roadmap/roadmap-page';

export function RoadmapRoutePage() {
  const { projectId: projectIdRaw } = useParams({ strict: false });
  const projectId = projectIdRaw!;

  return <RoadmapPage projectId={projectId} />;
}
