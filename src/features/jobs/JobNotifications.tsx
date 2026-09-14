import { LoaderCircle, X } from "lucide-react";
import { IconButton } from "@/src/components/atoms/IconButton";
import { type StudioController } from "@/src/controllers/useStudioController";

export function JobNotifications({
  studio,
}: {
  studio: Pick<StudioController, "activeJobs" | "cancelJob">;
}) {
  const { activeJobs, cancelJob } = studio;

  return (
    <div className="jobs-stack" aria-live="polite">
      {activeJobs.map((job) => (
        <div className="job-card" key={job.id}>
          <div>
            <LoaderCircle className="spin" size={15} />
            <strong>
              {job.kind === "model"
                ? "Downloading AI model"
                : job.kind === "export"
                  ? "Exporting video"
                  : job.kind === "transcribe"
                    ? "Transcribing locally"
                    : job.kind === "silence"
                      ? "Finding quiet moments"
                      : "Assistant is working"}
            </strong>
            <IconButton label="Cancel job" onClick={() => cancelJob(job.id)}>
              <X size={13} />
            </IconButton>
          </div>
          <progress max={1} value={job.progress > 1 ? job.progress / 100 : job.progress} />
          <p>{job.message}</p>
        </div>
      ))}
    </div>
  );
}
