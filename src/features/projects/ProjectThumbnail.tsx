import { FileVideo } from "lucide-react";
import { useProjectThumbnailController } from "@/src/controllers/useProjectThumbnailController";

export function ProjectThumbnail({ thumbnail }: { thumbnail: string }) {
  const { src } = useProjectThumbnailController({ thumbnail });
  return src ? <img src={src} alt="Recorded screen thumbnail" /> : <FileVideo size={32} />;
}
