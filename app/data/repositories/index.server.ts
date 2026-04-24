import process from "node:process";

import { getSqliteRepositories } from "./sqlite.server.js";

export function getRepositories() {
  const driver = process.env.PAYSHARE_DB_DRIVER ?? "sqlite";

  switch (driver) {
    case "sqlite":
      return getSqliteRepositories();
    default:
      throw new Error(`Unsupported data repository driver: ${driver}`);
  }
}
