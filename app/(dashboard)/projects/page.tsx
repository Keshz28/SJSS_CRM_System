import { InstallApp } from "@/components/pwa/PwaSupport";
import Link from "next/link";
import { Camera, FolderOpen, Pin, Plus, Star, Trash2 } from "lucide-react";
import { listProjects, projectView, projectViews } from "@/lib/project-list";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { getCompanyScope } from "@/lib/company-scope";
import { projectStatuses } from "@/lib/project-schema";
import { Header } from "@/components/layout/Header";
import type { ProjectStatus } from "@prisma/client";
const viewIcons = { all: FolderOpen, pinned: Pin, starred: Star, deleted: Trash2 };
export default async function ProjectsPage({
  searchParams: pendingSearchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string; view?: string }>;
}) {
  const searchParams = await pendingSearchParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const view = projectView(searchParams.view);
  const { companyId } = await getCompanyScope();
  const search = searchParams.search?.trim() || "";
  const status = Object.keys(projectStatuses).includes(
    searchParams.status || "",
  )
    ? (searchParams.status as ProjectStatus)
    : undefined;
  const requestedPage = Number(searchParams.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const { projects, total } = await listProjects({ userId: session.user.id, companyId, search, status, view, page });
  const href = (next: number) =>
    `/projects?${new URLSearchParams({ search, status: status || "", view, page: String(next) })}`;
  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Projects"
        subtitle="Every job, with its photos and site history"
      />
      <main className="p-4 sm:p-6 space-y-5">
        <InstallApp />
        <div className="flex flex-wrap gap-3">
          <Link href="/projects/new" className="dx-btn-gradient min-h-11">
            <Plus className="w-4 h-4" />
            New project
          </Link>
          <Link href="/site-visits/new" className="dx-btn-ghost min-h-11">
            <Camera className="w-4 h-4" />
            Capture update
          </Link>
        </div>
        <nav aria-label="Project sections" className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          {Object.entries(projectViews).map(([key, label]) => {
            const Icon = viewIcons[key as keyof typeof viewIcons];
            return (
              <Link
                key={key}
                href={`/projects?${new URLSearchParams({ search, status: status || "", view: key })}`}
                aria-current={view === key ? "page" : undefined}
                className={`${view === key ? "dx-btn-gradient" : "dx-btn-ghost"} min-h-11 text-sm justify-center`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="text-sm text-dx-ink-muted">Pins stay at the top. Stars mark important projects. These choices are saved for your account.</p>
        <form className="flex gap-3 flex-wrap">
          <input type="hidden" name="view" value={view} />
          <label className="flex-1 min-w-40">
            <span className="sr-only">Search projects</span>
            <input
              name="search"
              defaultValue={search}
              placeholder="Search projects or site addresses…"
              className="w-full rounded-xl bg-dx-surface border border-dx-line p-3 text-sm text-dx-ink"
            />
          </label>
          <label>
            <span className="sr-only">Project stage</span>
            <select
              name="status"
              defaultValue={status || ""}
              className="bg-dx-surface border border-dx-line rounded-xl p-3 text-sm text-dx-ink"
            >
              <option value="">All stages</option>
              {Object.entries(projectStatuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="dx-btn-ghost min-h-11">Search</button>
        </form>
        <h2 className="text-lg font-semibold text-dx-ink">{projectViews[view]}</h2>
        {view === "deleted" && <p className="text-sm text-dx-ink-muted">Deleted projects keep their site history and media. The creator or an administrator can restore them. Quotations remain available.</p>}
        {!projects.length ? (
          <div className="dx-card p-8 text-center">
            <FolderOpen className="w-10 h-10 text-dx-accent mx-auto mb-4" />
            <h2 className="font-semibold text-dx-ink">
              {search || status || view !== "all"
                ? view === "deleted" ? "No recently deleted projects" : view === "pinned" ? "No pinned projects match these filters" : view === "starred" ? "No starred projects match these filters" : "No matching projects"
                : "Start your first project"}
            </h2>
            <p className="text-sm text-dx-ink-muted mt-2">
              {search || status || view !== "all"
                ? "Try another search, stage or project view."
                : "Create a named job, then add site photos, descriptions and voice notes."}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} canDelete={session.user.role === "ADMIN" || p.createdById === session.user.id} />
            ))}
          </div>
        )}
        <div className="flex gap-3 items-center text-sm text-dx-ink-muted">
          <span>{total} project{total === 1 ? "" : "s"}</span>
          {page > 1 && (
            <Link href={href(page - 1)} className="dx-btn-ghost min-h-11">
              Previous
            </Link>
          )}
          {page * 20 < total && (
            <Link href={href(page + 1)} className="dx-btn-ghost min-h-11">
              Next
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
