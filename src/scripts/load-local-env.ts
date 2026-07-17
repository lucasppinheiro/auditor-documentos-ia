import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

export function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    if (existsSync(fileName)) {
      loadEnvFile(fileName);
    }
  }
}
