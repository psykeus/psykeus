# CNC Design Library - Project Documentation

## Overview

**CNC Design Library** is a self-hosted platform for browsing, previewing, and downloading CNC and laser cutting designs. It supports 2D vector files (SVG, DXF, DWG, AI, EPS, PDF) and 3D models (STL, OBJ, GLTF, GLB, 3MF) with server-side preview generation.

### Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Database**: Supabase (PostgreSQL + Storage) - self-hosted
- **Styling**: Tailwind CSS + shadcn/ui components
- **3D Rendering**: Three.js (client) + custom software renderers (server)
- **AI Metadata**: OpenAI GPT-4 Vision API
- **Language**: TypeScript 5.7

---

## Project Goals

### Core Objectives
1. **Design Library** - Organize and browse CNC/laser cutting designs with rich metadata
2. **Multi-format Preview** - Server-side preview generation for all supported file types
3. **Bulk Import** - Process 10,000+ files with project detection and duplicate handling
4. **Self-hosted** - Run entirely on user's infrastructure (Supabase + Next.js)

### Completed Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Design Browsing** | Grid view with filtering, search, pagination | ✅ Complete |
| **Multi-file Designs** | One design can have multiple files (variants, components) | ✅ Complete |
| **Preview Generation** | Server-side rendering for SVG, DXF, STL, OBJ, GLTF, 3MF | ✅ Complete |
| **3D Model Viewer** | Interactive Three.js viewer on detail pages | ✅ Complete |
| **Bulk Import** | Wizard for importing thousands of files with progress tracking | ✅ Complete |
| **Project Detection** | Auto-groups related files (Design.svg + Design.dxf = 1 design) | ✅ Complete |
| **Duplicate Detection** | SHA-256 hash + perceptual hash (pHash) for near-duplicates | ✅ Complete |
| **AI Metadata** | OpenAI Vision generates titles, descriptions, tags | ✅ Complete |
| **Favorites System** | Users can favorite designs | ✅ Complete |
| **Collections** | Users can organize designs into collections | ✅ Complete |
| **Related Designs** | Shows similar designs based on pHash | ✅ Complete |
| **Admin Dashboard** | Design management, analytics, settings | ✅ Complete |
| **Feature Flags** | Toggle features on/off via admin UI | ✅ Complete |
| **Dark Mode** | Full theme support with next-themes | ✅ Complete |
| **Rate Limiting** | In-memory rate limiter for API protection | ✅ Complete |

### Future Roadmap (Not Started)
- Background Job Queue (BullMQ + Redis)
- CDN Integration (Cloudflare)
- Scheduled Publishing
- Webhooks
- G-code Preview
- Sitemap Generation
- Social Cards (OpenGraph)

---

## Environment Setup

### Required Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Configuration (for metadata generation)
AI_API_KEY=sk-xxx
AI_MODEL=gpt-4o-mini

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build

# Database operations
npm run db:migrate    # Push migrations to Supabase
npm run db:reset      # Reset database
npm run db:types      # Generate TypeScript types

# Testing
npm run test          # Run tests
npm run test:watch    # Watch mode
npm run lint          # ESLint

# Clean build
npm run dev:clean     # Delete .next and restart
```

---

## Architecture

### Directory Structure

```
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── admin/             # Admin pages
│   ├── account/           # User account pages
│   ├── designs/           # Design browsing pages
│   └── login/             # Authentication
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── admin/            # Admin-specific components
├── lib/                   # Core libraries
│   ├── import/           # Bulk import system
│   ├── parsers/          # 3D file parsers
│   ├── services/         # Database services
│   ├── supabase/         # Supabase client configuration
│   └── types/            # TypeScript type definitions
├── config/               # Runtime configuration
│   └── ai-config.json    # Feature flags, AI prompts, tags
├── supabase/             # Database
│   └── migrations/       # SQL migration files
└── scripts/              # Python ingestion scripts
```

### Supabase Client Pattern

Two clients exist for different contexts:

```typescript
// Client with cookies - respects RLS, for API routes with user context
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Service client - bypasses RLS, for background jobs
import { createServiceClient } from "@/lib/supabase/server";
const supabase = createServiceClient();
```

**Important**: Background processors like `lib/import/job-processor.ts` must use `createServiceClient()` since they run outside request context.

### Authentication & Authorization

```typescript
import { getUser, requireUser, requireAdmin, isAdmin } from "@/lib/auth";

