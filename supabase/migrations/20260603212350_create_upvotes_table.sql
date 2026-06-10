CREATE TABLE IF NOT EXISTS public.upvotes (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (app_id, user_id)
);

CREATE INDEX IF NOT EXISTS upvotes_app_id_idx ON public.upvotes(app_id);
CREATE INDEX IF NOT EXISTS upvotes_user_id_idx ON public.upvotes(user_id);

ALTER TABLE public.upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read upvotes"
ON public.upvotes
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can upvote"
ON public.upvotes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own upvotes"
ON public.upvotes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
