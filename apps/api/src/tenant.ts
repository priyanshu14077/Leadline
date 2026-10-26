import { Prisma } from "./generated/prisma/client";
import { prisma } from "./db";

// Models that carry practiceId. Practice itself is the tenant, not tenant data.
const TENANT_MODELS = new Set<string>(["Campaign", "Lead", "WebhookDelivery", "TraceSpan"]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

type Args = Record<string, unknown> & { where?: object; data?: unknown; create?: object };

function scope(practiceId: string, operation: string, args: Args): Args {
  const next = { ...args };

  if (WHERE_OPS.has(operation) || operation === "upsert") {
    // Spread rather than AND so unique-where ops (findUnique, update, delete) keep their unique key.
    next.where = { ...args.where, practiceId };
  }
  if (CREATE_OPS.has(operation)) {
    next.data = Array.isArray(args.data)
      ? args.data.map((row) => ({ ...row, practiceId }))
      : { ...(args.data as object), practiceId };
  }
  if (operation === "upsert") {
    next.create = { ...args.create, practiceId };
  }
  // Moving a row to another tenant is never allowed.
  if ((operation.startsWith("update") || operation === "upsert") && next.data && !Array.isArray(next.data)) {
    next.data = { ...(next.data as object), practiceId };
  }
  return next;
}

/** A Prisma client whose every query on tenant models is filtered to one practice. */
export function forPractice(practiceId: string) {
  return prisma.$extends(
    Prisma.defineExtension({
      name: "tenant",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!TENANT_MODELS.has(model)) return query(args);
            return query(scope(practiceId, operation, args as Args));
          },
        },
      },
    }),
  );
}

export type TenantDb = ReturnType<typeof forPractice>;
