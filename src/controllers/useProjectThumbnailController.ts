import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { desktop } from "@/src/api";

export function useProjectThumbnailController({ thumbnail }: { thumbnail: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (/^(data:|https?:)/.test(thumbnail)) setSrc(thumbnail);
    else if (desktop) {
      setSrc(convertFileSrc(thumbnail));
    }
  }, [thumbnail]);
  return { src };
}
