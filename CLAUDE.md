# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

### 🔄 Project Awareness & Context
- **Always read `PROJECT_DOCUMENTATION.md`** at the start of a new conversation to understand the project's architecture, goals, style, and constraints.
- **Check `TASK.md`** before starting a new task. If the task isn’t listed, add it with a brief description and today's date. If no TASKS.md file exists, create one.
- **Use consistent naming conventions, file structure, and architecture patterns** as described in `PROJECT_DOCUMENTATION.md`.
- **Use venv_linux** (the virtual environment) whenever executing Python commands, including for unit tests.

### 🧱 Code Structure & Modularity
- **Never create a file longer than 500 lines of code.** If a file approaches this limit, refactor by splitting it into modules or helper files.
- **Organize code into clearly separated modules**, grouped by feature or responsibility.
  For agents this looks like:
    - `agent.py` - Main agent definition and execution logic 
    - `tools.py` - Tool functions used by the agent 
    - `prompts.py` - System prompts
- **Use clear, consistent imports** (prefer relative imports within packages).
- **Use clear, consistent imports** (prefer relative imports within packages).
- **Use python_dotenv and load_env()** for environment variables.

### 🧪 Testing & Reliability
- **Always create Pytest unit tests for new features** (functions, classes, routes, etc).
- **After updating any logic**, check whether existing unit tests need to be updated. If so, do it.
- **Tests should live in a `/tests` folder** mirroring the main app structure.
  - Include at least:
    - 1 test for expected use
    - 1 edge case
    - 1 failure case

### ✅ Task Completion
- **Mark completed tasks in `TASK.md`** immediately after finishing them.
- Add new sub-tasks or TODOs discovered during development to `TASK.md` under a “Discovered During Work” section.

### 📎 Style & Conventions
- **Use Python** as the primary language.
- **Follow PEP8**, use type hints, and format with `black`.
- **Use `pydantic` for data validation**.
- Use `FastAPI` for APIs and `SQLAlchemy` or `SQLModel` for ORM if applicable.
- Write **docstrings for every function** using the Google style:
  ```python
  def example():
      """
      Brief summary.

      Args:
          param1 (type): Description.

      Returns:
          type: Description.
      """
  ```

### 📚 Documentation & Explainability
- **Update `README.md`** when new features are added, dependencies change, or setup steps are modified. 
- **Include the date and what model AI you are** before updating any documentation.
- **Comment non-obvious code** and ensure everything is understandable to a mid-level developer.
- When writing complex logic, **add an inline `# Reason:` comment** explaining the why, not just the what.

### 🧠 AI Behavior Rules
- **Never assume missing context. Ask questions if uncertain.**
- **Never hallucinate libraries or functions** – only use known, verified Python packages.
- **Always confirm file paths and module names** exist before referencing them in code or tests.
- **Never delete or overwrite existing code** unless explicitly instructed to or if part of a task from `TASK.md`.

## Project Overview

CNC Design Library - a self-hosted platform for browsing, previewing, and downloading CNC and laser cutting designs. Built with Next.js 15 (App Router), Supabase (self-hosted), and Tailwind CSS.

## Prerequisites

- **Node.js 22+** (LTS) - Use fnm or nvm; `.node-version` file auto-switches
- Python 3.10+ (for design ingestion)
- Self-hosted Supabase instance

## Commands

```bash
# Development
npm run dev              # Start development server (localhost:3000)
npm run dev:clean        # Clear .next cache and start dev server
npm run build            # Production build
npm run lint             # ESLint

# Testing
npm run test             # Run tests once (vitest)
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report

# Database
npm run db:migrate       # Push migrations to Supabase (supabase db push)
npm run db:reset         # Reset database (supabase db reset)
npm run db:types         # Generate TypeScript types from schema

# Design ingestion (Python)
cd scripts && pip install -r requirements.txt
python ingest_designs.py /path/to/designs
```

