# ghp - Your AI GitHub Pal 🤖

`ghp` is a command-line interface (CLI) tool designed to streamline your Git and GitHub workflow by leveraging the power of AI. It acts as a wrapper around common `git` and `gh` commands, automatically generating commit messages and pull request descriptions based on your code changes.

Stop agonizing over the perfect commit message or PR description – let your AI pal handle the first draft!

## Features ✨

*   **AI-Powered Commit Messages:** Run `ghp commit` to automatically generate a conventional commit message based on your staged changes.
*   **AI-Powered PR Descriptions:** Run `ghp pr new` to create a new draft pull request with a title and description generated from the difference between your current branch and the base branch. It can even use your existing `.github/pull_request_template.md`!
*   **Interactive Confirmation:** Never commit or open a PR blindly. `ghp` always shows you the AI-generated content and asks for your confirmation before proceeding.
*   **Seamless Integration:** Uses your existing `git` and `gh` CLI setup.
*   **Configurable:** Options to specify base branches, control draft PR status, and open PRs in the browser.

## Installation 📦

```bash
# Clone the repository
git clone https://github.com/your-username/ghp.git # Replace with your repo URL
cd ghp

# Install dependencies
npm install

# Build the project
npm run build

# Link the CLI globally (optional but recommended for ease of use)
npm link
```

Now you can run `ghp` from any directory.

## Setup 🛠️

1.  **OpenAI API Key:** `ghp` uses OpenAI (specifically, `gpt-4o-mini` by default) to generate text. You need an OpenAI API key.
    *   Create a file named `.env` in the root of the `ghp` project directory.
    *   Add your API key to the `.env` file:
        ```
        OPENAI_API_KEY=your_openai_api_key_here
        ```
    *   *Note:* The `.env` file is included in `.gitignore` to prevent accidental key exposure.

2.  **GitHub CLI (`gh`):** The `ghp pr new` command relies on the official GitHub CLI (`gh`) being installed and authenticated.
    *   Install `gh` by following the instructions [here](https://github.com/cli/cli#installation).
    *   Authenticate with your GitHub account by running `gh auth login`.

## Usage 🚀

Make sure you are inside a Git repository directory.

### Generating Commit Messages

1.  Stage the changes you want to commit (`git add ...`).
2.  Run the command:
    ```bash
    ghp commit
    ```
3.  `ghp` will show the staged diff (if any) and then display the AI-generated commit message.
4.  You will be prompted to confirm (Y/n) if you want to use the generated message.
5.  If confirmed, `ghp` will execute `git commit` with the message.

### Creating Pull Requests

1.  Ensure your current feature branch has been pushed to GitHub (`git push -u origin your-branch-name`).
2.  Run the command:
    ```bash
    ghp pr new
    ```
3.  `ghp` will:
    *   Determine your current branch and the base branch (defaults to `main`).
    *   Fetch the diff between your branch and the base branch.
    *   Look for a `.github/pull_request_template.md` file.
    *   Generate a PR title and description using AI based on the diff and template (if found).
    *   Display the generated title and description.
4.  You will be prompted to confirm (Y/n) if you want to create the PR with this content.
5.  If confirmed, `ghp` will execute `gh pr create --draft ...` (draft by default).

#### `pr new` Options:

*   `--base <branch>`: Specify a different base branch (e.g., `ghp pr new --base develop`).
*   `--no-draft`: Create the PR as ready for review instead of a draft.
*   `--web`: Open the newly created PR in your web browser.

**Example:**

```bash
# Create a non-draft PR against the 'develop' branch and open it in the browser
ghp pr new --base develop --no-draft --web
```

## How it Works 🤔

1.  **Diffing:** Uses `git diff` commands via `execa` to get staged changes (`commit`) or changes relative to a base branch (`pr new`).
2.  **AI Generation:** Sends the diff (and PR template content, if applicable) to the OpenAI API using the `openai` library, with prompts designed to generate conventional commits or PR content.
3.  **Interaction:** Uses `inquirer` to display generated content and ask for user confirmation.
4.  **Execution:** If confirmed, runs the corresponding `git commit` or `gh pr create` command using `execa`.

## Contributing 🤝

Contributions are welcome! Feel free to open issues or submit pull requests.

## License 📄

This project is licensed under the MIT License. See the `LICENSE` file for details (if one exists) or check `package.json`. 