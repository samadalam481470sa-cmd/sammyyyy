/**
 * Creates .env from .env.example on first run so `npm run setup` works on a
 * fresh clone without a manual copy step. Never overwrites an existing .env.
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(projectRoot, ".env");
const examplePath = resolve(projectRoot, ".env.example");

if (existsSync(envPath)) {
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error("Missing .env.example; cannot create .env.");
  process.exit(1);
}

copyFileSync(examplePath, envPath);
console.log("Created .env from .env.example");
