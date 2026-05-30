import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data, error } = await supabase.from('collection_meta').select('*');
  console.log('meta:', data, error);
  const { data: regs, error: rErr } = await supabase.from('documents').select('id,collection').eq('collection', 'registrations');
  console.log('regs count:', regs?.length, rErr);
}
run();
