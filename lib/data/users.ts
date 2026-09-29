import type { RoleName } from "@/lib/auth/permissions";

export interface UserAccessState {
  id: string;
  role: RoleName;
  disabledAt: Date | null;
}

export interface UserRepo {
  findAccessState(id: string): Promise<UserAccessState | null>;
}
