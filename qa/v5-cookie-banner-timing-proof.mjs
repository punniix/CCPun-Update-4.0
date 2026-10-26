import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const cookieBannerOwner = 'features/analytics/components/CookieConsent.tsx';
export const cookieBannerPredecessorSha = '5f84509f9b4bb4f15956142229ed4ddfaa994924f44903565594002774467815';
export const cookieBannerImmediateSha = '3c4c0e8f54937e8183c01a79de9d6674c755d9fcdd015c5615ffad68f24333ab';
const sha = source => createHash('sha256').update(source).digest('hex');

// C9 admits one complete reviewed successor. Only the timer and its cleanup
// reconstruct the original, still-frozen v5 cookie notice owner.
export function cookieBannerTimingPredecessor(file, source) {
  if (file !== cookieBannerOwner || sha(source) !== cookieBannerImmediateSha) return source;
  const immediate = '      // eslint-disable-next-line react-hooks/set-state-in-effect -- C9 synchronizes banner visibility immediately after hydration without a timer.\n      setVisible(true);\n    }\n  }, []);';
  const delayed = '      const timer = setTimeout(() => setVisible(true), 800);\n      return () => clearTimeout(timer);\n    }\n  }, []);';
  assert.equal(source.split(immediate).length, 2, 'one exact first-visit timing transition');
  const predecessor = source.replace(immediate, delayed);
  assert.equal(sha(predecessor), cookieBannerPredecessorSha, 'frozen cookie notice identity before C9');
  return predecessor;
}
