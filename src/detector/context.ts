/**
 * Context Detector - Rule-based name detection using contextual patterns
 *
 * Detects names in specific contexts like email signatures, greetings,
 * headers, and titles where pattern matching is highly reliable.
 */

import type { DetectedEntity, DetectionOptions } from "../types";

// =============================================================================
// Types
// =============================================================================

type ContextType = "signature" | "greeting" | "header" | "title";

interface ContextMatch {
  text: string;
  start: number;
  end: number;
  context: ContextType;
  confidence: number;
}

// =============================================================================
// Patterns
// =============================================================================

/**
 * Common first names for validation (subset - most common English names)
 * Used to validate potential name matches
 */
const COMMON_FIRST_NAMES = new Set([
  // Male names
  "john", "james", "michael", "david", "robert", "william", "richard", "joseph",
  "thomas", "charles", "daniel", "matthew", "anthony", "mark", "donald", "steven",
  "paul", "andrew", "joshua", "kenneth", "kevin", "brian", "george", "timothy",
  "ronald", "edward", "jason", "jeffrey", "ryan", "jacob", "gary", "nicholas",
  "eric", "jonathan", "stephen", "larry", "justin", "scott", "brandon", "benjamin",
  "samuel", "raymond", "gregory", "frank", "alexander", "patrick", "jack", "dennis",
  "jerry", "tyler", "aaron", "jose", "adam", "nathan", "henry", "douglas", "zachary",
  "peter", "kyle", "noah", "ethan", "jeremy", "walter", "christian", "keith", "roger",
  "terry", "austin", "sean", "gerald", "carl", "harold", "dylan", "arthur", "lawrence",
  // Female names
  "mary", "patricia", "jennifer", "linda", "elizabeth", "barbara", "susan", "jessica",
  "sarah", "karen", "lisa", "nancy", "betty", "margaret", "sandra", "ashley", "kimberly",
  "emily", "donna", "michelle", "dorothy", "carol", "amanda", "melissa", "deborah",
  "stephanie", "rebecca", "sharon", "laura", "cynthia", "kathleen", "amy", "angela",
  "shirley", "anna", "brenda", "pamela", "emma", "nicole", "helen", "samantha",
  "katherine", "christine", "debra", "rachel", "carolyn", "janet", "catherine",
  "maria", "heather", "diane", "ruth", "julie", "olivia", "joyce", "virginia",
  "victoria", "kelly", "lauren", "christina", "joan", "evelyn", "judith", "megan",
  "andrea", "cheryl", "hannah", "jacqueline", "martha", "gloria", "teresa", "ann",
  "sara", "madison", "frances", "kathryn", "janice", "jean", "abigail", "alice",
  "judy", "sophia", "grace", "denise", "amber", "doris", "marilyn", "danielle",
  "beverly", "isabella", "theresa", "diana", "natalie", "brittany", "charlotte",
  "marie", "kayla", "alexis", "lori",
]);

/**
 * Common last names for validation
 */
const COMMON_LAST_NAMES = new Set([
  "smith", "johnson", "williams", "brown", "jones", "garcia", "miller", "davis",
  "rodriguez", "martinez", "hernandez", "lopez", "gonzalez", "wilson", "anderson",
  "thomas", "taylor", "moore", "jackson", "martin", "lee", "perez", "thompson",
  "white", "harris", "sanchez", "clark", "ramirez", "lewis", "robinson", "walker",
  "young", "allen", "king", "wright", "scott", "torres", "nguyen", "hill", "flores",
  "green", "adams", "nelson", "baker", "hall", "rivera", "campbell", "mitchell",
  "carter", "roberts", "chen", "mueller", "fischer", "weber", "meyer", "schmidt",
]);

/**
 * Words that should NOT be treated as names
 */
const NON_NAME_WORDS = new Set([
  "team", "support", "admin", "administrator", "customer", "service", "help",
  "info", "contact", "sales", "marketing", "hr", "human", "resources", "department",
  "office", "company", "organization", "group", "staff", "management", "regards",
  "sincerely", "thanks", "cheers", "best", "warmly", "cordially", "respectfully",
]);

// =============================================================================
// Context Detector Class
// =============================================================================

export class ContextDetector {
  /**
   * Detect names in contextual patterns
   */
  detect(text: string, options: DetectionOptions = {}): DetectedEntity[] {
    if (!text || !text.trim()) {
      return [];
    }

    const entities: DetectedEntity[] = [];

    // Run all context detectors
    const signatureMatches = this.detectSignatures(text);
    const greetingMatches = this.detectGreetings(text);
    const headerMatches = this.detectHeaders(text);
    const titleMatches = this.detectTitles(text);

    // Combine all matches
    const allMatches = [
      ...signatureMatches,
      ...greetingMatches,
      ...headerMatches,
      ...titleMatches,
    ];

    // Convert to DetectedEntity format
    for (const match of allMatches) {
      entities.push({
        text: match.text,
        type: "PERSON",
        start: match.start,
        end: match.end,
        confidence: match.confidence,
        method: "context",
        context: match.context,
      });
    }

    // Sort by position
    entities.sort((a, b) => a.start - b.start);

    return entities;
  }

  // ===========================================================================
  // Signature Detection
  // ===========================================================================

