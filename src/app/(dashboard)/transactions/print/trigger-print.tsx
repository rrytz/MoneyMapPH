"use client";

import { useEffect } from "react";

export function TriggerPrint() {
  useEffect(() => {
    // Small timeout to allow styles to finish loading and rendering before executing print dialog
    const timer = setTimeout(() => {
      window.print();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
