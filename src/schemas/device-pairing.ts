import { z } from "zod";

export const createDeviceLinkTokenResponseSchema = z.object({
  token: z.string(),
  code: z.string(),
  expiresAt: z.string(),
});

export const deviceLinkTokenParamsSchema = z.object({
  token: z.string().min(1),
});
