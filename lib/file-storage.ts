import { randomUUID } from "crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
export class FileValidationError extends Error {}
const extensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/3gpp": ".3gp",
  "audio/webm": ".webm",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};
const uploadRoot = path.resolve(
  process.env.UPLOAD_DIR || path.join(process.cwd(), ".local", "uploads"),
);

export function storedFilePath(key: string) {
  // Legacy files are still readable through the authenticated route during migration.
  const root = key.startsWith("uploads/")
    ? path.join(process.cwd(), "public")
    : uploadRoot;
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(root + path.sep))
    throw new Error("Invalid storage key");
  return resolved;
}

export async function readValidatedFile(file: File) {
  const mimetype = file.type.split(";")[0].trim().toLowerCase();
  const ext = extensions[mimetype];
  if (!ext)
    throw new FileValidationError(
      "Unsupported file type. Choose a photo, video, voice note, PDF or office document.",
    );
  if (!file.size || file.size > MAX_UPLOAD_SIZE)
    throw new FileValidationError("Choose a non-empty file under 50 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const ascii = (start: number, end: number) =>
    bytes.toString("ascii", start, end);
  const hex = bytes.subarray(0, 4).toString("hex");
  const container = ascii(4, 8) === "ftyp";
  let valid = false;
  if (mimetype === "image/jpeg") valid = bytes[0] === 255 && bytes[1] === 216;
  else if (mimetype === "image/png") valid = hex === "89504e47";
  else if (mimetype === "image/gif") valid = ascii(0, 3) === "GIF";
  else if (mimetype === "image/webp")
    valid = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  else if (
    [
      "image/heic",
      "image/heif",
      "video/mp4",
      "video/quicktime",
      "video/3gpp",
      "audio/mp4",
    ].includes(mimetype)
  )
    valid = container;
  else if (mimetype.endsWith("webm")) valid = hex === "1a45dfa3";
  else if (mimetype === "audio/ogg") valid = ascii(0, 4) === "OggS";
  else if (mimetype.includes("wav"))
    valid = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
  else if (["audio/mpeg", "audio/aac"].includes(mimetype))
    valid =
      ascii(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  else if (mimetype === "application/pdf") valid = ascii(0, 5) === "%PDF-";
  else valid = hex === "504b0304" || hex === "d0cf11e0";
  if (!valid)
    throw new FileValidationError(
      "The file content does not match its type. Please choose the original file.",
    );
  return { bytes, mimetype, ext };
}

export async function storeFile(file: File) {
  const { bytes, mimetype, ext } = await readValidatedFile(file);
  await mkdir(uploadRoot, { recursive: true, mode: 0o700 });
  const filepath = `${randomUUID()}${ext}`;
  await writeFile(storedFilePath(filepath), bytes, { flag: "wx", mode: 0o600 });
  return {
    filepath,
    filename: path.basename(file.name).slice(0, 200),
    filesize: file.size,
    mimetype,
  };
}

export async function removeUnreferencedFile(filepath: string) {
  if (await prisma.attachment.count({ where: { filepath } })) return;
  try {
    await unlink(storedFilePath(filepath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export { readFile, stat };
