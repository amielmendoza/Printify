# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Printify** is a web-based ID card printing service application. It accepts ID templates from different companies/schools, combines them with person photos and data, and produces printable ID card output (PDF).

### Core Functionality
- **Template Management**: Upload and manage ID card templates (PDF/image) from different organizations
- **Person Management**: Maintain a database of people with photos, names, roles, and metadata
- **ID Card Generation**: Overlay person data (photo, name, title, date) onto templates via a visual editor/preview
- **Batch Operations**: Select multiple people and generate IDs in bulk
- **Print/Export**: Export finished ID cards as print-ready PDFs

### Reference Design
The app follows a three-panel layout (see reference screenshot):
- **Left sidebar**: Navigation (Persons, ID Generator, Reports)
- **Center canvas**: ID card preview with real-time template + photo composition
- **Right panel**: Person list with search, filter by type/category, and batch selection

## Tech Stack

- **Framework**: Next.js with TypeScript (App Router)
- **UI**: React, Tailwind CSS, shadcn/ui components
- **Canvas/Editor**: Fabric.js for template editing and photo overlay on canvas
- **PDF**: pdf-lib for reading template PDFs and generating print-ready output
- **Database**: SQL Server via **Prisma** (`src/lib/db.ts`). JSON columns
  (placeholders, metadata, render_state) are stored as NVARCHAR(MAX) strings and
  parsed at the boundary by the mappers in `db.ts`.
- **Auth**: **Auth.js v5** (NextAuth) Credentials provider — local password
  (bcrypt) or external evesms API. Config split: `src/auth.config.ts` (edge,
  middleware) + `src/auth.ts` (Node, providers). Helpers in `src/lib/auth.ts`.
- **File Storage**: **Azure Blob Storage** (private containers `templates`,
  `photos`); reads via short-lived SAS URLs minted by `/api/storage/url`
  (`src/lib/storage.ts` server, `src/lib/storage-client.ts` client).

## Project Structure

```
src/
  app/              # Next.js App Router pages and API routes
    (dashboard)/    # Main app layout with sidebar
    api/            # REST API routes
  components/       # React components
    editor/         # Canvas/ID editor components (Fabric.js integration)
    ui/             # shadcn/ui base components
  lib/              # Shared utilities
    pdf.ts          # PDF parsing and generation helpers
    canvas.ts       # Fabric.js canvas utilities
    supabase/
      client.ts     # Supabase browser client
      server.ts     # Supabase server client (for Server Components / Route Handlers)
      middleware.ts  # Supabase auth middleware helper
```

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Database (Prisma + SQL Server)
npx prisma db push           # Sync schema to the database (no migration history)
npx prisma migrate dev       # Create + apply a migration in dev
npx prisma generate          # Regenerate the typed client (also runs on build/install)
npx prisma studio            # Browse data

# Linting and formatting
npm run lint                 # ESLint
npm run lint -- --fix        # Auto-fix lint issues

# Run a single test file
npx vitest run path/to/file.test.ts

