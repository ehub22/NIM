import { useLayoutEffect, useRef } from 'react';

/**
 * Keeps a ref pointing at the latest value so callbacks can stay referentially
 * stable without closing over stale props.
 *
 * The ref is seeded during the first render and updated in a layout effect, so
 * it is never written to while rendering.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
