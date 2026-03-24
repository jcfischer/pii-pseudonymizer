import { describe, it, expect } from "bun:test";
import type { DetectedEntity } from "../../src/types";

// =============================================================================
// Pattern Detection Tests (TDD - RED Phase)
// =============================================================================

describe("PatternDetector", () => {
  // ===========================================================================
  // Email Detection
  // ===========================================================================

  describe("email detection", () => {
    it("should detect simple email addresses", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Contact me at john.doe@example.com for more info.";
      const entities = detector.detect(text);

      expect(entities).toHaveLength(1);
      expect(entities[0].text).toBe("john.doe@example.com");
      expect(entities[0].type).toBe("EMAIL");
      expect(entities[0].confidence).toBe(1.0);
      expect(entities[0].method).toBe("pattern");
    });

    it("should detect multiple email addresses", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Send to alice@corp.com and bob@startup.io please.";
      const entities = detector.detect(text);

      const emails = entities.filter((e) => e.type === "EMAIL");
      expect(emails).toHaveLength(2);
      expect(emails[0].text).toBe("alice@corp.com");
      expect(emails[1].text).toBe("bob@startup.io");
    });

    it("should detect email with plus addressing", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Use user+tag@gmail.com for filtering.";
      const entities = detector.detect(text);

      expect(entities).toHaveLength(1);
      expect(entities[0].text).toBe("user+tag@gmail.com");
    });

    it("should detect email with subdomain", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Contact support@mail.company.co.uk";
      const entities = detector.detect(text);

      expect(entities).toHaveLength(1);
      expect(entities[0].text).toBe("support@mail.company.co.uk");
    });

    it("should return correct positions for email", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Email: test@example.com here";
      const entities = detector.detect(text);

      expect(entities[0].start).toBe(7);
      expect(entities[0].end).toBe(23);
      expect(text.slice(entities[0].start, entities[0].end)).toBe("test@example.com");
    });
  });

  // ===========================================================================
  // Phone Number Detection
  // ===========================================================================

  describe("phone number detection", () => {
    it("should detect US phone number with dashes", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Call me at 555-123-4567 tomorrow.";
      const entities = detector.detect(text);

      const phones = entities.filter((e) => e.type === "PHONE");
      expect(phones).toHaveLength(1);
      expect(phones[0].text).toBe("555-123-4567");
    });

    it("should detect phone number with parentheses", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Phone: (555) 123-4567";
      const entities = detector.detect(text);

      const phones = entities.filter((e) => e.type === "PHONE");
      expect(phones).toHaveLength(1);
      expect(phones[0].text).toBe("(555) 123-4567");
    });

    it("should detect international phone number", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "International: +1-555-123-4567";
      const entities = detector.detect(text);

      const phones = entities.filter((e) => e.type === "PHONE");
      expect(phones).toHaveLength(1);
      expect(phones[0].text).toContain("+1");
    });

    it("should detect Swiss phone number", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Reach me at +41 79 123 45 67";
      const entities = detector.detect(text);

      const phones = entities.filter((e) => e.type === "PHONE");
      expect(phones).toHaveLength(1);
    });

    it("should detect phone number with dots", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "My number is 555.123.4567";
      const entities = detector.detect(text);

      const phones = entities.filter((e) => e.type === "PHONE");
      expect(phones).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Domain Detection
  // ===========================================================================

  describe("domain detection", () => {
    it("should detect domain names", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Visit our website at company.com for more info.";
      const entities = detector.detect(text);

      const domains = entities.filter((e) => e.type === "DOMAIN");
      expect(domains).toHaveLength(1);
      expect(domains[0].text).toBe("company.com");
    });

    it("should detect subdomain", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Access portal.company.com";
      const entities = detector.detect(text);

      const domains = entities.filter((e) => e.type === "DOMAIN");
      expect(domains).toHaveLength(1);
      expect(domains[0].text).toBe("portal.company.com");
    });

    it("should not detect domain within email", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Email me at user@company.com";
      const entities = detector.detect(text);

      // Should only detect email, not domain separately
      const emails = entities.filter((e) => e.type === "EMAIL");
      const domains = entities.filter((e) => e.type === "DOMAIN");
      expect(emails).toHaveLength(1);
      expect(domains).toHaveLength(0);
    });
  });

  // ===========================================================================
  // URL Detection
  // ===========================================================================

  describe("URL detection", () => {
    it("should detect HTTP URLs", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Check http://example.com/page for details.";
      const entities = detector.detect(text);

      const urls = entities.filter((e) => e.type === "URL");
      expect(urls).toHaveLength(1);
      expect(urls[0].text).toBe("http://example.com/page");
    });

    it("should detect HTTPS URLs", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Visit https://secure.example.com/login";
      const entities = detector.detect(text);

      const urls = entities.filter((e) => e.type === "URL");
      expect(urls).toHaveLength(1);
      expect(urls[0].text).toBe("https://secure.example.com/login");
    });

    it("should detect URLs with query parameters", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Link: https://site.com/page?id=123&name=test";
      const entities = detector.detect(text);

      const urls = entities.filter((e) => e.type === "URL");
      expect(urls).toHaveLength(1);
      expect(urls[0].text).toContain("?id=123");
    });
  });

  // ===========================================================================
  // IP Address Detection
  // ===========================================================================

  describe("IP address detection", () => {
    it("should detect IPv4 addresses", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Server IP is 192.168.1.100";
      const entities = detector.detect(text);

      const ips = entities.filter((e) => e.type === "IP");
      expect(ips).toHaveLength(1);
      expect(ips[0].text).toBe("192.168.1.100");
    });

    it("should detect multiple IP addresses", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Primary: 10.0.0.1, Secondary: 10.0.0.2";
      const entities = detector.detect(text);

      const ips = entities.filter((e) => e.type === "IP");
      expect(ips).toHaveLength(2);
    });

    it("should not detect invalid IP addresses", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Not an IP: 999.999.999.999";
      const entities = detector.detect(text);

      const ips = entities.filter((e) => e.type === "IP");
      expect(ips).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Mixed Content
  // ===========================================================================

  describe("mixed content detection", () => {
    it("should detect multiple PII types in same text", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = `
        Contact John at john@company.com or call 555-123-4567.
        Visit https://company.com for more information.
        Server: 192.168.1.1
      `;
      const entities = detector.detect(text);

      const emails = entities.filter((e) => e.type === "EMAIL");
      const phones = entities.filter((e) => e.type === "PHONE");
      const urls = entities.filter((e) => e.type === "URL");
      const ips = entities.filter((e) => e.type === "IP");

      expect(emails.length).toBeGreaterThanOrEqual(1);
      expect(phones.length).toBeGreaterThanOrEqual(1);
      expect(urls.length).toBeGreaterThanOrEqual(1);
      expect(ips.length).toBeGreaterThanOrEqual(1);
    });

    it("should return entities sorted by position", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "First email@one.com then email@two.com";
      const entities = detector.detect(text);

      // Check entities are in order of appearance
      for (let i = 1; i < entities.length; i++) {
        expect(entities[i].start).toBeGreaterThan(entities[i - 1].start);
      }
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty string", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const entities = detector.detect("");
      expect(entities).toHaveLength(0);
    });

    it("should handle text with no PII", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "This is just regular text with no personal information.";
      const entities = detector.detect(text);

      expect(entities).toHaveLength(0);
    });

    it("should handle special characters", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Email: user_name+filter@sub.domain.co.uk!";
      const entities = detector.detect(text);

      expect(entities.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by entity types when specified", async () => {
      const { PatternDetector } = await import("../../src/detector/patterns");
      const detector = new PatternDetector();

      const text = "Email test@example.com and call 555-123-4567";
      const entities = detector.detect(text, { types: ["EMAIL"] });

      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe("EMAIL");
    });
  });
});
