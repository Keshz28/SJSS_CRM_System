import { test, expect } from "@playwright/test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

// Use the actual CLI encryption module, not a second implementation.
test("backup encryption rejects altered data, wrong keys and exposed key files", async () => {
  const { encryptionKey, encryptFile, decryptFile } = await import("../scripts/backup-crypto.mjs");
  const root = await mkdtemp("/tmp/sjss-crypto-test-");
  try {
    const keyFile = path.join(root, "key"), source = path.join(root, "source"), encrypted = path.join(root, "encrypted");
    const key = await encryptionKey(keyFile, true), data = randomBytes(256 * 1024);
    await writeFile(source, data);
    await encryptFile(source, encrypted, key);
    const restored = path.join(root, "restored");
    await decryptFile(encrypted, restored, key);
    expect(await readFile(restored)).toEqual(data);
    await expect(decryptFile(encrypted, path.join(root, "wrong"), randomBytes(32))).rejects.toThrow();
    const changed = await readFile(encrypted); changed[100] ^= 1;
    await writeFile(path.join(root, "changed"), changed);
    await expect(decryptFile(path.join(root, "changed"), path.join(root, "tampered"), key)).rejects.toThrow();
    await chmod(keyFile, 0o644);
    await expect(encryptionKey(keyFile)).rejects.toThrow("private regular file");
  } finally { await rm(root, { recursive: true, force: true }); }
});
