-- ============================================================
-- SIMULATED PURCHASES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.simulated_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  target_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for user filter speed
CREATE INDEX IF NOT EXISTS idx_simulated_purchases_user ON public.simulated_purchases(user_id);

-- Enable RLS
ALTER TABLE public.simulated_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own simulated purchases" ON public.simulated_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own simulated purchases" ON public.simulated_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own simulated purchases" ON public.simulated_purchases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own simulated purchases" ON public.simulated_purchases FOR DELETE USING (auth.uid() = user_id);

-- Trigger for set_updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.simulated_purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
