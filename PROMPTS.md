# Prompt Engineering Showcase

This file documents every AI prompt used to build this system. This is the primary evidence of AI-first engineering methodology — using AI tools at every stage of the development lifecycle, not just for code completion.

---

## 1. Lovable Prompt (Phase 1 Prototype)

Used to generate the entire Phase 1 frontend in one prompt. Paste into Lovable's "Describe your app" field.

```
Build a conversational AI event creation web app. There must be zero traditional forms 
anywhere — all event data is collected through a chat interface.

The app has two pages:

--- PAGE 1: CHAT (route: /) ---
On first load, show a GDPR consent message in the chat:
"Before we begin, your event data will be stored securely. You can request deletion 
at any time. Do you agree to proceed?"
Show two chips below: [I agree] [I decline]
If declined, show a message and stop.

After consent, the AI assistant (using Gemini API) guides the user through collecting 
these event fields conversationally, one at a time:
1. Event Name
2. Subheading (optional — user can skip)
3. Description
4. Banner Image (show an upload button when this field is being collected)
5. Time Zone (show chips: UTC, Asia/Kolkata, America/New_York, Europe/London, Asia/Kathmandu)
6. Status (show chips: Draft, Published, Cancelled)
7. Start Date (show a date-time picker inline)
8. End Date (show a date-time picker inline)
9. Vanish Date (show a date-time picker inline)
10. Roles (show chips: Organiser, Speaker, Attendee, Volunteer — user can select multiple)

After every AI message, show 2–4 context-relevant quick-reply suggestion chips below 
the input box. These update based on what field is being collected.

When all fields are collected, show a summary card in the chat with all values and ask 
"Shall I create this event?" with chips: [Yes, create it] [Edit something]

On confirmation, save the event to Supabase and show a success message.

--- PAGE 2: DASHBOARD (route: /dashboard) ---
Show all events as cards. Each card shows: event name, subheading, status badge 
(color-coded), start date, and two buttons: Edit and Delete (with confirmation dialog).

--- DESIGN ---
Clean, minimal, white background. Chat bubbles: AI on left (light gray), user on right 
(soft blue). Suggestion chips: small, pill-shaped, outlined. Mobile-friendly.

--- AUTH ---
Add simple email + password authentication using Supabase Auth.

--- SUPABASE TABLES NEEDED ---
events: id, user_id, event_name, subheading, description, banner_image_url, timezone, 
status, start_date, end_date, vanish_date, roles (jsonb), created_at, updated_at, deleted_at
chat_sessions: id, user_id, event_id, messages (jsonb), state (jsonb), created_at

Use Supabase Row Level Security so users can only see their own data.
```

**Why this prompt works:**
- Specifies zero forms as a hard constraint, not a preference
- Defines the GDPR consent flow as the first interaction
- Provides exact field names and types for the database schema
- Specifies chip options per field so suggestions are context-aware
- Includes RLS instruction so security is built in from the start

---

## 2. Gemini System Prompt (Production AI Engine)

This is the core prompt engineering artifact. Injected into every Gemini API call server-side via `src/lib/gemini.ts`. This single prompt replaces hundreds of lines of conditional validation logic.

```
You are an event creation assistant. Collect event data conversationally — never use 
form language like "Please fill in field X" or "Enter your Y".

Fields to collect in order:
1. event_name (string, required)
2. subheading (string, optional — accept "skip")
3. description (string, required, min 20 chars)
4. banner_image (tell user to upload, set field to "PENDING_UPLOAD")
5. timezone (IANA string, e.g. "Asia/Kathmandu")
6. status (DRAFT | PUBLISHED | CANCELLED, default DRAFT)
7. start_date (ISO 8601 datetime)
8. end_date (ISO 8601 datetime, must be after start_date)
9. vanish_date (ISO 8601 datetime, must be after end_date)
10. roles (array of strings, e.g. ["Organiser", "Speaker", "Attendee"])

Rules:
- Ask one field at a time. Be warm, brief, and natural.
- Confirm each value back to the user naturally before moving to the next field.
- If a value is invalid (e.g. end_date before start_date, description under 20 chars), 
  explain why conversationally and re-ask that field only.
- If user writes in a non-English language, respond in that language but still extract 
  values into the English schema (IANA timezones, ISO dates, English status values).
- When ALL fields are collected, output the complete event data as a JSON object 
  inside <event_data></event_data> tags.
- After EVERY response without exception, output 2-4 suggestion chips relevant to the 
  CURRENT field being collected, as a JSON array inside <suggestions></suggestions> tags.
- Never ask for or collect any data beyond the 10 fields listed above (data minimization).

SUGGESTION RULES — mandatory:
- event_name: ["Tech Summit 2026", "Product Launch", "Team Offsite", "Workshop"]
- subheading: ["Add a subheading", "Skip this field"]
- timezone: ["UTC", "Asia/Kathmandu", "America/New_York", "Europe/London"]
- status: ["Draft", "Published", "Cancelled"]
- start_date/end_date/vanish_date: ["Tomorrow", "Next week", "Next month", "Enter custom date"]
- roles: ["Organiser", "Speaker", "Attendee", "Volunteer"]
- confirmation: ["Yes, create it", "Edit something"]

Current conversation state: {state}
Fields collected so far: {collected}
```

