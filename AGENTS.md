<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Rules

This file defines the behavioral rules, coding standards, and decision-making guidelines
for AI agents (including Kilo Code) operating in this repository. All agents must read
and adhere to these rules before performing any task.

---

## 1. Task Completion Mindset

- Always work towards **full, functional completion** of the assigned task. Do not stop
  at a partial solution unless explicitly instructed or blocked by a missing dependency.
- Break complex tasks into clear, sequential subtasks. Complete each subtask before
  moving to the next, and validate the result at each stage.
- If a task is ambiguous or the requirements conflict, resolve the ambiguity before
  writing code — not after. A correct plan executed well beats a fast plan executed wrong.
- Do not leave `TODO`, `FIXME`, or `HACK` comments as permanent artifacts. If something
  cannot be completed in the current session, document it in a clearly named issue or
  note and flag it explicitly in your response.
- Prefer shipping a working, scoped solution over a large, incomplete one. If the full
  scope cannot be completed, deliver a working subset and communicate what remains.
- Never report a task as complete until you have verified the output end-to-end — not
  just that the code was written, but that it runs, passes tests, and produces the
  expected result in context.

---

## 2. Context Gathering

- **Always ask for clarification** before beginning work when:
  - The task description is vague or missing key details (e.g., "fix the bug" with no
    reproduction steps).
  - The expected output format, data shape, or interface is not specified.
  - Multiple valid interpretations exist and choosing the wrong one would waste significant
    effort.
  - External dependencies (APIs, services, credentials, environment variables) are
    referenced but not defined.
- Ask focused, specific questions. Do not ask for information you can reasonably infer
  from the existing codebase or context.
- Before modifying existing code, read the surrounding file(s), understand the existing
  patterns, and confirm you understand the intent — do not refactor blindly.
- When reading unfamiliar code, trace the data flow from entry point to output before
  making changes.
- When given access to a codebase for the first time, scan the top-level structure,
  README, and any existing `INSTRUCTIONS.md`, `CONTRIBUTING.md`, or `.cursorrules`
  before writing a single line of code.
- Do not assume a library, API, or language feature exists. If you cannot verify it
  from the codebase or reliable documentation, say so explicitly.

---

## 3. Code Comments & Documentation

- Every file must include a **top-level docblock** describing its purpose, what it
  exports/exposes, and any critical dependencies or side effects.
- Every function, method, and class must include a docstring or block comment covering:
  - What it does (purpose, not implementation detail).
  - Parameters: name, type, and what they represent.
  - Return value: type and what it represents.
  - Any exceptions or edge cases it handles or throws.
- Inline comments must explain **why**, not **what**. The code explains what; the
  comment explains the reasoning, constraint, or tradeoff behind a decision.
- Mark all non-obvious logic, workarounds, or external constraints with a comment that
  provides enough context for a reader with no prior knowledge to understand the
  decision without asking.
- When calling external APIs, annotate the call site with: the endpoint purpose, the
  shape of the expected response, and the handling strategy for failure cases.

  ```python
  # Fetches the latest embeddings for a given document chunk.
  # Returns: { "embedding": List[float], "model": str }
  # On 429 (rate limit), we back off exponentially and retry up to 3 times.
  response = client.embeddings.create(model="text-embedding-3-small", input=chunk_text)
  ```

- Every README must include: project purpose, local setup steps, environment variable
  requirements (pointing to `.env.example`), how to run tests, and how to run the
  application. A README that requires tribal knowledge to follow has failed.
- Architectural decisions with non-obvious tradeoffs must be documented as an
  Architectural Decision Record (ADR) in a `/docs/adr/` directory using the format:
  `NNN-short-title.md` with sections: **Status**, **Context**, **Decision**,
  **Consequences**.

---

## 4. Standard Coding Practices

- Follow the language-specific style guide for the project (e.g., PEP 8 for Python,
  Airbnb/Standard for JavaScript/TypeScript, `gofmt` for Go). If no guide is defined,
  adopt the most widely accepted community standard for that language.
- Use **meaningful, unambiguous names** for variables, functions, classes, and files.
  Avoid abbreviations unless they are universally understood in the domain (e.g., `url`,
  `id`, `api`).
- Functions and methods must do **one thing**. If a function requires a long comment to
  explain all the things it does, it should be split.
- Keep functions short. As a general rule, if a function exceeds 40–50 lines, consider
  whether it should be decomposed.
- Avoid deeply nested code. Prefer early returns, guard clauses, and extracted helper
  functions to reduce nesting depth.
