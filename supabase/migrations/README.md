# Supabase Migrations

**Last Updated:** 2025-12-29
**AI Model:** Claude Opus 4.5 (claude-opus-4-5-20251101)

## Migration Ordering

Migrations are applied in lexicographical order by filename. Each migration should have a unique sequence number prefix (e.g., `0001_`, `0002_`).

## Known Issues

### Duplicate Migration Numbers (0010, 0011)

The following migrations share the same sequence number:

| Number | File | Purpose |
|--------|------|---------|
| 0010 | `0010_performance_optimizations.sql` | Performance indexes (with CONCURRENTLY) |
| 0010 | `0010_performance_optimizations_studio.sql` | Same indexes (without CONCURRENTLY for Studio) |
| 0011 | `0011_import_logs.sql` | Import logging system |
| 0011 | `0011_session_expiration.sql` | Session expiration logic |

**Why not rename?** Renumbering existing migrations risks breaking deployed environments that have already applied these migrations. The `schema_migrations` table tracks applied migrations by filename.

**Impact:** In fresh deployments, files with the same prefix are applied in full lexicographical order:
- `0010_performance_optimizations.sql` before `0010_performance_optimizations_studio.sql`
- `0011_import_logs.sql` before `0011_session_expiration.sql`

This order happens to work correctly because the `_studio` variant is a fallback and `session_expiration` doesn't depend on `import_logs`.

### Future Migrations

All new migrations should start from `0032` or higher to avoid any ambiguity.

## Migration Guidelines

1. **Naming:** Use format `NNNN_descriptive_name.sql` (e.g., `0032_add_feature.sql`)
2. **Idempotency:** Use `IF NOT EXISTS` / `IF EXISTS` clauses where possible
3. **Security:** All functions should use `SET search_path = ''` for security
4. **RLS:** New tables should enable RLS and define appropriate policies
5. **Indexes:** Use `CREATE INDEX CONCURRENTLY` for production (but not in Supabase Studio)

## Key Tables

| Table | Migration | Purpose |
|-------|-----------|---------|
| `users` | 0001 | User accounts and profiles |
| `designs` | 0001 | Design metadata |
| `design_files` | 0001 | Files associated with designs |
| `downloads` | 0001 | Download tracking |
| `access_tiers` | 0013 | Subscription tiers |
| `import_jobs` | 0007 | Bulk import job tracking |
| `import_items` | 0007 | Individual files in import jobs |
| `import_logs` | 0011 | Detailed import processing logs |
| `notifications` | 0019 | User notifications |

## Testing Migrations

Before applying to production:
1. Test on a local Supabase instance
2. Verify RLS policies work correctly
3. Check that indexes don't cause performance issues during creation