// Check user role
const user = await getUser();
if (!user || !isAdmin(user)) {
  return NextResponse.json({ error: "Admin required" }, { status: 403 });
}
```

**User Roles**: `user`, `admin`, `super_admin`

---

## Database Schema

### Migrations (apply in order)

| Migration | Description |
|-----------|-------------|
| `0001_init.sql` | Core tables: users, designs, design_files, tags, downloads |
| `0002_rls.sql` | Row Level Security policies |
| `0003_functions.sql` | Database functions |
| `0004_storage.sql` | Storage bucket configuration |
| `0005_user_sessions.sql` | Session management |
| `0006_multi_file_support.sql` | Multi-file designs (file_role, file_group, sort_order) |
| `0007_bulk_import_jobs.sql` | Import system (import_jobs, import_items, import_detected_projects) |
| `0008_feature_flags.sql` | Favorites, collections, audit_logs tables |
| `0009_remove_materials.sql` | Remove unused materials column |

### Key Tables

#### `designs`
Main design records with metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| slug | text | URL-friendly identifier |
| title | text | Display title |
| description | text | Design description |
| preview_path | text | URL to preview image |
| project_type | text | e.g., "box", "sign", "ornament" |
| difficulty | text | beginner, intermediate, advanced |
| categories | text[] | Array of categories |
| style | text | e.g., "modern", "rustic" |
| approx_dimensions | text | Approximate size |
| is_public | boolean | Visibility flag |
| current_version_id | uuid | FK to active design_file |
| primary_file_id | uuid | FK to primary design_file |

#### `design_files`
Multiple files per design with versioning.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| design_id | uuid | FK to designs |
| storage_path | text | Path in Supabase storage |
| file_type | text | Extension (svg, stl, etc.) |
| size_bytes | bigint | File size |
| content_hash | text | SHA-256 hash |
| preview_phash | text | Perceptual hash for similarity |
| file_role | text | primary, variant, or component |
| file_group | text | Optional grouping name |
| original_filename | text | Original file name |
| display_name | text | User-friendly name |
| sort_order | int | Display order |
| is_active | boolean | Active version flag |

#### `import_jobs`
Bulk import job tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| source_type | text | folder, zip, or upload |
| source_path | text | Path to source |
| status | text | pending, scanning, processing, completed, failed |
| total_files | int | Total files to process |
| files_processed | int | Processed count |
| files_succeeded | int | Success count |
| files_failed | int | Failure count |
| generate_previews | boolean | Generate previews? |
| generate_ai_metadata | boolean | Use AI for metadata? |
| detect_duplicates | boolean | Check for duplicates? |

#### `user_favorites`
User favorite designs.

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | FK to users |
| design_id | uuid | FK to designs |
| created_at | timestamptz | When favorited |

#### `collections` / `collection_items`
User design collections.

---

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/designs` | Browse designs (paginated, filterable) |
| GET | `/api/designs/[slug]` | Get design details |
| GET | `/api/designs/[slug]/related` | Get similar designs |
| GET | `/api/designs/[slug]/files/[fileId]/preview` | Get file preview |
| GET | `/api/designs/[slug]/model` | Get 3D model for viewer |
| GET | `/api/download/[designId]` | Download primary file |
| GET | `/api/download/[designId]/file/[fileId]` | Download specific file |
| GET | `/api/download/[designId]/zip` | Download all files as ZIP |

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/session` | Get current session |

### User Endpoints (authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me/favorites` | List user's favorites |
| GET | `/api/me/downloads` | List user's downloads |
| GET/POST/DELETE | `/api/favorites/[designId]` | Manage favorites |
| GET/POST | `/api/collections` | List/create collections |
| GET/PATCH/DELETE | `/api/collections/[id]` | Manage collection |
| POST/DELETE/PATCH | `/api/collections/[id]/items` | Manage collection items |

