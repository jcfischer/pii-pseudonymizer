/**
 * Bidirectional Mapping Store
 * Manages sessions and mappings between original PII and pseudonyms
 */

import type { MappingSession, PIIMapping, EntityType } from "../types";

// =============================================================================
// Mapping Store Class
// =============================================================================

export class MappingStore {
  private sessions = new Map<string, MappingSession>();

  /**
   * Create a new mapping session
   */
  createSession(): string {
    const sessionId = this.generateSessionId();
    const session: MappingSession = {
      sessionId,
      createdAt: new Date(),
      mappings: new Map(),
      reverse: new Map(),
    };
    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): MappingSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all active session IDs
   */
  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Clear a session and its mappings
   */
  clearSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Add a mapping to a session
   * If the original already exists, keeps the first mapping
   */
  addMapping(
    sessionId: string,
    original: string,
    pseudonym: string,
    type: EntityType
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Don't overwrite existing mappings for same original
    if (session.mappings.has(original)) {
      return;
    }

    const mapping: PIIMapping = {
      original,
      pseudonym,
      type,
      createdAt: new Date(),
    };

    session.mappings.set(original, mapping);
    session.reverse.set(pseudonym, original);
  }

  /**
   * Get pseudonym for an original value
   */
  getPseudonym(sessionId: string, original: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    return session.mappings.get(original)?.pseudonym;
  }

  /**
   * Get original value for a pseudonym (reverse lookup)
   */
  getOriginal(sessionId: string, pseudonym: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    return session.reverse.get(pseudonym);
  }

  /**
   * Get all mappings for a session
   */
  getAllMappings(sessionId: string): Map<string, PIIMapping> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return new Map();
    }
    return new Map(session.mappings);
  }

  /**
   * Get all reverse mappings (pseudonym → original)
   */
  getReverseMappings(sessionId: string): Map<string, string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return new Map();
    }
    return new Map(session.reverse);
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `pii_${timestamp}_${random}`;
  }
}
