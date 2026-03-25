---
name: Pii
effort: low
description: |
  PII (Personally Identifiable Information) detection, pseudonymization, and restoration.
  Transforms PII into realistic fake data and back, enabling safe AI processing of sensitive documents.
  Supports pattern-based detection (EMAIL, PHONE, URL, IP, DOMAIN) and NER-based detection (PERSON, ORG, LOCATION).

  USE WHEN user mentions "anonymize", "pseudonymize", "PII", "personal data", "sensitive data",
  OR needs to process documents containing emails, phone numbers, names before sending to AI,
  OR wants to restore anonymized text back to original.
triggers:
  - pattern: "/pii"
    type: command
    priority: 100
  - pattern: "anonymize"
    type: keyword
    priority: 50
  - pattern: "pseudonymize"
    type: keyword
    priority: 50
  - pattern: "detect pii"
    type: keyword
    priority: 50
  - pattern: "personal data"
    type: keyword
    priority: 40
---

# PII Skill

Local PII detection, pseudonymization, and restoration. Enables safe AI processing of sensitive documents by replacing personal information with realistic fake data, then restoring it in outputs.

Uses pattern matching for structured data (emails, phones, URLs, IPs, domains), context-aware detection for names in signatures/greetings/headers, and Named Entity Recognition (NER) via Transformers.js for names, organizations, and locations.

## Quick Start

```bash
# Detect PII in text
echo "Contact john@example.com" | pii detect

# Pseudonymize (replace PII with fake data)
echo "Email alice@corp.com" | pii pseudonymize --save-session session.json

# Restore original PII
echo "Email fake@example.com" | pii restore --load-session session.json
```

## Commands

### detect

Detect PII entities in text without modifying.

```bash
# From stdin (detects patterns + names/orgs/locations via NER)
echo "Contact John Smith at john@example.com" | pii detect

# From file
pii detect --file document.txt

# Filter by type (patterns: EMAIL,PHONE,URL,IP,DOMAIN; NER: PERSON,ORG,LOCATION)
pii detect --types EMAIL,PHONE
pii detect --types PERSON,ORG

# Text output instead of JSON
pii detect --format text

# Pre-warm NER model (faster subsequent detections)
pii detect --warm-up

# Pattern-only detection (skip NER and context)
pii detect --no-ner --no-context

# Context-aware detection only (skip NER, slower ML model)
pii detect --no-ner

# Custom names detection (customer/partner names)
pii detect --custom-names customers.json
```

### pseudonymize

Replace PII with realistic fake data.

```bash
# Basic pseudonymization
echo "Email alice@corp.com" | pii pseudonymize

# Save session for restoration
echo "Email alice@corp.com" | pii pseudonymize --save-session session.json

# Output only text (no JSON wrapper)
echo "Email alice@corp.com" | pii pseudonymize --text-only

# Filter by type
echo "Email alice@corp.com Phone: 555-1234" | pii pseudonymize --types EMAIL

# Show translation table (original → pseudonym mappings)
echo "Contact John Smith at john@example.com" | pii pseudonymize --verbose

# Combine text-only with verbose (table shown on stderr)
echo "Contact John Smith" | pii pseudonymize --text-only --verbose

# Custom names (include customer/partner names in pseudonymization)
echo "Meeting with Acme Corp" | pii pseudonymize --custom-names customers.json
```

### restore

Restore pseudonyms back to original PII.

```bash
# Restore using saved session
echo "Email katrine72@yahoo.com" | pii restore --load-session session.json

# From file
pii restore --file pseudonymized.txt --load-session session.json

# Text only output
pii restore --load-session session.json --text-only < pseudo.txt
```

## Supported PII Types

| Type | Examples | Detection Method |
|------|----------|------------------|
| EMAIL | john@example.com | Pattern |
| PHONE | (555) 123-4567, +1-555-123-4567 | Pattern |
| URL | https://company.com/page | Pattern |
| IP | 192.168.1.1, 10.0.0.1 | Pattern |
| DOMAIN | company.com, example.org | Pattern |
| PERSON | John Doe, Angela Smith | Context + NER |
| ORG | Acme Corp, Switch AG | NER |
| LOCATION | New York, Zurich | NER |

### Context Detection

Names are detected in specific contexts with high reliability:
- **Signatures**: After "--", "Best regards,", "Sincerely,", "Thanks,", "Cheers,"
- **Greetings**: After "Dear", "Hi", "Hello"
- **Headers**: After "From:", "To:", "Cc:", "Contact:", "Author:"
- **Titles**: After "Dr.", "Mr.", "Ms.", "Mrs.", "Prof."

### Custom Names Configuration

For detecting specific customer, partner, or organization names, use a JSON config file:

```json
{
  "names": [
    { "name": "Acme Corporation", "type": "ORG", "aliases": ["Acme", "ACME Corp"] },
    { "name": "John Smith", "type": "PERSON", "aliases": ["JS", "J. Smith"] }
  ],
  "simpleNames": ["Jane Doe", "Bob Wilson"],
  "caseSensitive": false,
  "matchPartial": false
}
```

