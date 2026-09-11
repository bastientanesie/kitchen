import Fastify, { type FastifyInstance, type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { ZodError } from "zod";
import { AppError, problemDetails } from "./errors.js";
import { loadConfig, type AppConfig } from "./config.js";
import dbPlugin from "./plugins/db.js";
import authenticatePlugin from "./plugins/authenticate.js";
import healthRoute from "./routes/health.js";
import householdsRoutes from "./routes/households/index.js";
import webauthnRoutes from "./routes/auth/webauthn.js";
import devicePairingRoutes from "./routes/device-pairing/index.js";
import ingredientsRoutes from "./routes/ingredients/index.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export interface BuildAppOptions {
  logger?: boolean;
}

export async function buildApp(
  overrides: Partial<AppConfig> = {},
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: options.logger ?? false }).withTypeProvider<ZodTypeProvider>();

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  const config = { ...loadConfig(), ...overrides };
  fastify.decorate("config", config);

  await fastify.register(cookie);

  fastify.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      reply
        .status(error.status)
        .type("application/problem+json")
        .send(problemDetails(error, request.url));
      return;
    }

    const validationErrors = error instanceof ZodError ? error.issues : error.validation;
    if (validationErrors) {
      const validationError = new AppError(
        400,
        "VALIDATION_FAILED",
        "La requête ne respecte pas le format attendu.",
      );
      reply
        .status(400)
        .type("application/problem+json")
        .send({
          ...problemDetails(validationError, request.url),
          errors: validationErrors,
        });
      return;
    }

    request.log.error(error);
    const internalError = new AppError(500, "INTERNAL_ERROR", "Erreur interne.");
    reply
      .status(500)
      .type("application/problem+json")
      .send(problemDetails(internalError, request.url));
  });

  await fastify.register(dbPlugin);
  await fastify.register(authenticatePlugin);
  await fastify.register(healthRoute);
  await fastify.register(householdsRoutes, { prefix: "/households" });
  await fastify.register(webauthnRoutes, { prefix: "/auth" });
  await fastify.register(devicePairingRoutes, { prefix: "/device-pairing" });
  await fastify.register(ingredientsRoutes, { prefix: "/ingredients" });

  return fastify;
}
