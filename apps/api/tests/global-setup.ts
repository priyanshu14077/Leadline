import { execSync } from "node:child_process";

export default function setup() {
  execSync("bunx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "postgresql://leadline:leadline@localhost:5433/leadline_test?schema=public" },
    stdio: "inherit",
  });
}
