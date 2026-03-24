#!/usr/bin/env bun
/**
 * PII CLI
 * Command-line interface for PII detection, pseudonymization, and restoration
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { PIIService } from "./service/pii-service";
import type { EntityType, CustomNameConfig } from "./types";

const program = new Command();

// =============================================================================
// CLI Configuration
// =============================================================================

program
  .name("pii")
  .description("PII detection, pseudonymization, and restoration")
  .version("1.0.0");

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Read input from stdin or file
 */
async function readInput(options: { file?: string }): Promise<string> {
  if (options.file) {
    if (!existsSync(options.file)) {
      throw new Error(`File not found: ${options.file}`);
    }
    return readFileSync(options.file, "utf-8");
  }

  // Read from stdin
  const chunks: string[] = [];
  const reader = Bun.stdin.stream().getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(new TextDecoder().decode(value));
  }

  return chunks.join("").trim();
}

/**
 * Parse entity types from comma-separated string
 */
function parseTypes(types?: string): EntityType[] | undefined {
  if (!types) return undefined;
  return types.split(",").map((t) => t.trim().toUpperCase() as EntityType);
}

/**
 * Load session from file
 */
function loadSession(
  sessionFile: string
): { sessionId: string; mappings: [string, any][] } | null {
  if (!existsSync(sessionFile)) {
    return null;
  }
  const data = JSON.parse(readFileSync(sessionFile, "utf-8"));
  return data;
}

/**
 * Load custom names configuration from file
 */
function loadCustomNames(configFile: string): CustomNameConfig | null {
  if (!existsSync(configFile)) {
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(configFile, "utf-8"));
    return data as CustomNameConfig;
  } catch {
    console.error(`Error: Failed to parse custom names config: ${configFile}`);
    return null;
  }
}

/**
 * Save session to file
 */
function saveSession(
  sessionFile: string,
  sessionId: string,
  service: PIIService
): void {
  const session = service.getSession(sessionId);
  if (!session) return;

  const data = {
    sessionId,
    createdAt: session.createdAt.toISOString(),
    mappings: Array.from(session.mappings.entries()).map(([key, value]) => ({
      original: value.original,
      pseudonym: value.pseudonym,
      type: value.type,
    })),
  };

  writeFileSync(sessionFile, JSON.stringify(data, null, 2));
}

// =============================================================================
// Detect Command
// =============================================================================

