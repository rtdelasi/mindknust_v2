# Security Policy: MindKNUST

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of MindKNUST, student privacy, and mental-health confidentiality extremely seriously. If you discover a security vulnerability, please report it responsibly:

1. **Do not create a public issue.**
2. Send an encrypted email or private disclosure report to `security@mindknust.edu.gh`.
3. Provide detailed steps to reproduce the vulnerability, including payload examples, screenshots, or logs if applicable.
4. Our security team will acknowledge receipt within 24 hours and provide a remediation timeline.

## GitHub Security Features Checklist

Ensure the following security features are enabled in the repository settings:

- [x] **Dependabot Alerts**: Enabled under `Settings > Code security and analysis`.
- [x] **Dependabot Security Updates**: Enabled with automatic pull request generation.
- [x] **CodeQL Static Analysis**: Enabled via `.github/workflows/codeql.yml`.
- [x] **Secret Scanning**: Enabled under `Settings > Code security and analysis > Secret scanning`.
- [x] **Push Protection**: Enabled under `Settings > Code security and analysis > Push protection`.
- [x] **Branch Protection Rules**: Enforce status checks and require signed commits on `main` and `master`.
