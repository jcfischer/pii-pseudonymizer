import { describe, it, expect, beforeEach } from "bun:test";
import { CustomNameDetector } from "../../src/detector/custom";
import type { CustomNameConfig } from "../../src/types";

// =============================================================================
// Custom Name Detector Tests
// =============================================================================

describe("CustomNameDetector", () => {
  let detector: CustomNameDetector;

  // ===========================================================================
  // Basic Detection
  // ===========================================================================

  describe("basic detection", () => {
    beforeEach(() => {
      detector = new CustomNameDetector({
        names: [
          { name: "Acme Corporation", type: "ORG" },
          { name: "John Smith", type: "PERSON" },
        ],
      });
    });

    it("should detect configured organization name", () => {
      const text = "We had a meeting with Acme Corporation yesterday.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(1);
      expect(entities[0].text).toBe("Acme Corporation");
      expect(entities[0].type).toBe("ORG");
      expect(entities[0].method).toBe("custom");
    });

    it("should detect configured person name", () => {
      const text = "John Smith will join the call.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(1);
      expect(entities[0].text).toBe("John Smith");
      expect(entities[0].type).toBe("PERSON");
    });

    it("should detect multiple configured names", () => {
      const text = "John Smith from Acme Corporation sent the proposal.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(2);
      const names = entities.map((e) => e.text);
      expect(names).toContain("John Smith");
      expect(names).toContain("Acme Corporation");
    });

    it("should return correct positions", () => {
      const text = "Contact John Smith for details.";
      const entities = detector.detect(text);

      expect(entities[0].start).toBe(8);
      expect(entities[0].end).toBe(18);
      expect(text.substring(entities[0].start, entities[0].end)).toBe("John Smith");
    });
  });

  // ===========================================================================
  // Alias Detection
  // ===========================================================================

  describe("alias detection", () => {
    beforeEach(() => {
      detector = new CustomNameDetector({
        names: [
          { name: "Acme Corporation", type: "ORG", aliases: ["Acme", "ACME Corp"] },
          { name: "John Smith", type: "PERSON", aliases: ["JS", "J. Smith"] },
        ],
      });
    });

    it("should detect alias and return canonical name", () => {
      const text = "Meeting with Acme next week.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(1);
      expect(entities[0].text).toBe("Acme");
      expect(entities[0].type).toBe("ORG");
      expect(entities[0].canonical).toBe("Acme Corporation");
    });

    it("should detect multiple aliases", () => {
      const text = "ACME Corp and JS discussed the project.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(2);
      expect(entities.find((e) => e.text === "ACME Corp")?.canonical).toBe("Acme Corporation");
      expect(entities.find((e) => e.text === "JS")?.canonical).toBe("John Smith");
    });

    it("should detect alias with punctuation", () => {
      const text = "Talked to J. Smith about the deal.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(1);
      expect(entities[0].text).toBe("J. Smith");
      expect(entities[0].canonical).toBe("John Smith");
    });
  });

  // ===========================================================================
  // Case Sensitivity
  // ===========================================================================

  describe("case sensitivity", () => {
    it("should be case-insensitive by default", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Acme Corporation", type: "ORG" }],
      });

      const text = "acme corporation is our client.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(1);
      expect(entities[0].text).toBe("acme corporation");
    });

    it("should support case-sensitive mode", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Acme Corporation", type: "ORG" }],
        caseSensitive: true,
      });

      const text = "acme corporation vs Acme Corporation";
      const entities = detector.detect(text);

      expect(entities.length).toBe(1);
      expect(entities[0].text).toBe("Acme Corporation");
    });
  });

  // ===========================================================================
  // Word Boundary Matching
  // ===========================================================================

  describe("word boundary matching", () => {
    beforeEach(() => {
      detector = new CustomNameDetector({
        names: [{ name: "AC", type: "ORG" }],
      });
    });

    it("should match at word boundaries", () => {
      const text = "AC is a company.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(1);
      expect(entities[0].text).toBe("AC");
    });

    it("should not match within words by default", () => {
      const text = "ACME contains AC but is different.";
      const entities = detector.detect(text);

      // Should only match standalone "AC", not "AC" within "ACME"
      expect(entities.length).toBe(1);
      expect(entities[0].start).toBe(14); // The standalone "AC"
    });

    it("should support partial matching mode", () => {
      detector = new CustomNameDetector({
        names: [{ name: "AC", type: "ORG" }],
        matchPartial: true,
      });

      const text = "ACME contains AC.";
      const entities = detector.detect(text);

      // Should match both occurrences
      expect(entities.length).toBe(2);
    });
  });

  // ===========================================================================
  // Simple Names List
  // ===========================================================================

  describe("simple names list", () => {
    it("should support simple string array", () => {
      detector = new CustomNameDetector({
        simpleNames: ["Acme", "John Smith"],
      });

      const text = "Acme and John Smith are involved.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(2);
      // Simple names default to PERSON type
      expect(entities.every((e) => e.type === "PERSON")).toBe(true);
    });

    it("should combine simple names with structured names", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Acme Corporation", type: "ORG" }],
        simpleNames: ["John Smith"],
      });

      const text = "John Smith works at Acme Corporation.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(2);
      expect(entities.find((e) => e.type === "ORG")).toBeDefined();
      expect(entities.find((e) => e.type === "PERSON")).toBeDefined();
    });
  });

  // ===========================================================================
  // Configuration Loading
  // ===========================================================================

  describe("configuration", () => {
    it("should handle empty configuration", () => {
      detector = new CustomNameDetector({ names: [] });
      const entities = detector.detect("Any text here.");

      expect(entities).toEqual([]);
    });

    it("should update configuration dynamically", () => {
      detector = new CustomNameDetector({ names: [] });

      // Initially no matches
      let entities = detector.detect("Acme is here.");
      expect(entities.length).toBe(0);

      // Add configuration
      detector.setConfig({
        names: [{ name: "Acme", type: "ORG" }],
      });

      // Now should match
      entities = detector.detect("Acme is here.");
      expect(entities.length).toBe(1);
    });

    it("should clear configuration", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Acme", type: "ORG" }],
      });

      let entities = detector.detect("Acme is here.");
      expect(entities.length).toBe(1);

      detector.clearConfig();
      entities = detector.detect("Acme is here.");
      expect(entities.length).toBe(0);
    });
  });

  // ===========================================================================
  // Confidence Scores
  // ===========================================================================

  describe("confidence scores", () => {
    it("should assign high confidence to exact matches", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Acme Corporation", type: "ORG" }],
      });

      const entities = detector.detect("Acme Corporation is the client.");
      expect(entities[0].confidence).toBe(1.0);
    });

    it("should assign slightly lower confidence to alias matches", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Acme Corporation", type: "ORG", aliases: ["Acme"] }],
      });

      const entities = detector.detect("Acme is the client.");
      expect(entities[0].confidence).toBe(0.95);
    });

    it("should assign lower confidence to case-mismatched matches", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Acme Corporation", type: "ORG" }],
      });

      const entities = detector.detect("ACME CORPORATION is the client.");
      expect(entities[0].confidence).toBeLessThan(1.0);
      expect(entities[0].confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty string", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Acme", type: "ORG" }],
      });

      const entities = detector.detect("");
      expect(entities).toEqual([]);
    });

    it("should handle special regex characters in names", () => {
      detector = new CustomNameDetector({
        names: [{ name: "A.B.C. Corp", type: "ORG" }],
      });

      const text = "A.B.C. Corp is here.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(1);
      expect(entities[0].text).toBe("A.B.C. Corp");
    });

    it("should handle parentheses in names", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Company (UK)", type: "ORG" }],
      });

      const text = "Company (UK) sent the invoice.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(1);
    });

    it("should handle overlapping matches (longer match wins)", () => {
      detector = new CustomNameDetector({
        names: [
          { name: "Acme", type: "ORG" },
          { name: "Acme Corporation", type: "ORG" },
        ],
      });

      const text = "Acme Corporation is here.";
      const entities = detector.detect(text);

      // Should prefer longer match
      expect(entities.length).toBe(1);
      expect(entities[0].text).toBe("Acme Corporation");
    });

    it("should detect multiple occurrences of same name", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Acme", type: "ORG" }],
      });

      const text = "Acme sent the proposal. We'll respond to Acme tomorrow.";
      const entities = detector.detect(text);

      expect(entities.length).toBe(2);
      expect(entities[0].start).toBe(0);
      expect(entities[1].start).toBe(41);
    });
  });

  // ===========================================================================
  // Method Attribution
  // ===========================================================================

  describe("method attribution", () => {
    it("should mark entities as custom-detected", () => {
      detector = new CustomNameDetector({
        names: [{ name: "Acme", type: "ORG" }],
      });

      const entities = detector.detect("Acme is here.");
      expect(entities[0].method).toBe("custom");
    });
  });
});
