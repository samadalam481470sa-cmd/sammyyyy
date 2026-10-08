import fs from "node:fs";
import { configPath } from "./paths";
import type { Profile } from "./filler/fillForm";

export function loadProfile(): Profile {
  const preferred = configPath("profile.json");
  const fallback = configPath("profile.example.json");
  const file = fs.existsSync(preferred) ? preferred : fallback;
  if (!fs.existsSync(file)) {
    throw new Error("Missing config/profile.json — copy profile.example.json and fill FILL_ME values.");
  }
  if (file === fallback) {
    console.warn("[warn] Using profile.example.json. Copy it to profile.json and replace FILL_ME before real applies.");
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as Profile;
}
