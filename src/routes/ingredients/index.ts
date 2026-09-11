import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createIngredientsBodySchema,
  createIngredientsResponseSchema,
  ingredientParamsSchema,
  ingredientSchema,
  listIngredientsResponseSchema,
  patchIngredientBodySchema,
} from "../../schemas/ingredients.js";
import {
  createIngredients,
  deleteIngredient,
  listIngredients,
  updateIngredient,
} from "../../services/ingredients.js";

const ingredientsRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/",
    {
      preHandler: fastify.authenticate,
      schema: {
        response: { 200: listIngredientsResponseSchema },
      },
    },
    async (request) => {
      return listIngredients(fastify.db, request.auth!.householdId);
    },
  );

  app.post(
    "/",
    {
      preHandler: fastify.authenticate,
      schema: {
        body: createIngredientsBodySchema,
        response: { 201: createIngredientsResponseSchema },
      },
    },
    async (request, reply) => {
      const result = createIngredients(fastify.db, request.auth!.householdId, request.body);
      reply.status(201).send(result);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: ingredientParamsSchema,
        body: patchIngredientBodySchema,
        response: { 200: ingredientSchema },
      },
    },
    async (request) => {
      return updateIngredient(
        fastify.db,
        request.auth!.householdId,
        request.params.id,
        request.body,
      );
    },
  );

  app.delete(
    "/:id",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: ingredientParamsSchema,
      },
    },
    async (request, reply) => {
      deleteIngredient(fastify.db, request.auth!.householdId, request.params.id);
      reply.status(204).send();
    },
  );
};

export default ingredientsRoutes;
