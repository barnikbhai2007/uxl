import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://ygrmdlbyfrbqhzvvfmii.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_taKejserySOg3UGPlk0h-w_7tWsZDiN'
);

async function testUpdate() {
  const id = 'test-id';
  const collectionName = 'registrations';
  
  // insert
  await supabase.from("documents").upsert({
    id, collection: collectionName, data: { status: 'pending', name: 'Joe' }
  });
  
  console.log("Inserted");
  
  // try to update
  const { data: existing, error: fetchErr } = await supabase
    .from("documents")
    .select("data")
    .eq("collection", collectionName)
    .eq("id", id)
    .single();
    
  console.log("Existing:", existing, fetchErr);
  
  // update
  const { error: updateErr } = await supabase
      .from("documents")
      .update({ data: { ...existing.data, status: 'approved' } })
      .eq("collection", collectionName)
      .eq("id", id);
      
  console.log("Update err:", updateErr);
  
  const { data: final } = await supabase.from("documents").select("data").eq("id", id).single();
  console.log("Final:", final);
}
testUpdate();
