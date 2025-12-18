# Supabase Docker Compose for Coolify

Self-contained Supabase stack pre-configured for Coolify deployment. Includes CORS, auth redirects, database initialization, and all required configuration files.

## Quick Start (3 Steps)

### Step 1: Replace Domain Placeholders

Search and replace these two placeholders in `docker-compose.yml` and `volumes/api/kong.yml`:

| Placeholder | Replace With | Example |
|-------------|--------------|---------|
| `YOUR_APP_DOMAIN` | Your Next.js app domain | `myapp.example.com` |
| `YOUR_SUPABASE_DOMAIN` | Kong domain (assigned by Coolify after first deploy) | `api-abc123.coolify.io` |

**Files to update:**
- `docker-compose.yml` - 5 occurrences (lines 106, 115, 116, 120)
- `volumes/api/kong.yml` - 1 occurrence (line 24)

### Step 2: Configure SMTP (Optional but Recommended)

In Coolify's environment variables, add:

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server | `smtp.resend.com` |
| `SMTP_PORT` | Port (usually 587) | `587` |
| `SMTP_USER` | SMTP username | `resend` |
| `SMTP_PASS` | SMTP password | `re_xxxxx` |
| `SMTP_SENDER_NAME` | From name | `My App` |
| `SMTP_ADMIN_EMAIL` | From email | `noreply@myapp.com` |

### Step 3: Deploy

1. In Coolify, create a new **Docker Compose** service
2. Upload/paste the contents of this directory
3. Deploy and note your assigned Kong URL
4. Update `YOUR_SUPABASE_DOMAIN` with the actual URL
5. Redeploy

That's it! No need to copy additional SQL files or configuration.

---

## What's Included

### Pre-Configured Database
- All Supabase schemas, roles, and extensions
- `public.users` table synced from `auth.users` via trigger
- RLS policies for user data access
- Helper functions: `is_admin()`, `is_super_admin()`

### CORS & Auth
- Kong gateway with global CORS for your app domain
- GoTrue configured for email verification redirects
- Proper callback URL handling

### Edge Functions
- Ready-to-use function templates
- Hello world example at `/functions/v1/hello`

### Storage
- MinIO S3-compatible storage
- Automatic bucket creation
- Image transformation via imgproxy

---

## File Structure

```
supabase-coolify/
├── docker-compose.yml              # Main compose file
├── README.md                       # This file
├── entrypoint.sh                   # MinIO bucket setup
└── volumes/
    ├── api/
    │   └── kong.yml                # Kong routes + CORS config
    ├── db/
    │   ├── 00-init-scripts.sql     # Core Supabase setup
    │   └── 01-init-users.sql       # App users table + trigger
    ├── functions/
    │   ├── main/index.ts           # Edge function router
    │   └── hello/index.ts          # Example function
    ├── logs/
    │   └── vector.yml              # Log aggregation
    ├── pooler/
    │   └── pooler.exs              # Connection pooler config
    └── storage/                    # Storage data directory
```

---

## Auto-Generated Variables

Coolify automatically generates these (do not set manually):

- `SERVICE_PASSWORD_JWT` - JWT secret
- `SERVICE_PASSWORD_POSTGRES` - Database password
- `SERVICE_SUPABASEANON_KEY` - Anon API key
- `SERVICE_SUPABASESERVICE_KEY` - Service role key
- `SERVICE_USER_ADMIN` / `SERVICE_PASSWORD_ADMIN` - Studio credentials
- `SERVICE_USER_MINIO` / `SERVICE_PASSWORD_MINIO` - Storage credentials

---

## Next.js App Configuration

Add these to your Next.js `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-kong-url.coolify.domain
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
NEXT_PUBLIC_SITE_URL=https://your-app.domain
```

**Important:** Set `NEXT_PUBLIC_SITE_URL` to ensure auth callbacks redirect correctly.

---

## Troubleshooting

### CORS Errors
1. Verify `kong.yml` has your exact app domain (with `https://`)
2. Restart the Kong container after changes

### Emails Not Sending
1. Verify SMTP port is 587 (not 993)
2. Check Auth container logs: `docker logs supabase-auth`

### Redirect to Wrong URL After Verification
1. Ensure `NEXT_PUBLIC_SITE_URL` is set in your Next.js app
2. Ensure `GOTRUE_SITE_URL` matches your app domain
3. Ensure `GOTRUE_MAILER_EXTERNAL_HOSTS` includes both domains

### Users Not in public.users Table
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Manually sync existing users if needed
INSERT INTO public.users (id, email, name, role, status)
SELECT id, email, raw_user_meta_data->>'name', 'user', 'active'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

---

## Full Documentation

See [COOLIFY_SUPABASE_SETUP.md](../COOLIFY_SUPABASE_SETUP.md) for detailed step-by-step instructions and explanations.
