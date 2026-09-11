import { z } from "zod";

export const storageSchema = z.enum(["frigo", "placard", "congelateur"]);

export const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  present: z.boolean(),
  storage: storageSchema,
});

export const createIngredientSchema = z.object({
  name: z.string().trim().min(1),
  present: z.boolean(),
  storage: storageSchema,
});

export const createIngredientsBodySchema = z.array(createIngredientSchema);

export const createIngredientsResponseSchema = z.array(ingredientSchema);

export const listIngredientsResponseSchema = z.array(ingredientSchema);

export const ingredientParamsSchema = z.object({
  id: z.string(),
});

export const patchIngredientBodySchema = z
  .object({
    name: z.string().trim().min(1),
    present: z.boolean(),
    storage: storageSchema,
  })
  .partial();

export const parseTranscriptBodySchema = z.object({
  transcript: z.string().trim().min(1),
});

export const parsedIngredientSchema = z.object({
  name: z.string(),
  present: z.boolean(),
  isNew: z.boolean(),
});

export const parseTranscriptResponseSchema = z.object({
  ingredients: z.array(parsedIngredientSchema),
});

export type Storage = z.infer<typeof storageSchema>;
export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;
export type PatchIngredientBody = z.infer<typeof patchIngredientBodySchema>;
export type ParseTranscriptBody = z.infer<typeof parseTranscriptBodySchema>;
export type ParsedIngredient = z.infer<typeof parsedIngredientSchema>;
