import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TrpcContext, PublicTrpcContext } from "./context";

const t = initTRPC
  .context<TrpcContext | PublicTrpcContext>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError
              ? error.cause.flatten()
              : null,
        },
      };
    },
  });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// No authentication required (registration, public API endpoints)
export const publicProcedure = t.procedure;

// User must be authenticated — ctx contains userId, tenantId, role, db
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!("userId" in ctx) || !ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: ctx as TrpcContext,
  });
});

// User must be authenticated AND have one of the specified roles
export function roleProcedure(allowedRoles: string[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!allowedRoles.includes((ctx as TrpcContext).role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx: ctx as TrpcContext });
  });
}

// Shorthand role procedures
export const ownerProcedure = roleProcedure(["owner"]);
export const adminProcedure = roleProcedure(["owner", "admin"]);
export const managerProcedure = roleProcedure(["owner", "admin", "manager"]);
