# Astro with ClientRouter, so the ring wipe survives real URLs

The prototype is one document, and its ring-wipe transition plays between hash "pages". The site
now has real URLs. We chose Astro's ClientRouter (pages swapped in place) over native
cross-document view transitions, because only the ClientRouter keeps the wipe identical in every
browser, starting from the click point (Firefox has no cross-document transitions).

## Consequences

- Browser scripts load once. Every feature mounts again on each page and stops on the next
  (`src/scripts/core/lifecycle.ts`). State that the one-document prototype kept is carried in memory
  and written into the incoming page before it is shown.
- Astro's built-in Content Security Policy does not support the ClientRouter, so the CSP has to be
  written by hand (`public/_headers`) when the portal arrives.
- Analytics scripts stay loaded across page changes, so portal and admin pages must be excluded in
  the tracker's own filter.
