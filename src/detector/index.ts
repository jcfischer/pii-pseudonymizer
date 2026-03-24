/**
 * Unified PII Detector
 *
 * Combines pattern-based detection (EMAIL, PHONE, URL, IP, DOMAIN),
 * context-aware detection (names in signatures, greetings, headers, titles),
 * custom name detection (user-specified names with aliases),
 * and NER-based detection (PERSON, ORG, LOCATION).
 *
 * Priority for overlapping positions: Pattern > Context > Custom > NER
 */

import { PatternDetector } from "./patterns";
import { NERDetector } from "./ner";
import { ContextDetector } from "./context";
import { CustomNameDetector } from "./custom";
import type { DetectedEntity, DetectionOptions, EntityType, CustomNameConfig } from "../types";

// Re-export individual detectors
export { PatternDetector } from "./patterns";
export { NERDetector } from "./ner";
export { ContextDetector } from "./context";
export { CustomNameDetector } from "./custom";

// =============================================================================
// Entity Type Categories
// =============================================================================

/** Entity types handled by pattern detection */
const PATTERN_TYPES: EntityType[] = ["EMAIL", "PHONE", "URL", "IP", "DOMAIN"];

/** Entity types handled by NER detection */
const NER_TYPES: EntityType[] = ["PERSON", "ORG", "LOCATION"];

/** Entity types handled by context detection */
const CONTEXT_TYPES: EntityType[] = ["PERSON"];

// =============================================================================
// Unified Detector Class
// =============================================================================

export class UnifiedDetector {
  private patternDetector: PatternDetector;
  private nerDetector: NERDetector;
  private contextDetector: ContextDetector;
  private customDetector: CustomNameDetector;

  constructor() {
    this.patternDetector = new PatternDetector();
    this.nerDetector = new NERDetector();
    this.contextDetector = new ContextDetector();
    this.customDetector = new CustomNameDetector();
  }

  /**
   * Warm up the NER model for faster subsequent detections
   */
  async warmUp(): Promise<void> {
    await this.nerDetector.initialize();
  }

  /**
   * Check if NER model is initialized
   */
  isNERInitialized(): boolean {
    return this.nerDetector.isInitialized();
  }

  /**
   * Configure custom names for detection
   * @param config - Custom name configuration with names, aliases, and options
   */
  setCustomNames(config: CustomNameConfig): void {
    this.customDetector.setConfig(config);
  }

  /**
   * Clear custom name configuration
   */
  clearCustomNames(): void {
    this.customDetector.clearConfig();
  }

  /**
   * Check if custom names are configured
   */
  hasCustomNames(): boolean {
    return this.customDetector.hasNames();
  }

  /**
   * Detect PII entities using patterns, context, and NER
   *
   * @param text - Text to analyze
   * @param options - Detection options
   * @returns Array of detected entities, sorted by position
   */
  async detect(
    text: string,
    options: DetectionOptions = {}
  ): Promise<DetectedEntity[]> {
    if (!text || !text.trim()) {
      return [];
    }

    const requestedTypes = options.types;
    const usePatterns = options.usePatterns !== false;
    const useNER = options.useNER !== false;
    const useContext = options.useContext !== false;

    // Determine which detectors to use based on requested types
    const needPatterns = usePatterns && this.needsPatternDetection(requestedTypes);
    const needContext = useContext && this.needsContextDetection(requestedTypes);
    const needCustom = this.customDetector.hasNames() && this.needsCustomDetection(requestedTypes);
    const needNER = useNER && this.needsNERDetection(requestedTypes);

    // Run detectors in parallel where possible
    const [patternEntities, contextEntities, customEntities, nerEntities] = await Promise.all([
      needPatterns
        ? Promise.resolve(this.patternDetector.detect(text, options))
        : Promise.resolve([]),
      needContext
        ? Promise.resolve(this.contextDetector.detect(text, options))
        : Promise.resolve([]),
      needCustom
        ? Promise.resolve(this.customDetector.detect(text))
        : Promise.resolve([]),
      needNER
        ? this.nerDetector.detect(text, options)
        : Promise.resolve([]),
    ]);

    // Merge results, resolving overlaps
    // Priority: Pattern > Context > Custom > NER
    const merged = this.mergeEntities(patternEntities, contextEntities, customEntities, nerEntities);

    // Sort by position
    merged.sort((a, b) => a.start - b.start);

    return merged;
  }

  /**
   * Check if we need pattern detection based on requested types
   */
  private needsPatternDetection(requestedTypes?: EntityType[]): boolean {
    if (!requestedTypes) {
      return true; // No filter, use all detectors
    }
    return requestedTypes.some((t) => PATTERN_TYPES.includes(t));
  }

  /**
   * Check if we need context detection based on requested types
   */
  private needsContextDetection(requestedTypes?: EntityType[]): boolean {
    if (!requestedTypes) {
      return true; // No filter, use all detectors
    }
    return requestedTypes.some((t) => CONTEXT_TYPES.includes(t));
  }

  /**
   * Check if we need NER detection based on requested types
   */
  private needsNERDetection(requestedTypes?: EntityType[]): boolean {
    if (!requestedTypes) {
      return true; // No filter, use all detectors
    }
    return requestedTypes.some((t) => NER_TYPES.includes(t));
  }

  /**
   * Check if we need custom detection based on requested types
   * Custom names can be PERSON or ORG
   */
  private needsCustomDetection(requestedTypes?: EntityType[]): boolean {
    if (!requestedTypes) {
      return true; // No filter, use all detectors
    }
    // Custom names support PERSON and ORG types
    return requestedTypes.some((t) => t === "PERSON" || t === "ORG");
  }

  /**
   * Merge entities from all detectors, resolving overlaps
   *
   * Priority: Pattern > Context > Custom > NER
   */
  private mergeEntities(
    patternEntities: DetectedEntity[],
    contextEntities: DetectedEntity[],
    customEntities: DetectedEntity[],
    nerEntities: DetectedEntity[]
  ): DetectedEntity[] {
    // Start with pattern entities (highest priority)
    const result: DetectedEntity[] = [...patternEntities];

    // Track covered ranges
    const coveredRanges = patternEntities.map((e) => ({
      start: e.start,
      end: e.end,
    }));

    // Add context entities that don't overlap with pattern entities
    for (const entity of contextEntities) {
      if (!this.isOverlapping(entity, coveredRanges)) {
        result.push(entity);
        coveredRanges.push({ start: entity.start, end: entity.end });
      }
    }

    // Add custom entities that don't overlap with pattern or context entities
    for (const entity of customEntities) {
      if (!this.isOverlapping(entity, coveredRanges)) {
        result.push(entity);
        coveredRanges.push({ start: entity.start, end: entity.end });
      }
    }

    // Add NER entities that don't overlap with previous detections
    for (const entity of nerEntities) {
      if (!this.isOverlapping(entity, coveredRanges)) {
        result.push(entity);
        coveredRanges.push({ start: entity.start, end: entity.end });
      }
    }

    return result;
  }

  /**
   * Check if an entity overlaps with any covered range
   */
  private isOverlapping(
    entity: DetectedEntity,
    ranges: Array<{ start: number; end: number }>
  ): boolean {
    for (const range of ranges) {
      // Check for any overlap
      if (entity.start < range.end && entity.end > range.start) {
        return true;
      }
    }
    return false;
  }
}
