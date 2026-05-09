# Own CMP Project Instructions

## General Principles
- **Dependency-Free:** Prioritize native Node.js modules and vanilla JavaScript. Avoid adding NPM packages unless strictly necessary.
- **Documentation First:** Every meaningful project change must update the documentation in the same work session.
- **Visual & Functional:** Prototypes must be visually appealing and substantially complete.

## Verification & Testing Workflow
- **Manual Verification Mandate:** All feature testing and validation MUST be performed manually by the user. 
- **No Background Test Automation:** Do not attempt to run automated test suites in the background or through silent shell commands for final validation.
- **Procedure:**
  1. Implement the feature.
  2. Provide the user with a step-by-step manual testing plan (URL, credentials, actions).
  3. Wait for the user to confirm the results in their terminal/browser.

## Documentation Rules
- Update `docs/status.md` when project state, features, or milestones change.
- Update `docs/changelog.md` to record all behavioral or file changes.
- Update `README.md` for setup, usage, or major capability changes.
