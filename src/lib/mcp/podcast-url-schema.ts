import { z } from "zod";
import { validatePodcastEpisodeUrl } from "@/lib/hisfm/podcast-url";

export const mcpPodcastUrlSchema = z
  .union([z.string(), z.null()])
  .optional()
  .superRefine((val, ctx) => {
    if (val === undefined || val === null) return;
    const message = validatePodcastEpisodeUrl(val);
    if (message) {
      ctx.addIssue({ code: "custom", message });
    }
  });
