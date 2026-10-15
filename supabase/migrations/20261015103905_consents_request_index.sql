-- the consent records' link to their request (the performance advisor asks for an index on every foreign key)
create index contact_consents_request on public.contact_consents (request_id);