**Prompt engineering decisions explained:**

| Decision | Reason |
|---|---|
| Structured output tags `<event_data>` | Reliable server-side parsing without fragile regex |
| `<suggestions>` on every response | Enforces chip display even if AI forgets |
| State injection at end | Full context without relying on model memory |
| Explicit SUGGESTION RULES section | Prevents generic suggestions like "yes/no" |
| Multilingual rule | Handles input in any language, schema stays English |
| Data minimization rule in prompt | GDPR compliance enforced at AI layer |

---

## 3. Cursor Prompts (Phase 2 Backend)

Used with Co-pilot agent to scaffold and fix the Node.js backend.

### 3a. Initial Backend Scaffold

```
Build a production-ready Node.js + Express backend with PostgreSQL for an AI-first 
event creation system. Use TypeScript.

Structure:
src/routes/ (auth.ts, events.ts, chat.ts, gdpr.ts)
src/middleware/ (auth.ts, validate.ts, rateLimiter.ts)  
src/db/ (client.ts, migrations/001_init.sql)
src/lib/ (gemini.ts, audit.ts)
src/types/index.ts

AUTH: JWT 15min + refresh 7d in httpOnly cookie, bcrypt 12 rounds
CHAT: Call Gemini 2.5 Flash with system prompt, parse <event_data> and <suggestions> tags
EVENTS: Full CRUD, soft delete, scoped to authenticated user
GDPR: /export returns all user data as JSON, /me deletes account (soft)
SECURITY: helmet, cors, express-rate-limit (100/15min global, 10/15min auth), Zod validation, parameterized queries
AUDIT: Write to audit_logs on every significant action

[Full schema included in prompt]

Generate all files completely. No TODOs or placeholders.
```

### 3b. TypeScript JWT Fix

```
Fix TypeScript error in src/middleware/auth.ts:
"Type 'string' is not assignable to type 'number | StringValue | undefined'" 
on jwt.sign() expiresIn option.

Fix: cast options object as jwt.SignOptions and add "as string" to all 
process.env.JWT_SECRET references. Apply to all jwt.sign() and jwt.verify() calls.
```

### 3c. Database Migration Runner

```
Rewrite src/db/migrate.ts to use DATABASE_URL directly from .env.development 
using dotenv instead of separate POSTGRES_HOST/USER/DB variables.
Use ssl: { rejectUnauthorized: false } for Railway SSL requirement.
Add IF NOT EXISTS to all CREATE TABLE statements so re-runs don't fail.
```

### 3d. Production Deploy Prep

```
Prepare backend for Railway deployment:
1. package.json scripts: "build": "tsc", "start": "node dist/index.js"
2. tsconfig.json outDir: "./dist", rootDir: "./src"
3. dotenv config: only load .env.development when NODE_ENV !== production
4. PORT from process.env.PORT with fallback 4000
5. Create Procfile: web: npm start
```

---

## 4. What These Prompts Demonstrate

**AI-first engineering** means using AI across the entire development lifecycle:

- **Product design** — Lovable prompt defines the UX, DB schema, auth, and GDPR flow in one shot
- **Business logic** — Gemini system prompt IS the validation and entity extraction logic
- **Backend scaffolding** — Agents generates the entire TypeScript codebase from a single structured prompt
- **Debugging** — Agents fixes TypeScript errors from error messages alone
- **Deployment** — Agents prepares production config from a requirements list
