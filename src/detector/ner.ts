/**
 * NER Detector - Named Entity Recognition using Transformers.js
 *
 * Detects PERSON, ORG, and LOCATION entities using a pre-trained BERT NER model.
 * Features lazy model loading and token aggregation for multi-word entities.
 */

import type { DetectedEntity, DetectionOptions, EntityType } from "../types";

// Pipeline type definition (loaded dynamically to support compiled binaries)
type Pipeline = any;

// =============================================================================
// Types
// =============================================================================

/**
 * Raw NER token from Transformers.js
 * Note: start/end may not be present depending on model/options
 */
interface NERToken {
  /** The word/token text */
  word: string;
  /** NER entity tag (B-PER, I-PER, B-ORG, etc.) */
  entity: string;
  /** Confidence score 0-1 */
  score: number;
  /** Token index in sequence */
  index: number;
  /** Character start position (may not be present) */
  start?: number;
  /** Character end position (may not be present) */
  end?: number;
}

/**
 * Map NER tags to our EntityType
 */
const NER_TAG_MAP: Record<string, EntityType> = {
  PER: "PERSON",
  PERSON: "PERSON",
  ORG: "ORG",
  ORGANIZATION: "ORG",
  LOC: "LOCATION",
  LOCATION: "LOCATION",
  GPE: "LOCATION", // Geo-Political Entity
  MISC: "ORG", // Miscellaneous often includes organizations
};

/**
 * Entity types that NER can detect
 */
const NER_ENTITY_TYPES: EntityType[] = ["PERSON", "ORG", "LOCATION"];

// =============================================================================
// NER Detector Class
// =============================================================================

export class NERDetector {
  private pipeline: Pipeline | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private initFailed: boolean = false;

  /**
   * Model to use for NER
   * Xenova/bert-base-NER is optimized for JavaScript and supports PER/ORG/LOC/MISC
   */
  private readonly modelName = "Xenova/bert-base-NER";

  /**
   * Check if the detector is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if initialization failed (e.g., ONNX runtime not available in compiled binary)
   */
  isUnavailable(): boolean {
    return this.initFailed;
  }

