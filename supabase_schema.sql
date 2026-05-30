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

CREATE TABLE IF NOT EXISTS public.collection_meta (
  collection text PRIMARY KEY,
  updated_at bigint NOT NULL DEFAULT 0
);

CREATE TABLE news (
  title TEXT,
  content TEXT,
  category TEXT,
  matchday INT,
  created_at TIMESTAMP DEFAULT now(),
  triggered_by TEXT
);
CREATE INDEX idx_documents_collection ON public.documents(collection);

-- Indexes for fast status querying and JSONB extraction
CREATE INDEX idx_documents_data_status ON public.documents USING gin (data jsonb_path_ops);
CREATE INDEX idx_documents_status ON public.documents ((data->>'status'));
CREATE INDEX idx_documents_collection_status ON public.documents (collection, (data->>'status'));

-- Enable Realtime for the documents table
begin;
  -- remove the supabase_realtime publication
  drop publication if exists supabase_realtime;

  -- re-create the supabase_realtime publication with no tables
  create publication supabase_realtime;
commit;

-- add the news table to the publication
alter publication supabase_realtime add table public.news;

