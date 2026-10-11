import { db } from "@/lib/db/prisma";

import type { Repos, TxOptions } from "../repos";
import { auditRepo } from "./audit";
import { authTokenRepo } from "./auth-tokens";
import { chatRepo, chatTrainingRepo } from "./chat";
import type { DbClient } from "./client";
import { experienceRepo, projectRepo, serviceGroupRepo, serviceRepo, skillGroupRepo, skillRepo } from "./collections";
import { contentBlockRepo } from "./content";
import { inquiryRepo } from "./inquiries";
import { dashboardRepo, maintenanceRepo } from "./maintenance";
import { mediaRepo } from "./media";
import { postRepo, postRevisionRepo } from "./posts";
import { rolePermissionRepo } from "./role-permissions";
import { roleRepo } from "./roles";
import { settingRepo } from "./settings";
import { trashRepo } from "./trash";
import { userSessionRepo } from "./user-sessions";
import { userRepo } from "./users";

export { authAdapter } from "./auth-adapter";
export { isDbUnavailable } from "./errors";

export function createRepos(client: DbClient): Repos {
  return {
    audit: auditRepo(client),
    authTokens: authTokenRepo(client),
    chat: chatRepo(client),
    chatTraining: chatTrainingRepo(client),
    contentBlocks: contentBlockRepo(client),
    dashboard: dashboardRepo(client),
    experiences: experienceRepo(client),
    inquiries: inquiryRepo(client),
    maintenance: maintenanceRepo(client),
    media: mediaRepo(client),
    postRevisions: postRevisionRepo(client),
    posts: postRepo(client),
    projects: projectRepo(client),
    rolePermissions: rolePermissionRepo(client),
    roles: roleRepo(client),
    serviceGroups: serviceGroupRepo(client),
    services: serviceRepo(client),
    sessions: userSessionRepo(client),
    settings: settingRepo(client),
    skillGroups: skillGroupRepo(client),
    skills: skillRepo(client),
    trash: trashRepo(client),
    users: userRepo(client),
  };
}

/** Repositories on the shared client. `db` is a lazy proxy, so this does not connect. */
export const repos: Repos = createRepos(db);

/** Runs `fn` in one transaction; every repository it receives writes inside it. */
export function withTx<T>(fn: (tx: Repos) => Promise<T>, options?: TxOptions): Promise<T> {
  return db.$transaction((tx) => fn(createRepos(tx)), options);
}
