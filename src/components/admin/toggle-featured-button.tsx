"use client";

import { useActionState } from "react";
import { toggleBusinessFeatured } from "@/app/actions/business";

type Props = {
  businessId: string;
  isFeatured: boolean;
};

export function ToggleFeaturedButton({ businessId, isFeatured }: Props) {
  const [, formAction, isPending] = useActionState(
    toggleBusinessFeatured.bind(null, businessId, !isFeatured),
    null
  );

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className={`rounded-md border px-3 py-1.5 text-sm disabled:opacity-60 ${
          isFeatured
            ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            : "border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
        }`}
      >
        {isPending ? "..." : isFeatured ? "Quitar destaque" : "Destacar"}
      </button>
    </form>
  );
}