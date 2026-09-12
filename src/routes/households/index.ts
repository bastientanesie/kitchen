import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createHouseholdBodySchema,
  createHouseholdResponseSchema,
  createInvitationResponseSchema,
  createOwnHouseholdBodySchema,
  createOwnHouseholdResponseSchema,
  householdPreferencesResponseSchema,
  householdSummaryResponseSchema,
  invitationParamsSchema,
  invitationPreviewResponseSchema,
  updateHouseholdPreferencesBodySchema,
} from "../../schemas/households.js";
import {
  createHousehold,
  createHouseholdForUser,
  getHouseholdPreferences,
  getHouseholdSummary,
  updateHouseholdPreferences,
} from "../../services/households.js";
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
    "/mine",
    {
      preHandler: fastify.authenticate,
      schema: {
        body: createOwnHouseholdBodySchema,
        response: { 201: createOwnHouseholdResponseSchema },
      },
    },
    async (request, reply) => {
      const result = createHouseholdForUser(fastify.db, request.auth!.userId, request.body);
      reply.status(201).send({
        householdId: result.householdId,
        invitationToken: result.invitationToken,
        invitationExpiresAt: result.invitationExpiresAt.toISOString(),
      });
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

  app.get(
    "/mine",
    {
      preHandler: fastify.authenticate,
      schema: {
        response: { 200: householdSummaryResponseSchema },
      },
    },
    async (request) => {
      return getHouseholdSummary(fastify.db, request.auth!.householdId);
    },
  );

  app.get(
    "/me/preferences",
    {
      preHandler: fastify.authenticate,
      schema: {
        response: { 200: householdPreferencesResponseSchema },
      },
    },
    async (request) => {
      return { preferences: getHouseholdPreferences(fastify.db, request.auth!.householdId) };
    },
  );

  app.patch(
    "/me/preferences",
    {
      preHandler: fastify.authenticate,
      schema: {
        body: updateHouseholdPreferencesBodySchema,
        response: { 200: householdPreferencesResponseSchema },
      },
    },
    async (request) => {
      const preferences = updateHouseholdPreferences(
        fastify.db,
        request.auth!.householdId,
        request.body.preferences,
      );
      return { preferences };
    },
  );
};

export default householdsRoutes;
