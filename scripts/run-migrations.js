#!/usr/bin/env node
/**
 * Database Migration Script
 * Runs SQL migrations against Supabase using the service role key
 *
 * Usage: node scripts/run-migrations.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function runMigration(filePath, fileName) {
  console.log(`\n📄 Running migration: ${fileName}`);

  const sql = readFileSync(filePath, 'utf-8');

  // Split by semicolons but be careful with functions that contain semicolons
  // We'll run the whole file as one statement using rpc if available,
  // or fall back to individual statements

  const { error } = await supabase.rpc('exec_sql', { sql_string: sql }).single();

  if (error) {
    // If exec_sql doesn't exist, we need to inform the user
    if (error.message.includes('function') || error.code === '42883') {
      console.log(`   ⚠️  Cannot run SQL directly via API.`);
      console.log(`   Please run this migration manually in Supabase Studio SQL Editor:`);
      console.log(`   ${filePath}`);
      return false;
    }
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }

  console.log(`   ✅ Success`);
  return true;
}

async function checkConnection() {
  console.log('🔌 Checking Supabase connection...');

  const { data, error } = await supabase.from('_migrations_check').select('*').limit(1);

  // We expect this to fail (table doesn't exist), but it confirms connectivity
  if (error && !error.message.includes('does not exist') && !error.message.includes('permission denied')) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }

  console.log('✅ Connected to Supabase');
  return true;
}

async function main() {
  console.log('🚀 CNC Design Library - Database Migration\n');
  console.log(`Supabase URL: ${supabaseUrl}`);

  const connected = await checkConnection();
  if (!connected) {
    process.exit(1);
  }

  const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`\nFound ${files.length} migration files:`);
  files.forEach(f => console.log(`  - ${f}`));

  console.log('\n' + '='.repeat(50));
  console.log('⚠️  IMPORTANT: Migrations must be run in Supabase Studio');
  console.log('='.repeat(50));
  console.log('\nThe Supabase client API cannot execute DDL statements directly.');
  console.log('Please run the following SQL files in order using Supabase Studio:');
  console.log('\n1. Go to your Supabase Dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Run each file in order:\n');

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    console.log(`   📄 ${file}`);
    console.log(`      Path: ${filePath}`);
  }

  console.log('\n4. After migrations, run the seed file (optional):');
  console.log(`   📄 supabase/seed.sql`);

  console.log('\n' + '='.repeat(50));
  console.log('Alternatively, copy the SQL content below to run all at once:');
  console.log('='.repeat(50) + '\n');

  // Output combined SQL for easy copy-paste
  let combinedSql = '';
  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');
    combinedSql += `-- ========================================\n`;
    combinedSql += `-- ${file}\n`;
    combinedSql += `-- ========================================\n\n`;
    combinedSql += sql + '\n\n';
  }

  // Write combined SQL to a file
  const combinedPath = join(__dirname, '..', 'supabase', 'combined-migrations.sql');
  const { writeFileSync } = await import('fs');
  writeFileSync(combinedPath, combinedSql);

  console.log(`✅ Combined migrations written to: supabase/combined-migrations.sql`);
  console.log('\nYou can copy this entire file into Supabase Studio SQL Editor.');
}

main().catch(console.error);
