import { z } from "zod";

export const createHouseholdBodySchema = z.object({
  name: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
});

export const createHouseholdResponseSchema = z.object({
  userId: z.string(),
  householdId: z.string(),
});

export type CreateHouseholdBody = z.infer<typeof createHouseholdBodySchema>;
