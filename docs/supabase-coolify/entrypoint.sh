#!/bin/sh
# =============================================================================
# MinIO Bucket Creation Entrypoint
# =============================================================================
# This script creates the required storage bucket in MinIO on first startup.
# =============================================================================

set -e

echo "Configuring MinIO client..."
mc alias set supabase http://supabase-minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"

echo "Creating 'stub' bucket..."
mc mb supabase/stub --ignore-existing

echo "Setting bucket policy to allow authenticated access..."
mc anonymous set download supabase/stub

echo "MinIO bucket setup complete."
