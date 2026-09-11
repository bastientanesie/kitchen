import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createDeviceLinkTokenResponseSchema,
  deviceLinkTokenParamsSchema,
} from "../../schemas/device-pairing.js";
import { createDeviceLinkToken, getDeviceLinkStatusForOwner } from "../../services/device-link.js";

const EVENTS_POLL_INTERVAL_MS = 200;

const devicePairingRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/tokens",
    {
      preHandler: fastify.authenticate,
      schema: {
        response: { 201: createDeviceLinkTokenResponseSchema },
      },
    },
    async (request, reply) => {
      const result = createDeviceLinkToken(fastify.db, request.auth!.userId);
      reply.status(201).send({
        token: result.token,
        code: result.code,
        expiresAt: result.expiresAt.toISOString(),
      });
    },
  );

  app.get(
    "/tokens/:token/events",
    {
      preHandler: fastify.authenticate,
      schema: { params: deviceLinkTokenParamsSchema },
    },
    async (request, reply) => {
      const { token } = request.params;
      const ownerUserId = request.auth!.userId;

      const initialStatus = getDeviceLinkStatusForOwner(fastify.db, token, ownerUserId);

      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const sendEventAndClose = (event: "paired" | "expired", data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        clearInterval(interval);
        res.end();
      };

      const checkStatus = () => {
        const status = getDeviceLinkStatusForOwner(fastify.db, token, ownerUserId);
        if (status.kind === "paired") {
          sendEventAndClose("paired", { deviceName: status.deviceName });
        } else if (status.kind === "expired") {
          sendEventAndClose("expired", {});
        }
      };

      const interval = setInterval(checkStatus, EVENTS_POLL_INTERVAL_MS);
      request.raw.on("close", () => clearInterval(interval));

      if (initialStatus.kind === "paired") {
        sendEventAndClose("paired", { deviceName: initialStatus.deviceName });
      } else if (initialStatus.kind === "expired") {
        sendEventAndClose("expired", {});
      }
    },
  );
};

export default devicePairingRoutes;