**Configuration options:**
- `names` - Structured entries with type (PERSON/ORG) and optional aliases
- `simpleNames` - Simple string list (all treated as PERSON type)
- `caseSensitive` - Case-sensitive matching (default: false)
- `matchPartial` - Match within words, not just at boundaries (default: false)

**Key features:**
- Aliases map back to canonical names in output
- Priority: Pattern > Context > Custom > NER (for overlapping matches)
- High confidence (1.0 for exact match, 0.95 for aliases)

## Integration Example

### With meeting-intelligence and daily-briefing Skills

PII protection is **enabled by default** when using `--ai` flag:

```bash
# Meeting prep with PII protection (default)
meeting-intel prep --ai

# Meeting prep WITHOUT PII protection
meeting-intel prep --ai --no-pii

# With verbose PII logging
meeting-intel prep --ai --pii-verbose

# Daily briefing with PII protection (default)
briefing --ai

# Daily briefing WITHOUT PII protection
briefing --ai --no-pii
```

### Programmatic Integration

For use in other skills that send content to AI:

```typescript
// Method 1: Use the AI wrapper (recommended)
import { protectedAnthropicCall } from "~/.claude/skills/pii/src/utils/ai-wrapper";

const result = await protectedAnthropicCall(
  prompt,
  async (safePrompt) => anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    messages: [{ role: "user", content: safePrompt }]
  }),
  { verbose: true }
);
// result.result contains AI response with original PII restored

// Method 2: Direct service usage
import { PIIService } from "~/.claude/skills/pii/src/service/pii-service";

const service = new PIIService();

// Before sending to AI
const { text: safeText, sessionId } = await service.pseudonymize(emailBody);
const aiResponse = await callAI(safeText);

// After receiving AI response
const { text: finalResponse } = await service.restore(aiResponse, sessionId);
```

## Session Management

Sessions track the mapping between original and pseudonymized values:

- **Save session**: `--save-session session.json` - Saves mappings for later restoration
- **Load session**: `--load-session session.json` - Uses saved mappings
- **Round-trip**: Pseudonymize → Save → AI process → Restore → Original names

Sessions are JSON files containing:
```json
{
  "sessionId": "pii_abc123_xyz789",
  "createdAt": "2025-12-15T10:00:00.000Z",
  "mappings": [
    { "original": "john@example.com", "pseudonym": "katrine72@yahoo.com", "type": "EMAIL" }
  ]
}
```

## Key Features

- **100% Local**: No cloud services, all processing on-device
- **Consistent Pseudonyms**: Same input always generates same fake data (deterministic)
- **Realistic Fakes**: Uses Faker.js for believable replacement data
- **Round-trip Safe**: Original text fully restorable from pseudonymized version
- **Type Filtering**: Process only specific PII types if needed

## Architecture

```
src/
├── index.ts              # CLI entry point
├── types.ts              # Type definitions
├── detector/
│   ├── index.ts          # Unified detector (patterns + context + custom + NER)
│   ├── patterns.ts       # Regex-based PII detection
│   ├── context.ts        # Context-aware name detection
│   ├── custom.ts         # Custom name detection (configurable)
│   └── ner.ts            # NER-based detection via Transformers.js
├── pseudonymizer/
│   ├── generator.ts      # Faker-based pseudonym generation
│   └── mapper.ts         # Bidirectional mapping store
└── service/
    └── pii-service.ts    # Main service orchestrating components
```

## Test Coverage

222 tests covering:
- Pattern detection (emails, phones, URLs, IPs, domains)
- Context detection (signatures, greetings, headers, titles)
- Custom name detection (aliases, case sensitivity, word boundaries)
- NER detection (persons, organizations, locations)
- Unified detector (combined detection, overlap handling)
- Pseudonym generation (consistency, uniqueness, realism)
- Mapping store (sessions, lookups, isolation)
- Service integration (detect, pseudonymize, restore, round-trip)
- CLI commands (all flags, file I/O, edge cases)

Run tests:
```bash
cd ~/.claude/skills/pii && bun test
```

## Execution Modes

The PII skill can run in two modes:

| Mode | Command | NER Support | Use Case |
|------|---------|-------------|----------|
| Full | `bun run src/index.ts` | Yes | Full detection including names/orgs |
| Compiled | `./pii` | Pattern only | Fast pattern detection |

The compiled binary gracefully falls back to pattern-only mode because native ONNX modules cannot be bundled.

## Roadmap

- [x] Phase 1: Pattern-based detection (EMAIL, PHONE, URL, IP, DOMAIN)
- [x] Phase 2: NER-based detection (PERSON, ORG, LOCATION) via Transformers.js
- [x] Phase 3: Context-aware detection (names in signatures, greetings, headers, titles)
- [x] Phase 4: Custom names detection (configurable customer/partner names with aliases)