## Architecture

### Supabase Client Pattern

Two Supabase clients exist for different contexts:

1. **`createClient()`** - Uses cookies, respects RLS. For API routes and server components where user context matters.
2. **`createServiceClient()`** - Uses service role key, bypasses RLS. For background jobs and admin operations.

```typescript
// In API routes with user context
const supabase = await createClient();

// In background jobs or service-to-service
const supabase = createServiceClient();
```

**Important**: Background job processors (like `lib/import/job-processor.ts`) must use `createServiceClient()` since they run outside of request context and have no cookies.

### Authentication & Authorization

- `lib/auth.ts` provides `getUser()`, `requireUser()`, `requireAdmin()`, `requireSuperAdmin()`
- User roles: `user`, `admin`, `super_admin`
- `isAdmin(user)` helper checks for admin or super_admin

### Bulk Import System

Located in `lib/import/` and `lib/services/`:

1. **Scanner** (`lib/import/scanner.ts`) - Scans directories for design files
2. **Project Detector** (`lib/import/project-detector.ts`) - Groups related files (e.g., Design.svg + Design.dxf + Design.png) into projects
3. **Job Processor** (`lib/import/job-processor.ts`) - Processes import jobs with concurrency control
4. **Services** (`lib/services/import-job-service.ts`, `import-item-service.ts`) - Database operations

Files detected as belonging to the same project are bundled into ONE design with multiple `design_files` records.

### Preview Generation

`lib/preview-generator.ts` generates preview images for:
- **2D**: SVG, DXF, DWG, AI, EPS, PDF (uses sharp, canvas, dxf-parser)
- **3D**: STL, OBJ, GLTF, GLB, 3MF (software rendering to multi-view image)
- **Images**: PNG, JPG, WEBP (resize to thumbnail)

Previews are rendered server-side without GPU/WebGL dependencies.

### Feature Flags & AI Configuration

Runtime configuration stored in `config/ai-config.json`:

- **Feature flags**: Toggle features like favorites, collections, related designs
- **AI prompts**: Configurable prompts for metadata generation
- **Tag vocabulary**: Controlled vocabulary for design tags

Access via:
```typescript
import { loadAIConfig } from "@/lib/ai-config";
import { isFeatureEnabled } from "@/lib/feature-flags";
```

### Database Schema

Migrations in `supabase/migrations/` (apply in order):
- `0001_init.sql` - Core tables (users, designs, downloads)
- `0002_rls.sql` - Row Level Security policies
- `0003_functions.sql` - Helper functions
- `0004_storage.sql` - Storage bucket configuration
- `0005_user_sessions.sql` - User session tracking
- `0006_multi_file_support.sql` - Multi-file designs (design_files table)
- `0007_bulk_import_jobs.sql` - Import system (import_jobs, import_items, import_detected_projects)
- `0008_feature_flags.sql` - Favorites, collections, audit logs

### Key Tables

- `designs` - Main design records with metadata
- `design_files` - Multiple files per design (primary, variant, component roles)
- `import_jobs` - Bulk import job tracking
- `import_items` - Individual files in an import job
- `import_detected_projects` - Grouped files detected during scan

### API Route Conventions

- API routes requiring file operations need `export const runtime = "nodejs";`
- Next.js 15 uses async params: `const { id } = await params;`
- Admin routes check `isAdmin(user)` for authorization

### UI Components

Uses shadcn/ui components in `components/ui/`. Key custom components:
- `DesignCard` - Design thumbnail with favorite button
- `DesignFileList` - File list with preview/download for design detail page
- `ModelViewer` - Three.js 3D model viewer (client-side)
- `ImportWizard` - Multi-step bulk import interface

### 3D Model Handling

- Server-side: Parsed via custom parsers (`lib/parsers/`) for preview generation
- Client-side: Three.js viewer (`components/ModelViewer.tsx`) for interactive viewing
