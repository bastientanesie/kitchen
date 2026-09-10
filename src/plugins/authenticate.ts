import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { resolveSession, type AuthenticatedSession } from "../services/auth.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
  interface FastifyRequest {
    auth?: AuthenticatedSession;
  }
}

export default fp(async function authenticatePlugin(fastify: FastifyInstance) {
  fastify.decorate("authenticate", async (request: FastifyRequest) => {
    request.auth = resolveSession(fastify.db, request.cookies.session);
  });
});
