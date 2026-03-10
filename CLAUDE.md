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
- **Backend/Database**: Supabase (hosted PostgreSQL, auth, storage, real-time)
- **DB Client**: @supabase/supabase-js (use Supabase client directly, no ORM)
- **File Storage**: Supabase Storage buckets for templates and photos

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

# Supabase
npx supabase init            # Initialize Supabase config (first time)
npx supabase start           # Start local Supabase (Docker required)
npx supabase db push         # Push migrations to remote
npx supabase gen types typescript --linked > src/lib/supabase/types.ts  # Generate TS types from schema

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

### Supabase Setup
- **Auth**: Supabase Auth for user login (email/password or OAuth)
- **Storage buckets**: `templates` (org ID card backgrounds), `photos` (person headshots)
- **Row Level Security (RLS)**: Enforce per-organization data isolation — users only access their own org's data
- **Environment variables**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
- **Server-side client**: Use `createServerClient` from `@supabase/ssr` in Server Components and Route Handlers
- **Browser client**: Use `createBrowserClient` from `@supabase/ssr` in Client Components
- **Type safety**: Regenerate `types.ts` after any schema change with `supabase gen types`

### Canvas Editor
- Built on Fabric.js for drag-and-drop positioning of elements on the template
- Photo cropping/resizing within the placeholder boundary
- Text fields auto-sized to fit designated areas
- WYSIWYG preview matches final print output
