import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { MessagesSquare, Plus } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getCompanyScope } from "@/lib/company-scope";
import { listWorkGroups } from "@/lib/work-groups";
import { Header } from "@/components/layout/Header";
import { CommunicationNav } from "@/components/inbox/CommunicationNav";

export default async function WorkGroupsPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { companyId } = await getCompanyScope();
  const query = await searchParams;
  const search = query.search?.trim() || "";
  const { groups, total, page, pages } = await listWorkGroups(session.user.id, companyId, search, Number(query.page));
  const href = (next: number) => `/work-groups?${new URLSearchParams({ search, page: String(next) })}`;
  return <div className="flex flex-col flex-1">
    <Header title="Work groups" subtitle="Site discussions and official team announcements" />
    <main className="p-4 sm:p-6 space-y-5">
      <CommunicationNav active="groups" />
      <div className="flex flex-wrap gap-3">
        <form className="flex flex-1 min-w-48 gap-2"><label className="flex-1"><span className="sr-only">Search work groups</span><input name="search" defaultValue={search} placeholder="Search groups or projects…" className="w-full rounded-xl border border-dx-line bg-dx-surface p-3 text-sm text-dx-ink" /></label><button className="dx-btn-ghost min-h-11 text-sm">Search</button></form>
        {session.user.role === "ADMIN" && <Link href="/work-groups/new" className="dx-btn-gradient min-h-11 text-sm"><Plus className="w-4 h-4" />New group</Link>}
      </div>
      <p className="text-xs text-dx-ink-muted">Only your assigned groups appear here. Each group belongs to one company.</p>
      {groups.length ? <ul aria-label="Your work groups" className="dx-card divide-y divide-dx-line">
        {groups.map((group) => <li key={group.id}><Link href={`/work-groups/${group.id}`} className="flex gap-3 p-4 hover:bg-dx-accent/5 rounded-xl" aria-label={`Open group ${group.name}`}>
          <MessagesSquare className="w-6 h-6 text-dx-accent shrink-0 mt-1" /><div className="min-w-0 flex-1">
            <h2 className="font-semibold text-dx-ink truncate">{group.name}</h2>
            <p className="text-xs text-dx-ink-muted mt-1 truncate">{group.company.name}{group.project ? ` · ${group.project.name}` : ""} · {group._count.members} members</p>
            <p className="text-sm text-dx-ink-muted truncate mt-2">{group.messages[0] ? `${group.messages[0].isAnnouncement ? "Official · " : ""}${group.messages[0].authorName}: ${group.messages[0].body}` : "No messages yet"}</p>
          </div>
        </Link></li>)}
      </ul> : <div className="dx-card p-8 text-center"><MessagesSquare className="w-9 h-9 text-dx-accent mx-auto mb-3" /><h2 className="font-semibold text-dx-ink">{search ? "No matching groups" : "No work groups yet"}</h2><p className="text-sm text-dx-ink-muted mt-2">{session.user.role === "ADMIN" ? "Create a group and choose the staff working on that site or area." : "An administrator can add you to a site or area group."}</p></div>}
      <nav aria-label="Work group pages" className="flex flex-wrap items-center gap-3 text-sm text-dx-ink-muted"><span>{total} groups · Page {page} of {pages}</span>{page > 1 && <Link className="dx-btn-ghost min-h-11" href={href(page - 1)}>Previous</Link>}{page < pages && <Link className="dx-btn-ghost min-h-11" href={href(page + 1)}>Next</Link>}</nav>
    </main>
  </div>;
}
