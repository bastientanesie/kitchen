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

export const createOwnHouseholdBodySchema = z.object({
  name: z.string().trim().min(1),
});

export const createOwnHouseholdResponseSchema = z.object({
  householdId: z.string(),
  invitationToken: z.string(),
  invitationExpiresAt: z.string(),
});

export type CreateOwnHouseholdBody = z.infer<typeof createOwnHouseholdBodySchema>;

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

export const updateHouseholdPreferencesBodySchema = z.object({
  preferences: z.string(),
});

export type UpdateHouseholdPreferencesBody = z.infer<
  typeof updateHouseholdPreferencesBodySchema
>;

export const householdPreferencesResponseSchema = z.object({
  preferences: z.string().nullable(),
});

export const householdSummaryResponseSchema = z.object({
  householdId: z.string(),
  name: z.string(),
});