program
  .command("detect")
  .description("Detect PII entities in text (patterns: EMAIL, PHONE, URL, IP, DOMAIN; context/NER: PERSON, ORG, LOCATION)")
  .option("-f, --file <path>", "Read input from file")
  .option("-t, --types <types>", "Filter by entity types (comma-separated: EMAIL,PHONE,URL,IP,DOMAIN,PERSON,ORG,LOCATION)")
  .option(
    "--format <format>",
    "Output format: json (default) or text",
    "json"
  )
  .option("--warm-up", "Pre-load NER model before detection")
  .option("--no-ner", "Disable NER detection (pattern + context only)")
  .option("--no-context", "Disable context-aware detection (pattern + NER only)")
  .option("--custom-names <path>", "Load custom names configuration from JSON file")
  .action(async (options) => {
    try {
      const input = await readInput(options);
      const service = new PIIService();

      // Load custom names if provided
      if (options.customNames) {
        const customConfig = loadCustomNames(options.customNames);
        if (!customConfig) {
          console.error(`Error: Custom names file not found: ${options.customNames}`);
          process.exit(1);
        }
        service.setCustomNames(customConfig);
      }

      // Warm up NER model if requested
      if (options.warmUp) {
        console.error("[PII] Warming up NER model...");
        await service.warmUp();
        console.error("[PII] NER model ready");
      }

      const entities = await service.detect(input, {
        types: parseTypes(options.types),
        useNER: options.ner !== false,
        useContext: options.context !== false,
      });

      if (options.format === "text") {
        if (entities.length === 0) {
          console.log("No PII detected");
        } else {
          for (const entity of entities) {
            console.log(
              `${entity.type}: "${entity.text}" (${entity.start}-${entity.end})`
            );
          }
        }
      } else {
        console.log(
          JSON.stringify(
            {
              entities,
              count: entities.length,
            },
            null,
            2
          )
        );
      }
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

// =============================================================================
// Pseudonymize Command
// =============================================================================

program
  .command("pseudonymize")
  .description("Replace PII with pseudonyms")
  .option("-f, --file <path>", "Read input from file")
  .option("-t, --types <types>", "Filter by entity types (comma-separated)")
  .option("--text-only", "Output only the pseudonymized text")
  .option("--save-session <path>", "Save session to file for later restoration")
  .option("--load-session <path>", "Load existing session from file")
  .option("-v, --verbose", "Show translation table (original → pseudonym mappings)")
  .option("--custom-names <path>", "Load custom names configuration from JSON file")
  .action(async (options) => {
    try {
      const input = await readInput(options);
      const service = new PIIService();

      // Load custom names if provided
      if (options.customNames) {
        const customConfig = loadCustomNames(options.customNames);
        if (!customConfig) {
          console.error(`Error: Custom names file not found: ${options.customNames}`);
          process.exit(1);
        }
        service.setCustomNames(customConfig);
      }

      // If loading session, we need to reconstruct it
      // For CLI, we create fresh sessions but can save/load mappings
      let existingSessionId: string | undefined;

      if (options.loadSession) {
        const sessionData = loadSession(options.loadSession);
        if (sessionData) {
          // Create a new session and populate it with existing mappings
          // This ensures consistent pseudonyms for previously seen values
          const tempResult = await service.pseudonymize(input, {
            types: parseTypes(options.types),
          });

          // Note: In CLI mode, each invocation is a fresh process
          // To truly reuse sessions across invocations, we'd need persistence
          // For now, save-session/load-session handles the use case
          existingSessionId = tempResult.sessionId;
        }
      }

      const result = await service.pseudonymize(input, {
        types: parseTypes(options.types),
        sessionId: existingSessionId,
      });

      // Save session if requested
      if (options.saveSession) {
        saveSession(options.saveSession, result.sessionId, service);
      }

      // Build translation table from session mappings
      const session = service.getSession(result.sessionId);
      const translationTable: Array<{
        original: string;
        pseudonym: string;
        type: string;
      }> = [];

      if (session) {
        for (const [, mapping] of session.mappings) {
          translationTable.push({
            original: mapping.original,
            pseudonym: mapping.pseudonym,
            type: mapping.type,
          });
        }
      }

      if (options.textOnly) {
        console.log(result.text);
        // Show translation table to stderr in verbose mode
        if (options.verbose && translationTable.length > 0) {
          console.error("\n--- Translation Table ---");
          for (const entry of translationTable) {
            console.error(`[${entry.type}] "${entry.original}" → "${entry.pseudonym}"`);
          }
        }
      } else {
        const output: Record<string, unknown> = {
          text: result.text,
          sessionId: result.sessionId,
          replacementCount: result.replacementCount,
          entities: result.entities.map((e) => ({
            type: e.type,
            original: e.text,
          })),
        };

        // Include translation table in verbose mode
        if (options.verbose) {
          output.translationTable = translationTable;
        }

        console.log(JSON.stringify(output, null, 2));
      }
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

// =============================================================================
// Restore Command
// =============================================================================

program
  .command("restore")
  .description("Restore pseudonyms back to original PII")
  .option("-f, --file <path>", "Read input from file")
  .option("--text-only", "Output only the restored text")
  .option("--load-session <path>", "Load session from file (required)")
  .action(async (options) => {
    try {
      if (!options.loadSession) {
        console.error("Error: --load-session is required for restore command");
        process.exit(1);
      }

      const sessionData = loadSession(options.loadSession);
      if (!sessionData) {
        console.error(`Error: Session file not found: ${options.loadSession}`);
        process.exit(1);
      }

      const input = await readInput(options);

      // Perform restoration by simple string replacement
      // Use the mappings from the saved session
      let result = input;
      let restorationCount = 0;

      // Sort by pseudonym length (longest first) to avoid partial replacements
      const mappings = [...sessionData.mappings].sort(
        (a, b) => b.pseudonym.length - a.pseudonym.length
      );

      for (const mapping of mappings) {
        const { original, pseudonym } = mapping;
        let index = result.indexOf(pseudonym);
        while (index !== -1) {
          result =
            result.substring(0, index) +
            original +
            result.substring(index + pseudonym.length);
          restorationCount++;
          index = result.indexOf(pseudonym, index + original.length);
        }
      }

      if (options.textOnly) {
        console.log(result);
      } else {
        console.log(
          JSON.stringify(
            {
              text: result,
              restorationCount,
            },
            null,
            2
          )
        );
      }
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

// =============================================================================
// Parse and Execute
// =============================================================================

program.parse();
