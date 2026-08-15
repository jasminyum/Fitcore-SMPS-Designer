# Security Policy — FitCore

FitCore is a calculation tool that automates magnetic core, bobbin, wire,
and switching-device selection for power electronics designers. It runs on
a Firebase Cloud Functions backend with a Firestore-based component
database.

## Supported Versions

FitCore is currently under active development, so security updates are
applied only to the latest version. No backported patches are provided for
older versions.

| Version         | Supported          |
| --------------- | ------------------- |
| Latest (main)    | :white_check_mark: |
| Older versions   | :x:                 |

## Reporting a Vulnerability

If you discover a security vulnerability in FitCore, please **do not open
a public GitHub issue** — this could expose the issue before it can be
addressed.

Instead:

1. Report the finding directly to **ytaalgin@gmail.com**.
   Where possible, include:
   - A brief description of the vulnerability and the affected component
     (backend function, Firestore rules, client-side logic, etc.)
   - Steps to reproduce, or a sample request/payload
   - Your assessment of the impact (e.g., data leakage, unauthorized write
     access, service disruption)
2. You will receive a response within **3 business days**, along with
   information on the verification process.
3. If the vulnerability is confirmed:
   - A fix timeline will be set based on severity (target of 7 days for
     critical issues).
   - Credit will be given to the reporter once the fix is released, unless
     you request otherwise.
4. If the report is declined (not reproducible, out of scope, etc.), the
   reasoning will be explained clearly.

### Scope

This policy covers the following areas:

- Firebase Cloud Functions (`runSmpsOptimization` and related callable
  functions)
- Firestore security rules and data access permissions
- Client-side calculation logic and data validation

If you believe sensitive data such as service account keys, API keys, or
credentials has been exposed, please report it **urgently** to the address
above.
