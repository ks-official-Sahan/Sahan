import type { AuditRepo } from "./audit";
import type { AuthTokenRepo } from "./auth-tokens";
import type { ChatRepo, ChatTrainingRepo } from "./chat";
import type { InquiryRepo } from "./inquiries";
import type { SettingRepo } from "./settings";
import type { UserSessionRepo } from "./user-sessions";
import type { UserRepo } from "./users";

/**
 * Every repository, bound to one database client. `repos` (lib/data) uses the
 * shared client; `withTx` hands a set bound to one transaction, so a mutation
 * and its audit row commit or roll back together.
 */
export interface Repos {
  audit: AuditRepo;
  authTokens: AuthTokenRepo;
  chat: ChatRepo;
  chatTraining: ChatTrainingRepo;
  inquiries: InquiryRepo;
  sessions: UserSessionRepo;
  settings: SettingRepo;
  users: UserRepo;
}

export interface TxOptions {
  /** Longest the transaction may run, in ms. */
  timeout?: number;
  /** Longest to wait for a connection, in ms. */
  maxWait?: number;
}
