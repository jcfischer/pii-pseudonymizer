/**
 * Pattern-based PII Detector
 * Uses regex patterns to detect structured PII: emails, phones, domains, URLs, IPs
 */

import type { DetectedEntity, EntityType, DetectionOptions } from "../types";

// =============================================================================
// Regex Patterns
// =============================================================================

const PATTERNS: Record<string, { regex: RegExp; type: EntityType }> = {
  // Email addresses (comprehensive)
  email: {
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    type: "EMAIL",
  },

  // Phone numbers (various formats)
  phone: {
    // Matches: +1-555-123-4567, (555) 123-4567, 555-123-4567, 555.123.4567
    // Also: +41 79 123 45 67 (Swiss format)
    regex: /(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}(?:[-.\s]?\d{2,4})?/g,
    type: "PHONE",
  },

  // URLs (http/https)
  url: {
    regex: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
    type: "URL",
  },

  // IP addresses (IPv4 only, validated)
  ip: {
    // Looser pattern, validated in post-processing
    regex: /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g,
    type: "IP",
  },

  // Domain names (standalone, not in URLs or emails)
  domain: {
    // Will be filtered to exclude those within emails/URLs
    regex: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g,
    type: "DOMAIN",
  },
};

// Minimum phone number length to avoid false positives
const MIN_PHONE_LENGTH = 10;

// =============================================================================
// Pattern Detector Class
// =============================================================================

export class PatternDetector {
  /**
   * Detect PII entities using regex patterns
   */
  detect(text: string, options?: DetectionOptions): DetectedEntity[] {
    if (!text) {
      return [];
    }

    const entities: DetectedEntity[] = [];
    const allowedTypes = options?.types;

    // Track positions already covered by higher-priority patterns
    const coveredRanges: Array<{ start: number; end: number }> = [];

    // Process patterns in priority order
    const patternOrder = ["email", "url", "phone", "ip", "domain"];

    for (const patternName of patternOrder) {
      const pattern = PATTERNS[patternName];

      // Skip if type filtering is enabled and this type is not included
      if (allowedTypes && !allowedTypes.includes(pattern.type)) {
        continue;
      }

      // Skip domain detection if not explicitly requested (to avoid overlaps)
      if (patternName === "domain" && allowedTypes && !allowedTypes.includes("DOMAIN")) {
        continue;
      }

      // Reset regex lastIndex
      pattern.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const matchText = match[0];

        // Check if this position is already covered
        if (this.isPositionCovered(start, end, coveredRanges)) {
          continue;
        }

        // Validate specific patterns
        if (patternName === "ip" && !this.isValidIP(matchText)) {
          continue;
        }

        if (patternName === "phone" && !this.isValidPhone(matchText)) {
          continue;
        }

        if (patternName === "domain") {
          // Skip domains that are part of emails or URLs
          if (this.isDomainPartOfOtherEntity(text, start, end)) {
            continue;
          }
        }

        entities.push({
          text: matchText,
          type: pattern.type,
          start,
          end,
          confidence: 1.0,
          method: "pattern",
        });

        // Mark this range as covered
        coveredRanges.push({ start, end });
      }
    }

    // Sort by position
    entities.sort((a, b) => a.start - b.start);

    return entities;
  }

  /**
   * Check if a position is already covered by a previous detection
   */
  private isPositionCovered(
    start: number,
    end: number,
    ranges: Array<{ start: number; end: number }>
  ): boolean {
    for (const range of ranges) {
      // Check for any overlap
      if (start < range.end && end > range.start) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validate IPv4 address (each octet must be 0-255)
   */
  private isValidIP(ip: string): boolean {
    const parts = ip.split(".");
    if (parts.length !== 4) return false;

    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validate phone number (basic length check)
   */
  private isValidPhone(phone: string): boolean {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    // Must have at least MIN_PHONE_LENGTH digits
    return digits.length >= MIN_PHONE_LENGTH;
  }

  /**
   * Check if a domain is part of an email or URL
   */
  private isDomainPartOfOtherEntity(
    text: string,
    start: number,
    end: number
  ): boolean {
    // Check if preceded by @ (email)
    if (start > 0 && text[start - 1] === "@") {
      return true;
    }

    // Check if preceded by :// (URL)
    if (start >= 3 && text.slice(start - 3, start) === "://") {
      return true;
    }

    // Check if within a URL by looking for http before it
    const beforeText = text.slice(0, start);
    const urlMatch = beforeText.match(/https?:\/\/[^\s]*$/);
    if (urlMatch) {
      return true;
    }

    return false;
  }
}
