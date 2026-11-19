import { useState } from 'react';

/** The time the component mounted, in ms. Stable across re-renders (render stays pure). */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}
