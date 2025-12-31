/**
 * Performance optimization hooks and utilities
 * Reduces RAM usage, prevents memory leaks, and optimizes mobile performance
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook to detect if device is low-end (limited resources)
 * Used to disable heavy animations and effects on mobile
 */
export function useIsLowEndDevice() {
  const [isLowEnd, setIsLowEnd] = useState(false);

  useEffect(() => {
    // Check for low-end device indicators
    const checkDevice = () => {
      // Check hardware concurrency (CPU cores)
      const cores = navigator.hardwareConcurrency || 4;
      const isLowCores = cores <= 4;

      // Check device memory (if available)
      const memory = (navigator as any).deviceMemory || 8;
      const isLowMemory = memory <= 4;

      // Check if mobile
      const isMobile = window.innerWidth < 768;

      // Check connection type
      const connection = (navigator as any).connection;
      const isSlowConnection = connection?.effectiveType === 'slow-2g' || 
                               connection?.effectiveType === '2g' ||
                               connection?.saveData;

      setIsLowEnd(isMobile || isLowCores || isLowMemory || isSlowConnection);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return isLowEnd;
}

/**
 * Hook to defer non-critical operations until idle
 */
export function useIdleCallback(callback: () => void, deps: any[] = []) {
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(callback, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(callback, 100);
      return () => clearTimeout(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Hook to clean up intervals and timeouts on unmount
 */
export function useSafeInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

/**
 * Hook for debounced values - reduces re-renders
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook to track and limit component renders
 */
export function useRenderCount(componentName: string) {
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current += 1;
    if (process.env.NODE_ENV === 'development' && renderCount.current > 50) {
      console.warn(`[Performance] ${componentName} has rendered ${renderCount.current} times`);
    }
  });
  
  return renderCount.current;
}

/**
 * Hook to clean up event listeners properly
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | Element | null = typeof window !== 'undefined' ? window : null
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!element) return;
    
    const eventListener = (event: Event) => savedHandler.current(event as WindowEventMap[K]);
    element.addEventListener(eventName, eventListener);
    
    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]);
}

/**
 * Utility to check if we're on a mobile device
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Utility to reduce animation intensity on mobile
 */
export const getOptimizedAnimationDuration = (baseDuration: number): number => {
  if (isMobileDevice()) {
    return baseDuration * 0.5; // Faster animations on mobile
  }
  return baseDuration;
};
