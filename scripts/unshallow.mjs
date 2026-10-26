// Before a build (npm's prebuild): fetch the whole git history if the checkout is shallow, so each
// page's markdown can say when its own files last changed (src/md/registry.ts). Builds still work
// where it cannot: the date is then left out.
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
try {
  if (git('rev-parse', '--is-shallow-repository') === 'true') {
    git('fetch', '--unshallow', '--quiet');
    console.log('Fetched the full git history for the pages\' dates.');
  }
} catch (e) {
  console.warn(`Could not fetch the full git history; the markdown pages go without dates. ${e.message.split('\n')[0]}`);
}
