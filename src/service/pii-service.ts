/**
 * PII Service
 * Main service for detecting, pseudonymizing, and restoring PII in text
 */

import type {
  DetectedEntity,
  EntityType,
  DetectionOptions,
  PseudonymizeOptions,
  PseudonymizeResult,
  RestoreResult,
  MappingSession,
  CustomNameConfig,
} from "../types";
import { UnifiedDetector } from "../detector";
import { PseudonymGenerator } from "../pseudonymizer/generator";
import { MappingStore } from "../pseudonymizer/mapper";

// =============================================================================
// PII Service Class
// =============================================================================

export class PIIService {
  private detector: UnifiedDetector;
  private generator: PseudonymGenerator;
  private store: MappingStore;

  constructor() {
    this.detector = new UnifiedDetector();
    this.generator = new PseudonymGenerator();
    this.store = new MappingStore();
  }

  /**
   * Warm up the NER model for faster subsequent detections
   * Call this early if you want to avoid delay on first detection
   */
  async warmUp(): Promise<void> {
    await this.detector.warmUp();
  }

  /**
   * Check if the NER model is initialized
   */
  isNERInitialized(): boolean {
    return this.detector.isNERInitialized();
  }

  // ===========================================================================
  // Custom Names Configuration
  // ===========================================================================

  /**
   * Configure custom names for detection
   * @param config - Custom name configuration with names, aliases, and options
   */
  setCustomNames(config: CustomNameConfig): void {
    this.detector.setCustomNames(config);
  }

  /**
   * Clear custom name configuration
   */
  clearCustomNames(): void {
    this.detector.clearCustomNames();
  }

  /**
   * Check if custom names are configured
   */
  hasCustomNames(): boolean {
    return this.detector.hasCustomNames();
  }

  // ===========================================================================
  // Detection
  // ===========================================================================

  /**
   * Detect PII entities in text
   * Uses both pattern-based and NER-based detection
   */
  async detect(
    text: string,
    options?: DetectionOptions
  ): Promise<DetectedEntity[]> {
    return this.detector.detect(text, options);
  }

  // ===========================================================================
  // Pseudonymization
  // ===========================================================================

  /**
   * Pseudonymize PII in text
   * Replaces detected PII with realistic fake data
   */
  async pseudonymize(
    text: string,
    options?: PseudonymizeOptions
  ): Promise<PseudonymizeResult> {
    // Use provided session or create new one
    const sessionId = options?.sessionId ?? this.store.createSession();

    // Detect PII entities
    const detectionOptions: DetectionOptions = {
      types: options?.types,
    };
    const entities = await this.detect(text, detectionOptions);

    // If no entities found, return original text
    if (entities.length === 0) {
      return {
        text,
        sessionId,
        entities: [],
        replacementCount: 0,
      };
    }

    // Sort entities by position (descending) to replace from end to start
    // This preserves positions of earlier entities
    const sortedEntities = [...entities].sort((a, b) => b.start - a.start);

    let result = text;
    let replacementCount = 0;
    const processedEntities: DetectedEntity[] = [];

    for (const entity of sortedEntities) {
      // Check if we already have a pseudonym for this exact text
      let pseudonym = this.store.getPseudonym(sessionId, entity.text);

      if (!pseudonym) {
        // Generate new pseudonym
        pseudonym = this.generator.generate(entity.type, entity.text);
        // Store the mapping
        this.store.addMapping(sessionId, entity.text, pseudonym, entity.type);
      }

      // Replace in text
      result =
        result.substring(0, entity.start) +
        pseudonym +
        result.substring(entity.end);

      replacementCount++;
      processedEntities.push(entity);
    }

    return {
      text: result,
      sessionId,
      entities: processedEntities.reverse(), // Reverse back to original order
      replacementCount,
    };
  }

  // ===========================================================================
  // Restoration
  // ===========================================================================

  /**
   * Restore pseudonyms back to original PII
   */
  async restore(text: string, sessionId: string): Promise<RestoreResult> {
    const session = this.store.getSession(sessionId);

    // If session doesn't exist, return original text
    if (!session) {
      return {
        text,
        restorationCount: 0,
      };
    }

    // Get reverse mappings (pseudonym → original)
    const reverseMappings = this.store.getReverseMappings(sessionId);

    if (reverseMappings.size === 0) {
      return {
        text,
        restorationCount: 0,
      };
    }

    let result = text;
    let restorationCount = 0;

    // Sort pseudonyms by length (longest first) to avoid partial replacements
    const sortedPseudonyms = Array.from(reverseMappings.keys()).sort(
      (a, b) => b.length - a.length
    );

    for (const pseudonym of sortedPseudonyms) {
      const original = reverseMappings.get(pseudonym);
      if (!original) continue;

      // Replace all occurrences of the pseudonym
      let index = result.indexOf(pseudonym);
      while (index !== -1) {
        result =
          result.substring(0, index) +
          original +
          result.substring(index + pseudonym.length);
        restorationCount++;
        // Continue searching from after the replacement
        index = result.indexOf(pseudonym, index + original.length);
      }
    }

    return {
      text: result,
      restorationCount,
    };
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): MappingSession | undefined {
    return this.store.getSession(sessionId);
  }

  /**
   * List all active session IDs
   */
  listSessions(): string[] {
    return this.store.listSessions();
  }

  /**
   * Clear a session and its mappings
   */
  clearSession(sessionId: string): boolean {
    return this.store.clearSession(sessionId);
  }
}
