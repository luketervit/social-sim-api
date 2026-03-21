"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShareModal from "@/app/dashboard/share-modal";

interface PublishSimulation {
  id: string;
  audience_id: string;
  platform: string;
  input: string;
  status: string;
  aggression_score: string | null;
  public: boolean;
  title: string | null;
  summary: string | null;
  shared_at: string | null;
  progress_messages: number;
  created_at: string;
  completed_at: string | null;
}

interface PreviewPublishButtonProps {
  simulation: PublishSimulation;
}

export default function PreviewPublishButton({
  simulation,
}: PreviewPublishButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  function handleClose() {
    setOpen(false);

    if (needsRefresh) {
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary"
        style={{ padding: "6px 12px", minHeight: "auto", fontSize: 12 }}
      >
        Publish
      </button>

      {open ? (
        <ShareModal
          simulation={simulation}
          onClose={handleClose}
          onShared={() => setNeedsRefresh(true)}
        />
      ) : null}
    </>
  );
}
