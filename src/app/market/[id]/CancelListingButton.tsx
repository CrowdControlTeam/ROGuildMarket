"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelListing } from "@/lib/listings";
import { buttonClass } from "@/lib/ui";

export function CancelListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await cancelListing(listingId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error inesperado");
            }
          });
        }}
        className={buttonClass("outline")}
      >
        {isPending ? "Cancelando..." : "Cancelar publicación"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
