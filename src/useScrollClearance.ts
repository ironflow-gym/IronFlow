import { useLayoutEffect, type RefObject } from 'react';

/** Reserve the actual overlay height for native scrolling and keyboard focus. */
export function useScrollClearance(ref: RefObject<HTMLElement | null>, property: '--mobile-nav-clearance' | '--workout-header-clearance', enabled = true) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue(property);
    const update = () => {
      const height = element.getBoundingClientRect().height;
      root.style.setProperty(property, `${height > 0 ? Math.ceil(height) + 8 : 0}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element, { box: 'border-box' });
    return () => { observer.disconnect(); if (previous) root.style.setProperty(property, previous); else root.style.removeProperty(property); };
  }, [ref, property, enabled]);
}
