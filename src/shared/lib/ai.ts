/**
 * Shared Claude API client wrapper.
 *
 * All module code must use this wrapper — never import @anthropic-ai/sdk directly.
 * This ensures a single place for model config, error handling, and token tracking.
 */

import Anthropic from "@anthropic-ai/sdk";

// Lazy singleton — created once on first use
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Required for AI features."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface CallClaudeOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  /** Override the default model. Should only be used in tests. */
  model?: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Calls the Claude API and returns the text response.
 * Throws on API errors — callers decide whether to fallback or surface the error.
 */
export async function callClaude({
  systemPrompt,
  userPrompt,
  maxTokens,
  model = DEFAULT_MODEL,
}: CallClaudeOptions): Promise<string> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const firstContent = response.content[0];
  if (!firstContent || firstContent.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  return firstContent.text;
}

/**
 * Parses a JSON response from Claude. Claude sometimes wraps JSON in markdown code
 * blocks — this strips those before parsing.
 */
export function parseClaudeJson<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  return JSON.parse(cleaned) as T;
}
