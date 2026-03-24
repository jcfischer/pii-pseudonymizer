/**
 * Custom Name Detector - Configurable name detection
 *
 * Detects user-specified names (customers, partners, etc.) with support for:
 * - Canonical names with aliases
 * - Case-sensitive or case-insensitive matching
 * - Word boundary or partial matching
 */

import type { DetectedEntity, CustomNameConfig, CustomNameEntry, EntityType } from "../types";

// =============================================================================
// Types
// =============================================================================

interface NameMatcher {
  /** The text to match */
  pattern: string;
  /** Regex for matching */
  regex: RegExp;
  /** Entity type */
  type: EntityType;
  /** Canonical name (for aliases) */
  canonical?: string;
  /** Whether this is an alias (affects confidence) */
  isAlias: boolean;
}

// =============================================================================
// Custom Name Detector Class
// =============================================================================

export class CustomNameDetector {
  private matchers: NameMatcher[] = [];
  private caseSensitive: boolean = false;
  private matchPartial: boolean = false;

  constructor(config: CustomNameConfig = {}) {
    this.setConfig(config);
  }

  /**
   * Set or update the configuration
   */
  setConfig(config: CustomNameConfig): void {
    this.caseSensitive = config.caseSensitive ?? false;
    this.matchPartial = config.matchPartial ?? false;
    this.matchers = [];

    // Add structured names
    if (config.names) {
      for (const entry of config.names) {
        this.addNameEntry(entry);
      }
    }

    // Add simple names (default to PERSON type)
    if (config.simpleNames) {
      for (const name of config.simpleNames) {
        this.addNameEntry({ name, type: "PERSON" });
      }
    }

    // Sort matchers by pattern length (longest first) for overlap handling
    this.matchers.sort((a, b) => b.pattern.length - a.pattern.length);
  }

  /**
   * Clear all configuration
   */
  clearConfig(): void {
    this.matchers = [];
  }

  /**
   * Add a name entry to the matchers
   */
  private addNameEntry(entry: CustomNameEntry): void {
    // Add the primary name
    this.matchers.push({
      pattern: entry.name,
      regex: this.buildRegex(entry.name),
      type: entry.type,
      isAlias: false,
    });

    // Add aliases
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        this.matchers.push({
          pattern: alias,
          regex: this.buildRegex(alias),
          type: entry.type,
          canonical: entry.name,
          isAlias: true,
        });
      }
    }
  }

  /**
   * Build a regex for matching a name
   */
  private buildRegex(name: string): RegExp {
    // Escape special regex characters
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Build pattern with optional word boundaries
    // Only add \b when the character at that position is a word character
    // This handles names like "Company (UK)" where ) is not a word character
    let pattern: string;
    if (this.matchPartial) {
      pattern = escaped;
    } else {
      const firstChar = name.charAt(0);
      const lastChar = name.charAt(name.length - 1);
      const startsWithWord = /\w/.test(firstChar);
      const endsWithWord = /\w/.test(lastChar);

      const prefix = startsWithWord ? "\\b" : "";
      const suffix = endsWithWord ? "\\b" : "";
      pattern = `${prefix}${escaped}${suffix}`;
    }

    // Build flags
    const flags = this.caseSensitive ? "g" : "gi";

    return new RegExp(pattern, flags);
  }

  /**
   * Detect custom names in text
   */
  detect(text: string): DetectedEntity[] {
    if (!text || !text.trim() || this.matchers.length === 0) {
      return [];
    }

    const entities: DetectedEntity[] = [];
    const coveredRanges: Array<{ start: number; end: number }> = [];

    // Process matchers in order (longest patterns first)
    for (const matcher of this.matchers) {
      // Reset regex state
      matcher.regex.lastIndex = 0;

      let match;
      while ((match = matcher.regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        // Check if this range overlaps with existing matches
        if (this.isOverlapping({ start, end }, coveredRanges)) {
          continue;
        }

        // Calculate confidence
        const confidence = this.calculateConfidence(matcher, match[0]);

        const entity: DetectedEntity = {
          text: match[0],
          type: matcher.type,
          start,
          end,
          confidence,
          method: "custom",
        };

        // Add canonical name if this is an alias
        if (matcher.canonical) {
          entity.canonical = matcher.canonical;
        }

        entities.push(entity);
        coveredRanges.push({ start, end });
      }
    }

    // Sort by position
    entities.sort((a, b) => a.start - b.start);

    return entities;
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(matcher: NameMatcher, matchedText: string): number {
    let confidence = 1.0;

    // Alias matches get slightly lower confidence
    if (matcher.isAlias) {
      confidence = 0.95;
    }

    // Case mismatch reduces confidence
    if (!this.caseSensitive && matchedText !== matcher.pattern) {
      // Check if it's just a case difference
      if (matchedText.toLowerCase() === matcher.pattern.toLowerCase()) {
        confidence = Math.min(confidence, 0.95);
      }
    }

    return confidence;
  }

  /**
   * Check if a range overlaps with existing ranges
   */
  private isOverlapping(
    range: { start: number; end: number },
    existingRanges: Array<{ start: number; end: number }>
  ): boolean {
    for (const existing of existingRanges) {
      if (range.start < existing.end && range.end > existing.start) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if the detector has any configured names
   */
  hasNames(): boolean {
    return this.matchers.length > 0;
  }

  /**
   * Get the number of configured names (including aliases)
   */
  getNameCount(): number {
    return this.matchers.length;
  }
}
