import { EmptyState } from "@/components/page-state";

export default function NotFound() {
  return <EmptyState title="Movie not found" description="This movie is unavailable."
    link={{ href: "/", label: "Back to catalog" }} />;
}
