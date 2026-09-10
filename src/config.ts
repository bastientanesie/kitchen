export interface AppConfig {
  port: number;
  host: string;
  rpId: string;
  rpName: string;
  origin: string;
  databasePath: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? "0.0.0.0",
    rpId: env.RP_ID ?? "localhost",
    rpName: env.RP_NAME ?? "Kitchen",
    origin: env.ORIGIN ?? "http://localhost:3000",
    databasePath: env.DATABASE_PATH ?? "./data/kitchen.db",
  };
}
