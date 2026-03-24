import { describe, it, expect } from "bun:test";

// =============================================================================
// PII Service Tests (TDD - RED Phase)
// =============================================================================

describe("PIIService", () => {
  // ===========================================================================
  // Detection
  // ===========================================================================

  describe("detect", () => {
    it("should detect PII entities in text", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const text = "Contact john@example.com or call 555-123-4567";
      const entities = await service.detect(text);

      expect(entities.length).toBeGreaterThanOrEqual(2);
      const types = entities.map((e) => e.type);
      expect(types).toContain("EMAIL");
      expect(types).toContain("PHONE");
    });

    it("should return empty array for text without PII", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const text = "This is just regular text without any personal information.";
      const entities = await service.detect(text);

      expect(entities).toHaveLength(0);
    });

    it("should filter by entity types when specified", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const text = "Email: test@example.com Phone: 555-123-4567";
      const entities = await service.detect(text, { types: ["EMAIL"] });

      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe("EMAIL");
    });
  });

  // ===========================================================================
  // Pseudonymization
  // ===========================================================================

  describe("pseudonymize", () => {
    it("should replace PII with pseudonyms", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const text = "Contact me at john@example.com";
      const result = await service.pseudonymize(text);

      expect(result.text).not.toContain("john@example.com");
      expect(result.text).toContain("@"); // Should have replacement email
      expect(result.sessionId).toBeDefined();
      expect(result.entities).toHaveLength(1);
      expect(result.replacementCount).toBe(1);
    });

    it("should replace multiple PII entities", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const text = "Email alice@corp.com or bob@startup.io";
      const result = await service.pseudonymize(text);

      expect(result.text).not.toContain("alice@corp.com");
      expect(result.text).not.toContain("bob@startup.io");
      expect(result.replacementCount).toBe(2);
    });

    it("should return session ID for restoration", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const result = await service.pseudonymize("Contact test@example.com");

      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe("string");
      expect(result.sessionId.length).toBeGreaterThan(0);
    });

    it("should use provided session ID", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      // Create a session first
      const first = await service.pseudonymize("First test@example.com");
      const second = await service.pseudonymize("Second another@test.com", {
        sessionId: first.sessionId,
      });

      expect(second.sessionId).toBe(first.sessionId);
    });

    it("should preserve text structure", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const text = "Line 1: test@example.com\nLine 2: more content";
      const result = await service.pseudonymize(text);

      expect(result.text).toContain("\n");
      expect(result.text).toContain("Line 1:");
      expect(result.text).toContain("Line 2:");
    });

    it("should handle text without PII", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const text = "No personal information here.";
      const result = await service.pseudonymize(text);

      expect(result.text).toBe(text);
      expect(result.replacementCount).toBe(0);
      expect(result.entities).toHaveLength(0);
    });

    it("should generate consistent pseudonyms within session", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const text = "Email test@example.com and again test@example.com";
      const result = await service.pseudonymize(text);

      // Count occurrences of the pseudonym - should be 2 (same email replaced twice with same pseudonym)
      const pseudonymEmail = result.entities[0].text;
      const pseudonym = service.getSession(result.sessionId)?.mappings.get(pseudonymEmail)?.pseudonym;

      if (pseudonym) {
        const count = (result.text.match(new RegExp(pseudonym, "g")) || []).length;
        expect(count).toBe(2);
      }
    });
  });

  // ===========================================================================
  // Restoration
  // ===========================================================================

  describe("restore", () => {
    it("should restore pseudonyms to originals", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const original = "Contact john@example.com for help";
      const { text: pseudonymized, sessionId } = await service.pseudonymize(original);

      // Simulate AI processing (text might be slightly modified)
      const aiResponse = pseudonymized; // In real use, AI would process this

      const { text: restored } = await service.restore(aiResponse, sessionId);

      expect(restored).toContain("john@example.com");
    });

    it("should restore multiple pseudonyms", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const original = "Contact alice@one.com and bob@two.com";
      const { text: pseudonymized, sessionId } = await service.pseudonymize(original);
      const { text: restored } = await service.restore(pseudonymized, sessionId);

      expect(restored).toContain("alice@one.com");
      expect(restored).toContain("bob@two.com");
    });

    it("should return restoration count", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const original = "Email: test@example.com Phone: 555-123-4567";
      const { text: pseudonymized, sessionId } = await service.pseudonymize(original);
      const result = await service.restore(pseudonymized, sessionId);

      expect(result.restorationCount).toBeGreaterThanOrEqual(2);
    });

    it("should handle non-existent session gracefully", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const result = await service.restore("Some text", "non-existent-session");

      expect(result.text).toBe("Some text");
      expect(result.restorationCount).toBe(0);
    });

    it("should handle text without pseudonyms", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const { sessionId } = await service.pseudonymize("test@example.com");
      const result = await service.restore("No pseudonyms here", sessionId);

      expect(result.text).toBe("No pseudonyms here");
      expect(result.restorationCount).toBe(0);
    });
  });

  // ===========================================================================
  // Round-Trip
  // ===========================================================================

  describe("round-trip", () => {
    it("should preserve original text after pseudonymize → restore", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const original = "Contact john.doe@company.com or call (555) 123-4567";
      const { text: pseudonymized, sessionId } = await service.pseudonymize(original);
      const { text: restored } = await service.restore(pseudonymized, sessionId);

      expect(restored).toBe(original);
    });

    it("should handle complex text with multiple PII types", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const original = `
        Dear Team,

        Please contact alice@company.com or bob@partner.org about the project.
        Call Alice at (555) 111-2222 or Bob at (555) 333-4444.
        Check our site at https://company.com/project for details.

        Server IPs: 192.168.1.1 and 10.0.0.1

        Best regards
      `;

      const { text: pseudonymized, sessionId } = await service.pseudonymize(original);

      // Verify PII is removed
      expect(pseudonymized).not.toContain("alice@company.com");
      expect(pseudonymized).not.toContain("bob@partner.org");
      expect(pseudonymized).not.toContain("(555) 111-2222");

      // Restore
      const { text: restored } = await service.restore(pseudonymized, sessionId);

      // Verify PII is restored
      expect(restored).toContain("alice@company.com");
      expect(restored).toContain("bob@partner.org");
    });

    it("should handle same PII appearing multiple times", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const original = "Email test@example.com. Reply to test@example.com.";
      const { text: pseudonymized, sessionId } = await service.pseudonymize(original);
      const { text: restored } = await service.restore(pseudonymized, sessionId);

      expect(restored).toBe(original);
    });
  });

  // ===========================================================================
  // Session Management
  // ===========================================================================

  describe("session management", () => {
    it("should get session by ID", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const { sessionId } = await service.pseudonymize("test@example.com");
      const session = service.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
    });

    it("should list all sessions", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const { sessionId: id1 } = await service.pseudonymize("first@example.com");
      const { sessionId: id2 } = await service.pseudonymize("second@example.com");

      const sessions = service.listSessions();

      expect(sessions).toContain(id1);
      expect(sessions).toContain(id2);
    });

    it("should clear session", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const { sessionId } = await service.pseudonymize("test@example.com");
      const cleared = service.clearSession(sessionId);

      expect(cleared).toBe(true);
      expect(service.getSession(sessionId)).toBeUndefined();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty string", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const result = await service.pseudonymize("");

      expect(result.text).toBe("");
      expect(result.entities).toHaveLength(0);
    });

    it("should handle unicode text", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const original = "Kontakt: müller@beispiel.de für mehr Info";
      const { text: pseudonymized, sessionId } = await service.pseudonymize(original);
      const { text: restored } = await service.restore(pseudonymized, sessionId);

      expect(restored).toContain("müller@beispiel.de");
    });

    it("should handle special characters in surrounding text", async () => {
      const { PIIService } = await import("../../src/service/pii-service");
      const service = new PIIService();

      const original = "Email: <test@example.com> (primary)";
      const { text: pseudonymized, sessionId } = await service.pseudonymize(original);
      const { text: restored } = await service.restore(pseudonymized, sessionId);

      expect(restored).toContain("<");
      expect(restored).toContain(">");
      expect(restored).toContain("test@example.com");
    });
  });
});
