import "dotenv/config";
import { buildApp } from "./app.js";

const app = await buildApp({}, { logger: true });

app.listen({ port: app.config.port, host: app.config.host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
