import Link from "next/link";
import { FolderOpen, MapPin } from "lucide-react";
import { projectStatuses } from "@/lib/project-schema";
import { ProjectActions } from "./ProjectActions";

export function ProjectCard({ project: p, canDelete }: {
  project: {
    id: string; name: string; company: { name: string }; customer: { name: string } | null;
    location: string | null; status: keyof typeof projectStatuses; deletedAt: Date | null;
    isPinned: boolean; isStarred: boolean; _count: { siteVisits: number };
  };
  canDelete: boolean;
}) {
  const content = <>
    <div className="flex items-center gap-2 justify-between">
      <FolderOpen className="w-5 h-5 text-dx-accent" />
      <span className="text-xs rounded-full px-2 py-1 bg-dx-accent/10 text-dx-accent">{p.deletedAt ? "Deleted" : projectStatuses[p.status]}</span>
    </div>
    <h2 className="font-semibold text-dx-ink break-words">{p.name}</h2>
    <p className="text-sm text-dx-ink-muted">{p.customer?.name || "Customer not linked"}</p>
    {p.location && <p className="text-xs text-dx-ink-faint flex items-start gap-1"><MapPin className="w-3 h-3 shrink-0 mt-0.5" />{p.location}</p>}
    <div className="flex justify-between gap-2 text-xs text-dx-ink-faint border-t border-dx-line pt-3">
      <span>{p.company.name}</span><span>{p._count.siteVisits} update{p._count.siteVisits === 1 ? "" : "s"}</span>
    </div>
  </>;
  return (
    <article className={`dx-card overflow-hidden ${p.isPinned && !p.deletedAt ? "border-dx-accent/60" : ""}`} aria-label={p.name}>
      {p.deletedAt
        ? <div className="p-5 space-y-3">{content}</div>
        : <Link href={`/projects/${p.id}`} className="block p-5 space-y-3 hover:bg-dx-surface-hover">{content}</Link>}
      <div className="px-5 pb-4">
        <ProjectActions id={p.id} name={p.name} isPinned={p.isPinned} isStarred={p.isStarred} deleted={Boolean(p.deletedAt)} canDelete={canDelete} />
      </div>
    </article>
  );
}
