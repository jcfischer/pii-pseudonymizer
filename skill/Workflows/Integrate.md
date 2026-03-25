# Integrate Workflow

Add PII protection to AI calls in other skills or applications.

## When to Use

- Building a skill that sends user content to AI
- Wrapping existing AI calls with PII protection
- Creating safe pipelines for sensitive data processing

## Integration Methods

### Method 1: AI Wrapper (Recommended)

The simplest approach - wraps any AI call with automatic pseudonymization/restoration:

```typescript
import { protectedAnthropicCall } from "~/.claude/skills/Pii/src/utils/ai-wrapper";

const result = await protectedAnthropicCall(
  userContent,  // Contains PII
  async (safeContent) => {
    // safeContent has PII replaced with pseudonyms
    return anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: safeContent }]
    });
  },
  { verbose: true }  // Optional: log translation table
);

// result.result contains AI response with original PII restored
console.log(result.result);
```

### Method 2: Direct Service Usage

For more control over the pseudonymization process:

```typescript
import { PIIService } from "~/.claude/skills/Pii/src/service/pii-service";

const service = new PIIService();

// Before sending to AI
const { text: safeText, sessionId } = await service.pseudonymize(emailBody);

// Send safe text to AI
const aiResponse = await callYourAI(safeText);

// After receiving AI response - restore original PII
const { text: finalResponse } = await service.restore(aiResponse, sessionId);
```

### Method 3: CLI Pipeline

For shell scripts or CLI tools:

```bash
# In your script
safe_text=$(echo "$user_input" | pii pseudonymize --save-session /tmp/session.json --text-only)
ai_response=$(echo "$safe_text" | your-ai-command)
final_output=$(echo "$ai_response" | pii restore --load-session /tmp/session.json --text-only)
```

## Integration Pattern for Skills

When building a skill that processes user content:

```typescript
// skill-with-pii.ts
import { PIIService } from "~/.claude/skills/Pii/src/service/pii-service";

interface SkillOptions {
  piiProtection?: boolean;
  piiVerbose?: boolean;
}

async function processWithAI(content: string, options: SkillOptions = {}) {
  const { piiProtection = true, piiVerbose = false } = options;

  let processedContent = content;
  let sessionId: string | undefined;
  const service = new PIIService();

  // Pseudonymize if protection enabled
  if (piiProtection) {
    const result = await service.pseudonymize(content);
    processedContent = result.text;
    sessionId = result.sessionId;

    if (piiVerbose) {
      console.error("[PII] Pseudonymized content before AI call");
    }
  }

  // Call AI with safe content
  const aiResponse = await yourAICall(processedContent);

  // Restore if we pseudonymized
  if (piiProtection && sessionId) {
    const restored = await service.restore(aiResponse, sessionId);
    return restored.text;
  }

  return aiResponse;
}
```

## CLI Flags Convention

When adding PII protection to a CLI tool, use these standard flags:

| Flag | Description |
|------|-------------|
| `--no-pii` | Disable PII protection (enabled by default with `--ai`) |
| `--pii-verbose` | Show translation table |

Example:
```bash
your-tool --ai                    # PII protection ON (default)
your-tool --ai --no-pii           # PII protection OFF
your-tool --ai --pii-verbose      # Show what was anonymized
```

## Service API Reference

```typescript
class PIIService {
  // Detect PII entities
  detect(text: string, options?: DetectOptions): Promise<Entity[]>

  // Replace PII with pseudonyms
  pseudonymize(text: string, options?: PseudonymizeOptions): Promise<{
    text: string;
    sessionId: string;
    entities: Entity[];
    replacementCount: number;
  }>

  // Restore pseudonyms to originals
  restore(text: string, sessionId: string): Promise<{
    text: string;
    restorationCount: number;
  }>

  // Configure custom names
  setCustomNames(config: CustomNameConfig): void

  // Pre-load NER model
  warmUp(): Promise<void>

  // Get session for inspection
  getSession(sessionId: string): Session | undefined
}
```
