import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createHouseholdBodySchema,
  createHouseholdResponseSchema,
  createInvitationResponseSchema,
  invitationParamsSchema,
  invitationPreviewResponseSchema,
} from "../../schemas/households.js";
import { createHousehold } from "../../services/households.js";
import { createInvitation, peekInvitation } from "../../services/invitations.js";

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

  app.post(
    "/invitations",
    {
      preHandler: fastify.authenticate,
      schema: {
        response: { 201: createInvitationResponseSchema },
      },
    },
    async (request, reply) => {
      const result = createInvitation(fastify.db, request.auth!.householdId);
      reply.status(201).send({ token: result.token, expiresAt: result.expiresAt.toISOString() });
    },
  );

  app.get(
    "/invitations/:token",
    {
      schema: {
        params: invitationParamsSchema,
        response: { 200: invitationPreviewResponseSchema },
      },
    },
    async (request) => {
      return peekInvitation(fastify.db, request.params.token);
    },
  );
};

export default householdsRoutes;
