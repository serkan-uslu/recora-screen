import { useEffect, useState } from "react";
import { desktop } from "../api";

export function useProjectThumbnailController({
  thumbnail,
}: {
  thumbnail: string;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (/^(data:|https?:)/.test(thumbnail)) setSrc(thumbnail);
    else if (desktop) {
      void import("@tauri-apps/api/core").then(({ convertFileSrc }) =>
        setSrc(convertFileSrc(thumbnail)),
      );
    }
  }, [thumbnail]);
  return { src };
}
