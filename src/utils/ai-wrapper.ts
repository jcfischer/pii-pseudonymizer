/**
 * AI Wrapper with PII Protection
 *
 * Provides utilities to wrap AI calls with automatic PII pseudonymization/restoration.
 * Uses the PII CLI for processing to avoid dependency issues with compiled binaries.
 */

import { existsSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// =============================================================================
// Types
// =============================================================================

export interface PIIProtectionOptions {
  /** Entity types to pseudonymize (default: all) */
  types?: string[];
  /** Enable verbose logging to stderr */
  verbose?: boolean;
  /** Path to custom names configuration file */
  customNamesConfig?: string;
}

export interface ProtectedCallResult<T> {
  /** The restored result from AI */
  result: T;
  /** Number of PII entities that were protected */
  entitiesProtected: number;
  /** Number of restorations performed */
  restorationsPerformed: number;
  /** Session ID used (for debugging) */
  sessionId: string;
}

// =============================================================================
// PII CLI Path
// =============================================================================

const PII_CLI = process.env.PII_CLI || join(import.meta.dir, "../../pii");

/**
 * Check if PII CLI is available
 */
function isPIICLIAvailable(): boolean {
  return existsSync(PII_CLI);
}

// =============================================================================
// CLI-based PII Operations
// =============================================================================

interface PseudonymizeResult {
  text: string;
  sessionId: string;
  replacementCount: number;
  entities: Array<{ type: string; original: string }>;
}

interface RestoreResult {
  text: string;
  restorationCount: number;
}

/**
 * Pseudonymize text using PII CLI
 */
async function pseudonymizeViaCLI(
  text: string,
  sessionFile: string,
  options: PIIProtectionOptions = {}
): Promise<PseudonymizeResult> {
  const args = [PII_CLI, "pseudonymize", "--save-session", sessionFile];

  if (options.types && options.types.length > 0) {
    args.push("--types", options.types.join(","));
  }

  if (options.customNamesConfig) {
    args.push("--custom-names", options.customNamesConfig);
  }

  const proc = Bun.spawn(args, {
    stdin: new Response(text).body,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`PII CLI failed: ${stderr}`);
  }

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Failed to parse PII CLI output: ${stdout}`);
  }
}

/**
 * Restore text using PII CLI
 */
async function restoreViaCLI(
  text: string,
  sessionFile: string
): Promise<RestoreResult> {
  const proc = Bun.spawn(
    [PII_CLI, "restore", "--load-session", sessionFile],
    {
      stdin: new Response(text).body,
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`PII CLI restore failed: ${stderr}`);
  }

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Failed to parse PII CLI restore output: ${stdout}`);
  }
}

// =============================================================================
// Core Wrapper Functions
// =============================================================================

/**
 * Wrap an AI call with PII protection
 *
 * @param prompt - The prompt to send to AI
 * @param aiCall - Function that makes the AI call, receives pseudonymized prompt
 * @param options - PII protection options
 * @returns Protected call result with restored AI response
 *
 * @example
 * ```typescript
 * const result = await protectedAICall(
 *   "Contact john@example.com about the project",
 *   async (safePrompt) => {
 *     return await anthropic.messages.create({
 *       model: "claude-sonnet-4-20250514",
 *       messages: [{ role: "user", content: safePrompt }]
 *     });
 *   }
 * );
 * // result.result contains the AI response with original PII restored
 * ```
 */