### Admin Endpoints (admin role required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/designs` | List all designs (with unpublished) |
| GET/PATCH/DELETE | `/api/admin/designs/[id]` | Manage design |
| POST | `/api/admin/designs/bulk` | Bulk operations |
| GET/PATCH/DELETE | `/api/admin/designs/[id]/files/[fileId]` | Manage design files |
| POST | `/api/admin/designs/[id]/files` | Add files to design |
| POST | `/api/admin/designs/[id]/primary` | Set primary file |
| GET/POST | `/api/admin/tags` | Manage tags |
| PATCH | `/api/admin/designs/[id]/tags` | Update design tags |
| GET | `/api/admin/duplicates` | Find duplicate designs |
| POST | `/api/admin/duplicates/manage` | Resolve duplicates |
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/analytics/downloads` | Download analytics |
| GET | `/api/admin/analytics/popular` | Popular designs |
| GET/PATCH | `/api/admin/ai-settings` | AI configuration |

### Import System Endpoints (admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/import/scan` | Scan directory for files |
| GET/POST | `/api/admin/import/jobs` | List/create import jobs |
| GET | `/api/admin/import/jobs/[jobId]` | Get job details |
| POST | `/api/admin/import/jobs/[jobId]/start` | Start processing |
| POST | `/api/admin/import/jobs/[jobId]/pause` | Pause job |
| POST | `/api/admin/import/jobs/[jobId]/cancel` | Cancel job |
| POST | `/api/admin/import/jobs/[jobId]/undo` | Rollback import |
| GET | `/api/admin/import/jobs/[jobId]/items` | List import items |
| GET | `/api/admin/import/jobs/[jobId]/stream` | SSE progress stream |

### Upload Endpoints (admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/upload` | Upload single file |
| POST | `/api/admin/upload/zip` | Upload ZIP archive |
| POST | `/api/admin/upload/project` | Upload multi-file project |

---

## Core Libraries

### Preview Generation (`lib/preview-generator.ts`)

Generates preview images server-side without GPU:

| Format | Method |
|--------|--------|
| SVG | Sharp conversion |
| DXF | dxf-parser + Canvas rendering |
| DWG, AI, EPS | Placeholder (requires external tools) |
| PDF | Disabled (pdfjs-dist compatibility issues) |
| STL | Custom ASCII/binary parser + software renderer |
| OBJ | Custom parser + software renderer |
| GLTF/GLB | @gltf-transform/core + software renderer |
| 3MF | JSZip extraction + software renderer |
| Images | Sharp resize to thumbnail |

### 3D Parsers (`lib/parsers/`)

Custom parsers for 3D formats:

- `stl-parser.ts` - ASCII and binary STL
- `obj-parser.ts` - Wavefront OBJ with MTL
- `gltf-parser.ts` - GLTF/GLB via @gltf-transform
- `3mf-parser.ts` - 3MF via JSZip
- `gcode-parser.ts` - G-code/NC toolpath parsing
- `math-utils.ts` - Shared 3D math utilities (Vector3, calculateNormal)
- `index.ts` - Unified exports

### G-code Support

G-code files (`.gcode`, `.nc`, `.ngc`, `.tap`) are now supported:

- **Parsing**: Extracts toolpath segments (G0 rapid, G1 cutting, G2/G3 arcs)
- **Preview**: Generates 2D top-down toolpath visualization
  - Dark background with grid overlay
  - Blue dashed lines for rapid moves
  - Red solid lines for cutting moves
  - Info overlay showing move counts and dimensions
- **Metadata**: Extracts total moves, cutting distance, and bounds

### Import System (`lib/import/`)

Bulk import with concurrent processing:

- `scanner.ts` - Directory/ZIP scanning
- `project-detector.ts` - Groups related files
- `job-processor.ts` - Main orchestrator with worker pool

