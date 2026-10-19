import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
const prisma = new PrismaClient();
try {
  const publicRoot = path.join(process.cwd(), "public", "uploads");
  const privateRoot = path.resolve(
    process.env.UPLOAD_DIR || path.join(process.cwd(), ".local", "uploads"),
  );
  const files = await prisma.attachment.findMany({
    where: { filepath: { startsWith: "uploads/" } },
    select: { filepath: true },
    distinct: ["filepath"],
  });
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  for (const { filepath } of files) {
    const source = path.resolve(process.cwd(), "public", filepath);
    if (!source.startsWith(publicRoot + path.sep))
      throw new Error("Invalid legacy file path; migration stopped.");
    const key = randomUUID();
    const destination = path.join(privateRoot, key);
    await copyFile(source, destination, constants.COPYFILE_EXCL);
    try {
      await prisma.attachment.updateMany({
        where: { filepath },
        data: { filepath: key },
      });
    } catch (error) {
      await unlink(destination);
      throw error;
    }
    await unlink(source);
  }
  console.log(`Moved ${files.length} legacy files into private storage.`);
} finally {
  await prisma.$disconnect();
}
