# Frontend Development Guidelines

> Best practices for React frontend development in WarHutTV.

---

## Overview

The frontend is a React 19 + TypeScript + Vite 6 SPA with:
- Tailwind CSS for styling with custom CSS variable-based theming
- Dexie (IndexedDB wrapper) for local persistent storage
- React Context + Provider for global state
- Artplayer + HLS.js for video playback
- PWA support with Service Worker
- Chinese (zh-CN) as the primary UI language

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Component/page/hook organization | ✅ Done |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props conventions | ✅ Done |
| [Hook Guidelines](./hook-guidelines.md) | Custom hook naming, patterns | ✅ Done |
| [State Management](./state-management.md) | State patterns, what goes where | ✅ Done |
| [Quality Guidelines](./quality-guidelines.md) | Linting, testing, accessibility | ✅ Done |
| [Type Safety](./type-safety.md) | TypeScript conventions, type organization | ✅ Done |

---

## Language

- UI text is in **Chinese (zh-CN)**
- Code comments are in **English**
- Type definitions use English identifiers
- File names: PascalCase for components (`Player.tsx`), camelCase for utilities (`adblock.ts`)
