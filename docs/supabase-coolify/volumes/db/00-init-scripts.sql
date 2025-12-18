-- =============================================================================
-- Supabase Database Initialization Script
-- =============================================================================
-- This comprehensive script initializes all required Supabase database objects.
-- It runs automatically when the database container is first created.
--
-- Order matters! Scripts are executed alphabetically, so this runs first (00-).
-- =============================================================================

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA graphql;
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA net;
CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA pgsodium;
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA vault;

-- =============================================================================
-- 2. SCHEMAS
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS _realtime;
CREATE SCHEMA IF NOT EXISTS graphql;
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE SCHEMA IF NOT EXISTS net;
CREATE SCHEMA IF NOT EXISTS pgsodium;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE SCHEMA IF NOT EXISTS supabase_functions;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE SCHEMA IF NOT EXISTS _supabase;

-- =============================================================================
-- 3. ROLES
-- =============================================================================

-- Create roles if they don't exist
DO $$
BEGIN
    -- Anon role (unauthenticated requests)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;

    -- Authenticated role (authenticated requests)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;

    -- Service role (server-side, bypasses RLS)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;

    -- Supabase auth admin
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT CREATEROLE CREATEDB;
    END IF;

    -- Supabase storage admin
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT;
    END IF;

    -- Supabase realtime admin
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
        CREATE ROLE supabase_realtime_admin NOLOGIN NOINHERIT;
    END IF;

    -- Supabase admin (full access)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin NOLOGIN NOINHERIT BYPASSRLS;
    END IF;

    -- Dashboard user
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dashboard_user') THEN
        CREATE ROLE dashboard_user NOLOGIN NOINHERIT;
    END IF;

    -- Authenticator role (PostgREST uses this)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator NOLOGIN NOINHERIT;
    END IF;

    -- Supabase functions admin
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
        CREATE ROLE supabase_functions_admin NOLOGIN NOINHERIT;
    END IF;

    -- Postgres role grants
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pgsodium_keyholder') THEN
        CREATE ROLE pgsodium_keyholder NOLOGIN NOINHERIT;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pgsodium_keyiduser') THEN
        CREATE ROLE pgsodium_keyiduser NOLOGIN NOINHERIT;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pgsodium_keymaker') THEN
        CREATE ROLE pgsodium_keymaker NOLOGIN NOINHERIT;
    END IF;
END
$$;

-- Grant role memberships
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_admin TO authenticator;

GRANT supabase_auth_admin TO postgres;
GRANT supabase_storage_admin TO postgres;
GRANT supabase_realtime_admin TO postgres;
GRANT supabase_functions_admin TO postgres;

-- =============================================================================
-- 4. SCHEMA PERMISSIONS
-- =============================================================================

-- Public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, supabase_admin;

-- Auth schema
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin, service_role, dashboard_user;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;

-- Storage schema
GRANT USAGE ON SCHEMA storage TO supabase_storage_admin, service_role, authenticated, anon;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

-- Realtime schemas
GRANT USAGE ON SCHEMA realtime TO supabase_realtime_admin, service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;
GRANT USAGE ON SCHEMA _realtime TO supabase_realtime_admin;
GRANT ALL ON SCHEMA _realtime TO supabase_realtime_admin;

-- GraphQL schemas
GRANT USAGE ON SCHEMA graphql TO service_role, authenticated, anon;
GRANT USAGE ON SCHEMA graphql_public TO service_role, authenticated, anon;

-- Extensions schema
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- Supabase functions schema
GRANT USAGE ON SCHEMA supabase_functions TO service_role;
GRANT ALL ON SCHEMA supabase_functions TO supabase_functions_admin;

-- =============================================================================
-- 5. JWT FUNCTIONS
-- =============================================================================

-- Function to get the current user's JWT claims
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb
$$;

-- Function to get the current user's role from JWT
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (SELECT rolname FROM pg_roles WHERE oid = (SELECT current_user::regrole::oid))
  )::text
$$;

-- Function to get the current user's ID from JWT
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- Function to get the current user's email from JWT
CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

-- Grant execute to relevant roles
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.email() TO anon, authenticated, service_role;

-- =============================================================================
-- 6. AUTH SCHEMA CORE TABLES
-- =============================================================================

-- Users table (core auth table - GoTrue manages this)
CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aud character varying(255),
    role character varying(255),
    email character varying(255) UNIQUE,
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text UNIQUE DEFAULT NULL,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT '',
    phone_change_token character varying(255) DEFAULT '',
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT '',
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT '',
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false
);

-- Indexes for auth.users
CREATE INDEX IF NOT EXISTS users_instance_id_idx ON auth.users (instance_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users (email);
CREATE INDEX IF NOT EXISTS users_is_anonymous_idx ON auth.users (is_anonymous);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    instance_id uuid,
    id bigserial PRIMARY KEY,
    token character varying(255),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);

CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON auth.refresh_tokens (token);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON auth.refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_session_id_idx ON auth.refresh_tokens (session_id);

-- Sessions table
CREATE TABLE IF NOT EXISTS auth.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal text,
    not_after timestamp with time zone,
    refreshed_at timestamp with time zone,
    user_agent text,
    ip text,
    tag text
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_not_after_idx ON auth.sessions (not_after);

-- Identities table (for OAuth providers)
CREATE TABLE IF NOT EXISTS auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    CONSTRAINT identities_pkey PRIMARY KEY (id),
    CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider)
);

CREATE INDEX IF NOT EXISTS identities_user_id_idx ON auth.identities (user_id);
CREATE INDEX IF NOT EXISTS identities_email_idx ON auth.identities (email);

-- MFA factors table
CREATE TABLE IF NOT EXISTS auth.mfa_factors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friendly_name text,
    factor_type text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS mfa_factors_user_id_idx ON auth.mfa_factors (user_id);

