import { describe, it, expect, beforeAll } from "bun:test";
import { UnifiedDetector } from "../../src/detector";
import type { DetectedEntity, EntityType } from "../../src/types";

// =============================================================================
// Unified Detector Tests
// =============================================================================

describe("UnifiedDetector", () => {
  let detector: UnifiedDetector;

  beforeAll(() => {
    detector = new UnifiedDetector();
  });

  // ===========================================================================
  // Combined Detection
  // ===========================================================================

  describe("combined detection", () => {
    it("should detect both pattern and NER entities", async () => {
      const entities = await detector.detect(
        "Contact John Smith at john@example.com"
      );

      // Should have PERSON from NER and EMAIL from pattern
      const person = entities.find(e => e.type === "PERSON");
      const email = entities.find(e => e.type === "EMAIL");

      expect(person).toBeDefined();
      expect(email).toBeDefined();
      expect(person?.method).toBe("ner");
      expect(email?.method).toBe("pattern");
    });

    it("should detect multiple entity types", async () => {
      const entities = await detector.detect(
        "John Smith from Microsoft at 192.168.1.1 called (555) 123-4567"
      );

      const types = new Set(entities.map(e => e.type));
      expect(types.has("PERSON")).toBe(true);
      expect(types.has("ORG")).toBe(true);
      expect(types.has("IP")).toBe(true);
      expect(types.has("PHONE")).toBe(true);
    });

    it("should sort entities by position", async () => {
      const entities = await detector.detect(
        "First john@example.com then John Smith"
      );

      for (let i = 1; i < entities.length; i++) {
        expect(entities[i].start).toBeGreaterThanOrEqual(entities[i - 1].start);
      }
    });
  });

  // ===========================================================================
  // Pattern-Only Detection
  // ===========================================================================

  describe("pattern-only detection", () => {
    it("should use only patterns when NER types not requested", async () => {
      const entities = await detector.detect(
        "John Smith at john@example.com and 192.168.1.1",
        { types: ["EMAIL", "IP"] }
      );

      // Should only have pattern matches
      expect(entities.every(e => e.method === "pattern")).toBe(true);
      expect(entities.every(e => ["EMAIL", "IP"].includes(e.type))).toBe(true);
    });

    it("should skip NER when useNER is false", async () => {
      const entities = await detector.detect(
        "John Smith at john@example.com",
        { useNER: false }
      );

      // Should not have any NER entities
      expect(entities.every(e => e.method === "pattern")).toBe(true);
    });
  });

  // ===========================================================================
  // NER-Only Detection
  // ===========================================================================

  describe("NER-only detection", () => {
    it("should use only NER when pattern types not requested", async () => {
      const entities = await detector.detect(
        "John Smith from Microsoft in Seattle with john@example.com",
        { types: ["PERSON", "ORG", "LOCATION"] }
      );

      // Should only have NER matches
      expect(entities.every(e => e.method === "ner")).toBe(true);
    });

    it("should skip patterns when usePatterns is false", async () => {
      const entities = await detector.detect(
        "John Smith at john@example.com",
        { usePatterns: false }
      );

      // Should not have any pattern entities
      expect(entities.every(e => e.method === "ner")).toBe(true);
    });
  });

  // ===========================================================================
  // Overlap Handling
  // ===========================================================================

  describe("overlap handling", () => {
    it("should prefer pattern matches when overlapping", async () => {
      // Email contains a name-like part, pattern should win
      const entities = await detector.detect(
        "Contact john.smith@example.com for help"
      );

      const email = entities.find(e => e.type === "EMAIL");
      expect(email).toBeDefined();
      expect(email?.text).toBe("john.smith@example.com");
      expect(email?.method).toBe("pattern");

      // There should NOT be a PERSON entity overlapping with the email
      const overlappingPerson = entities.find(
        e => e.type === "PERSON" &&
        e.start >= (email?.start ?? 0) &&
        e.end <= (email?.end ?? 0)
      );
      expect(overlappingPerson).toBeUndefined();
    });

    it("should not duplicate entities at same position", async () => {
      const entities = await detector.detect("john@example.com");

      // Should only have one entity for the email
      expect(entities.length).toBe(1);
      expect(entities[0].type).toBe("EMAIL");
    });
  });

  // ===========================================================================
  // Confidence Filtering
  // ===========================================================================

  describe("confidence filtering", () => {
    it("should apply minConfidence to NER entities", async () => {
      const highConfidence = await detector.detect(
        "John Smith works at Microsoft",
        { minConfidence: 0.95 }
      );
      const lowConfidence = await detector.detect(
        "John Smith works at Microsoft",
        { minConfidence: 0.5 }
      );

      // Low threshold should return at least as many results
      expect(lowConfidence.length).toBeGreaterThanOrEqual(highConfidence.length);
    });

    it("should not apply minConfidence to pattern entities", async () => {
      const entities = await detector.detect(
        "Email: john@example.com",
        { minConfidence: 0.99 }
      );

      // Pattern matches have 1.0 confidence, should still be returned
      const email = entities.find(e => e.type === "EMAIL");
      expect(email).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty string", async () => {
      const entities = await detector.detect("");
      expect(entities).toEqual([]);
    });

    it("should handle text with no entities", async () => {
      const entities = await detector.detect("Hello world");
      // May return empty or minimal results
      expect(Array.isArray(entities)).toBe(true);
    });

    it("should handle complex mixed content", async () => {
      const text = `
        Dear John Smith,

        Please contact our team at support@company.com or call (555) 123-4567.
        Visit https://example.com for more info.

        Best regards,
        Angela from Microsoft
      `;

      const entities = await detector.detect(text);

      // Should find multiple entity types
      const types = new Set(entities.map(e => e.type));
      expect(types.size).toBeGreaterThan(2);
    });

    it("should handle unicode names and content", async () => {
      const entities = await detector.detect(
        "Meeting with François Müller in Zürich"
      );

      expect(entities.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Initialization
  // ===========================================================================

  describe("initialization", () => {
    it("should allow warming up NER model", async () => {
      const freshDetector = new UnifiedDetector();

      // Warm up
      await freshDetector.warmUp();

      // Should be initialized
      expect(freshDetector.isNERInitialized()).toBe(true);
    });
  });
});
