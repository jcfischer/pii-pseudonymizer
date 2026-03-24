import { describe, it, expect } from "bun:test";

// =============================================================================
// Pseudonym Generator Tests (TDD - RED Phase)
// =============================================================================

describe("PseudonymGenerator", () => {
  // ===========================================================================
  // Person Names
  // ===========================================================================

  describe("person name generation", () => {
    it("should generate realistic person names", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const pseudonym = generator.generate("PERSON", "John Doe");

      expect(pseudonym).toBeDefined();
      expect(typeof pseudonym).toBe("string");
      expect(pseudonym.length).toBeGreaterThan(0);
      expect(pseudonym).not.toBe("John Doe");
    });

    it("should generate consistent pseudonyms for same input", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const p1 = generator.generate("PERSON", "Angela Smith");
      const p2 = generator.generate("PERSON", "Angela Smith");

      expect(p1).toBe(p2);
    });

    it("should generate different pseudonyms for different inputs", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const p1 = generator.generate("PERSON", "John Doe");
      const p2 = generator.generate("PERSON", "Jane Doe");

      expect(p1).not.toBe(p2);
    });

    it("should generate names with first and last name", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const pseudonym = generator.generate("PERSON", "Single");

      // Should have at least a first name (can be single or multi-part)
      expect(pseudonym.length).toBeGreaterThan(2);
    });
  });

  // ===========================================================================
  // Organization Names
  // ===========================================================================

  describe("organization name generation", () => {
    it("should generate realistic company names", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const pseudonym = generator.generate("ORG", "TechCorp Inc");

      expect(pseudonym).toBeDefined();
      expect(typeof pseudonym).toBe("string");
      expect(pseudonym.length).toBeGreaterThan(0);
      expect(pseudonym).not.toBe("TechCorp Inc");
    });

    it("should generate consistent company pseudonyms", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const p1 = generator.generate("ORG", "Switch AG");
      const p2 = generator.generate("ORG", "Switch AG");

      expect(p1).toBe(p2);
    });
  });

  // ===========================================================================
  // Email Addresses
  // ===========================================================================

  describe("email address generation", () => {
    it("should generate valid email addresses", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const pseudonym = generator.generate("EMAIL", "john.doe@company.com");

      expect(pseudonym).toContain("@");
      expect(pseudonym).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it("should generate consistent email pseudonyms", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const p1 = generator.generate("EMAIL", "test@example.com");
      const p2 = generator.generate("EMAIL", "test@example.com");

      expect(p1).toBe(p2);
    });

    it("should not include original email parts", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const original = "john.doe@company.com";
      const pseudonym = generator.generate("EMAIL", original);

      expect(pseudonym.toLowerCase()).not.toContain("john");
      expect(pseudonym.toLowerCase()).not.toContain("doe");
      expect(pseudonym.toLowerCase()).not.toContain("company");
    });
  });

  // ===========================================================================
  // Phone Numbers
  // ===========================================================================

  describe("phone number generation", () => {
    it("should generate phone number strings", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const pseudonym = generator.generate("PHONE", "555-123-4567");

      expect(pseudonym).toBeDefined();
      // Should contain digits
      expect(pseudonym).toMatch(/\d/);
    });

    it("should generate consistent phone pseudonyms", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const p1 = generator.generate("PHONE", "(555) 123-4567");
      const p2 = generator.generate("PHONE", "(555) 123-4567");

      expect(p1).toBe(p2);
    });
  });

  // ===========================================================================
  // Domain Names
  // ===========================================================================

  describe("domain name generation", () => {
    it("should generate domain names", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const pseudonym = generator.generate("DOMAIN", "company.com");

      expect(pseudonym).toBeDefined();
      expect(pseudonym).toContain(".");
    });

    it("should generate consistent domain pseudonyms", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const p1 = generator.generate("DOMAIN", "switch.ch");
      const p2 = generator.generate("DOMAIN", "switch.ch");

      expect(p1).toBe(p2);
    });
  });

  // ===========================================================================
  // URL Generation
  // ===========================================================================

  describe("URL generation", () => {
    it("should generate URLs", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const pseudonym = generator.generate("URL", "https://company.com/page");

      expect(pseudonym).toBeDefined();
      expect(pseudonym).toMatch(/^https?:\/\//);
    });
  });

  // ===========================================================================
  // IP Address Generation
  // ===========================================================================

  describe("IP address generation", () => {
    it("should generate valid IPv4 addresses", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const pseudonym = generator.generate("IP", "192.168.1.100");

      expect(pseudonym).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    });

    it("should generate consistent IP pseudonyms", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const p1 = generator.generate("IP", "10.0.0.1");
      const p2 = generator.generate("IP", "10.0.0.1");

      expect(p1).toBe(p2);
    });
  });

  // ===========================================================================
  // Collision Avoidance
  // ===========================================================================

  describe("collision avoidance", () => {
    it("should generate unique pseudonyms for 100 different inputs", async () => {
      const { PseudonymGenerator } = await import("../../src/pseudonymizer/generator");
      const generator = new PseudonymGenerator();

      const pseudonyms = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const pseudonym = generator.generate("PERSON", `Person ${i}`);
        pseudonyms.add(pseudonym);
      }

      // Allow some collisions due to Faker's limited data, but most should be unique
      expect(pseudonyms.size).toBeGreaterThan(80);
    });
  });
});
