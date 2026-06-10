-- Hard-enforce display name length so the limit can't be bypassed by
-- hitting the PostgREST endpoint directly. char_length() counts grapheme-ish
-- characters (better than length() which counts bytes — relevant for emoji
-- and non-ASCII names).
--
-- NULL passes (CHECK treats NULL as not-failed); existing rows in this
-- project are all 0-8 chars long so no data migration needed.

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_name_max_length
CHECK (name IS NULL OR char_length(name) <= 15);
