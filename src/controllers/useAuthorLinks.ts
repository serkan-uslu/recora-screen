import { useState } from "react";
import type { MouseEvent } from "react";
import { desktop, openUrl } from "@/src/infrastructure/platform";
import { messageOf } from "@/src/lib/errors";

export function useAuthorLinks() {
  const [error, setError] = useState("");
  function open(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!desktop) return;
    event.preventDefault();
    void openUrl(href).catch((error) => setError(messageOf(error)));
  }
  return { error, open };
}
