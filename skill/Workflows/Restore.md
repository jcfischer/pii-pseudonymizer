# Restore Workflow

Restore pseudonymized text back to original PII using saved session.

## When to Use

- After AI has processed pseudonymized content
- Reversing anonymization for final output
- Recovering original names/emails from test data

## Steps

1. **Load session** - Read mappings from saved session file
2. **Get input** - Pseudonymized text from stdin or file
3. **Replace pseudonyms** - Substitute fake data with originals
4. **Output restored text**

## CLI Usage

```bash
# Restore using saved session
echo "Email katrine72@yahoo.com" | pii restore --load-session session.json

# From file
pii restore --file pseudonymized.txt --load-session session.json

# Text-only output
pii restore --load-session session.json --text-only < pseudo.txt
```

## Output Format

### JSON (default)
```json
{
  "text": "Email alice@corp.com",
  "restorationCount": 1
}
```

### Text-only
```
Email alice@corp.com
```

## Round-Trip Example

```bash
# Step 1: Pseudonymize and save session
echo "Contact John Smith at john@example.com about Project Alpha" \
  | pii pseudonymize --save-session /tmp/session.json --text-only \
  > /tmp/safe.txt

# Step 2: Process with AI (safe text)
cat /tmp/safe.txt | some-ai-command > /tmp/ai-response.txt

# Step 3: Restore original PII
cat /tmp/ai-response.txt | pii restore --load-session /tmp/session.json --text-only
```

## Important Notes

- **Session required**: Restoration only works with the session from pseudonymization
- **Longest match first**: Pseudonyms are replaced in order of length to avoid partial matches
- **All occurrences**: Every instance of a pseudonym in the text is restored
