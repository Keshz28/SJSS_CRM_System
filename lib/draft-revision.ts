const prefix = "sjss-draft-revision:";
export function draftRevision(ownerId: string) {
  return localStorage.getItem(`${prefix}${ownerId}`) || "0";
}
export function invalidateDrafts(ownerId: string) {
  localStorage.setItem(`${prefix}${ownerId}`, crypto.randomUUID());
}
export function notifyDraftsCleared(ownerId: string, notifyCurrent = true) {
  // A distinct completion marker makes other tabs reload only after deletion.
  localStorage.setItem(`sjss-drafts-cleared:${ownerId}`, crypto.randomUUID());
  if (notifyCurrent) window.dispatchEvent(new CustomEvent("sjss-drafts-cleared", { detail: ownerId }));
}
export function onDraftsCleared(ownerId: string, listener: () => void) {
  const local = (event: Event) => { if ((event as CustomEvent<string>).detail === ownerId) listener(); };
  const remote = (event: StorageEvent) => { if (event.key === `sjss-drafts-cleared:${ownerId}`) listener(); };
  window.addEventListener("sjss-drafts-cleared", local);
  window.addEventListener("storage", remote);
  return () => { window.removeEventListener("sjss-drafts-cleared", local); window.removeEventListener("storage", remote); };
}
