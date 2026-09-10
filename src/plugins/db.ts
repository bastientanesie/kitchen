import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { createDatabase } from "../db/index.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Database.Database;
  }
}

export default fp(async function dbPlugin(fastify: FastifyInstance) {
  const db = createDatabase(fastify.config.databasePath);
  fastify.decorate("db", db);
  fastify.addHook("onClose", (instance, done) => {
    db.close();
    done();
  });
});
