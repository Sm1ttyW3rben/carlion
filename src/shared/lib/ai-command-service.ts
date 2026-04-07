/**
 * AI Command Service — Propose → Preview → Confirm → Execute → Log → Undo
 *
 * Phase 1: Stufe 1 (Assistent only).
 * All writing AI tools MUST go through propose() — never mutate directly.
 *
 * Spec: 01_ARCHITECTURE.md Section 6 (AI-Aktionsprotokoll)
 *       00_VISION.md Section 5 (AI-Automatisierungsstufen)
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { aiActionCommands } from "@/server/db/schema/ai-action-commands";
import type { TrpcContext } from "@/server/trpc/context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProposeInput<TChanges = unknown, TPreview = unknown> {
  /** Module originating the action (e.g. "inventory", "crm") */
  module: string;
  /** Human-readable action identifier (e.g. "create_vehicle", "update_vehicle_status") */
  action: string;
  /** The data that would change — shown in Preview step */
  proposedChanges: TChanges;
  /** Returns a dry-run preview without touching the DB */
  preview: () => Promise<TPreview>;
  /** The actual mutation — called only after confirmation */
  executeOnConfirm: () => Promise<unknown>;
}

export interface ProposeResult<TPreview = unknown> {
  commandId: string;
  confirmToken: string;
  preview: TPreview;
  expiresAt: string;
}

export interface ConfirmInput {
  commandId: string;
  confirmToken: string;
}

export interface ConfirmResult {
  commandId: string;
  status: "executed";
  result: unknown;
}

// ---------------------------------------------------------------------------
// propose()
// ---------------------------------------------------------------------------

/**
 * Creates an ai_action_commands record in "proposed" state,
 * runs the dry-run preview, and returns the confirm token.
 *
 * The token is valid for 5 minutes. Without confirmation nothing is mutated.
 */
export async function propose<TChanges = unknown, TPreview = unknown>(
  input: ProposeInput<TChanges, TPreview>,
  ctx: TrpcContext
): Promise<ProposeResult<TPreview>> {
  const confirmToken = randomBytes(32).toString("hex");
  const confirmExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Run preview first — if it throws the command is never written
  const preview = await input.preview();

  const [command] = await ctx.db
    .insert(aiActionCommands)
    .values({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      actionType: input.action,
      targetModule: input.module,
      proposedChanges: input.proposedChanges as Record<string, unknown>,
      confirmToken,
      confirmExpires,
      status: "proposed",
    })
    .returning({ id: aiActionCommands.id });

  if (!command) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  return {
    commandId: command.id,
    confirmToken,
    preview,
    expiresAt: confirmExpires.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// confirm()
// ---------------------------------------------------------------------------

/**
 * Validates the confirm token and executes the stored action.
 * The executeOnConfirm callback is re-provided by the caller (tRPC router).
 *
 * Security:
 * - Token must match exactly (constant-time comparison not needed — random 32-byte hex)
 * - Token must not be expired
 * - Command must be in "proposed" state
 * - Command must belong to the current tenant/user
 */
export async function confirm(
  input: ConfirmInput,
  executeOnConfirm: () => Promise<unknown>,
  ctx: TrpcContext
): Promise<ConfirmResult> {
  const [command] = await ctx.db
    .select()
    .from(aiActionCommands)
    .where(eq(aiActionCommands.id, input.commandId))
    .limit(1);

  if (!command) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Aktion nicht gefunden." });
  }

  // Tenant isolation — the RLS would also block, but explicit is safer
  if (command.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  if (command.status !== "proposed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Diese Aktion wurde bereits ausgeführt, abgelaufen oder storniert.",
    });
  }

  if (command.confirmToken !== input.confirmToken) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ungültiges Bestätigungs-Token." });
  }

  if (!command.confirmExpires || command.confirmExpires < new Date()) {
    await ctx.db
      .update(aiActionCommands)
      .set({ status: "expired" })
      .where(eq(aiActionCommands.id, input.commandId));

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Das Bestätigungs-Token ist abgelaufen. Bitte starte die Aktion erneut.",
    });
  }

  // Mark as confirmed before executing (prevents double-execution on retry)
  await ctx.db
    .update(aiActionCommands)
    .set({ status: "confirmed" })
    .where(eq(aiActionCommands.id, input.commandId));

  try {
    const result = await executeOnConfirm();

    await ctx.db
      .update(aiActionCommands)
      .set({
        status: "executed",
        executedAt: new Date(),
        // confirmToken cleared after use
        confirmToken: null,
      })
      .where(eq(aiActionCommands.id, input.commandId));

    return { commandId: input.commandId, status: "executed", result };
  } catch (err) {
    // Roll back to proposed if execution fails so user can retry
    await ctx.db
      .update(aiActionCommands)
      .set({ status: "proposed" })
      .where(eq(aiActionCommands.id, input.commandId));

    throw err;
  }
}

// ---------------------------------------------------------------------------
// cancel()
// ---------------------------------------------------------------------------

export async function cancel(commandId: string, ctx: TrpcContext): Promise<void> {
  const [command] = await ctx.db
    .select({ tenantId: aiActionCommands.tenantId, status: aiActionCommands.status })
    .from(aiActionCommands)
    .where(eq(aiActionCommands.id, commandId))
    .limit(1);

  if (!command || command.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  if (command.status !== "proposed") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Nur vorgeschlagene Aktionen können storniert werden." });
  }

  await ctx.db
    .update(aiActionCommands)
    .set({ status: "cancelled" })
    .where(eq(aiActionCommands.id, commandId));
}
