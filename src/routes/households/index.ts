import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createHouseholdBodySchema,
  createHouseholdResponseSchema,
} from "../../schemas/households.js";
import { createHousehold } from "../../services/households.js";

const householdsRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/",
    {
      schema: {
        body: createHouseholdBodySchema,
        response: { 201: createHouseholdResponseSchema },
      },
    },
    async (request, reply) => {
      const result = createHousehold(fastify.db, request.body);
      reply.status(201).send(result);
    },
  );
};

export default householdsRoutes;
