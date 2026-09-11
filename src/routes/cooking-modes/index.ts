import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  cookingModeParamsSchema,
  cookingModeSchema,
  createCookingModesBodySchema,
  createCookingModesResponseSchema,
  listCookingModesResponseSchema,
  patchCookingModeBodySchema,
} from "../../schemas/cooking-modes.js";
import {
  createCookingModes,
  deleteCookingMode,
  listCookingModes,
  updateCookingMode,
} from "../../services/cooking-modes.js";

const cookingModesRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/",
    {
      preHandler: fastify.authenticate,
      schema: {
        response: { 200: listCookingModesResponseSchema },
      },
    },
    async (request) => {
      return listCookingModes(fastify.db, request.auth!.householdId);
    },
  );

  app.post(
    "/",
    {
      preHandler: fastify.authenticate,
      schema: {
        body: createCookingModesBodySchema,
        response: { 201: createCookingModesResponseSchema },
      },
    },
    async (request, reply) => {
      const result = createCookingModes(fastify.db, request.auth!.householdId, request.body);
      reply.status(201).send(result);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: cookingModeParamsSchema,
        body: patchCookingModeBodySchema,
        response: { 200: cookingModeSchema },
      },
    },
    async (request) => {
      return updateCookingMode(
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
        params: cookingModeParamsSchema,
      },
    },
    async (request, reply) => {
      deleteCookingMode(fastify.db, request.auth!.householdId, request.params.id);
      reply.status(204).send();
    },
  );
};

export default cookingModesRoutes;
