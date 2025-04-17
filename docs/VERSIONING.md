# Versioning and Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) to automate version management and package publishing. This document explains how it works and how to use it effectively.

## How It Works

When code is pushed to the `main` branch, semantic-release automatically:

1. Analyzes commit messages since the last release
2. Determines the next version number based on the types of changes
3. Generates/updates the CHANGELOG.md
4. Creates a new GitHub release with release notes
5. Updates package.json with the new version
6. Publishes to npm (if configured)

## Commit Message Convention

We follow the [Angular Commit Message Convention](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#-commit-message-format). Your commit message should be structured as follows:

```
<type>(<scope>): <short summary>

<body>

<footer>
```

### Types and Their Impact on Versioning

| Type     | Description                                                    | Release Type |
|----------|----------------------------------------------------------------|--------------|
| feat     | A new feature                                                   | minor        |
| fix      | A bug fix                                                       | patch        |
| docs     | Documentation only changes                                      | patch*       |
| style    | Changes that don't affect the meaning of the code              | patch*       |
| refactor | A code change that neither fixes a bug nor adds a feature      | patch*       |
| perf     | A code change that improves performance                        | patch        |
| test     | Adding missing tests or correcting existing tests              | no release   |
| build    | Changes that affect the build system or external dependencies  | no release   |
| ci       | Changes to our CI configuration files and scripts              | no release   |
| chore    | Other changes that don't modify src or test files             | no release   |

\* These are custom rules specific to our project

### Breaking Changes

To indicate a breaking change, either:
1. Add `BREAKING CHANGE:` in the commit message body
2. Add a `!` after the type/scope

Example:
```
feat(api)!: remove deprecated endpoints

BREAKING CHANGE: The v1 API endpoints have been removed. Please migrate to v2.
```

### Commit Message Examples

```bash
# Feature (minor release)
git commit -m "feat(auth): add OAuth2 login support"

# Bug fix (patch release)
git commit -m "fix(api): handle null response in user service"

# Breaking change (major release)
git commit -m "feat(api)!: migrate to GraphQL API
    
BREAKING CHANGE: REST API endpoints are no longer available. Use GraphQL queries instead."

# Documentation update (patch release)
git commit -m "docs(readme): update installation instructions"

# Code style change (patch release)
git commit -m "style(components): format according to new style guide"

# Refactoring (patch release)
git commit -m "refactor(utils): simplify date formatting logic"
```

## Configuration

The semantic-release configuration is in `.releaserc.json` and includes:

- Commit message parsing and version determination
- Changelog generation
- GitHub release creation
- Git tag creation
- File updates (package.json, CHANGELOG.md)

## CI/CD Integration

The release process is automated through GitHub Actions (see `.github/workflows/release.yml`). It triggers on every push to the `main` branch.

### Required Secrets

The workflow requires these GitHub secrets:
- `GITHUB_TOKEN` (automatically provided)
- `NPM_TOKEN` (if publishing to npm)

## Manual Release

While the process is automated, you can trigger a release manually by:

1. Ensuring you're on the main branch
2. Running:
```bash
npx semantic-release
```

## Troubleshooting

If a release isn't triggered as expected:

1. Check if your commit messages follow the convention
2. Verify that you're pushing to the `main` branch
3. Check the GitHub Actions logs for any errors
4. Ensure all required secrets are configured

## Additional Resources

- [semantic-release documentation](https://semantic-release.gitbook.io/)
- [Angular Commit Message Convention](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#-commit-message-format)
- [Conventional Commits](https://www.conventionalcommits.org/) 