"use client";

import { useEffect } from "react";

interface ViewTrackerProps {
  simulationId: string;
}

export default function ViewTracker({ simulationId }: ViewTrackerProps) {
  useEffect(() => {
    void fetch(`/api/v1/simulate/${simulationId}/analytics`, {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    });
  }, [simulationId]);

  return null;
}
