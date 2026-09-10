import { z } from "zod";

export const createHouseholdBodySchema = z.object({
  name: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
});

export const createHouseholdResponseSchema = z.object({
  userId: z.string(),
  householdId: z.string(),
  enrollmentToken: z.string(),
});

export type CreateHouseholdBody = z.infer<typeof createHouseholdBodySchema>;

export const createInvitationResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
});

export const invitationParamsSchema = z.object({
  token: z.string(),
});

export const invitationPreviewResponseSchema = z.object({
  householdName: z.string(),
  memberCount: z.number(),
});
