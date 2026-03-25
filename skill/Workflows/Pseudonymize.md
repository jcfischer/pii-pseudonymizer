# Pseudonymize Workflow

Replace PII with realistic fake data while maintaining text structure.

## When to Use

- Before sending content to external AI services
- Sharing documents with third parties
- Creating test data from production content
- Complying with data protection requirements

## Steps

1. **Get input** - From stdin, file, or programmatically
2. **Detect PII** - Find all entities in text
3. **Generate pseudonyms** - Create realistic replacements via Faker.js
4. **Replace text** - Substitute originals with pseudonyms
5. **Save session** - Store mappings for later restoration

## CLI Usage

```bash
# Basic pseudonymization
echo "Email alice@corp.com" | pii pseudonymize

# Save session for later restoration
echo "Contact John at john@example.com" | pii pseudonymize --save-session session.json

# Output only text (no JSON wrapper)
echo "Email alice@corp.com" | pii pseudonymize --text-only

# Show translation table
echo "Contact John Smith" | pii pseudonymize --verbose

# Filter by type (only anonymize emails)
echo "Email alice@corp.com Phone: 555-1234" | pii pseudonymize --types EMAIL

# With custom names
echo "Meeting with Acme Corp" | pii pseudonymize --custom-names customers.json
```

## Output Format

### JSON (default)
```json
{
  "text": "Email katrine72@yahoo.com",
  "sessionId": "pii_abc123_xyz789",
  "replacementCount": 1,
  "entities": [{ "type": "EMAIL", "original": "alice@corp.com" }]
}
```

### With --verbose
```json
{
  "text": "Contact Alice Johnson at katrine72@yahoo.com",
  "sessionId": "pii_abc123_xyz789",
  "replacementCount": 2,
  "entities": [...],
  "translationTable": [
    { "original": "John Smith", "pseudonym": "Alice Johnson", "type": "PERSON" },
    { "original": "john@example.com", "pseudonym": "katrine72@yahoo.com", "type": "EMAIL" }
  ]
}
```

### Text-only with --verbose
```
Contact Alice Johnson at katrine72@yahoo.com

--- Translation Table ---
[PERSON] "John Smith" → "Alice Johnson"
[EMAIL] "john@example.com" → "katrine72@yahoo.com"
```

## Session Files

Sessions track mappings between originals and pseudonyms:

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

- **Deterministic**: Same input always produces same pseudonym (within session)
- **Realistic**: Uses Faker.js for believable replacements
- **Reversible**: Sessions enable full restoration
- **Type-aware**: Email pseudonyms are valid emails, phones are valid phones
