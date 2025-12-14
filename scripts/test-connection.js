#!/usr/bin/env node
/**
 * Test Supabase Connection and Database Setup
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function testConnection() {
  console.log('🔍 Testing CNC Design Library Setup\n');
  console.log(`Supabase URL: ${supabaseUrl}\n`);

  const tests = [];

  // Test 1: Users table
  console.log('1️⃣  Testing users table...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, role')
    .limit(5);

  if (usersError) {
    console.log(`   ❌ Error: ${usersError.message}`);
    tests.push({ name: 'users', pass: false });
  } else {
    console.log(`   ✅ Found ${users.length} user(s)`);
    users.forEach(u => console.log(`      - ${u.email} (${u.role})`));
    tests.push({ name: 'users', pass: true });
  }

  // Test 2: Designs table
  console.log('\n2️⃣  Testing designs table...');
  const { data: designs, error: designsError } = await supabase
    .from('designs')
    .select('id, title')
    .limit(5);

  if (designsError) {
    console.log(`   ❌ Error: ${designsError.message}`);
    tests.push({ name: 'designs', pass: false });
  } else {
    console.log(`   ✅ Found ${designs.length} design(s)`);
    tests.push({ name: 'designs', pass: true });
  }

  // Test 3: Tags table
  console.log('\n3️⃣  Testing tags table...');
  const { data: tags, error: tagsError } = await supabase
    .from('tags')
    .select('id, name')
    .limit(10);

  if (tagsError) {
    console.log(`   ❌ Error: ${tagsError.message}`);
    tests.push({ name: 'tags', pass: false });
  } else {
    console.log(`   ✅ Found ${tags.length} tag(s)`);
    if (tags.length > 0) {
      console.log(`      Tags: ${tags.map(t => t.name).join(', ')}`);
    }
    tests.push({ name: 'tags', pass: true });
  }

  // Test 4: Design files table
  console.log('\n4️⃣  Testing design_files table...');
  const { data: files, error: filesError } = await supabase
    .from('design_files')
    .select('id')
    .limit(1);

  if (filesError) {
    console.log(`   ❌ Error: ${filesError.message}`);
    tests.push({ name: 'design_files', pass: false });
  } else {
    console.log(`   ✅ Table accessible (${files.length} file(s))`);
    tests.push({ name: 'design_files', pass: true });
  }

  // Test 5: Downloads table
  console.log('\n5️⃣  Testing downloads table...');
  const { data: downloads, error: downloadsError } = await supabase
    .from('downloads')
    .select('id')
    .limit(1);

  if (downloadsError) {
    console.log(`   ❌ Error: ${downloadsError.message}`);
    tests.push({ name: 'downloads', pass: false });
  } else {
    console.log(`   ✅ Table accessible (${downloads.length} download(s))`);
    tests.push({ name: 'downloads', pass: true });
  }

  // Test 6: Storage buckets
  console.log('\n6️⃣  Testing storage buckets...');
  const { data: buckets, error: bucketsError } = await supabase
    .storage
    .listBuckets();

  if (bucketsError) {
    console.log(`   ❌ Error: ${bucketsError.message}`);
    tests.push({ name: 'storage', pass: false });
  } else {
    const bucketNames = buckets.map(b => b.name);
    console.log(`   ✅ Found ${buckets.length} bucket(s): ${bucketNames.join(', ')}`);

    const hasDesigns = bucketNames.includes('designs');
    const hasPreviews = bucketNames.includes('previews');

    if (!hasDesigns) console.log(`   ⚠️  Missing 'designs' bucket`);
    if (!hasPreviews) console.log(`   ⚠️  Missing 'previews' bucket`);

    tests.push({ name: 'storage', pass: hasDesigns && hasPreviews });
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));

  const passed = tests.filter(t => t.pass).length;
  const failed = tests.filter(t => !t.pass).length;

  tests.forEach(t => {
    console.log(`   ${t.pass ? '✅' : '❌'} ${t.name}`);
  });

  console.log(`\nPassed: ${passed}/${tests.length}`);

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  } else {
    console.log('\n🎉 All tests passed! Your setup is ready.');
  }
}

testConnection().catch(console.error);
