#!/usr/bin/env node
/**
 * Seed initial tags
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const tags = [
  'dragon', 'mandala', 'geometric', 'floral', 'animal',
  'holiday', 'christmas', 'halloween', 'mechanical', 'puzzle',
  'coaster', 'sign', 'ornament', 'box', 'art',
  'celtic', 'tribal', 'nature', 'abstract', 'vintage'
];

async function seedTags() {
  console.log('🌱 Seeding tags...\n');

  for (const name of tags) {
    const { error } = await supabase
      .from('tags')
      .upsert({ name }, { onConflict: 'name' });

    if (error) {
      console.log(`   ❌ ${name}: ${error.message}`);
    } else {
      console.log(`   ✅ ${name}`);
    }
  }

  console.log('\n✅ Tags seeded successfully!');
}

seedTags().catch(console.error);