  /**
   * Initialize the NER model
   * Call this explicitly for warm-up, or let detect() handle it lazily
   */
  async initialize(): Promise<void> {
    if (this.initialized || this.initFailed) return;

    // Prevent multiple concurrent initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    await this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Dynamic import to allow graceful fallback in compiled binaries
      // Native ONNX modules can't be bundled in Bun compiled executables
      const { pipeline } = await import("@huggingface/transformers");

      // Use quantized model (q8) for smaller size and faster loading
      // Suppress progress logging by default
      this.pipeline = await pipeline("token-classification", this.modelName, {
        dtype: "q8",
        progress_callback: undefined,
      });
      this.initialized = true;
    } catch (error) {
      this.initPromise = null;
      this.initFailed = true;
      // Don't throw - allow graceful fallback to pattern-only mode
      // This happens when running as compiled binary (ONNX runtime not available)
      console.error(
        `[PII] NER unavailable (pattern-only mode): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Detect NER entities in text
   */
  async detect(
    text: string,
    options: DetectionOptions = {}
  ): Promise<DetectedEntity[]> {
    // Handle empty/whitespace text
    if (!text || !text.trim()) {
      return [];
    }

    // Ensure model is loaded
    if (!this.initialized && !this.initFailed) {
      await this.initialize();
    }

    // Return empty if NER is unavailable (e.g., compiled binary without ONNX)
    if (!this.pipeline) {
      return [];
    }

    // Filter types to only NER-compatible ones
    const requestedTypes = options.types?.filter((t) =>
      NER_ENTITY_TYPES.includes(t)
    );

    // If types are specified but none are NER types, return empty
    if (options.types && (!requestedTypes || requestedTypes.length === 0)) {
      return [];
    }

    const minConfidence = options.minConfidence ?? 0.7;

    try {
      // Run NER inference
      const results = (await this.pipeline(text)) as NERToken[];

      // Aggregate tokens into entities
      const entities = this.aggregateTokens(results, text);

      // Apply filters
      return entities.filter((entity) => {
        // Filter by confidence
        if (entity.confidence < minConfidence) {
          return false;
        }

        // Filter by type if specified
        if (requestedTypes && !requestedTypes.includes(entity.type)) {
          return false;
        }

        return true;
      });
    } catch (error) {
      // Log error but don't crash - return empty results
      console.error(
        `NER detection error: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Aggregate NER tokens into complete entities
   *
   * NER models return tokens like:
   * - B-PER: Beginning of person name
   * - I-PER: Inside/continuation of person name
   *
   * This function merges consecutive tokens of the same type.
   */
  private aggregateTokens(
    tokens: NERToken[],
    originalText: string
  ): DetectedEntity[] {
    const entities: DetectedEntity[] = [];
    let currentEntity: {
      tokens: NERToken[];
      type: EntityType;
    } | null = null;
    let searchFrom = 0;

    const finalize = () => {
      if (currentEntity) {
        const result = this.finalizeEntity(
          { ...currentEntity, searchFrom },
          originalText
        );
        // Only add if we found valid positions
        if (result.entity.start >= 0) {
          entities.push(result.entity);
          searchFrom = result.nextSearchFrom;
        }
        currentEntity = null;
      }
    };

    for (const token of tokens) {
      // Skip "O" (outside) tokens
      if (token.entity === "O") {
        finalize();
        continue;
      }

      // Parse the entity tag (e.g., "B-PER" -> { prefix: "B", type: "PER" })
      const { prefix, baseType } = this.parseEntityTag(token.entity);
      const mappedType = NER_TAG_MAP[baseType];

      // Skip if we can't map this entity type
      if (!mappedType) {
        finalize();
        continue;
      }

      // B- prefix means beginning of new entity
      if (prefix === "B") {
        finalize();
        // Start new entity
        currentEntity = {
          tokens: [token],
          type: mappedType,
        };
      }
      // I- prefix means continuation
      else if (prefix === "I" && currentEntity && currentEntity.type === mappedType) {
        currentEntity.tokens.push(token);
      }
      // I- without matching B-, or different type - treat as new entity
      else {
        finalize();
        currentEntity = {
          tokens: [token],
          type: mappedType,
        };
      }
    }

    // Don't forget the last entity
    finalize();

    return entities;
  }

  /**
   * Parse NER entity tag into prefix and base type
   * E.g., "B-PER" -> { prefix: "B", baseType: "PER" }
   */
  private parseEntityTag(tag: string): { prefix: string; baseType: string } {
    if (tag.includes("-")) {
      const [prefix, ...rest] = tag.split("-");
      return { prefix, baseType: rest.join("-") };
    }
    // Some models don't use B-/I- prefixes
    return { prefix: "B", baseType: tag };
  }

  /**
   * Finalize an aggregated entity, computing text, positions, and confidence
   */
  private finalizeEntity(
    entity: { tokens: NERToken[]; type: EntityType; searchFrom: number },
    originalText: string
  ): { entity: DetectedEntity; nextSearchFrom: number } {
    const { tokens, type, searchFrom } = entity;

    // Build the entity text from tokens
    const entityText = this.buildEntityText(tokens);

    // Find position in original text (case-insensitive search)
    const { start, end, actualText } = this.findInText(
      originalText,
      entityText,
      searchFrom
    );

    // Calculate average confidence
    const confidence =
      tokens.reduce((sum, t) => sum + t.score, 0) / tokens.length;

    return {
      entity: {
        text: actualText,
        type,
        start,
        end,
        confidence,
        method: "ner",
      },
      nextSearchFrom: end,
    };
  }

  /**
   * Build entity text from tokens, handling BERT's ## subword tokens
   */
  private buildEntityText(tokens: NERToken[]): string {
    let text = "";
    for (const token of tokens) {
      if (token.word.startsWith("##")) {
        // Subword continuation - append without space
        text += token.word.substring(2);
      } else if (text.length > 0) {
        // New word - add space
        text += " " + token.word;
      } else {
        text = token.word;
      }
    }
    return text;
  }

  /**
   * Find entity text in original text, returning actual positions
   */
  private findInText(
    originalText: string,
    entityText: string,
    searchFrom: number
  ): { start: number; end: number; actualText: string } {
    // Try exact match first
    let idx = originalText.indexOf(entityText, searchFrom);
    if (idx !== -1) {
      return {
        start: idx,
        end: idx + entityText.length,
        actualText: entityText,
      };
    }

    // Try case-insensitive match
    const lowerOriginal = originalText.toLowerCase();
    const lowerEntity = entityText.toLowerCase();
    idx = lowerOriginal.indexOf(lowerEntity, searchFrom);
    if (idx !== -1) {
      return {
        start: idx,
        end: idx + entityText.length,
        actualText: originalText.substring(idx, idx + entityText.length),
      };
    }

    // Fallback: search from beginning
    idx = lowerOriginal.indexOf(lowerEntity);
    if (idx !== -1) {
      return {
        start: idx,
        end: idx + entityText.length,
        actualText: originalText.substring(idx, idx + entityText.length),
      };
    }

    // Last resort: return -1 positions (should be filtered out)
    return {
      start: -1,
      end: -1,
      actualText: entityText,
    };
  }
}
