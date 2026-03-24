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

  // ===========================================================================
  // Chunking for Long Inputs (Issue #1)
  // ===========================================================================

  describe("chunking for long inputs", () => {
    it("should detect entities in text with >15 lines", async () => {
      // Create a 20-line text with entities spread throughout
      const lines = [
        "Meeting Transcript - 2024-01-15",
        "Attendees: John Smith, Angela Chen, Michael Johnson",
        "",
        "09:00 - John Smith: Let's start with the project update.",
        "09:01 - Angela Chen: I've been working with Microsoft on the integration.",
        "09:02 - Michael Johnson: The New York office has some concerns.",
        "",
        "09:05 - John Smith: What about the timeline?",
        "09:06 - Angela Chen: Google replied last week about the API.",
        "09:07 - Michael Johnson: I'll coordinate with the London team.",
        "",
        "09:10 - John Smith: Any blockers from Acme Corp?",
        "09:11 - Angela Chen: No, they're based in San Francisco.",
        "09:12 - Michael Johnson: Let me check with Sarah Williams.",
        "",
        "09:15 - John Smith: Sounds good.",
        "09:16 - Angela Chen: I'll follow up with Amazon.",
        "09:17 - Michael Johnson: The Berlin conference is next month.",
        "",
        "End of meeting",
      ];
      const text = lines.join("\n");

      const entities = await detector.detect(text);

      // Should detect multiple entities (names, orgs, locations)
      expect(entities.length).toBeGreaterThan(0);

      // Verify some expected entities are found
      const persons = entities.filter(e => e.type === "PERSON");
      const orgs = entities.filter(e => e.type === "ORG");
      const locations = entities.filter(e => e.type === "LOCATION");

      expect(persons.length).toBeGreaterThan(0);
      expect(orgs.length).toBeGreaterThan(0);
      expect(locations.length).toBeGreaterThan(0);
    });

    it("should have correct positions for entities in chunked text", async () => {
      // Create a 25-line text to force chunking
      const lines: string[] = [];
      for (let i = 0; i < 25; i++) {
        if (i % 3 === 0) {
          lines.push(`Line ${i}: John Smith mentioned the update.`);
        } else if (i % 3 === 1) {
          lines.push(`Line ${i}: Angela Chen works at Microsoft.`);
        } else {
          lines.push(`Line ${i}: Meeting in New York next week.`);
        }
      }
      const text = lines.join("\n");

      const entities = await detector.detect(text);

      // Verify that positions are correct
      for (const entity of entities) {
        const extractedText = text.substring(entity.start, entity.end);
        // The extracted text should match the entity text (case-insensitive)
        expect(extractedText.toLowerCase()).toBe(entity.text.toLowerCase());
      }
    });

    it("should detect entities in 170-line meeting transcript", async () => {
      // Simulate the reported issue scenario
      const lines: string[] = [];
      const speakers = ["John Smith", "Angela Chen", "Michael Johnson", "Sarah Williams"];
      const companies = ["Microsoft", "Google", "Amazon", "Acme Corp"];
      const locations = ["New York", "San Francisco", "London", "Berlin"];

      for (let i = 0; i < 170; i++) {
        const speaker = speakers[i % speakers.length];
        const company = companies[i % companies.length];
        const location = locations[i % locations.length];
        const timestamp = `${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`;

        lines.push(`${timestamp} - ${speaker}: Working with ${company} team in ${location}.`);
      }
      const text = lines.join("\n");

      const entities = await detector.detect(text);

      // Should detect entities (previously returned 0 for this scenario)
      expect(entities.length).toBeGreaterThan(0);

      // Verify we found different types
      const types = new Set(entities.map(e => e.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it("should handle chunk boundaries correctly", async () => {
      // Create text where entities might span chunk boundaries
      const lines: string[] = [];
      for (let i = 0; i < 30; i++) {
        lines.push(`This is line ${i} with John Smith`);
      }
      const text = lines.join("\n");

      const entities = await detector.detect(text);

      // All detected entities should have valid positions
      for (const entity of entities) {
        expect(entity.start).toBeGreaterThanOrEqual(0);
        expect(entity.end).toBeGreaterThan(entity.start);
        expect(entity.end).toBeLessThanOrEqual(text.length);
      }
    });

    it("should maintain confidence scores across chunks", async () => {
      // Create long text with clear entities
      const lines: string[] = [];
      for (let i = 0; i < 50; i++) {
        lines.push(`Meeting ${i}: John Smith and Angela Chen discussed the project.`);
      }
      const text = lines.join("\n");

      const entities = await detector.detect(text);

      // All entities should have reasonable confidence scores
      for (const entity of entities) {
        expect(entity.confidence).toBeGreaterThan(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should process chunks in parallel efficiently", async () => {
      // Create a large text to test parallel processing
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`Line ${i}: Sarah Williams from Apple Inc in Seattle.`);
      }
      const text = lines.join("\n");

      const startTime = Date.now();
      const entities = await detector.detect(text);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (parallel processing)
      // Note: This is a rough check - actual time depends on hardware
      expect(entities.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(30000); // Should complete in under 30 seconds
    });
  });
});
