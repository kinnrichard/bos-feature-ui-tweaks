# Security Considerations

## Access Control

- Generator only accesses read-only database schema information
- No sensitive data (passwords, tokens) included in generated schema
- Output files contain only structural metadata

## Data Privacy

- Schema generation is metadata-only
- No actual user data exposed in generated files
- Generated TypeScript types contain no sensitive information