-- MFA challenges table
CREATE TABLE IF NOT EXISTS auth.mfa_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    factor_id uuid NOT NULL REFERENCES auth.mfa_factors(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text
);

CREATE INDEX IF NOT EXISTS mfa_challenges_factor_id_idx ON auth.mfa_challenges (factor_id);

-- Audit log table
CREATE TABLE IF NOT EXISTS auth.audit_log_entries (
    instance_id uuid,
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payload jsonb,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''
);

CREATE INDEX IF NOT EXISTS audit_log_entries_instance_id_idx ON auth.audit_log_entries (instance_id);

-- Schema migrations tracking
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version character varying(255) PRIMARY KEY
);

-- SSO Providers
CREATE TABLE IF NOT EXISTS auth.sso_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

-- SSO Domains
CREATE TABLE IF NOT EXISTS auth.sso_domains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sso_provider_id uuid REFERENCES auth.sso_providers(id) ON DELETE CASCADE,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

-- SAML Providers
CREATE TABLE IF NOT EXISTS auth.saml_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sso_provider_id uuid REFERENCES auth.sso_providers(id) ON DELETE CASCADE,
    entity_id text UNIQUE NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text
);

-- SAML Relay States
CREATE TABLE IF NOT EXISTS auth.saml_relay_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sso_provider_id uuid REFERENCES auth.sso_providers(id) ON DELETE CASCADE,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid
);

-- Flow state table
CREATE TABLE IF NOT EXISTS auth.flow_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method text NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS flow_state_created_at_idx ON auth.flow_state (created_at);

-- One-time tokens table
CREATE TABLE IF NOT EXISTS auth.one_time_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_type text NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS one_time_tokens_token_hash_idx ON auth.one_time_tokens (token_hash);
CREATE INDEX IF NOT EXISTS one_time_tokens_user_id_idx ON auth.one_time_tokens (user_id);

-- Grant permissions on auth tables
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO dashboard_user;

-- =============================================================================
-- 7. STORAGE SCHEMA
-- =============================================================================

-- Buckets table
CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL UNIQUE,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text
);

-- Objects table
CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets(id),
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    CONSTRAINT objects_bucketid_name_unique UNIQUE (bucket_id, name)
);

CREATE INDEX IF NOT EXISTS objects_bucket_id_idx ON storage.objects (bucket_id);
CREATE INDEX IF NOT EXISTS objects_name_idx ON storage.objects (name);
CREATE INDEX IF NOT EXISTS objects_owner_idx ON storage.objects (owner);

-- S3 Multipart uploads table
CREATE TABLE IF NOT EXISTS storage.s3_multipart_uploads (
    id text PRIMARY KEY,
    in_progress_size bigint DEFAULT 0,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL REFERENCES storage.buckets(id),
    key text NOT NULL,
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now()
);

-- S3 Multipart upload parts table
CREATE TABLE IF NOT EXISTS storage.s3_multipart_uploads_parts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id text NOT NULL REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE,
    size bigint DEFAULT 0,
    part_number integer NOT NULL,
    bucket_id text NOT NULL REFERENCES storage.buckets(id),
    key text NOT NULL,
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Storage migrations tracking
CREATE TABLE IF NOT EXISTS storage.migrations (
    id integer PRIMARY KEY,
    name character varying(100) NOT NULL UNIQUE,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Grant permissions on storage tables
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;

-- Storage RLS
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 8. REALTIME SCHEMA
-- =============================================================================

-- Realtime schema migrations tracking
CREATE TABLE IF NOT EXISTS realtime.schema_migrations (
    version bigint PRIMARY KEY,
    inserted_at timestamp(0) without time zone
);

-- Realtime subscriptions
CREATE TABLE IF NOT EXISTS realtime.subscription (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters jsonb[] DEFAULT '{}' NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS ((claims ->> 'role'::text)::regrole) STORED,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS subscription_subscription_id_idx ON realtime.subscription (subscription_id);
CREATE INDEX IF NOT EXISTS subscription_entity_idx ON realtime.subscription (entity);

-- Grant permissions on realtime
GRANT ALL ON ALL TABLES IN SCHEMA realtime TO supabase_realtime_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA realtime TO supabase_realtime_admin;
GRANT USAGE ON SCHEMA realtime TO authenticated;

-- =============================================================================
-- 9. SUPABASE FUNCTIONS SCHEMA
-- =============================================================================

-- Functions migrations tracking
CREATE TABLE IF NOT EXISTS supabase_functions.migrations (
    version text PRIMARY KEY,
    inserted_at timestamp with time zone DEFAULT now()
);

-- Hooks for edge functions
CREATE TABLE IF NOT EXISTS supabase_functions.hooks (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hook_table_id integer NOT NULL,
    hook_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    request_id bigint
);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA supabase_functions TO supabase_functions_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA supabase_functions TO supabase_functions_admin;

-- =============================================================================
-- 10. DEFAULT PERMISSIONS FOR FUTURE OBJECTS
-- =============================================================================

-- Public schema defaults
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO postgres, supabase_admin, authenticated, anon;

-- Auth schema defaults
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;

-- Storage schema defaults
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_storage_admin;

-- =============================================================================
-- 11. UTILITY FUNCTIONS
-- =============================================================================

-- Function to check if a schema exists
CREATE OR REPLACE FUNCTION public.schema_exists(schema_name text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
    );
END;
$$;

-- Function to check if a table exists
CREATE OR REPLACE FUNCTION public.table_exists(table_schema text, table_name text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.schema_exists(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.table_exists(text, text) TO authenticated, anon, service_role;

-- =============================================================================
-- COMPLETE
-- =============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Supabase database initialization completed successfully.';
END
$$;
