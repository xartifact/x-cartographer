import { useParams } from '@tanstack/react-router';
import { RoadmapPage } from '@/features/roadmap/roadmap-page';

export function RoadmapRoutePage() {
  const { productId: productIdRaw } = useParams({ strict: false });
  const productId = productIdRaw!;

  return <RoadmapPage projectId={productId} />;
}