- Never hardcode secrets, credentials, API keys, or environment-specific values.
  Use environment variables or a secrets manager, and document the required variables
  in `.env.example` or the project README.
- Write **idempotent** functions wherever possible. A function called multiple times
  with the same inputs should produce the same result without unintended side effects.
- Boolean parameters that control behavior are a code smell. Prefer separate functions
  or strategy objects over `process(data, is_dry_run=True)`.
- Delete dead code rather than commenting it out. Version control preserves history;
  commented-out code pollutes readability and misleads future readers.
- Do not repeat yourself (DRY), but do not over-abstract prematurely. Duplication is
  preferable to the wrong abstraction. Reach for an abstraction only when the same
  pattern appears three or more times with high confidence it will stay stable.

---

## 5. Error Handling

- Every external call (network, filesystem, database, subprocess) must be wrapped in
  explicit error handling. Silent failures are not acceptable.
- Distinguish between recoverable and unrecoverable errors. Recoverable errors (e.g.,
  transient network failure) should trigger a retry or fallback; unrecoverable errors
  (e.g., corrupted required config) should fail fast with a clear, actionable message.
- Error messages must include:
  - What failed.
  - Why it failed (if determinable).
  - What the caller or user can do to resolve it.
- Do not swallow exceptions with empty `except` / `catch` blocks. Log the error at
  minimum, and re-raise if the caller needs to be aware.
- Validate all user-provided and external inputs at the boundary (entry point of the
  system). Do not assume inputs are safe, correctly typed, or within expected ranges.
- Use typed, domain-specific exception classes rather than bare `Exception` or `Error`.
  This makes `except` clauses precise and makes error handling exhaustive and auditable.
- Always attach contextual metadata to errors — include the operation being performed,
  the input values (sanitized of secrets), and any relevant IDs (request ID, user ID,
  resource ID) that would help reproduce or diagnose the failure.
- Implement **circuit breakers** for calls to external services that have known
  reliability issues. A circuit breaker prevents cascading failures when a dependency
  degrades.
- For retry logic: cap the number of attempts, use exponential backoff with jitter, and
  only retry on idempotent operations. Document the retry policy at the call site.

  ```python
  # Retry policy: 3 attempts, exponential backoff (1s, 2s, 4s) with ±500ms jitter.
  # Only retried on 429 (rate limit) and 5xx (server error). 4xx errors are not retried.
  ```

---

## 6. Testing

- Every new function, class, or module must have corresponding unit tests. No exceptions.
- Tests live in the `test/` directory at the project root, mirroring the source tree
  structure (e.g., `src/utils/parser.py` → `test/utils/test_parser.py`).
- Each test must be:
  - **Isolated**: no shared mutable state between tests.
  - **Deterministic**: same input always produces the same result.
  - **Fast**: unit tests should not make real network or database calls; mock
    external dependencies.
- Cover at minimum: the happy path, edge cases (empty input, boundary values), and
  known failure modes.
- When fixing a bug, write a regression test that reproduces the bug **before** writing
  the fix. The test should fail before the fix and pass after.
- Integration tests (where applicable) must be clearly labeled and separated from unit
  tests so they can be run independently.
- Test names must be descriptive enough to diagnose a failure without reading the body.
  Prefer `test_returns_empty_list_when_query_yields_no_results` over `test_query_1`.
- Aim for a minimum of **80% line coverage** on new code. Coverage is a floor, not a
  goal — a test that covers a line without asserting meaningful behavior is not a test.
- **Never modify a test to make it pass** unless the test was provably wrong. A failing
  test is information. Silence it only after understanding what it is telling you.
- Mock at the correct layer: mock the HTTP transport or external client, not the
  business logic. Over-mocking creates tests that pass while the real behavior is broken.
- Property-based tests (e.g., Hypothesis for Python, fast-check for JS) are preferred
  over hand-written parametrized cases for functions with large or complex input spaces.
- All tests must pass in CI on a clean environment before a task is marked complete.

---

## 7. File & Project Organization

- Follow the existing directory structure of the project. Do not create new top-level
  directories without confirming with the user.
- One module, one responsibility. Files should not mix unrelated concerns (e.g., routing
  logic and database models in the same file).
- Shared utilities, constants, and types must live in a dedicated `utils/`, `constants/`,
  or `types/` module — not scattered across feature files.
- Configuration files (linting, formatting, build tools) must be placed at the project
  root and documented in the README if they require developer setup.
- Avoid deeply nested directory structures. More than 3–4 levels of nesting is usually
  a sign of over-engineering.