export async function protectedAICall<T extends string>(
  prompt: string,
  aiCall: (safePrompt: string) => Promise<T>,
  options: PIIProtectionOptions = {}
): Promise<ProtectedCallResult<T>> {
  // Check if PII CLI is available
  if (!isPIICLIAvailable()) {
    if (options.verbose) {
      console.error("[PII] CLI not found, skipping protection");
    }
    const result = await aiCall(prompt);
    return {
      result,
      entitiesProtected: 0,
      restorationsPerformed: 0,
      sessionId: "",
    };
  }

  // Create temp session file
  const sessionFile = join(
    tmpdir(),
    `pii-session-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );

  try {
    if (options.verbose) {
      console.error("[PII] Starting protected AI call...");
    }

    // Pseudonymize the prompt
    const pseudoResult = await pseudonymizeViaCLI(prompt, sessionFile, options);

    if (options.verbose) {
      console.error(
        `[PII] Pseudonymized ${pseudoResult.replacementCount} entities in prompt`
      );
      if (pseudoResult.entities.length > 0) {
        const typeCounts = pseudoResult.entities.reduce(
          (acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
        console.error(`[PII] Entity types: ${JSON.stringify(typeCounts)}`);
      }
    }

    // Make the AI call with protected prompt
    const aiResponse = await aiCall(pseudoResult.text);

    // Restore PII in the response
    const restoreResult = await restoreViaCLI(aiResponse, sessionFile);

    if (options.verbose) {
      console.error(
        `[PII] Restored ${restoreResult.restorationCount} entities in response`
      );
    }

    return {
      result: restoreResult.text as T,
      entitiesProtected: pseudoResult.replacementCount,
      restorationsPerformed: restoreResult.restorationCount,
      sessionId: pseudoResult.sessionId,
    };
  } finally {
    // Clean up session file
    try {
      if (existsSync(sessionFile)) {
        unlinkSync(sessionFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

// =============================================================================
// Anthropic-Specific Wrapper
// =============================================================================

/**
 * Options for Anthropic API calls with PII protection
 */
export interface AnthropicPIIOptions extends PIIProtectionOptions {
  /** Whether PII protection is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Extract text content from Anthropic message response
 */
export function extractAnthropicText(
  content: Array<{ type: string; text?: string }>
): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text || "")
    .join("\n\n");
}

/**
 * Wrap an Anthropic messages.create call with PII protection
 *
 * @param prompt - The user prompt
 * @param anthropicCall - Function that creates the Anthropic message
 * @param options - PII protection options
 *
 * @example
 * ```typescript
 * const response = await protectedAnthropicCall(
 *   buildPrepPrompt(doc),
 *   async (safePrompt) => {
 *     return await anthropic.messages.create({
 *       model: "claude-sonnet-4-20250514",
 *       max_tokens: 4096,
 *       messages: [{ role: "user", content: safePrompt }]
 *     });
 *   },
 *   { verbose: true }
 * );
 * ```
 */
export async function protectedAnthropicCall(
  prompt: string,
  anthropicCall: (safePrompt: string) => Promise<{
    content: Array<{ type: string; text?: string }>;
  }>,
  options: AnthropicPIIOptions = {}
): Promise<ProtectedCallResult<string>> {
  // If PII protection is disabled, just make the call directly
  if (options.enabled === false) {
    const response = await anthropicCall(prompt);
    const text = extractAnthropicText(response.content);
    return {
      result: text,
      entitiesProtected: 0,
      restorationsPerformed: 0,
      sessionId: "",
    };
  }

  return protectedAICall(
    prompt,
    async (safePrompt) => {
      const response = await anthropicCall(safePrompt);
      return extractAnthropicText(response.content);
    },
    options
  );
}

// =============================================================================
// Legacy exports for backward compatibility
// =============================================================================

/**
 * @deprecated Use protectedAICall instead
 */
export async function pseudonymize(
  text: string,
  options: PIIProtectionOptions = {}
): Promise<{ text: string; sessionId: string; replacementCount: number }> {
  const sessionFile = join(
    tmpdir(),
    `pii-session-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
  const result = await pseudonymizeViaCLI(text, sessionFile, options);
  // Note: caller must manage session file cleanup
  return {
    text: result.text,
    sessionId: sessionFile, // Return file path as "session ID"
    replacementCount: result.replacementCount,
  };
}

/**
 * @deprecated Use protectedAICall instead
 */
export async function restore(
  text: string,
  sessionId: string
): Promise<{ text: string; restorationCount: number }> {
  // sessionId is actually the session file path
  if (!existsSync(sessionId)) {
    return { text, restorationCount: 0 };
  }
  return restoreViaCLI(text, sessionId);
}

/**
 * @deprecated Use protectedAICall instead
 */
export function clearSession(sessionId: string): boolean {
  try {
    if (existsSync(sessionId)) {
      unlinkSync(sessionId);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// For testing - not needed with CLI approach
export function resetPIIService(): void {
  // No-op - CLI is stateless
}

export function getPIIService(): null {
  return null;
}