**Project Detection Signals**:
1. **Folder grouping** - Files in same folder
2. **Filename variants** - Same base name, different extension
3. **Common prefix** - solar-panel-base.svg, solar-panel-cover.svg
4. **Layer numbering** - layer-1.svg, layer-2.svg
5. **Cross-folder** - SVG/Design.svg + DXF/Design.dxf

### Services (`lib/services/`)

Database operations:

- `import-job-service.ts` - Import job CRUD
- `import-item-service.ts` - Import item management

### Background Jobs (`lib/jobs/`)

Async job processing with BullMQ + Redis:

- `queue.ts` - Job queue manager with processors
- `index.ts` - Module exports

**Job Types**:
- `preview:generate` - Generate preview images asynchronously
- `ai:extract-metadata` - Extract AI metadata from designs
- `design:publish` / `design:unpublish` - Scheduled publishing
- `webhook:deliver` - Deliver webhooks with retry logic
- `import:process-item` - Process import items (future)

**Usage**:
```typescript
import { enqueueJob, scheduleJob } from "@/lib/jobs";

// Add job to queue
await enqueueJob({
  type: "preview:generate",
  designId: "uuid",
  fileId: "uuid",
  storagePath: "path/to/file",
  fileType: "stl",
});

// Schedule job for later
await scheduleJob(
  { type: "design:publish", designId: "uuid" },
  new Date("2024-12-25T00:00:00Z")
);
```

**API Endpoints**:
- `GET /api/admin/jobs` - Queue statistics
- `POST /api/admin/jobs` - Add job to queue
- `GET /api/admin/jobs/[jobId]` - Get job status

**Requirements**: Redis (via `REDIS_URL` env var). Falls back gracefully when Redis unavailable.

### Feature Flags (`lib/feature-flags.ts`)

Runtime feature toggles stored in `config/ai-config.json`:

```typescript
import { isFavoritesEnabled, isCollectionsEnabled } from "@/lib/feature-flags";

if (await isFavoritesEnabled()) {
  // Show favorites UI
}
```

### Validation (`lib/validations.ts`)

Zod schemas for API validation:

- `browseDesignsSchema` - Browse query params
- `favoriteParamsSchema` - UUID validation
- `collectionParamsSchema` - UUID validation
- `createCollectionSchema` - Collection creation
- `escapeIlikePattern()` - SQL injection prevention

### Constants (`lib/constants.ts`)

Centralized application constants:

```typescript
import { STORAGE_BUCKETS, PAGINATION, TIMEOUTS } from "@/lib/constants";

// Storage buckets
STORAGE_BUCKETS.DESIGNS  // "designs"
STORAGE_BUCKETS.PREVIEWS // "previews"

// Pagination defaults
PAGINATION.DEFAULT_PAGE_SIZE // 30
PAGINATION.MAX_PAGE_SIZE     // 100

// Timeouts
TIMEOUTS.SIGNED_URL_SECONDS  // 3600 (1 hour)
```

### CDN Integration (`lib/cdn.ts`)

CDN URL rewriting and cache management:

```typescript
import { getCdnUrl, getCdnUrls, purgeCdnCache } from "@/lib/cdn";
import { getCdnCacheHeaders, getStaticAssetHeaders } from "@/lib/cdn";

// Rewrite storage URL to CDN URL (if enabled)
const cdnUrl = await getCdnUrl(storageUrl);

// Batch rewrite
const urlMap = await getCdnUrls([url1, url2, url3]);

// Purge cache
await purgeCdnCache([url1, url2]);

// Get cache headers
const headers = getCdnCacheHeaders(3600, 86400); // maxAge, staleWhileRevalidate
```

**Supported Providers**:
- `cloudflare` - Requires `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`
- `cloudfront` - Requires `CLOUDFRONT_DISTRIBUTION_ID`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `generic` - Basic URL rewriting without purge support

**API Endpoints**:
- `GET /api/admin/cdn` - CDN configuration status
- `POST /api/admin/cdn` - Purge URLs from cache

