import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ygrmdlbyfrbqhzvvfmii.supabase.co';
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_taKejserySOg3UGPlk0h-w_7tWsZDiN';

export const supabase = createClient(supabaseUrl, supabaseKey);
