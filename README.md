# pii-pseudonymizer

Detect, pseudonymize, and restore personally identifiable information (PII) in text.

Replaces real PII with realistic fake data (powered by [Faker.js](https://fakerjs.dev/)) and can restore it later using session-based mapping. Useful for safely processing sensitive text through AI models, sharing datasets, or testing with realistic data.

## Detection Methods

- **Pattern-based**: EMAIL, PHONE, URL, IP, DOMAIN
- **Context-aware**: Detects names and organizations from surrounding context clues
- **NER-based**: PERSON, ORG, LOCATION (via [Hugging Face Transformers](https://huggingface.co/docs/transformers.js))

## Requirements

- [Bun](https://bun.sh/) runtime

## Installation

```bash
git clone https://github.com/jcfischer/pii-pseudonymizer.git
cd pii-pseudonymizer
bun install
```

### Build the CLI binary

```bash
bun run build
```

This compiles a standalone `pii` binary.

## CLI Usage

### Detect PII

```bash
echo "Contact john@example.com or call +41 79 123 45 67" | ./pii detect
echo "Contact john@example.com" | ./pii detect --format text
echo "Contact john@example.com" | ./pii detect --types EMAIL,PHONE
```

### Pseudonymize

```bash
echo "Email john@example.com about the project" | ./pii pseudonymize
echo "Email john@example.com about the project" | ./pii pseudonymize --text-only
echo "Email john@example.com about the project" | ./pii pseudonymize --text-only -v
```

### Pseudonymize and Restore (round-trip)

```bash
# Pseudonymize and save session
echo "Contact john@example.com at Acme Corp" | ./pii pseudonymize --save-session /tmp/session.json --text-only

# Process the safe text with AI, then restore
echo "I contacted jane.smith@fakecorp.net at Globex Inc" | ./pii restore --load-session /tmp/session.json --text-only
```

### Custom Names

Create a JSON config to detect specific names:

```json
{
  "names": [
    { "name": "John Doe", "aliases": ["JD", "John"] },
    { "name": "Acme Corp", "aliases": ["Acme", "ACME"] }
  ]
}
```

```bash
echo "JD from Acme signed the contract" | ./pii detect --custom-names config.json
```

### Options

| Flag | Description |
|------|-------------|
| `-f, --file <path>` | Read input from file instead of stdin |
| `-t, --types <types>` | Filter by entity types (comma-separated) |
| `--format <format>` | Output format: `json` (default) or `text` |
| `--text-only` | Output only the processed text |
| `-v, --verbose` | Show translation table (pseudonymize only) |
| `--save-session <path>` | Save session mappings for later restoration |
| `--load-session <path>` | Load saved session mappings |
| `--custom-names <path>` | Load custom names config from JSON |
| `--warm-up` | Pre-load NER model before detection |
| `--no-ner` | Disable NER detection |
| `--no-context` | Disable context-aware detection |

## Library Usage

```typescript
import { PIIService } from "pii-pseudonymizer";

const service = new PIIService();

// Detect
const entities = await service.detect("Contact john@example.com");

// Pseudonymize
const result = await service.pseudonymize("Contact john@example.com");
console.log(result.text); // "Contact jane.smith@fakecorp.net"

// Restore
const restored = await service.restore(result.text, result.sessionId);
console.log(restored.text); // "Contact john@example.com"
```

### AI Wrapper

Wrap AI calls with automatic PII protection:

```typescript
import { protectedAICall } from "pii-pseudonymizer/ai-wrapper";

const result = await protectedAICall(
  "Summarize this: John Doe (john@acme.com) reported a bug",
  async (safePrompt) => {
    // safePrompt has PII replaced with fake data
    const response = await yourAICall(safePrompt);
    return response;
  }
);
// result.result has the original PII restored in the AI's response
```

Set the `PII_CLI` environment variable to point to the compiled binary if it's not in the default location.

## Testing

```bash
bun test
```

## License

MIT
