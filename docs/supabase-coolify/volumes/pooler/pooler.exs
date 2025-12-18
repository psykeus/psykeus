# =============================================================================
# Supavisor Connection Pooler Configuration
# =============================================================================
# Configures connection pooling for PostgreSQL with dev_tenant
# =============================================================================

tenant_id = System.get_env("POOLER_TENANT_ID", "dev_tenant")
postgres_host = System.get_env("POSTGRES_HOSTNAME", "supabase-db")
postgres_port = String.to_integer(System.get_env("POSTGRES_PORT", "5432"))
postgres_db = System.get_env("POSTGRES_DB", "postgres")
postgres_password = System.get_env("POSTGRES_PASSWORD")

pool_mode = System.get_env("POOLER_POOL_MODE", "transaction")
default_pool_size = String.to_integer(System.get_env("POOLER_DEFAULT_POOL_SIZE", "20"))
max_client_conn = String.to_integer(System.get_env("POOLER_MAX_CLIENT_CONN", "100"))

# Tenant configuration for the connection pooler
Supavisor.Tenants.create_tenant(%{
  "external_id" => tenant_id,
  "db_host" => postgres_host,
  "db_port" => postgres_port,
  "db_database" => postgres_db,
  "require_user" => false,
  "auth_query" => "SELECT rolname, rolpassword FROM pg_authid WHERE rolname=$1",
  "default_pool_size" => default_pool_size,
  "max_client_conn" => max_client_conn,
  "default_max_clients" => 200,
  "sni_hostname" => nil,
  "upstream_ssl" => false,
  "enforce_ssl" => false,
  "ip_version" => "auto",
  "upstream_verify" => "none",
  "upstream_tls_ca" => nil,
  "users" => [
    %{
      "db_user" => "postgres",
      "db_password" => postgres_password,
      "pool_size" => default_pool_size,
      "mode_type" => pool_mode,
      "pool_checkout_timeout" => 60000,
      "is_manager" => true
    },
    %{
      "db_user" => "anon",
      "db_password" => postgres_password,
      "pool_size" => default_pool_size,
      "mode_type" => pool_mode,
      "pool_checkout_timeout" => 60000,
      "is_manager" => false
    },
    %{
      "db_user" => "authenticated",
      "db_password" => postgres_password,
      "pool_size" => default_pool_size,
      "mode_type" => pool_mode,
      "pool_checkout_timeout" => 60000,
      "is_manager" => false
    },
    %{
      "db_user" => "service_role",
      "db_password" => postgres_password,
      "pool_size" => default_pool_size,
      "mode_type" => pool_mode,
      "pool_checkout_timeout" => 60000,
      "is_manager" => false
    }
  ]
})
