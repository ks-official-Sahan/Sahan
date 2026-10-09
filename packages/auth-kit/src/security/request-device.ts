import { headers } from "next/headers";

import { requestDetailsFromHeaders, type RequestDeviceDetails } from "./device";

export type { RequestDeviceDetails } from "./device";

/** Next.js wrapper: the current request's device details. Outside Next.js use `requestDetailsFromHeaders` from ./device. */
export async function requestDetails(name: string | null): Promise<RequestDeviceDetails> {
  return requestDetailsFromHeaders(await headers(), name);
}