- Group files by **feature** rather than by **layer** in application code
  (e.g., `features/auth/` containing router, service, models, and tests is preferable
  to top-level `routes/`, `services/`, `models/` directories that scatter related
  concerns). Follow the existing convention if one is already established.
- Ensure every directory that is a Python package contains an `__init__.py`. Implicit
  namespace packages are acceptable only when explicitly adopted project-wide.

---

## 8. Version Control & Change Hygiene

- Atomic commits: each commit should represent one logical, self-contained change.
  Do not bundle unrelated changes into a single commit.
- Commit messages must follow the format:
  ```
  <type>(<scope>): <short summary>

  <optional body explaining why, not what>
  ```
  Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`.
- Do not commit generated files, build artifacts, or editor-specific configs unless they
  are intentionally part of the repository (documented in the README).
- Never commit directly to `main` or `master`. All changes must go through a branch and,
  where applicable, a pull request.
- If modifying a file that is not directly related to the assigned task, stop and confirm
  with the user before proceeding — scope creep corrupts intent.
- Keep branches short-lived. Long-running branches diverge, create merge conflicts, and
  obscure intent. Aim to merge within the same working session where possible.
- `.gitignore` must be updated whenever new artifact types (build outputs, local config
  files, generated code) are introduced. Never rely on a developer knowing to ignore
  something manually.

---

## 9. Security Practices

- Never introduce code that logs, stores, or transmits secrets, tokens, passwords,
  or PII in plaintext.
- Sanitize and validate all inputs before using them in SQL queries, shell commands,
  file paths, or template rendering to prevent injection attacks.
- When integrating third-party libraries, prefer well-maintained packages with clear
  licensing. Flag any dependency with known CVEs before adding it.
- Principle of least privilege: code should request only the permissions it strictly
  needs. Do not request broad access when narrow access is sufficient.
- If authentication or authorization logic is modified, explicitly note this in the
  commit message and request a review.
- Use parameterized queries or an ORM for all database interactions. String-interpolated
  SQL is never acceptable, regardless of how "safe" the input appears.
- Set explicit CORS policies on all HTTP servers. A wildcard `*` CORS policy is
  acceptable only for fully public, read-only APIs and must be documented as intentional.
- All cryptographic operations must use vetted, standard library implementations.
  Never implement your own hashing, signing, or encryption.
- Dependency scanning (e.g., `pip-audit`, `npm audit`, `trivy`) must be run before
  adding any new package and results must be addressed — not silently ignored.
- Tokens and credentials stored in environment variables must be accessed through a
  typed configuration layer, never via raw `os.environ.get("KEY")` scattered across
  the codebase. Centralize secret access.

---

## 10. Performance Awareness

- Profile before optimizing. Do not prematurely optimize code without evidence of a
  bottleneck (measurement first, optimization second).
- For algorithms operating on non-trivial data, document the time and space complexity
  in the function docstring (e.g., `O(n log n)` time, `O(n)` space).
- Avoid N+1 query patterns. When fetching relational data in a loop, use batch queries,
  joins, or eager loading.
- Cache expensive or repeated computations only when the cache invalidation strategy
  is clearly defined and documented alongside the cache.
- Use pagination, streaming, or chunking when handling large datasets. Never load an
  unbounded dataset into memory.
- Always close resources (file handles, database connections, HTTP clients) explicitly,
  or use context managers / `using` blocks. Resource leaks degrade long-running services.
- For I/O-bound workloads, prefer async/concurrent patterns over synchronous blocking.
  Blocking the event loop in an async context is a correctness issue, not just a
  performance issue.
- Establish a **baseline performance metric** before any optimization sprint. Document
  it. Confirm the optimization is measurable against the baseline — not just intuitive.

---

## 11. Communication & Transparency

- Before starting any non-trivial task, output a brief **plan** describing the approach,
  the files that will be modified, and any assumptions being made.
- After completing a task, provide a concise **summary** of what was done, what was
  not done (and why), and any follow-up actions the user should take.
- If a chosen implementation has known tradeoffs (e.g., speed vs. memory, simplicity
  vs. extensibility), state them explicitly so the user can make an informed decision.
- When something is uncertain (e.g., unclear requirement, missing context, unfamiliar
  domain), say so explicitly rather than guessing silently.
- Do not fabricate API signatures, library behaviors, or language features. If you are
  not certain a function or method exists, verify it in the codebase or documentation
  before using it.
- When a decision was made for a reason that is not obvious from the code, record it.
  Future agents and developers should not have to reverse-engineer intent from output.
- If you discover mid-task that the original plan is wrong or insufficient, stop,
  communicate the updated understanding, and propose a revised plan before continuing.
  Do not silently pivot.

---

## 12. Respect for Existing Code

- Do not refactor or restructure code that is outside the scope of the assigned task.
  Unsolicited refactoring introduces risk and scope creep.
- If you identify a bug or code smell adjacent to the task, note it in a comment or
  flag it to the user — but do not fix it without explicit approval.
- Preserve the existing naming conventions, formatting style, and architectural patterns
  of the project. Consistency within a codebase matters more than adherence to an
  external style guide.
- If the existing code has tests, run them before and after your changes to ensure
  nothing is broken. A passing test suite before your change that fails after is a
  regression you introduced.
- When a file is being read for context, do not edit it unless it is explicitly in scope.
  Reading is not a license to modify.

---

## 13. Dependency Management

- Do not add new dependencies without explicitly listing them and explaining why the
  existing toolchain cannot satisfy the requirement.
- Prefer the standard library over third-party packages for straightforward tasks.
- Pin dependency versions in lock files (`package-lock.json`, `poetry.lock`,
  `requirements.txt` with pinned versions). Unpinned dependencies create non-reproducible
  builds.
- When removing a dependency, verify it is not used anywhere else in the project before
  removing it from the manifest.
- Transitive dependencies matter. Before adding a package, check its own dependency
  tree for bloat, license conflicts, or CVEs. A small convenience package that pulls
  in 200MB of transitive deps is not a small dependency.
- Separate runtime dependencies from development dependencies in the manifest
  (`dependencies` vs. `devDependencies`, `[tool.poetry.dependencies]` vs.
  `[tool.poetry.dev-dependencies]`). Production builds must not include dev tools.

---

## 14. Accessibility & Inclusivity (Frontend)

- All interactive UI elements must have appropriate ARIA labels, roles, and keyboard
  navigation support.
- Do not rely solely on color to convey information — pair with text labels, icons,
  or patterns.
- Ensure sufficient color contrast ratios (WCAG AA minimum: 4.5:1 for normal text,
  3:1 for large text).
- All images must have descriptive `alt` text; decorative images must have `alt=""`.
- Focus order must be logical and follow the visual layout. Do not suppress focus
  outlines without providing an equivalent visual indicator.
- All form inputs must have explicit `<label>` elements or `aria-label` attributes.
  Placeholder text is not a label.
- Test keyboard navigation on any new interactive component before marking it complete.

---

## 15. Database & Migration Safety

- **Never modify a production schema directly.** All schema changes must be expressed
  as versioned, sequential migration scripts using the project's migration tool
  (e.g., Alembic, Flyway, Prisma Migrate, Drizzle Kit).
- Every migration must have a corresponding **rollback** (`down`) path that is tested
  and verified to restore the prior schema state without data loss.
- Before writing a migration, identify: (a) whether existing data must be backfilled,
  (b) whether the migration is safe to run while the application is live (zero-downtime
  vs. maintenance window), and (c) the estimated runtime on current data volume.
- Long-running migrations (e.g., adding an index to a large table) must be run with
  `CONCURRENTLY` or equivalent non-locking strategy to avoid table locks in production.
- Never perform schema changes inside application code on startup (e.g., `CREATE TABLE
  IF NOT EXISTS` in the app boot path). Migrations are a deployment concern, not a
  runtime concern.
- All foreign keys must be indexed. Unindexed foreign keys cause full table scans on
  join and cascade operations.
- Data invariants (e.g., "a user must have at least one role") must be enforced at the
  database level via constraints — not only in application logic. Application logic
  can be bypassed; database constraints cannot.
- When dropping columns or tables, use a two-phase approach: (1) stop writing to the
  column/table in application code and deploy, (2) run the schema removal migration
  in a subsequent deployment. Dropping a column that live code still references causes
  outages.
- Document the data model (entity relationships, index rationale, constraint semantics)
  in a schema map at `docs/schema.md` or equivalent. The database should never be a
  black box.

---

## 16. Observability & Structured Logging

- Use **structured logging** (JSON format) in all services. Do not use `print()`
  statements or unstructured string logs in production code.
- Every log entry must include at minimum: `timestamp`, `level`, `module` or `logger`,
  and a `message`. For request-scoped operations, also include `request_id` or
  `correlation_id` to enable distributed tracing.
- Use log levels correctly and consistently:
  - `DEBUG`: internal state, intermediate values, decision branches. Not emitted in
    production by default.
  - `INFO`: normal operational events (service start, request received, job completed).
  - `WARNING`: recoverable anomalies (deprecated API used, retry triggered, fallback
    activated).
  - `ERROR`: failures that require attention but do not crash the process.
  - `CRITICAL`: failures that compromise the integrity of the system or require
    immediate human intervention.
- **Never log secrets, tokens, passwords, or PII.** Sanitize inputs and outputs before
  logging. If a full payload must be logged for debugging, provide a scrubbing utility
  and gate it behind a debug flag.
- Every HTTP server must expose a `/health` endpoint that returns `200 OK` with a
  payload indicating the status of critical dependencies (database reachability, cache,
  external APIs). This endpoint must not require authentication.
- Instrument the critical path of every major feature with timing metrics. Latency
  regressions are as important as functional regressions.
- When catching and re-raising exceptions, always log the original exception with its
  full stack trace before re-raising. Do not log only the message — the trace is the
  signal.

  ```python
  except SomeError as e:
      logger.error("Retrieval failed", extra={"request_id": req_id, "query": query}, exc_info=True)
      raise
  ```

---

## 17. API Design Standards

- All HTTP APIs must be **versioned** from day one. Use URL path versioning (`/v1/`,
  `/v2/`) as the default. Never introduce breaking changes to an existing versioned
  endpoint — create a new version.
- Use HTTP status codes correctly and consistently:
  - `200 OK` — successful GET, PUT, PATCH.
  - `201 Created` — successful POST that creates a resource. Include `Location` header.
  - `204 No Content` — successful DELETE or action with no response body.
  - `400 Bad Request` — invalid input (validation failure).
  - `401 Unauthorized` — not authenticated.
  - `403 Forbidden` — authenticated but not authorized.
  - `404 Not Found` — resource does not exist.
  - `409 Conflict` — state conflict (e.g., duplicate resource).
  - `422 Unprocessable Entity` — syntactically valid but semantically invalid.
  - `429 Too Many Requests` — rate limit exceeded. Include `Retry-After` header.
  - `500 Internal Server Error` — unhandled server-side failure.
- All error responses must use a **consistent envelope**:
  ```json
  {
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "Human-readable description.",
      "details": [{ "field": "email", "issue": "Invalid format." }],
      "request_id": "abc-123"
    }
  }
  ```
- All list endpoints must be **paginated**. Never return an unbounded array. Prefer
  cursor-based pagination over offset-based for large or frequently updated collections.
- Mutation endpoints (POST, PUT, PATCH, DELETE) should accept an `Idempotency-Key`
  header. Document whether the endpoint is idempotent natively or key-based.
- Maintain an **OpenAPI/Swagger specification** for every HTTP API. The spec is
  the source of truth for clients and must be updated in the same PR as the
  implementation change.
- Rate limit all public-facing and authenticated API endpoints. Document the limits
  in the API spec and enforce them at the gateway or middleware layer.

---

## 18. Type Safety & Schema Contracts

- **Python**: apply type hints to all function signatures and class attributes in new
  code. Run `mypy` or `pyright` in strict mode as part of CI. `type: ignore` annotations
  must include an inline comment justifying the suppression.
- **TypeScript**: `strict: true` in `tsconfig.json` is non-negotiable. Do not use `any`
  without a comment explaining why the type cannot be expressed. Prefer `unknown` over
  `any` for truly dynamic values and narrow it explicitly.
- Use **schema validation libraries** (Pydantic for Python, Zod for TypeScript) at all
  data boundaries: API request bodies, external API responses, file reads, database
  query results. Do not trust any external data until it has been parsed and validated
  against a schema.
- Never use raw `dict` / `object` as the type for structured data that will be passed
  between modules. Define a named type, dataclass, or model. If the structure is truly
  dynamic, document why.
- When a schema changes, update all downstream consumers in the same PR. A schema
  change merged without updating consumers is a deferred bug.
- Enumerations must be used for finite, closed sets of values (status codes, event
  types, roles). Do not use raw strings for values that must be validated against a
  known set.

---

## 19. LLM & AI Pipeline Standards

These rules apply to any code that constructs prompts, calls language model APIs,
processes model outputs, or manages retrieval-augmented pipelines.

- **Prompt versioning**: every prompt template used in production must be versioned.
  Treat prompt text the same as source code — changes require review, are tracked in
  version control, and are tested against a defined evaluation set before deployment.
- **Eval-first development**: before building a new LLM-powered feature or pipeline,
  define the evaluation criteria, metrics (e.g., nDCG, faithfulness, answer relevance),
  and baseline. Do not ship without a passing eval run.
- **Never use raw LLM output** in security-critical paths (SQL queries, shell commands,
  file paths, auth decisions) without explicit validation and sanitization. LLM outputs
  are untrusted strings.
- **Token budgets**: always specify `max_tokens`. Never allow unbounded generation.
  Document the reasoning behind the chosen budget at the call site (e.g., "512 tokens
  sufficient for structured JSON extraction; overflow indicates malformed input").
- **Structured output contracts**: when expecting JSON from a model, define a Pydantic
  or Zod schema. Parse and validate the response against the schema. If parsing fails,
  treat it as a model failure — log it, handle it, and never pass an unparsed string
  downstream.

  ```python
  # Model is expected to return JSON matching ExtractedEntity schema.
  # If JSON parsing fails, log the raw output and raise ModelOutputError.
  raw = response.content[0].text
  try:
      result = ExtractedEntity.model_validate_json(raw)
  except ValidationError as e:
      logger.error("Model output schema mismatch", extra={"raw": raw, "error": str(e)})
      raise ModelOutputError("Unexpected model output format") from e
  ```

- **Model version pinning**: pin the exact model version in all API calls (e.g.,
  `claude-sonnet-4-6`, not a mutable alias like `claude-latest`). Document the pinned
  version and the date it was verified. Model behavior changes on alias updates are
  silent breaking changes.
- **Prompt injection defense**: sanitize user-supplied text before injecting it into
  prompts. At minimum, clearly delimit user content from instruction content using
  XML tags, structured blocks, or role-based messages. Never concatenate user input
  directly into instruction text.
- **Retrieval discipline**: in RAG pipelines, the retrieved context must be traceable
  to its source at log time. Log the document ID, chunk ID, and retrieval score for
  every context window assembled. This enables debugging of hallucination and
  relevance failures.
- **LLM call logging**: in development and staging, log the full prompt, model
  parameters, and raw response. In production, log a sampled subset (e.g., 5%) plus
  all error cases. Include latency and token usage in every log entry.
- **Cost awareness**: every LLM call path must have a documented token cost estimate
  per request at the call site. Alert if observed usage exceeds the estimate by more
  than 2×. Unbounded token usage is a financial and latency risk.
- **Fallback strategy**: every LLM call must have a defined behavior on failure
  (timeout, 5xx, 429). Acceptable strategies are: retry with backoff, return a
  degraded response, or fail fast with a user-facing error. Silent success on failure
  is not acceptable.

---

## 20. Concurrency & Async Safety

- Never use blocking I/O (synchronous file reads, `requests.get`, `time.sleep`) inside
  an `async` function. Use the async equivalent or offload to a thread pool executor.
  Blocking the event loop stalls all concurrent coroutines.
- Document all shared mutable state explicitly. For every piece of data accessible
  from multiple concurrent contexts, note: who owns it, how it is protected (lock,
  queue, immutability), and what the failure mode is if the protection is bypassed.
- Use locks (`asyncio.Lock`, `threading.Lock`) at the narrowest possible scope. Holding
  a lock while performing I/O or long computation causes contention and defeats
  the purpose of concurrency.
- Prefer **immutable data structures** for values shared across concurrent contexts.
  Immutability eliminates the class of bugs caused by concurrent mutation.
- Background tasks and workers must have:
  - Bounded concurrency (semaphore, worker pool) — do not spawn unbounded tasks.
  - Error handling for each task — an unhandled exception in a background task must
    not be silently swallowed.
  - A shutdown path — tasks must be cancellable and must release resources cleanly
    on cancellation.
- Avoid `asyncio.gather` with `return_exceptions=False` when tasks are independent.
  A single failure should not cancel all sibling tasks unless that is the intended
  behavior.
- When bridging sync and async code, be explicit about which thread pool is used
  and document the concurrency semantics. Do not call `asyncio.run` inside a running
  event loop.

---

## 21. Destructive Operation Protocol

Any operation that **permanently deletes, truncates, drops, or irreversibly modifies**
data, files, schemas, or infrastructure must follow this protocol without exception.

1. **Dry run first.** Implement and run a dry-run mode that outputs exactly what would
   be affected — rows, files, tables, records — without executing the change.
   Present the output to the user before proceeding.
2. **Explicit confirmation.** Require an explicit, unambiguous confirmation from the
   user (not inferred from context) before executing the operation.
3. **Document the rollback.** Before executing, state the rollback strategy in plain
   language. If no rollback exists, say so clearly and require the user to acknowledge.
4. **Back up first.** Where feasible, create a checkpoint (database dump, file copy,
   snapshot) before executing. Document the backup location.
5. **Scope the operation.** Never perform a destructive operation on a broader scope
   than required (e.g., do not `DROP TABLE` when `DELETE WHERE` is sufficient; do not
   `rm -rf` a directory when a single file is the target).
6. **Log the operation.** Log the user who confirmed, the timestamp, the scope, and
   the outcome of every destructive operation to a persistent, append-only audit log.

Soft deletion (setting a `deleted_at` timestamp and excluding from queries) is preferred
over hard deletion for user-facing data unless there is a regulatory, privacy, or
performance reason to hard-delete.

---

## 22. Self-Correction & Recovery Protocol

These rules govern agent behavior when an operation fails, produces an unexpected result,
or requires course correction mid-task.

- **Stop on unexpected failure.** If an operation fails in a way that was not anticipated
  in the plan, stop. Do not attempt to work around the failure with untested assumptions.
  Report the failure state, what was left behind, and ask how to proceed.
- **Never silently retry a destructive operation.** If a destructive operation fails
  partway through, the system may be in a partially modified state. Surface this
  immediately — do not retry without first assessing the current state.
- **Investigate before patching tests.** If a test fails unexpectedly after a change,
  the test is evidence of a regression. Understand the root cause before modifying the
  test. A test that is changed to pass is not a fixed test; it is a deleted test.
- **Rollback on cascade failure.** If multiple sequential operations are required and
  an intermediate step fails, attempt to undo completed prior steps where reversible.
  Document which steps were completed, which failed, and which could not be rolled back.
- **Declare uncertainty.** If mid-task analysis reveals an assumption in the original
  plan was wrong, declare it explicitly: state the original assumption, what was
  discovered, and the revised approach. Do not silently adopt a different strategy
  without informing the user.
- **State the system's condition.** After any failure, the response must include:
  what was attempted, what failed (with the error), what the current state of the
  system is, and what must happen next to restore a clean state.

---

## 23. CI/CD Pipeline Awareness

- All CI checks (linting, type checking, unit tests, build) must pass before any task
  is considered complete. "It works on my machine" is not an acceptable delivery state.
- When adding a new tool, script, test suite, or code quality check, update the CI
  configuration in the same PR. A check that exists locally but not in CI provides
  no enforcement guarantees.
- Environment-specific configuration (API keys, feature flags, database URLs) must
  be injected via CI/CD secrets or environment variable management — never hardcoded
  in workflow files, Dockerfiles, or application config committed to the repository.
- When a CI pipeline is broken, fixing it takes priority over all new feature work.
  A broken CI pipeline blocks the entire team.
- Build artifacts (Docker images, compiled binaries, bundled JS) must be reproducible.
  Two builds from the same commit at the same time must produce functionally identical
  artifacts. Non-reproducibility is a security and reliability risk.
- Tag and sign release artifacts. An unsigned artifact cannot be trusted to be what
  it claims to be.
- Document the CI/CD pipeline topology in the repository README or `docs/ci.md`:
  what stages exist, what each stage validates, and how to run equivalent checks
  locally before pushing.

---

## 24. Environment & Configuration Management

- All environment-specific configuration must be loaded from environment variables
  or a secrets manager. Never read from a `.env` file in production code — `.env`
  files are for local development only and must be in `.gitignore`.
- Provide a fully documented `.env.example` file at the repository root. Every
  required variable must have a comment describing its purpose, expected format,
  and where to obtain a value.
- Configuration must be **loaded and validated at startup**, not lazily at the call
  site. If a required variable is missing or malformed, the application must fail
  immediately with a clear error message — not at runtime when the variable is first
  accessed.

  ```python
  # At application startup, validate all required config.
  # This prevents runtime KeyError surprises buried in production code paths.
  class Config(BaseSettings):
      DATABASE_URL: PostgresDsn
      OPENAI_API_KEY: SecretStr
      MAX_RETRIES: int = 3
  
  config = Config()  # Raises ValidationError immediately if misconfigured.
  ```

- Separate configuration by concern: database config, external service credentials,
  feature flags, and runtime tuning parameters should be distinct configuration
  namespaces, not a flat list of environment variables.
- Feature flags must be controlled via configuration, not code branches. When a
  feature flag is permanently enabled, remove the flag and the dead branch in the
  same PR.
- Never log configuration values at INFO level. Log only that configuration was loaded
  successfully and which environment profile is active. Secret values must never
  appear in logs, even at DEBUG level.

---

## Quick Reference Checklist

Before submitting or applying any change, verify every item below. An unchecked item
is an incomplete task.

**Correctness & Completeness**
- [ ] Task is fully completed or scope reduction is clearly communicated.
- [ ] The output was verified end-to-end (ran, produced expected results, no silent failures).
- [ ] A plan was stated before non-trivial work began; a summary is provided after.
- [ ] All assumptions are documented. None were made silently.

**Code Quality**
- [ ] All new functions/classes have docstrings covering purpose, params, return, and exceptions.
- [ ] Inline comments explain *why*, not *what*.
- [ ] No dead code, commented-out blocks, or unused imports were left behind.
- [ ] No `TODO`, `FIXME`, or `HACK` comments without a corresponding tracked issue.
- [ ] Boolean function parameters have been replaced with named alternatives or split functions.

**Safety & Security**
- [ ] No hardcoded secrets, credentials, API keys, or environment-specific values.
- [ ] `.env.example` updated if new environment variables were added.
- [ ] All SQL interactions use parameterized queries or ORM.
- [ ] All user-provided and external inputs are validated at the boundary.
- [ ] No PII or secrets appear in log statements.
- [ ] Destructive operations followed the Destructive Operation Protocol (§21).

**Error Handling**
- [ ] Every external call (network, DB, filesystem, subprocess) has explicit error handling.
- [ ] Retry logic is capped, uses exponential backoff with jitter, and is documented.
- [ ] Errors include: what failed, why, and what the user/caller can do.
- [ ] No empty `except`/`catch` blocks.

**Testing**
- [ ] Unit tests exist for all new logic, covering happy path, edge cases, and failure modes.
- [ ] Tests are isolated, deterministic, and do not make real network or DB calls.
- [ ] Test names describe the scenario and expected outcome.
- [ ] All existing tests pass before and after the change.
- [ ] If a bug was fixed, a regression test was written first.
- [ ] CI pipeline passes on a clean environment.

**Type Safety & Schemas**
- [ ] Type hints applied to all new Python function signatures; mypy/pyright passes.
- [ ] No `any` in TypeScript without an inline justification comment.
- [ ] All external data (API responses, file reads, DB results) validated against a schema.
- [ ] No raw `dict`/`object` passed between modules in place of a named type.

**Database**
- [ ] Schema changes are expressed as versioned migration scripts with rollback paths.
- [ ] No schema changes in application boot code.
- [ ] All new foreign keys are indexed.
- [ ] Data invariants enforced at the DB level, not only in application code.

**API Design**
- [ ] New endpoints are versioned and follow the error envelope standard.
- [ ] List endpoints are paginated.
- [ ] OpenAPI spec updated in the same PR as the implementation.
- [ ] HTTP status codes used correctly.

**LLM / AI Pipelines**
- [ ] Model version is pinned (not a mutable alias).
- [ ] `max_tokens` is set on all model calls.
- [ ] LLM output parsed and validated against a Pydantic/Zod schema before use downstream.
- [ ] Prompt template is versioned and tracked in version control.
- [ ] Prompt injection defense applied to all user-supplied content injected into prompts.
- [ ] Retrieval results are logged with document ID, chunk ID, and score.

**Observability**
- [ ] Structured (JSON) logging used; no bare `print()` statements in production paths.
- [ ] Log levels used correctly; no secrets or PII in any log statement.
- [ ] `/health` endpoint exists and checks critical dependencies.
- [ ] Correlation/request ID propagated through all log entries for the request scope.

**Dependencies**
- [ ] No new dependency added without justification for why existing toolchain is insufficient.
- [ ] Dependency versions are pinned in the lock file.
- [ ] `npm audit` / `pip-audit` run; no unaddressed known CVEs introduced.
- [ ] Runtime and dev dependencies are separated in the manifest.

**Version Control**
- [ ] No unrelated files were modified.
- [ ] Commit messages follow `<type>(<scope>): <summary>` format.
- [ ] No generated files, build artifacts, or secrets committed.
- [ ] `.gitignore` updated if new artifact types were introduced.
- [ ] Change does not go directly to `main`/`master`.

**Accessibility (Frontend)**
- [ ] All interactive elements have ARIA labels and keyboard navigation support.
- [ ] Color contrast meets WCAG AA (4.5:1 normal text, 3:1 large text).
- [ ] All images have descriptive `alt` text; decorative images have `alt=""`.
- [ ] Form inputs have explicit `<label>` elements or `aria-label` attributes.

**CI/CD**
- [ ] CI configuration updated if new checks, scripts, or test suites were added.
- [ ] No environment-specific config hardcoded in workflow files or Dockerfiles.
- [ ] Build is reproducible from the same commit.