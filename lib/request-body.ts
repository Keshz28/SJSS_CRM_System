// Count actual streamed bytes as well as declared Content-Length. This prevents
// chunked requests bypassing the early middleware size check.
export async function readRequestBytes(request: Request | Response, maximum: number) {
  if (Number(request.headers.get("content-length") || 0) > maximum) throw new Error("Body too large");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

/** Invalid JSON becomes a validation error, without reflecting parser details. */
export async function readJson(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
    return JSON.parse(new TextDecoder().decode(await readRequestBytes(request, 1024 * 1024))) as unknown;
  } catch { return null; }
}

export async function readForm(request: Request, maximum = 51 * 1024 * 1024) {
  try {
    const bytes = await readRequestBytes(request, maximum);
    return await new Response(new Uint8Array(bytes), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
  } catch { return new FormData(); }
}
