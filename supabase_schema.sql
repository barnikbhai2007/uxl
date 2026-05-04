-- Run this in your Supabase SQL Editor to complete the migration!

CREATE TABLE public.documents (
  id TEXT NOT NULL,
  collection TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (collection, id)
);

-- Enable RLS and allow all (like Firestore free tier during testing)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert" ON public.documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update" ON public.documents
  FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous delete" ON public.documents
  FOR DELETE USING (true);

-- Index for collection querying
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

