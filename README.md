# CNC Design Library

A self-hosted platform for browsing, previewing, and downloading CNC and laser cutting designs.

## Tech Stack

- **Frontend/Backend:** Next.js 15 (App Router, TypeScript)
- **Database/Auth/Storage:** Supabase (self-hosted on Hetzner via Coolify)
- **Styling:** Tailwind CSS
- **Ingestion:** Python script with AI-powered metadata generation

## Getting Started

### Prerequisites

- **Node.js 22+** (LTS recommended)
- Python 3.10+
- Self-hosted Supabase instance

### Node.js Setup

This project requires Node.js 22+. We recommend using [fnm](https://github.com/Schniz/fnm) for version management:

```bash
# Install fnm
curl -fsSL https://fnm.vercel.app/install | bash

# Restart terminal or source your shell config, then:
fnm install 22
fnm use 22

# The .node-version file will auto-switch when entering the project directory
```

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials and AI API key.

3. Run database migrations:

Apply the SQL migrations in `supabase/migrations/` to your Supabase instance in order:
- `0001_init.sql` - Creates tables
- `0002_rls.sql` - Sets up Row Level Security
- `0003_functions.sql` - Creates helper functions
- `0004_storage.sql` - Configures storage buckets

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── admin/             # Admin dashboard
│   ├── designs/           # Design browsing & detail
│   ├── login/             # Authentication
│   └── account/           # User account
├── components/            # React components
├── lib/                   # Utilities and clients
│   ├── supabase/         # Supabase client setup
│   ├── auth.ts           # Auth helpers
│   ├── types.ts          # TypeScript types
│   └── utils.ts          # Utility functions
├── scripts/              # Python ingestion script
└── supabase/             # Database migrations
```

## Design Ingestion

The Python script in `scripts/ingest_designs.py` handles:

- Scanning directories for design files
- Duplicate detection via SHA-256 hash
- Version tracking for updated files
- AI-powered metadata extraction
- Preview generation
- Upload to Supabase Storage

### Setup

```bash
cd scripts
pip install -r requirements.txt
```

### Usage

```bash
python ingest_designs.py /path/to/your/designs
```

## User Roles

- **Anonymous:** Browse and search designs
- **User:** Download designs, view history
- **Admin:** Manage designs, review duplicates
- **Super Admin:** Manage users and admins

## API Endpoints

### Public
- `GET /api/designs` - List designs with filtering
- `GET /api/designs/[slug]` - Get design details

### Authenticated
- `POST /api/download/[designId]` - Download a design
- `GET /api/me/downloads` - User's download history

### Admin
- `GET/POST /api/admin/designs` - List/create designs
- `PATCH/DELETE /api/admin/designs/[id]` - Update/delete design
- `GET/POST /api/admin/designs/[id]/versions` - Manage versions
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/duplicates` - Review near-duplicates

## License

Private - All rights reserved.
# cnc-designs
# psykeus
