import { createFileRoute } from '@tanstack/react-router';
import { useProject } from '@/lib/api/hooks';
import { StoryMapCanvas } from '@/features/story-map/components/story-map-canvas';

export const Route = createFileRoute('/projects/$projectId/story-map')({
  component: StoryMapRoutePage,
});

function StoryMapRoutePage() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
        加载中…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
        项目不存在或未加载
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-9.5rem)] overflow-hidden">
      <StoryMapCanvas journeys={project.user_journeys ?? []} projectId={projectId} className="h-full w-full" />
    </div>
  );
}
