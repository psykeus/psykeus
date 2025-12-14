#!/usr/bin/env node
/**
 * Create Initial Super Admin User
 *
 * Usage: node scripts/create-admin.js <email> <password>
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node scripts/create-admin.js <email> <password>');
  console.log('Example: node scripts/create-admin.js admin@example.com MySecurePassword123');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function createSuperAdmin() {
  console.log('🚀 Creating Super Admin User\n');
  console.log(`Email: ${email}`);
  console.log(`Supabase: ${supabaseUrl}\n`);

  // Step 1: Create the auth user using admin API
  console.log('1️⃣  Creating auth user...');

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('   ⚠️  User already exists in auth, fetching...');

      // Get existing user
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingUser = users?.users?.find(u => u.email === email);

      if (existingUser) {
        console.log(`   Found existing user: ${existingUser.id}`);
        await updateUserRole(existingUser.id);
        return;
      }
    }
    console.error('   ❌ Auth error:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`   ✅ Auth user created: ${userId}`);

  // Step 2: Create/update the public.users record
  await updateUserRole(userId);
}

async function updateUserRole(userId) {
  console.log('\n2️⃣  Setting up public.users record...');

  // Check if user exists in public.users
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (existingUser) {
    // Update existing user to super_admin
    const { error: updateError } = await supabase
      .from('users')
      .update({ role: 'super_admin' })
      .eq('id', userId);

    if (updateError) {
      console.error('   ❌ Update error:', updateError.message);
      process.exit(1);
    }
    console.log('   ✅ Updated existing user to super_admin');
  } else {
    // Insert new user record
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        role: 'super_admin',
      });

    if (insertError) {
      console.error('   ❌ Insert error:', insertError.message);
      process.exit(1);
    }
    console.log('   ✅ Created user record with super_admin role');
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Super Admin Created Successfully!');
  console.log('='.repeat(50));
  console.log(`\nEmail: ${email}`);
  console.log('Role: super_admin');
  console.log('\nYou can now log in to the application.');
}

createSuperAdmin().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
