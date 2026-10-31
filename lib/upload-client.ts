/** The browser sends file bytes directly to private object storage in hosted mode. */
export async function uploadForm(url: string, form: FormData, signal?: AbortSignal) {
  const file = form.get("file");
  // Imports without an attachment are small and can use the existing endpoint.
  if (!(file instanceof File)) return fetch(url, { method: "POST", body: form, signal });
  const purpose = url === "/api/uploads" ? "attachment" : url === "/api/quotations/extract" ? "extract" : "import";
  const metadata = Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const prepare = await fetch("/api/uploads/prepare", {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose, name: file.name, type: file.type.split(";")[0].trim().toLowerCase(), size: file.size, metadata }),
  });
  if (!prepare.ok) return prepare;
  const data = await prepare.json();
  if (data.mode === "local") return fetch(url, { method: "POST", body: form, signal });
  const uploaded = await fetch(data.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type, "x-upsert": "false" }, signal });
  if (!uploaded.ok) throw new Error("The private upload failed. Please try again.");
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadTicket: data.uploadTicket }), signal });
}