### Scheduled Publishing (`lib/scheduled-publishing.ts`)

Automatic publishing and unpublishing of designs based on scheduled times. Uses the database columns `publish_at` and `unpublish_at` on the designs table.

**Features**:
- Schedule designs to auto-publish at a future date
- Schedule designs to auto-unpublish (expire) at a future date
- Process scheduled designs via cron job or manual trigger
- Integrates with background job queue when Redis available

**Usage**:

```typescript
import {
  processScheduledPublishing,
  scheduleDesign,
  clearSchedule,
  getScheduledDesigns,
} from "@/lib/scheduled-publishing";

// Schedule a design to publish at a specific time
await scheduleDesign({
  designId: "uuid",
  publishAt: "2024-12-25T00:00:00Z",
  unpublishAt: "2025-01-01T00:00:00Z", // optional
});

// Process all due designs (call from cron)
const result = await processScheduledPublishing();
// { success: true, published: 2, unpublished: 1 }

// Get scheduled designs for admin dashboard
const scheduled = await getScheduledDesigns();
// { toPublish: [...], toUnpublish: [...] }
```

**API Endpoints**:
- `GET /api/admin/scheduled-publishing` - Get list of scheduled designs
- `POST /api/admin/scheduled-publishing` - Process scheduled designs (cron-safe)
- `PUT /api/admin/scheduled-publishing` - Schedule a design

**Cron Setup** (optional):
```bash
# Call every 5 minutes to process scheduled designs
curl -X POST https://your-app.com/api/admin/scheduled-publishing \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

Set `CRON_SECRET` in environment variables to allow cron access without admin auth.

### Webhooks (`lib/webhooks.ts`)

Event-driven webhook system for integrating with external services. Supports design lifecycle events.

**Supported Events**:
- `design.created` - When a new design is created
- `design.updated` - When a design is updated
- `design.published` - When a design is made public
- `design.unpublished` - When a design is made private
- `design.deleted` - When a design is deleted
- `import.started` - When a bulk import job starts
- `import.completed` - When a bulk import job completes
- `import.failed` - When a bulk import job fails

**Usage**:

```typescript
import {
  createWebhook,
  dispatchWebhookEvent,
  listWebhooks,
  getWebhookDeliveries,
} from "@/lib/webhooks";

// Create a webhook
await createWebhook({
  name: "My Integration",
  url: "https://example.com/webhook",
  events: ["design.created", "design.published"],
});

// Dispatch an event (to all subscribed webhooks)
await dispatchWebhookEvent("design.created", {
  id: "uuid",
  title: "New Design",
  slug: "new-design",
});
```

**Webhook Payload Format**:
```json
{
  "event": "design.created",
  "timestamp": "2024-12-09T00:00:00Z",
  "data": { "id": "...", "title": "...", "slug": "..." }
}
```

**Security**: Each webhook has a secret key. Deliveries include `X-Webhook-Signature` header with HMAC-SHA256 signature.

**API Endpoints**:
- `GET /api/admin/webhooks` - List webhooks and stats
- `POST /api/admin/webhooks` - Create webhook
- `GET /api/admin/webhooks/[id]` - Get webhook details and deliveries
- `PATCH /api/admin/webhooks/[id]` - Update webhook
- `DELETE /api/admin/webhooks/[id]` - Delete webhook
- `POST /api/admin/webhooks/[id]` - Test webhook

### Sitemap & Robots (`app/sitemap.ts`, `app/robots.ts`)

SEO-friendly sitemap and robots.txt generation using Next.js 15 metadata API.

**Sitemap** (`/sitemap.xml`):
- Includes all static pages (home, designs, login)
- Dynamically includes all public designs with last modified dates
- Feature flag controlled via `sitemapGeneration.enabled`
- Proper priority and changeFrequency hints for crawlers

**Robots.txt** (`/robots.txt`):
- Allows crawling of public pages
- Blocks API endpoints, admin, account, auth routes
- References sitemap location

**Configuration**:
Set `NEXT_PUBLIC_SITE_URL` environment variable for proper URL generation in production.

### Social Cards / OpenGraph (`app/api/og/[slug]`, `app/designs/[slug]/page.tsx`)

Dynamic social card images for design pages using Satori.

**Features**:
- Dynamic OG image generation per design
- Includes design title, description, preview image, badges (project type, difficulty, categories)
- Dark theme with branding
- Twitter card support

**How It Works**:
1. Design detail pages include `generateMetadata` function
2. OG images are generated on-demand at `/api/og/[slug]`
3. When shared on social media, platforms fetch the OG image URL
4. Feature flag controlled via `socialCards.enabled`

**Generated Image**:
- 1200x630 pixels (standard OG size)
- Dark background with design preview
- Title, description, and category badges
- "Download Now" call-to-action

### Error Messages (`lib/error-messages.ts`)

Standardized error messages for API responses:

```typescript
import { AUTH_ERRORS, NOT_FOUND_ERRORS, RATE_LIMIT_ERRORS } from "@/lib/error-messages";

