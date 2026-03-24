import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  protectedAICall,
  protectedAnthropicCall,
  pseudonymize,
  restore,
  clearSession,
  resetPIIService,
  extractAnthropicText,
} from "../../src/utils/ai-wrapper";

// =============================================================================
// AI Wrapper Tests
// =============================================================================

describe("AI Wrapper", () => {
  beforeEach(() => {
    // Reset shared service between tests
    resetPIIService();
  });

  // ===========================================================================
  // protectedAICall
  // ===========================================================================

  describe("protectedAICall", () => {
    it("should pseudonymize prompt and restore response", async () => {
      const originalPrompt = "Contact john@example.com for help";
      let receivedPrompt = "";

      const result = await protectedAICall(
        originalPrompt,
        async (safePrompt) => {
          receivedPrompt = safePrompt;
          // Simulate AI echoing back part of the prompt
          return `I will contact ${safePrompt.match(/[\w.]+@[\w.]+/)?.[0] || "the email"} as requested.`;
        }
      );

      // The AI received a pseudonymized prompt
      expect(receivedPrompt).not.toContain("john@example.com");
      expect(receivedPrompt).toContain("@"); // Has pseudonym email

      // The result has original PII restored
      expect(result.result).toContain("john@example.com");
      expect(result.entitiesProtected).toBe(1);
      expect(result.restorationsPerformed).toBeGreaterThanOrEqual(1);
    });

    it("should handle multiple PII entities", async () => {
      const originalPrompt =
        "Email alice@corp.com and bob@partner.org about the project";
      let receivedPrompt = "";

      const result = await protectedAICall(
        originalPrompt,
        async (safePrompt) => {
          receivedPrompt = safePrompt;
          // Extract the pseudonym emails from the prompt
          const emails = safePrompt.match(/[\w.]+@[\w.]+/g) || [];
          return `Sent emails to ${emails.join(" and ")}.`;
        }
      );

      // Original emails should not be in the prompt sent to AI
      expect(receivedPrompt).not.toContain("alice@corp.com");
      expect(receivedPrompt).not.toContain("bob@partner.org");

      // Both should be restored in response
      expect(result.result).toContain("alice@corp.com");
      expect(result.result).toContain("bob@partner.org");
      expect(result.entitiesProtected).toBe(2);
    });

    it("should handle prompt without PII", async () => {
      const originalPrompt = "What is the weather today?";

      const result = await protectedAICall(originalPrompt, async (safePrompt) => {
        return "The weather is sunny.";
      });

      expect(result.result).toBe("The weather is sunny.");
      expect(result.entitiesProtected).toBe(0);
      expect(result.restorationsPerformed).toBe(0);
    });

    it("should filter by entity types", async () => {
      const originalPrompt = "Email test@example.com at 555-123-4567";
      let receivedPrompt = "";

      const result = await protectedAICall(
        originalPrompt,
        async (safePrompt) => {
          receivedPrompt = safePrompt;
          return safePrompt;
        },
        { types: ["EMAIL"] }
      );

      // Email should be pseudonymized
      expect(receivedPrompt).not.toContain("test@example.com");
      // Phone should NOT be pseudonymized (not in filter)
      expect(receivedPrompt).toContain("555-123-4567");
    });

    it("should clean up session after call", async () => {
      let capturedSessionId = "";

      const result = await protectedAICall(
        "Contact test@example.com",
        async (safePrompt) => {
          return "Done";
        }
      );

      capturedSessionId = result.sessionId;

      // Session should be cleared
      const restoreResult = await restore("Some text", capturedSessionId);
      expect(restoreResult.restorationCount).toBe(0); // Session no longer exists
    });
  });

  // ===========================================================================
  // protectedAnthropicCall
  // ===========================================================================

  describe("protectedAnthropicCall", () => {
    it("should work with Anthropic response format", async () => {
      const result = await protectedAnthropicCall(
        "Contact john@example.com",
        async (safePrompt) => {
          // Simulate Anthropic response structure
          const email = safePrompt.match(/[\w.]+@[\w.]+/)?.[0] || "";
          return {
            content: [
              { type: "text", text: `Contacting ${email}` },
              { type: "text", text: ` for assistance.` },
            ],
          };
        }
      );

      expect(result.result).toContain("john@example.com");
      expect(result.entitiesProtected).toBe(1);
    });

    it("should bypass protection when disabled", async () => {
      let receivedPrompt = "";

      const result = await protectedAnthropicCall(
        "Contact john@example.com",
        async (safePrompt) => {
          receivedPrompt = safePrompt;
          return {
            content: [{ type: "text", text: "Response" }],
          };
        },
        { enabled: false }
      );

      // Original email should be passed through
      expect(receivedPrompt).toContain("john@example.com");
      expect(result.entitiesProtected).toBe(0);
      expect(result.sessionId).toBe("");
    });
  });

  // ===========================================================================
  // extractAnthropicText
  // ===========================================================================

  describe("extractAnthropicText", () => {
    it("should extract text from content blocks", () => {
      const content = [
        { type: "text", text: "Hello" },
        { type: "text", text: "World" },
      ];

      const result = extractAnthropicText(content);
      expect(result).toBe("Hello\n\nWorld");
    });

    it("should filter non-text blocks", () => {
      const content = [
        { type: "text", text: "Text content" },
        { type: "tool_use", id: "123" },
        { type: "text", text: "More text" },
      ];

      const result = extractAnthropicText(content as any);
      expect(result).toBe("Text content\n\nMore text");
    });

    it("should handle empty content", () => {
      expect(extractAnthropicText([])).toBe("");
    });
  });

  // ===========================================================================
  // Manual pseudonymize/restore
  // ===========================================================================

  describe("manual pseudonymize/restore", () => {
    it("should allow manual control of pseudonymization", async () => {
      const text = "Email test@example.com";

      const { text: safe, sessionId } = await pseudonymize(text);

      expect(safe).not.toContain("test@example.com");
      expect(sessionId).toBeDefined();

      // Do something with the safe text...

      const { text: restored } = await restore(safe, sessionId);
      expect(restored).toContain("test@example.com");

      // Clean up
      clearSession(sessionId);
    });
  });

  // ===========================================================================
  // Round-trip integrity
  // ===========================================================================

  describe("round-trip integrity", () => {
    it("should preserve complex prompts through protection", async () => {
      const complexPrompt = `
## Meeting Preparation

### Attendees
- Alice Smith (alice@company.com)
- Bob Jones (bob@partner.org)

### Contact Numbers
- Alice: (555) 111-2222
- Bob: (555) 333-4444

### Server Access
- Production: 192.168.1.100
- Staging: 10.0.0.50

Please prepare briefing materials.
`;

      const result = await protectedAICall(complexPrompt, async (safePrompt) => {
        // AI "processes" and returns modified version
        return safePrompt.replace("Please prepare", "I have prepared");
      });

      // All PII should be restored
      expect(result.result).toContain("alice@company.com");
      expect(result.result).toContain("bob@partner.org");
      expect(result.result).toContain("(555) 111-2222");
      expect(result.result).toContain("(555) 333-4444");
      expect(result.result).toContain("192.168.1.100");
      expect(result.result).toContain("10.0.0.50");

      // Content should be modified as expected
      expect(result.result).toContain("I have prepared");
    });
  });
});
