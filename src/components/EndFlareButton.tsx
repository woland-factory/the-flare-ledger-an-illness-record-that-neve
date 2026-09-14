"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import EndInterview from "./EndInterview";

export default function EndFlareButton({ flareId }: { flareId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="btn btn-primary"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        This flare ended
      </button>
      {open ? (
        <EndInterview
          flareId={flareId}
          onClosed={() => {
            setOpen(false);
            router.refresh();
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
