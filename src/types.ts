/**
 * PII Service Types
 * Core type definitions for PII detection, pseudonymization, and restoration
 */

// =============================================================================
// Entity Types
// =============================================================================

/**
 * Types of PII that can be detected
 */
export type EntityType =
  | "PERSON"      // Person names (via NER)
  | "ORG"         // Organization/company names (via NER)
  | "EMAIL"       // Email addresses (via regex)
  | "PHONE"       // Phone numbers (via regex)
  | "DOMAIN"      // Domain names (via regex)
  | "URL"         // URLs (via regex)
  | "IP"          // IP addresses (via regex)
  | "DATE"        // Dates (via regex) - optional
  | "LOCATION";   // Locations (via NER) - optional

/**
 * A detected PII entity in text
 */
export interface DetectedEntity {
  /** The original text of the entity */
  text: string;
  /** The type of PII */
  type: EntityType;
  /** Start position in the original text */
  start: number;
  /** End position in the original text */
  end: number;
  /** Confidence score (0-1), 1.0 for regex matches */
  confidence: number;
  /** Detection method */
  method: "ner" | "pattern" | "context" | "custom";
  /** Context type (for context-detected entities) */
  context?: "signature" | "greeting" | "header" | "title";
  /** Canonical name (for custom names with aliases) */
  canonical?: string;
}

// =============================================================================
// Custom Name Configuration
// =============================================================================

/**
 * A custom name entry for detection
 */
export interface CustomNameEntry {
  /** The primary/canonical name */
  name: string;
  /** Entity type (PERSON or ORG) */
  type: "PERSON" | "ORG";
  /** Alternative names/abbreviations that map to this entry */
  aliases?: string[];
}

/**
 * Configuration for custom name detection
 */
export interface CustomNameConfig {
  /** Structured name entries with type and aliases */
  names?: CustomNameEntry[];
  /** Simple list of names (all treated as PERSON) */
  simpleNames?: string[];
  /** Case-sensitive matching (default: false) */
  caseSensitive?: boolean;
  /** Match names within words, not just at boundaries (default: false) */
  matchPartial?: boolean;
}

// =============================================================================
// Mapping Types
// =============================================================================

/**
 * A single mapping between original and pseudonym
 */
export interface PIIMapping {
  /** Original PII value */
  original: string;
  /** Generated pseudonym */
  pseudonym: string;
  /** Entity type */
  type: EntityType;
  /** When this mapping was created */
  createdAt: Date;
}

/**
 * A session containing all mappings for a pseudonymization operation
 */
export interface MappingSession {
  /** Unique session identifier */
  sessionId: string;
  /** When the session was created */
  createdAt: Date;
  /** All mappings in this session (original → mapping) */
  mappings: Map<string, PIIMapping>;
  /** Reverse lookup (pseudonym → original) */
  reverse: Map<string, string>;
}

// =============================================================================
// Service Options
// =============================================================================

/**
 * Options for PII detection
 */
export interface DetectionOptions {
  /** Entity types to detect (default: all) */
  types?: EntityType[];
  /** Minimum confidence threshold for NER (default: 0.7) */
  minConfidence?: number;
  /** Whether to use NER for names/orgs (default: true) */
  useNER?: boolean;
  /** Whether to use pattern matching (default: true) */
  usePatterns?: boolean;
  /** Whether to use context-aware detection for names (default: true) */
  useContext?: boolean;
}

/**
 * Options for pseudonymization
 */
export interface PseudonymizeOptions extends DetectionOptions {
  /** Session ID to use (generates new if not provided) */
  sessionId?: string;
  /** Locale for generating fake data (default: "en") */
  locale?: string;
}

/**
 * Result of pseudonymization
 */
export interface PseudonymizeResult {
  /** The pseudonymized text */
  text: string;
  /** Session ID for restoration */
  sessionId: string;
  /** All detected and replaced entities */
  entities: DetectedEntity[];
  /** Number of replacements made */
  replacementCount: number;
}

/**
 * Result of restoration
 */
export interface RestoreResult {
  /** The restored text with original PII */
  text: string;
  /** Number of restorations made */
  restorationCount: number;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Main PII service interface
 */
export interface IPIIService {
  /**
   * Detect PII entities in text
   */
  detect(text: string, options?: DetectionOptions): Promise<DetectedEntity[]>;

  /**
   * Pseudonymize PII in text
   */
  pseudonymize(text: string, options?: PseudonymizeOptions): Promise<PseudonymizeResult>;

  /**
   * Restore original PII from pseudonymized text
   */
  restore(text: string, sessionId: string): Promise<RestoreResult>;

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): MappingSession | undefined;

  /**
   * Clear a session
   */
  clearSession(sessionId: string): boolean;

  /**
   * List all active sessions
   */
  listSessions(): string[];
}
