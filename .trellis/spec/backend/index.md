# Backend Development Guidelines

> Best practices for Go backend development in WarHutTV.

---

## Overview

The backend is a single-module Go application using **Gin** framework. It provides:
- JWT-authenticated REST API for video search, detail, play, and config
- SSE streaming for real-time cross-source search results
- M3U8 proxy with URL rewriting for HLS playback
- Rate-limited login, CORS middleware
- Embedded frontend static assets via `embed.FS`

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | ✅ Done |
| [Database Guidelines](./database-guidelines.md) | No database — file-based config + in-memory cache | ✅ Done |
| [Error Handling](./error-handling.md) | Error types, handling strategies | ✅ Done |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | ✅ Done |
| [Logging Guidelines](./logging-guidelines.md) | Minimal logging via Gin default logger | ✅ Done |

---

## Language

All backend code is written in **Go 1.26** with module path `warhutv`. 
Documentation comments in code are in **English**.
HTTP response messages use **Chinese** for user-facing text.
