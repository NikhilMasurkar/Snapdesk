"use client";

import { useEffect, useRef } from "react";
import { trackScan } from "./actions";

/** Fire-and-forget scan tracking on page load. Renders nothing, never blocks. */
export default function ScanTracker({
  businessId,
  table,
}: {
  businessId: string;
  table: string | null;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return; // guard against Strict Mode double-mount
    fired.current = true;
    void trackScan(businessId, table);
  }, [businessId, table]);

  return null;
}
