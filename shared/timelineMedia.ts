import { z } from "zod";

export const timelineMediaSchema = z
  .object({
    frames: z
      .array(
        z
          .object({
            timeMs: z.number().finite().min(0),
            src: z
              .string()
              .max(100_000)
              .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/),
          })
          .strict(),
      )
      .max(8),
    channels: z
      .array(
        z
          .object({
            kind: z.enum(["microphone", "system", "asset"]),
            levels: z.array(z.number().finite().min(0).max(1)).max(256),
          })
          .strict(),
      )
      .max(2),
  })
  .strict();
export type TimelineMedia = z.infer<typeof timelineMediaSchema>;
export type TimelineMediaRange = {
  projectId: string;
  assetId?: string;
  startMs: number;
  endMs: number;
};
