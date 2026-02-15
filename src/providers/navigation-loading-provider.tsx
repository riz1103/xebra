"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { NavigationLoadingOverlay } from "@/components/ui/navigation-loading-overlay";

export function NavigationLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const pathnameRef = useRef(pathname);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigationStartRef = useRef(false);
  const loadingStartTimeRef = useRef<number | null>(null);

  // Intercept Link clicks to show loading immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Find the closest anchor tag (Link component renders as <a>)
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      
      if (link) {
        const href = link.getAttribute("href");
        // Only intercept internal navigation (not external links or anchors)
        if (href && href.startsWith("/") && !href.startsWith("//") && !link.hasAttribute("download")) {
          // Check if it's a different route
          if (href !== pathname && !href.startsWith("#")) {
            navigationStartRef.current = true;
            loadingStartTimeRef.current = Date.now();
            setIsLoading(true);
          }
        }
      }
    };

    // Add click listener to document
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [pathname]);

  // Handle pathname changes (navigation completion)
  useEffect(() => {
    // If pathname changed, we're navigating
    if (pathnameRef.current !== pathname) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // If we didn't catch the click (e.g., programmatic navigation), show loading now
      if (!navigationStartRef.current) {
        loadingStartTimeRef.current = Date.now();
        setIsLoading(true);
      }

      // Hide loading overlay after route has loaded
      // Use a minimum display time to ensure users see the feedback
      const minDisplayTime = 300; // Minimum 300ms display time
      const hideLoading = () => {
        if (loadingStartTimeRef.current) {
          const elapsed = Date.now() - loadingStartTimeRef.current;
          const remaining = Math.max(0, minDisplayTime - elapsed);
          
          timeoutRef.current = setTimeout(() => {
            setIsLoading(false);
            pathnameRef.current = pathname;
            navigationStartRef.current = false;
            loadingStartTimeRef.current = null;
          }, remaining);
        } else {
          setIsLoading(false);
          pathnameRef.current = pathname;
          navigationStartRef.current = false;
        }
      };
      
      // Small delay to ensure smooth transition, then check minimum display time
      timeoutRef.current = setTimeout(hideLoading, 150);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pathname]);

  // Initialize pathname ref on mount
  useEffect(() => {
    pathnameRef.current = pathname;
  }, []);

  return (
    <>
      {children}
      <NavigationLoadingOverlay isLoading={isLoading} />
    </>
  );
}
