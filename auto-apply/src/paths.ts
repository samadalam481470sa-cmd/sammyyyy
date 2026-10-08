import fs from "node:fs";
import path from "node:path";

function baseDir(): string {
  return process.env.DATA_DIR ?? path.join(__dirname, "..");
}

export const paths = {
  get root() {
    return baseDir();
  },
  get config() {
    return path.join(baseDir(), "config");
  },
  get db() {
    return path.join(baseDir(), "auto-apply.db");
  },
  get browserProfile() {
    return path.join(baseDir(), "browser-profile");
  },
  get screenshots() {
    return path.join(baseDir(), "screenshots");
  },
  get generated() {
    return path.join(baseDir(), "resumes", "generated");
  },
  get resumes() {
    return path.join(baseDir(), "resumes");
  },
  get baseResume() {
    return path.join(baseDir(), "resumes", "base-resume.html");
  },
};

export function ensureDataDirs() {
  for (const dir of [paths.config, paths.screenshots, paths.generated, paths.browserProfile, paths.resumes]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function configPath(name: string): string {
  return path.join(paths.config, name);
}
