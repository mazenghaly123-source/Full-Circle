-- Requests no longer carry files (Mazen, 15 Oct 2026): sketches, tech packs and photos come on
-- WhatsApp after the first contact. The file table, the bucket and its policy go.
drop policy "staff read request files" on storage.objects;
drop table public.request_files;

-- Storage refuses direct deletes unless asked, so that files are not orphaned. The bucket is empty
-- by now: any files in it are removed through the Storage API first, which deletes them for good.
set storage.allow_delete_query = 'true';
delete from storage.buckets where id = 'request-files';
reset storage.allow_delete_query;
