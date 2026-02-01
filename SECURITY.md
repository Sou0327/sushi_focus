# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainers directly or use GitHub's private vulnerability reporting feature
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Assessment**: We will assess the vulnerability and determine its severity
- **Fix Timeline**: Critical issues will be addressed within 7 days; others within 30 days
- **Disclosure**: We will coordinate disclosure timing with you

### Security Measures in FocusFlow

FocusFlow implements several security measures:

- **Local-only communication**: Daemon binds to `127.0.0.1` only
- **CORS restrictions**: Configurable origin whitelist
- **Bearer token authentication**: Optional API authentication
- **Input validation**: All API inputs are validated
- **No remote code execution**: Commands are whitelisted

## Security Best Practices for Users

1. **Keep FocusFlow updated** to the latest version
2. **Set `FOCUSFLOW_SECRET`** environment variable for API authentication
3. **Review distraction domain lists** before adding custom entries
4. **Don't expose the daemon** to external networks

Thank you for helping keep FocusFlow secure!
