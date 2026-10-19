import Link from "next/link";
import { Inbox, MessagesSquare } from "lucide-react";

export function CommunicationNav({ active }: { active: "inbox" | "groups" }) {
  return <nav aria-label="Communication sections" className="flex flex-wrap gap-2">
    <Link href="/inbox" aria-current={active === "inbox" ? "page" : undefined} className={`${active === "inbox" ? "dx-btn-gradient" : "dx-btn-ghost"} min-h-11 text-sm`}><Inbox className="w-4 h-4" />Inbox</Link>
    <Link href="/work-groups" aria-current={active === "groups" ? "page" : undefined} className={`${active === "groups" ? "dx-btn-gradient" : "dx-btn-ghost"} min-h-11 text-sm`}><MessagesSquare className="w-4 h-4" />Work groups</Link>
  </nav>;
}