  /**
   * Detect names in email signature blocks
   * Patterns: "--\n", "Best regards,", "Sincerely,", "Thanks,", "Cheers,", "Best,"
   */
  private detectSignatures(text: string): ContextMatch[] {
    const matches: ContextMatch[] = [];

    // Pattern 1: Signature delimiter "--" followed by name on next line
    const delimiterPattern = /^--\s*\n([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gm;
    let match;
    while ((match = delimiterPattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (this.isValidName(name)) {
        const nameStart = match.index + match[0].indexOf(name);
        matches.push({
          text: name,
          start: nameStart,
          end: nameStart + name.length,
          context: "signature",
          confidence: 0.85,
        });
      }
    }

    // Pattern 2: Closing phrases followed by name on next line
    const closingPhrases = [
      "Best regards",
      "Sincerely",
      "Thanks",
      "Cheers",
      "Best",
      "Regards",
      "Warm regards",
      "Kind regards",
      "Many thanks",
      "Thank you",
      "Warmly",
      "Cordially",
    ];

    for (const phrase of closingPhrases) {
      // Match phrase followed by comma/newline and name
      const pattern = new RegExp(
        `${this.escapeRegex(phrase)},?\\s*\\n([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)`,
        "gm"
      );
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (this.isValidName(name)) {
          const nameStart = match.index + match[0].indexOf(match[1]);
          matches.push({
            text: name,
            start: nameStart,
            end: nameStart + name.length,
            context: "signature",
            confidence: 0.85,
          });
        }
      }
    }

    return matches;
  }

  // ===========================================================================
  // Greeting Detection
  // ===========================================================================

  /**
   * Detect names in greetings/salutations
   * Patterns: "Dear X,", "Hi X,", "Hello X,"
   */
  private detectGreetings(text: string): ContextMatch[] {
    const matches: ContextMatch[] = [];

    const greetingPrefixes = ["Dear", "Hi", "Hello", "Hey", "Good morning", "Good afternoon"];

    for (const prefix of greetingPrefixes) {
      // Match greeting followed by name and comma/colon/newline
      const pattern = new RegExp(
        `${this.escapeRegex(prefix)}\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)[,:\\n]`,
        "gm"
      );
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (this.isValidName(name)) {
          const nameStart = match.index + match[0].indexOf(match[1]);
          matches.push({
            text: name,
            start: nameStart,
            end: nameStart + name.length,
            context: "greeting",
            confidence: 0.9,
          });
        }
      }
    }

    return matches;
  }

  // ===========================================================================
  // Header Detection
  // ===========================================================================

  /**
   * Detect names in header fields
   * Patterns: "From:", "To:", "Cc:", "Contact:", "Author:"
   */
  private detectHeaders(text: string): ContextMatch[] {
    const matches: ContextMatch[] = [];

    const headerPrefixes = ["From", "To", "Cc", "Bcc", "Contact", "Author", "By", "Sender"];

    for (const prefix of headerPrefixes) {
      // Match header followed by name
      const pattern = new RegExp(
        `${this.escapeRegex(prefix)}:\\s*([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)`,
        "gm"
      );
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (this.isValidName(name)) {
          const nameStart = match.index + match[0].indexOf(match[1]);
          matches.push({
            text: name,
            start: nameStart,
            end: nameStart + name.length,
            context: "header",
            confidence: 0.9,
          });
        }
      }
    }

    return matches;
  }

  // ===========================================================================
  // Title Detection
  // ===========================================================================

  /**
   * Detect names with honorific titles
   * Patterns: "Dr. X", "Mr. X", "Ms. X", "Mrs. X", "Prof. X"
   */
  private detectTitles(text: string): ContextMatch[] {
    const matches: ContextMatch[] = [];

    const titles = ["Dr", "Mr", "Ms", "Mrs", "Miss", "Prof", "Professor", "Sir", "Madam"];

    for (const title of titles) {
      // Match title with optional period, followed by name
      const pattern = new RegExp(
        `\\b(${this.escapeRegex(title)}\\.?\\s+[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)\\b`,
        "g"
      );
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[1].trim();
        matches.push({
          text: fullMatch,
          start: match.index,
          end: match.index + fullMatch.length,
          context: "title",
          confidence: 0.95,
        });
      }
    }

    return matches;
  }

  // ===========================================================================
  // Validation Helpers
  // ===========================================================================

  /**
   * Check if a string looks like a valid name
   */
  private isValidName(text: string): boolean {
    if (!text || text.length < 2) return false;

    // Check if it's a non-name word
    if (NON_NAME_WORDS.has(text.toLowerCase())) return false;

    const parts = text.split(/\s+/);

    // Single word - check if it's a known first name
    if (parts.length === 1) {
      const lower = text.toLowerCase();
      return COMMON_FIRST_NAMES.has(lower) || this.looksLikeName(text);
    }

    // Two words - more likely to be a name
    if (parts.length === 2) {
      const [first, last] = parts;
      // Both parts should start with uppercase
      if (!/^[A-Z]/.test(first) || !/^[A-Z]/.test(last)) return false;
      // Check against known names or name-like patterns
      return (
        COMMON_FIRST_NAMES.has(first.toLowerCase()) ||
        COMMON_LAST_NAMES.has(last.toLowerCase()) ||
        (this.looksLikeName(first) && this.looksLikeName(last))
      );
    }

    // More than 2 parts - less common but possible
    return parts.every(
      (p) => /^[A-Z][a-z]+$/.test(p) && !NON_NAME_WORDS.has(p.toLowerCase())
    );
  }

  /**
   * Check if a word looks like it could be a name based on pattern
   */
  private looksLikeName(word: string): boolean {
    // Must start with uppercase, rest lowercase
    if (!/^[A-Z][a-z]+$/.test(word)) return false;
    // Reasonable length for a name
    if (word.length < 2 || word.length > 20) return false;
    return true;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
