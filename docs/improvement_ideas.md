# GHP Improvement Ideas

This document outlines potential improvements and new features for the `ghp` project.

## 1. New Features & Functionality

*   **`ghp review` Command:**
    *   **Idea:** Add a command that takes a PR URL (or diff from a base branch) and uses AI to provide a preliminary code review summary.
    *   **Why:** Speed up the PR review process.
*   **`ghp suggest` Command:**
    *   **Idea:** Analyze staged diff and suggest code improvements or refactorings.
    *   **Why:** Act as an AI pair programmer.
*   **More Context for AI:**
    *   **Idea:** Include file names, surrounding code snippets (within token limits), and branch names when sending data to the AI.
    *   **Why:** Improve accuracy of AI generations.
*   **Smart PR Template Filling:**
    *   **Idea:** Train the AI to fill specific sections of the `.github/pull_request_template.md` based on the diff analysis.
    *   **Why:** Create more structured and complete PR descriptions.
*   **Customizable Prompts:**
    *   **Idea:** Allow users to override default AI prompts via a configuration file (e.g., `~/.ghp/config.json` or `.ghprc`).
    *   **Why:** Give users control over AI tone, style, and format.
*   **Support for Different AI Models/Providers:**
    *   **Idea:** Allow configuration of OpenAI models or other providers (Anthropic Claude, Google Gemini).
    *   **Why:** Provide flexibility based on user preference, cost, or quality needs.
*   **`ghp config` Command:**
    *   **Idea:** Add `ghp config get <key>` and `ghp config set <key> <value>` for managing settings.
    *   **Why:** Improve usability and discoverability of configuration.
*   **Amend Support:**
    *   **Idea:** Add `ghp commit --amend` flag to generate a new message for the previous commit.
    *   **Why:** Streamline the common `git commit --amend` workflow.

## 2. Refactoring & Code Quality

*   **Address Linter Errors:** Fix existing `Unable to resolve path to module` errors. This is high priority.
*   **Configuration Management:** Move hardcoded values (e.g., AI model, default base branch) to a dedicated configuration system.
*   **Error Handling:**
    *   Use `instanceof Error` consistently.
    *   Provide more specific error messages (include `stderr` from `execa` where helpful).
    *   Consider custom error classes (`GitError`, `AIError`, `GhCliError`).
*   **Dependency Injection / Testability:**
    *   Abstract external interactions (`execa`, `openai`, `inquirer`, `ora`) behind interfaces/services (`GitService`, `AIService`, `UIService`, `GhCliService`).
    *   Inject these services into command handlers.
    *   **Why:** Improve unit testability by enabling mocking.
*   **Testing:** Implement unit tests (Vitest/Jest) and integration tests (using a temporary Git repo).
*   **Structured Logging:** Replace scattered `console.log`/`chalk` calls with a structured logger (e.g., `pino`) and add log levels/verbosity flags.

## 3. User Experience (UX)

*   **Editor Integration (`openInEditor`):**
    *   Allow configuration of the editor command.
    *   Improve temporary file naming (e.g., `ghp-commit-msg-xyz.gitcommit`).
*   **Better Diff Display:** Summarize or truncate long diffs shown in the terminal before AI generation.
*   **Confirmation Prompts:** Offer more options like `[Y]es / [N]o / [E]dit / [A]bort`.

## 4. Build & Development

*   **CI/CD:** Set up GitHub Actions for automated linting, type checking, tests, builds, and releases. 