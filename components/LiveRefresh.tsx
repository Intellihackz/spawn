"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-reads the page's server data every few seconds while the tab is visible, so new trades appear on their own. */
export function LiveRefresh({ every = 5000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(id);
  }, [router, every]);
  return null;
}
