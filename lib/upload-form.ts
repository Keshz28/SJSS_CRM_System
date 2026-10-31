import { readForm, readJson } from "./request-body";
import { cloudStorageEnabled, downloadStagedFile, storageBucket } from "./cloud-storage";
import { verifyUploadTicket } from "./upload-ticket";
import { readValidatedFile } from "./file-storage";

/** Only signed, user-bound metadata can resolve a staging object. The validated
 * bytes are copied to a NEW final key by storeFile; upload tokens never address
 * permanent files. Local multipart uploads remain available for development. */
export async function readUploadForm(request: Request, userId: string, purpose: "attachment" | "import" | "extract") {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    const form = await readForm(request, cloudStorageEnabled() ? 1024 * 1024 : purpose === "attachment" ? 51 * 1024 * 1024 : 11 * 1024 * 1024);
    if (cloudStorageEnabled() && form.has("file")) throw new Error("Use a direct private upload");
    return form;
  }
  const body = await readJson(request) as { uploadTicket?: unknown } | null;
  if (!cloudStorageEnabled() || typeof body?.uploadTicket !== "string") throw new Error("Invalid upload request");
  const ticket = verifyUploadTicket(body.uploadTicket, userId, purpose);
  if (purpose !== "attachment" && ticket.size > 10 * 1024 * 1024) throw new Error("Document is too large");
  const bytes = await downloadStagedFile(ticket.key, ticket.size);
  if (bytes.byteLength !== ticket.size) throw new Error("Upload size did not match");
  const file = new File([new Uint8Array(bytes)], ticket.name, { type: ticket.type });
  await readValidatedFile(file);
  // The signed upload capability cannot overwrite the validated permanent copy.
  // Abandoned staging objects are removed by storage:cleanup after 24 hours.
  await storageBucket(true).remove([ticket.key]);
  const form = new FormData();
  for (const [key, value] of Object.entries(ticket.metadata)) form.set(key, value);
  form.set("file", file);
  return form;
}
