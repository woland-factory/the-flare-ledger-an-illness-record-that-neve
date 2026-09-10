"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import OnsetSheet from "./OnsetSheet";

export default function AdjustOnsetButton({ flareId }: { flareId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)}>
        Adjust onset
      </button>
      {open ? (
        <OnsetSheet
          flareId={flareId}
          editing
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
