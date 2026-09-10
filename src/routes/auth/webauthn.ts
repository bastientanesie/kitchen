import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  registerOptionsBodySchema,
  registerVerifyBodySchema,
  registerVerifyResponseSchema,
} from "../../schemas/auth.js";
import { createRegistrationOptions, verifyRegistration } from "../../services/auth.js";

const webauthnRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const rp = () => ({
    rpId: fastify.config.rpId,
    rpName: fastify.config.rpName,
    origin: fastify.config.origin,
  });

  app.post(
    "/webauthn/register/options",
    { schema: { body: registerOptionsBodySchema } },
    async (request) => {
      return createRegistrationOptions(fastify.db, rp(), request.body);
    },
  );

  app.post(
    "/webauthn/register/verify",
    {
      schema: {
        body: registerVerifyBodySchema,
        response: { 200: registerVerifyResponseSchema },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const result = await verifyRegistration(fastify.db, rp(), {
        credential: body.credential as unknown as RegistrationResponseJSON,
        deviceName: body.deviceName,
      });

      reply.setCookie("session", result.sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: result.sessionExpiresAt,
      });

      reply.send({ userId: result.userId, householdId: result.householdId });
    },
  );
};

export default webauthnRoutes;
