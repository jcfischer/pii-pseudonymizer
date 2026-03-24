import { describe, it, expect, beforeAll } from "bun:test";
import { NERDetector } from "../../src/detector/ner";
import type { DetectedEntity, EntityType } from "../../src/types";

// =============================================================================
// NER Detector Tests
// =============================================================================

describe("NERDetector", () => {
  let detector: NERDetector;

  beforeAll(() => {
    detector = new NERDetector();
  });

  // ===========================================================================
  // Initialization
  // ===========================================================================

  describe("initialization", () => {
    it("should not be initialized before first detection", () => {
      const freshDetector = new NERDetector();
      expect(freshDetector.isInitialized()).toBe(false);
    });

    it("should lazy-load model on first detect call", async () => {
      const freshDetector = new NERDetector();
      expect(freshDetector.isInitialized()).toBe(false);

      await freshDetector.detect("Hello John");

      expect(freshDetector.isInitialized()).toBe(true);
    });

    it("should allow explicit initialization", async () => {
      const freshDetector = new NERDetector();
      await freshDetector.initialize();
      expect(freshDetector.isInitialized()).toBe(true);
    });
  });

  // ===========================================================================
  // PERSON Detection
  // ===========================================================================

  describe("PERSON detection", () => {
    it("should detect single person name", async () => {
      const entities = await detector.detect("Contact John Smith for help");

      const persons = entities.filter(e => e.type === "PERSON");
      expect(persons.length).toBeGreaterThanOrEqual(1);
      expect(persons[0].text).toContain("John");
      expect(persons[0].method).toBe("ner");
      expect(persons[0].confidence).toBeGreaterThan(0);
    });

    it("should detect multiple person names", async () => {
      const entities = await detector.detect("Meeting with John Smith and Angela Chen");

      const persons = entities.filter(e => e.type === "PERSON");
      expect(persons.length).toBeGreaterThanOrEqual(2);
    });

    it("should detect first name only", async () => {
      const entities = await detector.detect("Hello Angela, how are you?");

      const persons = entities.filter(e => e.type === "PERSON");
      expect(persons.length).toBeGreaterThanOrEqual(1);
    });

    it("should have correct position for person names", async () => {
      const text = "Hello John Smith";
      const entities = await detector.detect(text);

      const person = entities.find(e => e.type === "PERSON");
      expect(person).toBeDefined();
      if (person) {
        expect(person.start).toBeGreaterThanOrEqual(0);
        expect(person.end).toBeGreaterThan(person.start);
        expect(text.substring(person.start, person.end)).toContain("John");
      }
    });
  });

  // ===========================================================================
  // ORG Detection
  // ===========================================================================

  describe("ORG detection", () => {
    it("should detect organization names", async () => {
      const entities = await detector.detect("I work at Microsoft Corporation");

      const orgs = entities.filter(e => e.type === "ORG");
      expect(orgs.length).toBeGreaterThanOrEqual(1);
      expect(orgs[0].text).toContain("Microsoft");
      expect(orgs[0].method).toBe("ner");
    });

    it("should detect company names with suffixes", async () => {
      const entities = await detector.detect("The meeting is at Apple Inc.");

      const orgs = entities.filter(e => e.type === "ORG");
      expect(orgs.length).toBeGreaterThanOrEqual(1);
    });

    it("should detect Swiss organizations", async () => {
      const entities = await detector.detect("Working with Switch AG in Zurich");

      const orgs = entities.filter(e => e.type === "ORG");
      expect(orgs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // LOCATION Detection
  // ===========================================================================

  describe("LOCATION detection", () => {
    it("should detect city names", async () => {
      const entities = await detector.detect("The conference is in New York");

      const locations = entities.filter(e => e.type === "LOCATION");
      expect(locations.length).toBeGreaterThanOrEqual(1);
      expect(locations[0].method).toBe("ner");
    });

    it("should detect country names", async () => {
      const entities = await detector.detect("Traveling to Switzerland next week");

      const locations = entities.filter(e => e.type === "LOCATION");
      expect(locations.length).toBeGreaterThanOrEqual(1);
    });

    it("should detect European cities", async () => {
      const entities = await detector.detect("Office located in Zürich");

      const locations = entities.filter(e => e.type === "LOCATION");
      expect(locations.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // Confidence Scores
  // ===========================================================================

  describe("confidence scores", () => {
    it("should return confidence between 0 and 1", async () => {
      const entities = await detector.detect("John Smith works at Google");

      for (const entity of entities) {
        expect(entity.confidence).toBeGreaterThan(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should filter by minimum confidence", async () => {
      const highConfidence = await detector.detect("John Smith", { minConfidence: 0.9 });
      const lowConfidence = await detector.detect("John Smith", { minConfidence: 0.1 });

      // Low confidence threshold should return at least as many results
      expect(lowConfidence.length).toBeGreaterThanOrEqual(highConfidence.length);
    });
  });

  // ===========================================================================
  // Type Filtering
  // ===========================================================================

  describe("type filtering", () => {
    it("should filter to PERSON only", async () => {
      const entities = await detector.detect(
        "John Smith works at Microsoft in Seattle",
        { types: ["PERSON"] }
      );

      expect(entities.every(e => e.type === "PERSON")).toBe(true);
    });

    it("should filter to ORG only", async () => {
      const entities = await detector.detect(
        "John Smith works at Microsoft in Seattle",
        { types: ["ORG"] }
      );

      expect(entities.every(e => e.type === "ORG")).toBe(true);
    });

    it("should filter to LOCATION only", async () => {
      const entities = await detector.detect(
        "John Smith works at Microsoft in Seattle",
        { types: ["LOCATION"] }
      );

      expect(entities.every(e => e.type === "LOCATION")).toBe(true);
    });

    it("should support multiple type filters", async () => {
      const entities = await detector.detect(
        "John Smith works at Microsoft in Seattle",
        { types: ["PERSON", "ORG"] }
      );

      expect(entities.every(e => e.type === "PERSON" || e.type === "ORG")).toBe(true);
    });

    it("should return empty for non-NER types", async () => {
      const entities = await detector.detect(
        "John Smith works at Microsoft",
        { types: ["EMAIL", "PHONE"] }
      );

      expect(entities.length).toBe(0);
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

    it("should handle whitespace only", async () => {
      const entities = await detector.detect("   \n\t  ");
      expect(entities).toEqual([]);
    });

    it("should handle text with no entities", async () => {
      const entities = await detector.detect("The quick brown fox jumps over the lazy dog");
      // May or may not detect entities depending on model
      expect(Array.isArray(entities)).toBe(true);
    });

    it("should handle unicode characters", async () => {
      const entities = await detector.detect("Meeting with François Müller");

      const persons = entities.filter(e => e.type === "PERSON");
      expect(persons.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle long text", async () => {
      const longText = "John Smith ".repeat(100) + "works at Microsoft";
      const entities = await detector.detect(longText);

      expect(Array.isArray(entities)).toBe(true);
    });
  });

  // ===========================================================================
  // Token Aggregation
  // ===========================================================================

  describe("token aggregation", () => {
    it("should aggregate multi-token names into single entity", async () => {
      const entities = await detector.detect("John Paul Smith is here");

      const persons = entities.filter(e => e.type === "PERSON");
      // Should be one merged entity, not three separate tokens
      expect(persons.length).toBeLessThanOrEqual(2);
    });

    it("should aggregate organization name tokens", async () => {
      const entities = await detector.detect("Working at International Business Machines");

      const orgs = entities.filter(e => e.type === "ORG");
      // Should merge "International Business Machines" into one
      expect(orgs.some(o => o.text.includes("International") || o.text.includes("Business"))).toBe(true);
    });

    it("should handle split word pieces (##tokens)", async () => {
      // BERT tokenizers often split words into pieces
      const entities = await detector.detect("Meeting with Christopher");

      const persons = entities.filter(e => e.type === "PERSON");
      if (persons.length > 0) {
        // Text should be whole word, not ##opher
        expect(persons[0].text).not.toContain("##");
      }
    });
  });

  // ===========================================================================
  // NER-Specific Types
  // ===========================================================================

  describe("NER type support", () => {
    const NER_TYPES: EntityType[] = ["PERSON", "ORG", "LOCATION"];
    const PATTERN_TYPES: EntityType[] = ["EMAIL", "PHONE", "URL", "IP", "DOMAIN"];

    it("should only return NER-compatible types", async () => {
      const entities = await detector.detect(
        "John at john@example.com in New York at 192.168.1.1"
      );

      for (const entity of entities) {
        expect(NER_TYPES).toContain(entity.type);
        expect(PATTERN_TYPES).not.toContain(entity.type);
      }
    });

    it("should set method to ner for all results", async () => {
      const entities = await detector.detect("Angela works at Switch");

      for (const entity of entities) {
        expect(entity.method).toBe("ner");
      }
    });
  });
});
