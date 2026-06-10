-- The upvotes table had RLS policies (upvotes_insert / upvotes_delete /
-- "Anyone can read upvotes") but never received the underlying table GRANTs to
-- the API roles, unlike its sibling tables (bookmarks, reports). Without the
-- base privilege every insert failed with "permission denied for table
-- upvotes" (SQLSTATE 42501), so the upvote button optimistically incremented
-- then rolled back to 0. Grant the DML the policies already assume exists.
grant select, insert, delete on public.upvotes to authenticated;
grant select on public.upvotes to anon;
