import { accountCaptureDrafts } from "@/lib/capture-drafts";
import { invalidateDrafts, notifyDraftsCleared } from "@/lib/draft-revision";

function messageKeys(ownerId: string) {
  return Object.keys(localStorage).filter((key) => key.startsWith(`sjss-group-draft:${ownerId}:`));
}
export async function countDeviceDrafts(ownerId: string) {
  return { captures: await accountCaptureDrafts(ownerId), messages: messageKeys(ownerId).length };
}
export async function clearDeviceDrafts(ownerId: string, notifyCurrent = true) {
  // Invalidate autosaves before starting the deletion transaction. A delayed
  // save from another open tab must not put old photos/messages back afterwards.
  invalidateDrafts(ownerId);
  await accountCaptureDrafts(ownerId, true);
  for (const key of messageKeys(ownerId)) localStorage.removeItem(key);
  notifyDraftsCleared(ownerId, notifyCurrent);
}