// Usage
return NextResponse.json({ error: AUTH_ERRORS.AUTHENTICATION_REQUIRED }, { status: 401 });
return NextResponse.json({ error: NOT_FOUND_ERRORS.DESIGN }, { status: 404 });
return NextResponse.json({ error: RATE_LIMIT_ERRORS.TOO_MANY_REQUESTS }, { status: 429 });
```

### File Types (`lib/file-types.ts`)

File type utilities and constants:

```typescript
import {
  DESIGN_EXTENSIONS,
  IMAGE_EXTENSIONS,
  PRIMARY_FILE_PRIORITY,
  PREVIEW_FILE_PRIORITY,
  getMimeType,
  sortFilesByPriority,
  isDesignFile,
  isImageFile,
  is3DFormat,
} from "@/lib/file-types";

// Get MIME type for storage upload
const mimeType = getMimeType(".stl"); // "model/stl"

// Sort files by priority
const sorted = sortFilesByPriority(files, PRIMARY_FILE_PRIORITY);
```

### Rate Limiting (`lib/rate-limit.ts`)

In-memory rate limiter:

```typescript
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

const identifier = getClientIdentifier(request, user?.id);
const rateLimit = checkRateLimit(identifier, RATE_LIMITS.browse);

if (!rateLimit.success) {
  return NextResponse.json({ error: "Too many requests" }, { status: 429 });
}
```

**Presets**: browse (100/min), search (60/min), download (30/min), auth (10/min), admin (120/min), upload (20/min)

---

## UI Components

### shadcn/ui Components (`components/ui/`)

Pre-built: button, input, card, badge, select, skeleton, dialog, tabs, switch, slider, tooltip, collapsible, dropdown-menu, alert-dialog, checkbox, progress, label, textarea, separator, toast

### Custom Components

| Component | Description |
|-----------|-------------|
| `Header.tsx` | Navigation header with theme toggle |
| `Footer.tsx` | Site footer |
| `DesignCard.tsx` | Design thumbnail card with favorite button |
| `DesignFileList.tsx` | File list with download buttons |
| `DesignPreview.tsx` | Design preview with lightbox |
| `FilterBar.tsx` | Search and filter controls |
| `Pagination.tsx` | Page navigation |
| `FavoriteButton.tsx` | Heart toggle button |
| `AddToCollectionModal.tsx` | Collection picker dialog |
| `RelatedDesigns.tsx` | Similar designs grid |
| `ModelViewer.tsx` | Three.js 3D model viewer |
| `DownloadButton.tsx` | Download with login prompt |
| `ThemeProvider.tsx` | Dark mode provider |
| `ThemeToggle.tsx` | Dark/light mode switch |
| `AdminFileManager.tsx` | File management for admins |
| `DuplicateCard.tsx` | Duplicate resolution UI |
| `ImageLightbox.tsx` | Full-screen image viewer |

---

## Application Pages

### Public Pages

| Route | Description |
|-------|-------------|
| `/` | Homepage with hero and features |
| `/designs` | Browse all public designs |
| `/designs/[slug]` | Design detail page |
| `/login` | Login form |

### User Pages (authenticated)

| Route | Description |
|-------|-------------|
| `/account` | User profile |
| `/account/favorites` | User's favorited designs |
| `/account/collections` | User's collections |
| `/account/collections/[id]` | Collection detail |

### Admin Pages (admin role)

| Route | Description |
|-------|-------------|
| `/admin` | Dashboard with stats and charts |
| `/admin/designs` | Design management table |
| `/admin/designs/[id]` | Edit design |
| `/admin/upload` | Single file upload |
| `/admin/import` | Bulk import wizard |
| `/admin/import/jobs` | Import job list |
| `/admin/import/jobs/[jobId]` | Job detail/progress |
| `/admin/duplicates` | Duplicate detection |
| `/admin/ai-settings` | AI config and feature flags |
| `/admin/features` | Feature flag toggles |
| `/admin/users` | User management |

---

## Processing Options (Import)

Configurable settings for bulk imports:

```typescript
interface ProcessingOptions {
  // Core
  generate_previews: boolean;      // Generate preview images (default: true)
  generate_ai_metadata: boolean;   // Use AI for metadata (default: false)
  auto_publish: boolean;           // Make designs public (default: false)

