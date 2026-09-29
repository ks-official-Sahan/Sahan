import { db } from "@/lib/db/prisma";

import type { Repos, TxOptions } from "../repos";
import { auditRepo } from "./audit";
import { authTokenRepo } from "./auth-tokens";
import type { DbClient } from "./client";
import { inquiryRepo } from "./inquiries";
import { settingRepo } from "./settings";
import { userSessionRepo } from "./user-sessions";
import { userRepo } from "./users";

export function createRepos(client: DbClient): Repos {
  return {
    audit: auditRepo(client),
    authTokens: authTokenRepo(client),
    inquiries: inquiryRepo(client),
    sessions: userSessionRepo(client),
    settings: settingRepo(client),
    users: userRepo(client),
  };
}

/** Repositories on the shared client. `db` is a lazy proxy, so this does not connect. */
export const repos: Repos = createRepos(db);

/** Runs `fn` in one transaction; every repository it receives writes inside it. */
export function withTx<T>(fn: (tx: Repos) => Promise<T>, options?: TxOptions): Promise<T> {
  return db.$transaction((tx) => fn(createRepos(tx)), options);
}
