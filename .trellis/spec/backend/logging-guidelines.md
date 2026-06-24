# Logging Guidelines

> How logging works in the backend.

---

## Current State

The project uses **Gin's default logger** only. No structured logging library (zerolog, zap, logrus) is used.

```go
r := gin.Default()  // Includes Logger() and Recovery() middleware
```

Gin's default logger automatically logs:
- Incoming HTTP requests (method, path, status code, latency)
- Panic recovery with stack trace (via Recovery middleware)

---

## What We Don't Log

- No application-level debug logging
- No structured log output (JSON)
- No log levels (info, warn, error)
- No file rotation or log shipping
- No function-level tracing logs

---

## Patterns to Follow

### Current conventions
- Rely on Gin's built-in request logging for operational visibility
- Use `fmt.Errorf` for error messages that include context (these appear in handler responses, not logs)
- Error responses are returned to the client as JSON, not logged separately

### If adding logging in the future
- Prefer a lightweight logger compatible with Gin
- Log at request boundaries only, not inside internal functions
- Never log sensitive data (JWT tokens, passwords)
- Use the same error format as existing handlers

## Anti-patterns

- ❌ Do not add `fmt.Println` or `log.Println` for debugging — remove before committing
- ❌ Do not log entire request bodies or responses
- ❌ Do not log passwords or JWT tokens
