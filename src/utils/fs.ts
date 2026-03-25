import { chmod, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { GeneratedFile, ResumeState } from "../types.js";

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectoryEmpty(path: string): Promise<boolean> {
  if (!(await pathExists(path))) {
    return true;
  }

  const stats = await stat(path);
  if (!stats.isDirectory()) {
    return false;
  }

  const entries = await readdir(path);
  return entries.length === 0;
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function writeTextFile(path: string, content: string, executable = false): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, content, "utf8");

  if (executable) {
    await chmod(path, 0o755);
  }
}

export async function writeGeneratedFiles(rootDir: string, files: GeneratedFile[]): Promise<string[]> {
  const written: string[] = [];
  const seenPaths = new Set<string>();
  const resolvedRoot = resolve(rootDir);

  for (const file of files) {
    const fullPath = resolve(resolvedRoot, file.path);

    if (fullPath !== resolvedRoot && !fullPath.startsWith(`${resolvedRoot}${sep}`)) {
      throw new Error(`Refusing to write generated file outside the target directory: ${file.path}`);
    }

    if (seenPaths.has(fullPath)) {
      throw new Error(`Duplicate generated file path detected: ${file.path}`);
    }

    seenPaths.add(fullPath);
    await writeTextFile(fullPath, file.content, file.executable);
    written.push(fullPath);
  }

  return written;
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeTextFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

export async function readJson<T>(path: string): Promise<T> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as T;
}

export async function saveResumeState(path: string, state: ResumeState): Promise<void> {
  await writeJson(path, state);
}

export async function removeFile(path: string): Promise<void> {
  if (await pathExists(path)) {
    await rm(path, { force: true });
  }
}
