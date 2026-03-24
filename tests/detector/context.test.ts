import { describe, it, expect, beforeAll } from "bun:test";
import { ContextDetector } from "../../src/detector/context";
import type { DetectedEntity } from "../../src/types";

// =============================================================================
// Context Detector Tests
// =============================================================================

describe("ContextDetector", () => {
  let detector: ContextDetector;

  beforeAll(() => {
    detector = new ContextDetector();
  });

  // ===========================================================================
  // Email Signature Detection
  // ===========================================================================

  describe("email signature detection", () => {
    it("should detect name after signature delimiter '--'", () => {
      const text = `Thanks for the update.

--
John Smith
Senior Engineer`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("John Smith");
      expect(person?.context).toBe("signature");
    });

    it("should detect name after 'Best regards,'", () => {
      const text = `Let me know if you have questions.

Best regards,
Angela Brown`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Angela Brown");
      expect(person?.context).toBe("signature");
    });

    it("should detect name after 'Sincerely,'", () => {
      const text = `Thank you for your time.

Sincerely,
Michael Johnson`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Michael Johnson");
    });

    it("should detect name after 'Thanks,'", () => {
      const text = `I'll follow up tomorrow.

Thanks,
Sarah`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Sarah");
    });

    it("should detect name after 'Cheers,'", () => {
      const text = `See you next week.

Cheers,
David Miller`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("David Miller");
    });
  });

  // ===========================================================================
  // Greeting/Salutation Detection
  // ===========================================================================

  describe("greeting detection", () => {
    it("should detect name after 'Dear'", () => {
      const text = `Dear John,

I hope this email finds you well.`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("John");
      expect(person?.context).toBe("greeting");
    });

    it("should detect name after 'Hi'", () => {
      const text = `Hi Angela,

Thanks for reaching out.`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Angela");
    });

    it("should detect name after 'Hello'", () => {
      const text = `Hello Michael,

Great to hear from you.`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Michael");
    });

    it("should detect full name after 'Dear'", () => {
      const text = `Dear John Smith,

Following up on our conversation.`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("John Smith");
    });
  });

  // ===========================================================================
  // Header-style Detection
  // ===========================================================================

  describe("header detection", () => {
    it("should detect name after 'From:'", () => {
      const text = `From: John Smith
To: Angela Brown
Subject: Meeting tomorrow`;

      const entities = detector.detect(text);
      const fromPerson = entities.find(e => e.text === "John Smith");
      const toPerson = entities.find(e => e.text === "Angela Brown");

      expect(fromPerson).toBeDefined();
      expect(fromPerson?.context).toBe("header");
      expect(toPerson).toBeDefined();
    });

    it("should detect name after 'To:'", () => {
      const text = `To: Michael Johnson`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Michael Johnson");
    });

    it("should detect name after 'Cc:'", () => {
      const text = `Cc: Sarah Williams`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Sarah Williams");
    });

    it("should detect name after 'Contact:'", () => {
      const text = `Contact: David Miller
Phone: 555-1234`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("David Miller");
    });

    it("should detect name after 'Author:'", () => {
      const text = `Author: Emily Chen
Date: 2025-12-15`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Emily Chen");
    });
  });

  // ===========================================================================
  // Title/Role Detection
  // ===========================================================================

  describe("title detection", () => {
    it("should detect name after 'Dr.'", () => {
      const text = `Dr. John Smith will present the findings.`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Dr. John Smith");
      expect(person?.context).toBe("title");
    });

    it("should detect name after 'Mr.'", () => {
      const text = `Please contact Mr. Johnson for details.`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Mr. Johnson");
    });

    it("should detect name after 'Ms.'", () => {
      const text = `Ms. Williams will lead the project.`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Ms. Williams");
    });

    it("should detect name after 'Mrs.'", () => {
      const text = `Mrs. Angela Brown is the director.`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Mrs. Angela Brown");
    });

    it("should detect name after 'Prof.'", () => {
      const text = `Prof. Michael Chen gave the lecture.`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("Prof. Michael Chen");
    });
  });

  // ===========================================================================
  // Position Tracking
  // ===========================================================================

  describe("position tracking", () => {
    it("should return correct start and end positions", () => {
      const text = "Dear John Smith,";
      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.start).toBe(5); // After "Dear "
      expect(person?.end).toBe(15); // End of "John Smith"
      expect(text.substring(person!.start, person!.end)).toBe("John Smith");
    });

    it("should track positions in signature blocks", () => {
      const text = `Hello,

Thanks,
Angela Brown`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      const extractedText = text.substring(person!.start, person!.end);
      expect(extractedText).toBe("Angela Brown");
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty string", () => {
      const entities = detector.detect("");
      expect(entities).toEqual([]);
    });

    it("should handle text with no context patterns", () => {
      const entities = detector.detect("This is a normal sentence.");
      expect(entities).toEqual([]);
    });

    it("should not detect non-name words after patterns", () => {
      const text = "Best regards,\n\nTeam";
      const entities = detector.detect(text);
      // "Team" is not a person name
      expect(entities.length).toBe(0);
    });

    it("should handle multiple context patterns in same text", () => {
      const text = `Dear John,

Thanks for the update.

Best regards,
Angela`;

      const entities = detector.detect(text);
      expect(entities.length).toBe(2);

      const names = entities.map(e => e.text);
      expect(names).toContain("John");
      expect(names).toContain("Angela");
    });

    it("should handle name with email in signature", () => {
      const text = `Best,
John Smith
john@example.com`;

      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.text).toBe("John Smith");
      // Email should be detected by pattern detector, not context detector
    });
  });

  // ===========================================================================
  // Confidence Scores
  // ===========================================================================

  describe("confidence scores", () => {
    it("should assign high confidence to titled names", () => {
      const text = "Dr. John Smith attended.";
      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("should assign high confidence to greeting names", () => {
      const text = "Dear Angela,";
      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("should assign moderate confidence to signature names", () => {
      const text = `Thanks,
John`;
      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  // ===========================================================================
  // Method Attribution
  // ===========================================================================

  describe("method attribution", () => {
    it("should mark entities as context-detected", () => {
      const text = "Dear John,";
      const entities = detector.detect(text);
      const person = entities.find(e => e.type === "PERSON");

      expect(person).toBeDefined();
      expect(person?.method).toBe("context");
    });
  });
});
