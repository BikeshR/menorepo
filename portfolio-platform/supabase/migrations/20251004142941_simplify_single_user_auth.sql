-- Simplify for single-user authentication
-- Drop and recreate demo_private_data table without user_id and RLS

-- Drop existing table and all its dependencies
DROP TABLE IF EXISTS public.demo_private_data CASCADE;

-- Recreate without user_id and RLS
CREATE TABLE public.demo_private_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 100),
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for ordering
CREATE INDEX idx_demo_private_data_created_at
  ON public.demo_private_data(created_at DESC);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.demo_private_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- No RLS needed for single-user system
-- Application-level authentication via iron-session handles access control
-- Migration deployed via GitHub Actions
