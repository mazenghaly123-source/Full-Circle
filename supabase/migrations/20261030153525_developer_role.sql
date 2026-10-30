-- A third role, developer (Mazen, 30 Oct 2026): the person who builds the site and the admin. It can do
-- everything an owner can (private.is_owner, next migration) but is named for what it is. A new enum value
-- can't be used in the transaction that adds it, so the function that reads it comes in its own migration.
alter type public.staff_role add value 'developer';
