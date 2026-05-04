-- Run this in your Supabase SQL Editor to complete the migration!

CREATE TABLE public.documents (
  id TEXT NOT NULL,
  collection TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (collection, id)
);

-- Enable RLS to prevent abuse
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.documents
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete" ON public.documents
  FOR DELETE TO authenticated USING (true);

CREATE TABLE news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  content TEXT,
  category TEXT,
  matchday INT,
  created_at TIMESTAMP DEFAULT now(),
  triggered_by TEXT
);
CREATE INDEX idx_documents_collection ON public.documents(collection);

-- Enable Realtime for the documents table
begin;
  -- remove the supabase_realtime publication
  drop publication if exists supabase_realtime;

  -- re-create the supabase_realtime publication with no tables
  create publication supabase_realtime;
commit;

-- add the documents table to the publication
alter publication supabase_realtime add table public.documents;

