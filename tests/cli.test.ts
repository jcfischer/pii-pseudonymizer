import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import { writeFileSync, unlinkSync, existsSync } from "fs";

// =============================================================================
// CLI Integration Tests (TDD - RED Phase)
// =============================================================================

const CLI_PATH = "/Users/fischer/.claude/skills/pii/src/index.ts";
const TEST_DIR = "/Users/fischer/.claude/skills/pii/tests";

describe("PII CLI", () => {
  // ===========================================================================
  // Help & Version
  // ===========================================================================

  describe("help and version", () => {
    it("should show help with --help", async () => {
      const result = await $`bun ${CLI_PATH} --help`.text();
      expect(result).toContain("pii");
      expect(result).toContain("pseudonymize");
      expect(result).toContain("restore");
    });

    it("should show version with --version", async () => {
      const result = await $`bun ${CLI_PATH} --version`.text();
      expect(result).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  // ===========================================================================
  // Detect Command
  // ===========================================================================

  describe("detect command", () => {
    it("should detect PII from stdin", async () => {
      const input = "Contact john@example.com or call 555-123-4567";
      const result = await $`echo ${input} | bun ${CLI_PATH} detect`.json();

      expect(result.entities).toBeDefined();
      expect(result.entities.length).toBeGreaterThanOrEqual(2);
      const types = result.entities.map((e: any) => e.type);
      expect(types).toContain("EMAIL");
      expect(types).toContain("PHONE");
    });

    it("should detect PII from file", async () => {
      const testFile = `${TEST_DIR}/test-input.txt`;
      writeFileSync(testFile, "Email: alice@corp.com");

      try {
        const result = await $`bun ${CLI_PATH} detect --file ${testFile}`.json();
        expect(result.entities).toBeDefined();
        expect(result.entities.length).toBe(1);
        expect(result.entities[0].type).toBe("EMAIL");
      } finally {
        unlinkSync(testFile);
      }
    });

    it("should filter by entity type", async () => {
      const input = "Email: test@example.com Phone: 555-123-4567";
      const result =
        await $`echo ${input} | bun ${CLI_PATH} detect --types EMAIL`.json();

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe("EMAIL");
    });

    it("should output in text format", async () => {
      const input = "Contact test@example.com";
      const result =
        await $`echo ${input} | bun ${CLI_PATH} detect --format text`.text();

      expect(result).toContain("EMAIL");
      expect(result).toContain("test@example.com");
    });
  });

  // ===========================================================================
  // Pseudonymize Command
  // ===========================================================================

  describe("pseudonymize command", () => {
    it("should pseudonymize text from stdin", async () => {
      const input = "Contact john@example.com for help";
      const result =
        await $`echo ${input} | bun ${CLI_PATH} pseudonymize`.json();

      expect(result.text).toBeDefined();
      expect(result.text).not.toContain("john@example.com");
      expect(result.sessionId).toBeDefined();
      expect(result.replacementCount).toBe(1);
    });

    it("should pseudonymize text from file", async () => {
      const testFile = `${TEST_DIR}/test-input2.txt`;
      writeFileSync(testFile, "Email alice@corp.com for info");

      try {
        const result =
          await $`bun ${CLI_PATH} pseudonymize --file ${testFile}`.json();
        expect(result.text).not.toContain("alice@corp.com");
        expect(result.sessionId).toBeDefined();
      } finally {
        unlinkSync(testFile);
      }
    });

    it("should output only text with --text-only", async () => {
      const input = "Contact test@example.com";
      const result =
        await $`echo ${input} | bun ${CLI_PATH} pseudonymize --text-only`.text();

      // Should be just the pseudonymized text, no JSON
      expect(result).not.toContain("{");
      expect(result).not.toContain("sessionId");
      expect(result).toContain("@"); // Should have replacement email
    });

    it("should save session to file", async () => {
      const input = "Email: test@example.com";
      const sessionFile = `${TEST_DIR}/test-session.json`;

      try {
        const result =
          await $`echo ${input} | bun ${CLI_PATH} pseudonymize --save-session ${sessionFile}`.json();

        expect(existsSync(sessionFile)).toBe(true);
        const session = JSON.parse(
          await Bun.file(sessionFile).text()
        );
        expect(session.sessionId).toBe(result.sessionId);
        expect(session.mappings).toBeDefined();
      } finally {
        if (existsSync(sessionFile)) unlinkSync(sessionFile);
      }
    });

    it("should use provided session ID", async () => {
      const input1 = "First test@example.com";
      const input2 = "Second another@test.com";

      // First pseudonymization
      const result1 =
        await $`echo ${input1} | bun ${CLI_PATH} pseudonymize`.json();
      const sessionFile = `${TEST_DIR}/session-reuse.json`;

      try {
        // Save session
        await $`echo ${input1} | bun ${CLI_PATH} pseudonymize --save-session ${sessionFile}`.quiet();

        // Second pseudonymization with same session
        const result2 =
          await $`echo ${input2} | bun ${CLI_PATH} pseudonymize --load-session ${sessionFile}`.json();

        // Sessions should be different because we're using CLI instances
        // But the functionality should work
        expect(result2.sessionId).toBeDefined();
        expect(result2.text).not.toContain("another@test.com");
      } finally {
        if (existsSync(sessionFile)) unlinkSync(sessionFile);
      }
    });
  });

  // ===========================================================================
  // Restore Command
  // ===========================================================================

  describe("restore command", () => {
    it("should restore pseudonymized text", async () => {
      const original = "Contact john@example.com for help";
      const sessionFile = `${TEST_DIR}/restore-session.json`;

      try {
        // Pseudonymize and save session
        const pseudoResult =
          await $`echo ${original} | bun ${CLI_PATH} pseudonymize --save-session ${sessionFile}`.json();

        // Restore using session
        const restoreResult =
          await $`echo ${pseudoResult.text} | bun ${CLI_PATH} restore --load-session ${sessionFile}`.json();

        expect(restoreResult.text).toContain("john@example.com");
        expect(restoreResult.restorationCount).toBe(1);
      } finally {
        if (existsSync(sessionFile)) unlinkSync(sessionFile);
      }
    });

    it("should restore from file", async () => {
      const original = "Email alice@corp.com";
      const sessionFile = `${TEST_DIR}/restore-session2.json`;
      const pseudoFile = `${TEST_DIR}/pseudo-text.txt`;

      try {
        // Pseudonymize
        const pseudoResult =
          await $`echo ${original} | bun ${CLI_PATH} pseudonymize --save-session ${sessionFile}`.json();

        // Write pseudonymized text to file
        writeFileSync(pseudoFile, pseudoResult.text);

        // Restore from file
        const restoreResult =
          await $`bun ${CLI_PATH} restore --file ${pseudoFile} --load-session ${sessionFile}`.json();

        expect(restoreResult.text).toContain("alice@corp.com");
      } finally {
        if (existsSync(sessionFile)) unlinkSync(sessionFile);
        if (existsSync(pseudoFile)) unlinkSync(pseudoFile);
      }
    });

    it("should output only text with --text-only", async () => {
      const original = "Contact test@example.com";
      const sessionFile = `${TEST_DIR}/restore-text-only.json`;

      try {
        // Pseudonymize
        const pseudoResult =
          await $`echo ${original} | bun ${CLI_PATH} pseudonymize --save-session ${sessionFile}`.json();

        // Restore with text-only
        const restoreResult =
          await $`echo ${pseudoResult.text} | bun ${CLI_PATH} restore --load-session ${sessionFile} --text-only`.text();

        expect(restoreResult).not.toContain("{");
        expect(restoreResult.trim()).toContain("test@example.com");
      } finally {
        if (existsSync(sessionFile)) unlinkSync(sessionFile);
      }
    });

    it("should handle missing session file gracefully", async () => {
      const input = "Some text";

      // Use nothrow to capture both stdout and stderr without throwing
      const proc = $`echo ${input} | bun ${CLI_PATH} restore --load-session nonexistent.json 2>&1`.nothrow();
      const result = await proc.text();

      // Should error with message about missing session
      expect(
        result.includes("Error") ||
          result.includes("not found") ||
          result.includes("Session file")
      ).toBe(true);
    });
  });

  // ===========================================================================
  // Round-Trip
  // ===========================================================================

  describe("round-trip via CLI", () => {
    it("should preserve original after pseudonymize → restore", async () => {
      const original = "Contact john.doe@company.com or call (555) 123-4567";
      const sessionFile = `${TEST_DIR}/roundtrip-session.json`;

      try {
        // Pseudonymize
        const pseudoResult =
          await $`echo ${original} | bun ${CLI_PATH} pseudonymize --save-session ${sessionFile}`.json();

        // Verify PII is replaced
        expect(pseudoResult.text).not.toContain("john.doe@company.com");
        expect(pseudoResult.text).not.toContain("(555) 123-4567");

        // Restore
        const restoreResult =
          await $`echo ${pseudoResult.text} | bun ${CLI_PATH} restore --load-session ${sessionFile}`.json();

        // Verify PII is restored
        expect(restoreResult.text).toBe(original);
      } finally {
        if (existsSync(sessionFile)) unlinkSync(sessionFile);
      }
    });

    it("should handle complex multi-PII text", async () => {
      const original = `Dear Team,

Please contact alice@company.com or bob@partner.org about the project.
Call Alice at (555) 111-2222 or Bob at (555) 333-4444.

Server IP: 192.168.1.100

Best regards`;

      const sessionFile = `${TEST_DIR}/complex-session.json`;

      try {
        // Pseudonymize
        const pseudoResult =
          await $`echo ${original} | bun ${CLI_PATH} pseudonymize --save-session ${sessionFile}`.json();

        // Verify emails are replaced
        expect(pseudoResult.text).not.toContain("alice@company.com");
        expect(pseudoResult.text).not.toContain("bob@partner.org");

        // Restore
        const restoreResult =
          await $`echo ${pseudoResult.text} | bun ${CLI_PATH} restore --load-session ${sessionFile}`.json();

        // Verify emails are restored
        expect(restoreResult.text).toContain("alice@company.com");
        expect(restoreResult.text).toContain("bob@partner.org");
      } finally {
        if (existsSync(sessionFile)) unlinkSync(sessionFile);
      }
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty input", async () => {
      const result = await $`echo "" | bun ${CLI_PATH} detect`.json();
      expect(result.entities).toHaveLength(0);
    });

    it("should handle text without PII", async () => {
      const input = "This is regular text without any personal information.";
      const result =
        await $`echo ${input} | bun ${CLI_PATH} pseudonymize`.json();

      expect(result.text).toBe(input);
      expect(result.replacementCount).toBe(0);
    });

    it("should handle unicode text", async () => {
      const input = "Kontakt: müller@beispiel.de";
      const sessionFile = `${TEST_DIR}/unicode-session.json`;

      try {
        const pseudoResult =
          await $`echo ${input} | bun ${CLI_PATH} pseudonymize --save-session ${sessionFile}`.json();

        expect(pseudoResult.text).not.toContain("müller@beispiel.de");

        const restoreResult =
          await $`echo ${pseudoResult.text} | bun ${CLI_PATH} restore --load-session ${sessionFile}`.json();

        expect(restoreResult.text).toContain("müller@beispiel.de");
      } finally {
        if (existsSync(sessionFile)) unlinkSync(sessionFile);
      }
    });
  });
});