# Run all tests
npm test
```

## Architecture Notes

### Template System
Templates are PDF or image files uploaded per organization. Each template defines:
- Fixed background artwork (borders, logos, text)
- Placeholder regions for dynamic content (photo position, name position, etc.)
- Template metadata stored in Supabase DB; actual files in Supabase Storage (`templates` bucket)

### ID Generation Pipeline
1. Load template background onto Fabric.js canvas
2. Position person photo at the defined placeholder region
3. Render text fields (name, title, date) at configured positions with styling
4. Preview in the canvas editor (center panel)
5. On export: render canvas to image, embed into PDF using pdf-lib

### PDF Output
- Uses pdf-lib to create multi-page PDFs (one ID per page, or multiple IDs per sheet)
- Supports standard ID card dimensions (CR-80: 3.375" x 2.125")
- Print layout should account for bleed and cut marks

### Data Model (Key Entities)
- **Organization**: Company/school that owns templates
- **Template**: ID card template file + placeholder positions
- **Person**: Individual with name, photo, role, organization membership
- **IDCard**: Generated card instance linking a person to a template with render state

### Backend Setup (SQL Server + Auth.js + Azure Blob)
- **Schema**: `prisma/schema.prisma`. After changes: `npx prisma db push` (or
  `prisma migrate dev`) then `npx prisma generate`. Domain types live in
  `src/lib/types.ts` (stable contract); Prisma rows are mapped to them in `db.ts`.
- **Org isolation**: No RLS. Every API route calls `requireUser()` and filters by
  `user.orgId`; mutations verify org ownership before writing (defense-in-depth).
- **Auth**: `requireUser()` for API routes (identity), `getCurrentUser()` for
  server components, `getExternalCreds(request)` to read the evesms bearer
  token/schoolId from the JWT. Client: `signIn`/`signOut` from `next-auth/react`.
- **Storage**: upload via `POST /api/upload` (`uploadFile`); resolve a stored
  path to a viewable URL via `getStorageUrl(bucket, path)` (client) which hits
  `/api/storage/url` and returns a short-lived SAS URL.
- **Environment variables**: `DATABASE_URL`, `AUTH_SECRET`,
  `AZURE_STORAGE_CONNECTION_STRING`, container names (see `.env.example`).
- **Migration runbook**: see `MIGRATION.md`.

### Canvas Editor
- Built on Fabric.js for drag-and-drop positioning of elements on the template
- Photo cropping/resizing within the placeholder boundary
- Text fields auto-sized to fit designated areas
- WYSIWYG preview matches final print output

## Security Audit (2026-03-14)

Known vulnerabilities to fix when modifying related code. **Do not introduce new instances of these patterns.**

### CRITICAL
1. **No Supabase auth on external API routes** — `/api/persons`, `/api/persons/[id]/photo` only check cookie tokens, not Supabase session. Every API route that returns data MUST call `supabase.auth.getUser()` and reject if no user.
2. **Unrestricted file upload** — `src/app/api/upload/route.ts` has no extension whitelist, file size limit, or server-side MIME validation. Uploads MUST be restricted to `['jpg','jpeg','png','gif','webp','pdf']` with a max size.
3. **Password in login response** — `src/app/api/auth/login/route.ts` returns plaintext Supabase password in JSON. Never return passwords in API responses.
4. **Weak password generation** — `ext_{userId}_{password}` pattern is predictable. Use crypto-random passwords.

### HIGH
5. **No auth on GET `/api/id-cards` and `/api/templates`** — Both return all data without authentication.
6. **No auth/rate-limit on `/api/remove-bg`** — Anyone can call this and burn PiAPI credits.
7. **IDOR on CRUD endpoints** — PUT/DELETE on persons and templates lack org ownership checks, relying solely on RLS.
8. **XSS via `dangerouslySetInnerHTML`** — `template-editor.tsx` renders placeholder labels as raw HTML. Sanitize with DOMPurify or use text rendering.
9. **HTML injection in canvas** — `addHtmlLabel()` in `canvas.ts` injects unsanitized text into SVG foreignObject. Sanitize all inputs.
10. **Public storage policies** — `supabase/migrations/00002_storage_policies.sql` allows unauthenticated read on templates and photos buckets.

### MEDIUM
11. **Middleware skips `/api/` routes** — `src/lib/supabase/middleware.ts` exempts all API routes from auth redirect.
12. **No input validation on PUT bodies** — API routes spread unvalidated JSON into DB updates. Use Zod schemas.
13. **Open redirect in OAuth callback** — `next` query param in `/auth/callback` is unvalidated.
14. **Wildcard image remote patterns** — `next.config.ts` allows `hostname: "**"`. Restrict to known domains.
15. **No security headers** — No CSP, X-Frame-Options, HSTS, or X-Content-Type-Options configured.

### Rules for new code
- Every API route MUST verify authentication before processing
- Every CRUD operation MUST verify org ownership (defense-in-depth, don't rely solely on RLS)
- All user input MUST be validated with Zod before DB operations
- Never use `dangerouslySetInnerHTML` with user-provided content
- Never return secrets/passwords in API responses
- File uploads MUST validate extension, MIME type, and enforce size limits
- Restrict `next.config.ts` image remote patterns to specific domains
