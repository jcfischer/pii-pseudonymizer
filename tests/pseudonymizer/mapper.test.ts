import { describe, it, expect, beforeEach } from "bun:test";

// =============================================================================
// Mapping Store Tests (TDD - RED Phase)
// =============================================================================

describe("MappingStore", () => {
  // ===========================================================================
  // Session Management
  // ===========================================================================

  describe("session management", () => {
    it("should create a new session", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it("should generate unique session IDs", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(store.createSession());
      }

      expect(ids.size).toBe(100);
    });

    it("should get session by ID", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      const session = store.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
    });

    it("should return undefined for non-existent session", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const session = store.getSession("non-existent-id");

      expect(session).toBeUndefined();
    });

    it("should list all sessions", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const id1 = store.createSession();
      const id2 = store.createSession();
      const sessions = store.listSessions();

      expect(sessions).toContain(id1);
      expect(sessions).toContain(id2);
      expect(sessions.length).toBe(2);
    });

    it("should clear a session", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      const cleared = store.clearSession(sessionId);

      expect(cleared).toBe(true);
      expect(store.getSession(sessionId)).toBeUndefined();
    });

    it("should return false when clearing non-existent session", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const cleared = store.clearSession("non-existent");

      expect(cleared).toBe(false);
    });
  });

  // ===========================================================================
  // Mapping Operations
  // ===========================================================================

  describe("mapping operations", () => {
    it("should add a mapping to session", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      store.addMapping(sessionId, "John Doe", "David Smith", "PERSON");

      const pseudonym = store.getPseudonym(sessionId, "John Doe");
      expect(pseudonym).toBe("David Smith");
    });

    it("should support reverse lookup", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      store.addMapping(sessionId, "john@example.com", "david@fake.com", "EMAIL");

      const original = store.getOriginal(sessionId, "david@fake.com");
      expect(original).toBe("john@example.com");
    });

    it("should return undefined for unknown original", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      const pseudonym = store.getPseudonym(sessionId, "unknown");

      expect(pseudonym).toBeUndefined();
    });

    it("should return undefined for unknown pseudonym", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      const original = store.getOriginal(sessionId, "unknown");

      expect(original).toBeUndefined();
    });

    it("should get all mappings for session", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      store.addMapping(sessionId, "John", "David", "PERSON");
      store.addMapping(sessionId, "john@real.com", "david@fake.com", "EMAIL");

      const mappings = store.getAllMappings(sessionId);

      expect(mappings.size).toBe(2);
      expect(mappings.get("John")?.pseudonym).toBe("David");
      expect(mappings.get("john@real.com")?.pseudonym).toBe("david@fake.com");
    });

    it("should get all reverse mappings for session", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      store.addMapping(sessionId, "John", "David", "PERSON");
      store.addMapping(sessionId, "Jane", "Alice", "PERSON");

      const reverse = store.getReverseMappings(sessionId);

      expect(reverse.size).toBe(2);
      expect(reverse.get("David")).toBe("John");
      expect(reverse.get("Alice")).toBe("Jane");
    });
  });

  // ===========================================================================
  // Consistency
  // ===========================================================================

  describe("consistency", () => {
    it("should return same pseudonym for same original", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      store.addMapping(sessionId, "John", "David", "PERSON");

      // Adding same original again should not create new mapping
      store.addMapping(sessionId, "John", "Michael", "PERSON");

      const pseudonym = store.getPseudonym(sessionId, "John");
      expect(pseudonym).toBe("David"); // Should keep first mapping
    });

    it("should handle case-sensitive originals", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      store.addMapping(sessionId, "John", "David", "PERSON");
      store.addMapping(sessionId, "john", "Michael", "PERSON");

      expect(store.getPseudonym(sessionId, "John")).toBe("David");
      expect(store.getPseudonym(sessionId, "john")).toBe("Michael");
    });

    it("should maintain mapping integrity across multiple lookups", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      store.addMapping(sessionId, "Original", "Pseudonym", "PERSON");

      // Multiple lookups should return consistent results
      for (let i = 0; i < 10; i++) {
        expect(store.getPseudonym(sessionId, "Original")).toBe("Pseudonym");
        expect(store.getOriginal(sessionId, "Pseudonym")).toBe("Original");
      }
    });
  });

  // ===========================================================================
  // Session Isolation
  // ===========================================================================

  describe("session isolation", () => {
    it("should isolate mappings between sessions", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const session1 = store.createSession();
      const session2 = store.createSession();

      store.addMapping(session1, "John", "David", "PERSON");
      store.addMapping(session2, "John", "Michael", "PERSON");

      expect(store.getPseudonym(session1, "John")).toBe("David");
      expect(store.getPseudonym(session2, "John")).toBe("Michael");
    });

    it("should not affect other sessions when clearing one", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const session1 = store.createSession();
      const session2 = store.createSession();

      store.addMapping(session1, "John", "David", "PERSON");
      store.addMapping(session2, "Jane", "Alice", "PERSON");

      store.clearSession(session1);

      expect(store.getSession(session1)).toBeUndefined();
      expect(store.getPseudonym(session2, "Jane")).toBe("Alice");
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty strings", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      store.addMapping(sessionId, "", "fake", "PERSON");

      expect(store.getPseudonym(sessionId, "")).toBe("fake");
    });

    it("should handle special characters in originals", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      const special = "O'Brien-Smith Jr.";
      store.addMapping(sessionId, special, "John Doe", "PERSON");

      expect(store.getPseudonym(sessionId, special)).toBe("John Doe");
    });

    it("should handle unicode characters", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      const sessionId = store.createSession();
      store.addMapping(sessionId, "François Müller", "John Smith", "PERSON");

      expect(store.getPseudonym(sessionId, "François Müller")).toBe("John Smith");
    });

    it("should throw when adding to non-existent session", async () => {
      const { MappingStore } = await import("../../src/pseudonymizer/mapper");
      const store = new MappingStore();

      expect(() => {
        store.addMapping("non-existent", "John", "David", "PERSON");
      }).toThrow();
    });
  });
});
