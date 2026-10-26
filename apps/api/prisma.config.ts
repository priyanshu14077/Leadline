import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// One .env at the repo root, shared by the API, Prisma and the simulator.
config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
