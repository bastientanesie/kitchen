import { z } from "zod";

export const registerOptionsBodySchema = z.object({
  enrollmentToken: z.string().min(1).optional(),
  displayName: z.string().trim().min(1),
});

export const registerVerifyBodySchema = z.object({
  enrollmentToken: z.string().min(1).optional(),
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    type: z.literal("public-key"),
    clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
      transports: z.array(z.string()).optional(),
    }),
  }),
  deviceName: z.string().trim().min(1),
});

export const registerVerifyResponseSchema = z.object({
  userId: z.string(),
  householdId: z.string(),
});

export type RegisterOptionsBody = z.infer<typeof registerOptionsBodySchema>;
export type RegisterVerifyBody = z.infer<typeof registerVerifyBodySchema>;
