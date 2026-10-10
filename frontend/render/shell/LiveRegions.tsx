'use client';

import { useAnnouncements } from '@/runtime/liveRegion';

// The two global live regions (SDD 9.6). Status changes that happen without a page reload are announced here.
export function LiveRegions() {
  const { polite, assertive } = useAnnouncements();
  return (
    <>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="visually-hidden" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  );
}