  // Duplicate Detection
  detect_duplicates: boolean;      // Enable detection (default: true)
  near_duplicate_threshold: number; // 0-100% similarity (default: 85)
  exact_duplicates_only: boolean;  // Skip pHash comparison (default: false)

  // Project Detection
  enable_project_detection: boolean;       // Auto-group files (default: true)
  cross_folder_detection: boolean;         // Cross-folder grouping (default: true)
  project_confidence_threshold: number;    // 0-1 confidence (default: 0.7)

  // Performance
  concurrency: number;             // Parallel workers (default: 5)
  checkpoint_interval: number;     // Save every N files (default: 10)

  // Error Handling
  max_retries: number;             // Retry failed files (default: 3)
  skip_failed_files: boolean;      // Continue on failure (default: true)
}
```

---

## Configuration Files

### `config/ai-config.json`

Runtime configuration for AI and features:

```json
{
  "featureFlags": {
    "favorites": { "enabled": true, "maxPerUser": 500 },
    "collections": { "enabled": true, "maxPerUser": 50, "maxItemsPerCollection": 500 },
    "relatedDesigns": { "enabled": true, "maxSuggestions": 6, "similarityThreshold": 85 },
    "analyticsCharts": { "enabled": true },
    // ... more flags
  },
  "prompts": {
    "model3DSystem": { /* AI prompt config */ },
    "legacy2DSystem": { /* AI prompt config */ }
  },
  "tagVocabulary": {
    "categories": ["decorative", "functional", "artistic", ...],
    "techniques": ["laser cutting", "CNC routing", ...]
  },
  "displaySettings": {
    "defaultPageSize": 30,
    "maxPageSize": 100
  }
}
```

---

## Key Patterns

### Next.js 15 Async Params

```typescript
interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;  // Must await
  // ...
}
```

### File Operation Routes

```typescript
export const runtime = "nodejs";  // Required for fs operations
```

### Error Handling

API routes use consistent error responses:

```typescript
return NextResponse.json(
  { error: "Description of error" },
  { status: 400 }  // 400, 401, 403, 404, 429, 500
);
```

### Feature Flag Check

```typescript
if (!(await isFavoritesEnabled())) {
  return NextResponse.json(
    { error: "Favorites feature is disabled" },
    { status: 403 }
  );
}
```

---

## Testing

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Test files in `tests/` directory using Vitest.

---

## Deployment Notes

### Node.js Version
Requires Node.js 22 LTS (for canvas native module compatibility).

### Storage Buckets
Supabase storage buckets:
- `designs` - Design files
- `previews` - Preview images

### Important Considerations

1. **Service Client**: Background processors must use `createServiceClient()` (no cookies)
2. **File Size**: Large imports may require memory tuning
3. **Rate Limits**: In-memory, reset on server restart (use Redis for production scale)
4. **AI Costs**: AI metadata generation uses OpenAI API credits

---

## Common Tasks for Development

### Adding a New API Endpoint

1. Create `app/api/[path]/route.ts`
2. Add validation schema to `lib/validations.ts`
3. Add rate limiting if public
4. Check feature flag if feature-gated
5. Add to this documentation

### Adding a New Feature Flag

1. Add to `FeatureFlags` interface in `lib/ai-config.ts`
2. Add helper function in `lib/feature-flags.ts`
3. Add to `config/ai-config.json`
4. Check flag in relevant API routes and components

### Adding a New File Format

1. Create parser in `lib/parsers/[format]-parser.ts`
2. Export from `lib/parsers/index.ts`
3. Add preview support in `lib/preview-generator.ts`
4. Add extension to `lib/file-types.ts`

### Running a Database Migration

1. Create `supabase/migrations/00XX_description.sql`
2. Run `npm run db:migrate`
3. Regenerate types with `npm run db:types`

---

## Troubleshooting

### "Module not found" for parsers
Ensure imports use `@/lib/parsers` path alias.

### Preview generation fails
Check Node.js version (22 required for canvas).

### Import jobs fail with UUID error
Fixed in recent update - ensure `loadExistingHashes()` returns `Map<string, string>`.

### AI metadata not generating
Check `generate_ai_metadata` option is enabled and `AI_API_KEY` is set.

---

## Technical Debt & Planned Consolidation

### Phase 2 Complete: Foundation Files Created

The following centralized files have been created:

| File | Purpose | Status |
|------|---------|--------|
| `lib/constants.ts` | Storage buckets, pagination, timeouts | ✅ Created |
| `lib/error-messages.ts` | Centralized error message strings | ✅ Created |
| `lib/parsers/math-utils.ts` | Shared 3D math (Vector3, calculateNormal) | ✅ Created |
| `lib/file-types.ts` | Added priority constants, getMimeType, sortFilesByPriority | ✅ Updated |
| `lib/types.ts` | Added route param types (SlugRouteParams, IdRouteParams, etc.) | ✅ Updated |

### Remaining Work (Phase 3-4)

The following consolidation remains to be done in future sessions:

#### Update Existing Files to Use New Utilities

| File | Change Needed |
|------|---------------|
| `lib/import/project-detector.ts` | Import `PRIMARY_FILE_PRIORITY` from file-types.ts |
| `lib/import/job-processor.ts` | Import `getMimeType`, use `DESIGN_EXTENSIONS`/`IMAGE_EXTENSIONS` |
| `app/api/admin/upload/zip/route.ts` | Import priority constants and `sortFilesByPriority` |
| `app/api/admin/upload/project/route.ts` | Import priority constants and `sortFilesByPriority` |
| `app/api/admin/designs/ids/route.ts` | Import `escapeIlikePattern` from validations.ts |
| `lib/parsers/*.ts` | Import `Vector3`, `calculateNormal` from math-utils.ts |

#### Type Consolidation

| Type | Locations | Action |
|------|-----------|--------|
| `Design` interface | 4 components with local copies | Import from lib/types.ts |
| `RouteParams` | 31 API routes | Use new route param types |
| Upload types | 5+ files | Consider `lib/types/upload.ts` |

#### Error Message Migration

35+ error message occurrences across API routes can now use `lib/error-messages.ts`:
- "Too many requests. Please slow down." → `RATE_LIMIT_ERRORS.TOO_MANY_REQUESTS`
- "Design not found" → `NOT_FOUND_ERRORS.DESIGN`
- "{Feature} feature is disabled" → `featureDisabledError(feature)`
- "Collection not found or access denied" → `NOT_FOUND_ERRORS.COLLECTION`

---

## Contact & Resources

- **GitHub Issues**: Report bugs and feature requests
- **CLAUDE.md**: Quick reference for AI assistants
- **This document**: Comprehensive project reference

---

*Last updated: December 2024*
