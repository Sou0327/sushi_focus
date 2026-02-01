# Contributing to FocusFlow

Thank you for your interest in contributing to FocusFlow! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all skill levels.

## Getting Started

### Prerequisites

- **Node.js** 20 or higher
- **pnpm** 9 or higher (`npm install -g pnpm`)
- **Google Chrome** browser

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/FocusFlow.git
   cd FocusFlow
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start development servers**
   ```bash
   # Terminal 1: Start daemon
   pnpm dev:daemon

   # Terminal 2: Watch extension
   pnpm dev:extension
   ```

4. **Load the extension in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `extension/dist/` directory

### Project Structure

```
FocusFlow/
├── daemon/           # Node.js daemon (Express + WebSocket)
│   └── src/
│       └── server/   # API endpoints and WebSocket handler
├── extension/        # Chrome Extension (MV3)
│   └── src/
│       ├── background/   # Service Worker
│       ├── sidepanel/    # Dashboard UI
│       ├── popup/        # Quick settings popup
│       ├── options/      # Settings page
│       └── shared/       # Shared types and components
└── scripts/          # Utility scripts
```

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Use TypeScript strict mode
   - Add tests for new functionality

3. **Test your changes**
   ```bash
   pnpm lint        # Run ESLint
   pnpm typecheck   # Check TypeScript types
   pnpm test        # Run tests
   pnpm build       # Build everything
   ```

4. **Commit your changes**
   ```bash
   git commit -m "feat: add new feature"
   ```

   We use [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation only
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

### Pull Request Process

1. **Push your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request**
   - Provide a clear title and description
   - Reference any related issues
   - Include screenshots for UI changes

3. **Address review feedback**
   - Make requested changes
   - Push additional commits
   - Request re-review when ready

## Coding Guidelines

### TypeScript

- Use strict mode (`"strict": true`)
- Avoid `any` - use `unknown` with type guards
- Use path aliases (`@/*` for extension source)

### Styling

- Use Tailwind CSS utility classes
- Follow the existing design system (see `tailwind.config.js`)
- Use semantic color tokens (`focus-primary`, `focus-bg`, etc.)

### Testing

- Write tests for new features
- Include edge cases
- Use Vitest for unit tests

## Reporting Issues

### Bug Reports

Please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS version
- Console errors (if any)

### Feature Requests

Please include:
- Clear description of the feature
- Use case / motivation
- Proposed implementation (optional)

## Questions?

- Open a [GitHub Issue](https://github.com/Sou0327/focus_flow/issues)
- Check existing issues and discussions

Thank you for contributing!
