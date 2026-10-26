import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Separate database so tests never touch the demo data.
    env: { DATABASE_URL: "postgresql://leadline:leadline@localhost:5433/leadline_test?schema=public" },
    globalSetup: "tests/global-setup.ts",
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // Generated Prisma client, and the process entry point (listen + signal handlers).
      exclude: ["src/generated/**", "src/server.ts"],
      reporter: [["text", { skipFull: false }], "html", "json-summary"],
      // The root .gitignore covers /coverage, so reports never show up as untracked files.
      reportsDirectory: "../../coverage/api",
    },
  },
});
