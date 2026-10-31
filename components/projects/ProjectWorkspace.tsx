"use client";
import { useState } from "react";
import Link from "next/link";
import { Camera, FolderOpen } from "lucide-react";
import { MediaGallery, type MediaItem } from "@/components/media/MediaGallery";
import { ProjectActions } from "./ProjectActions";
import { ProjectForm } from "./ProjectForm";
import { projectStatuses } from "@/lib/project-schema";
interface Project {
  id: string;
  name: string;
  companyId: string;
  customerId: string | null;
  location: string | null;
  description: string | null;
  status: keyof typeof projectStatuses;
  customer: { name: string } | null;
  company: { name: string };
  createdById: string;
  siteVisits: {
    id: string;
    title: string;
    createdAt: string;
    notes: string | null;
    createdBy: { name: string };
    _count: { attachments: number };
  }[];
  quotations: { id: string; quotationNumber: string; status: string }[];
}
export function ProjectWorkspace({
  project,
  media,
  canEdit,
  isPinned,
  isStarred,
  companies,
  customers,
}: {
  project: Project;
  media: MediaItem[];
  canEdit: boolean;
  isPinned: boolean;
  isStarred: boolean;
  companies: { id: string; name: string }[];
  customers: { id: string; name: string; companyId: string | null }[];
}) {
  const [tab, setTab] = useState("Updates");
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex gap-3 flex-wrap">
        <Link
          href={`/site-visits/new?projectId=${project.id}`}
          className="dx-btn-gradient min-h-11"
        >
          <Camera className="w-4 h-4" />
          Capture update
        </Link>
        <Link href="/projects" className="dx-btn-ghost min-h-11">
          ← Projects
        </Link>
      </div>
      <ProjectActions id={project.id} name={project.name} isPinned={isPinned} isStarred={isStarred} canDelete={canEdit} inWorkspace />
      <div className="dx-card p-4 sm:p-5 flex items-start gap-3">
        <FolderOpen className="w-6 h-6 text-dx-accent shrink-0" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-dx-ink break-words">
            {project.name}
          </h2>
          <p className="text-sm text-dx-ink-muted mt-1">
            {project.customer?.name || "Customer not linked"} ·{" "}
            {project.company.name}
          </p>
          {project.location && (
            <p className="text-sm text-dx-ink-muted mt-1 break-words">
              {project.location}
            </p>
          )}
          <span className="inline-block text-xs px-2 py-1 rounded-full bg-dx-accent/10 text-dx-accent mt-3">
            {projectStatuses[project.status]}
          </span>
        </div>
      </div>
      <div
        role="tablist"
        aria-label="Project views"
        className="flex gap-1 overflow-x-auto border-b border-dx-line"
      >
        {["Updates", "Media", "Quotations", "Overview"].map((name) => (
          <button
            role="tab"
            id={`project-tab-${name}`}
            aria-controls="project-panel"
            aria-selected={tab === name}
            key={name}
            onClick={() => setTab(name)}
            className={`min-h-11 px-4 py-3 text-sm whitespace-nowrap border-b-2 ${tab === name ? "border-dx-accent text-dx-accent" : "border-transparent text-dx-ink-muted"}`}
          >
            {name}
          </button>
        ))}
      </div>
      <section
        id="project-panel"
        role="tabpanel"
        aria-labelledby={`project-tab-${tab}`}
      >
        {tab === "Updates" && (
          <div className="space-y-3">
            {!project.siteVisits.length && (
              <div className="dx-card p-6">
                <p className="text-dx-ink font-medium">No site updates yet</p>
                <p className="text-sm text-dx-ink-muted mt-2">
                  Use Capture update to add photos, descriptions or a voice note
                  to this project.
                </p>
              </div>
            )}
            {project.siteVisits.map((v) => (
              <Link
                key={v.id}
                href={`/site-visits/${v.id}`}
                className="dx-card block p-4 space-y-2 hover:border-dx-accent/40"
              >
                <div className="flex justify-between gap-3 flex-wrap">
                  <h3 className="font-medium text-dx-ink">{v.title}</h3>
                  <span className="text-xs text-dx-ink-faint">
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                </div>
                {v.notes && (
                  <p className="text-sm text-dx-ink-muted line-clamp-2">
                    {v.notes}
                  </p>
                )}
                <p className="text-xs text-dx-ink-faint">
                  {v.createdBy.name} · {v._count.attachments} media items
                </p>
              </Link>
            ))}
            {project.siteVisits.length === 100 && (
              <p className="text-xs text-dx-ink-muted">
                Showing the latest 100 updates.
              </p>
            )}
          </div>
        )}
        {tab === "Media" && (
          <>
            <MediaGallery media={media} />
            {media.length === 200 && (
              <p className="text-xs text-dx-ink-muted mt-3">
                Showing the latest 200 media items.
              </p>
            )}
          </>
        )}
        {tab === "Quotations" && (
          <div className="space-y-3">
            <p className="text-sm text-dx-ink-muted">
              Create a quotation from a site update to keep it linked to this
              project.
            </p>
            {project.quotations.map((q) => (
              <Link
                key={q.id}
                href={`/quotations/${q.id}`}
                className="dx-card p-4 flex gap-3 justify-between flex-wrap text-sm text-dx-ink"
              >
                <span className="text-dx-accent">{q.quotationNumber}</span>
                <span>{q.status.toLowerCase()}</span>
              </Link>
            ))}
            {!project.quotations.length && (
              <p className="text-sm text-dx-ink-faint py-4">
                No linked quotations yet.
              </p>
            )}
          </div>
        )}
        {tab === "Overview" && (
          <div className="space-y-4">
            {canEdit && (
              <button
                className="dx-btn-ghost min-h-11"
                onClick={() => setEditing(!editing)}
              >
                {editing ? "Close editor" : "Edit project details"}
              </button>
            )}
            {editing ? (
              <ProjectForm
                initial={project}
                customers={customers}
                companies={companies}
              />
            ) : (
              <div className="dx-card p-5">
                <h3 className="font-medium text-dx-ink mb-3">Project notes</h3>
                <p className="text-sm text-dx-ink-muted whitespace-pre-wrap">
                  {project.description || "No project notes yet."}
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
