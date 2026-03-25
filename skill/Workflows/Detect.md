# Detect Workflow

Detect PII entities in text without modification.

## When to Use

- User wants to scan text for personal information
- Need to audit a document for sensitive data
- Pre-check before deciding whether to anonymize

## Steps

1. **Get input** - From stdin, file, or clipboard
2. **Run detection** - Pattern + Context + NER (configurable)
3. **Output results** - JSON or text format with entity types and positions

## CLI Usage

```bash
# Basic detection from stdin
echo "Contact John at john@example.com" | pii detect

# From file
pii detect --file document.txt

# Filter specific types
pii detect --types EMAIL,PHONE
pii detect --types PERSON,ORG

# Text output instead of JSON
pii detect --format text

# Pattern-only (skip NER for speed)
pii detect --no-ner

# Include custom names (customers, partners)
pii detect --custom-names customers.json
```

## Output Format

### JSON (default)
```json
{
  "entities": [
    { "type": "EMAIL", "text": "john@example.com", "start": 16, "end": 32, "confidence": 1.0 },
    { "type": "PERSON", "text": "John", "start": 8, "end": 12, "confidence": 0.85 }
  ],
  "count": 2
}
```

### Text
```
EMAIL: "john@example.com" (16-32)
PERSON: "John" (8-12)
```

## Detection Methods

| Method | Types | Speed | Accuracy |
|--------|-------|-------|----------|
| Pattern | EMAIL, PHONE, URL, IP, DOMAIN | Fast | High |
| Context | PERSON (signatures, greetings) | Fast | High |
| Custom | PERSON, ORG (configured names) | Fast | Exact |
| NER | PERSON, ORG, LOCATION | Slower | Variable |

## Custom Names Configuration

Create a JSON file for detecting specific names:

```json
{
  "names": [
    { "name": "Acme Corporation", "type": "ORG", "aliases": ["Acme", "ACME Corp"] }
  ],
  "simpleNames": ["Jane Doe", "Bob Wilson"],
  "caseSensitive": false
}
```
