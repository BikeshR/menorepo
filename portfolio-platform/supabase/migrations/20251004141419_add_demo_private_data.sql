-- Demo private project data table
CREATE TABLE public.demo_private_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 100),
  content TEXT NOT NULL CHECK (char_length(title) > 0 AND char_length(content) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_demo_private_data_user_id ON public.demo_private_data(user_id);
CREATE INDEX idx_demo_private_data_created_at ON public.demo_private_data(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE public.demo_private_data IS 'Sample data for demonstrating private project functionality';
COMMENT ON COLUMN public.demo_private_data.user_id IS 'Reference to the user who owns this data';
COMMENT ON COLUMN public.demo_private_data.title IS 'Title of the demo entry (max 100 chars)';
COMMENT ON COLUMN public.demo_private_data.content IS 'Content of the demo entry (max 1000 chars)';

-- Trigger for updated_at
CREATE TRIGGER update_demo_private_data_updated_at
  BEFORE UPDATE ON public.demo_private_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on demo_private_data table
ALTER TABLE public.demo_private_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own data
CREATE POLICY "Users can view own demo data"
  ON public.demo_private_data
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own data
CREATE POLICY "Users can insert own demo data"
  ON public.demo_private_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own demo data"
  ON public.demo_private_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own data
CREATE POLICY "Users can delete own demo data"
  ON public.demo_private_data
  FOR DELETE
  USING (auth.uid() = user_id);
