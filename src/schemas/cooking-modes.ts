import { z } from "zod";

export const cookingModeSchema = z.object({
  id: z.string(),
  name: z.string(),
  present: z.boolean(),
});

export const createCookingModeSchema = z.object({
  name: z.string().trim().min(1),
  present: z.boolean(),
});

export const createCookingModesBodySchema = z.array(createCookingModeSchema);

export const createCookingModesResponseSchema = z.array(cookingModeSchema);

export const listCookingModesResponseSchema = z.array(cookingModeSchema);

export const cookingModeParamsSchema = z.object({
  id: z.string(),
});

export const patchCookingModeBodySchema = z
  .object({
    name: z.string().trim().min(1),
    present: z.boolean(),
  })
  .partial();

export type CreateCookingModeInput = z.infer<typeof createCookingModeSchema>;
export type PatchCookingModeBody = z.infer<typeof patchCookingModeBodySchema>;
