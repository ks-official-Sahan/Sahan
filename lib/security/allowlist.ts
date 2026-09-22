// Pure IP allowlist matching for IPv4, IPv6, and CIDR notation.
// Unit tested; no database or external dependencies. Design:
// docs/plan/admin-cms-adr.md section 6.2 and risk R22.

import { UNKNOWN_IP } from "./ip";

/**
 * Syntax check for one allowlist entry (IPv4, IPv6, or either in CIDR
 * notation), for the settings screen to reject junk input before it is
 * saved. A blank line or a `#` comment is treated as valid (ignored by
 * isIpAllowed), since the editor stores the list as free text.
 */
export function isValidAllowlistEntry(entry: string): boolean {
  const trimmed = entry.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) return true;

  const [address, prefixStr] = trimmed.split("/");
  if (prefixStr !== undefined) {
    if (!/^\d+$/.test(prefixStr)) return false;
    const prefix = Number(prefixStr);
    const max = address.includes(":") ? 128 : 32;
    if (prefix < 0 || prefix > max) return false;
  }

  if (address.includes(":")) return ipv6ToNumber(address) !== null;
  return ipv4ToNumber(address) !== null;
}

/**
 * The proxy's admin allowlist decision (responsibility 5, section 4.5):
 * should this request to /admin or /api/admin be rewritten to the locked
 * path? False (never block) when the list is empty, and also when the
 * caller's IP could not be determined at all — the "unknown" bucket every
 * caller shares without TRUSTED_PROXY_HOPS (risk R22). Failing closed on an
 * unknown IP would turn "turn the allowlist on" into "lock everyone out,
 * including the owner", the moment TRUSTED_PROXY_HOPS is unset; this keeps
 * the allowlist a real filter for identified callers without that trap.
 * Pure and unit tested so this exact decision is pinned down independently
 * of proxy.ts, which only calls it and logs the outcome.
 */
export function shouldBlockAdminByAllowlist(ip: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return false;
  if (ip === UNKNOWN_IP) return false;
  return !isIpAllowed(ip, allowlist);
}

/**
 * Check if an IP address matches the allowlist.
 * Supports IPv4 (single IPs and CIDR), IPv6 (single IPs and CIDR), and exact matches.
 * Returns true if the IP is in the allowlist, or if the allowlist is empty (fail-open).
 *
 * @param ip The IP address to check (IPv4 or IPv6)
 * @param allowlist Array of allowed IPs or CIDR ranges
 * @returns true if IP is allowed or list is empty
 */
export function isIpAllowed(ip: string | null | undefined, allowlist: string[]): boolean {
  // Fail-open: if no IP or no allowlist, allow access
  if (!ip || !allowlist || allowlist.length === 0) return true;

  // Remove invalid entries and normalize
  const validEntries = allowlist
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !entry.startsWith("#"));

  if (validEntries.length === 0) return true;

  // Check each entry
  for (const entry of validEntries) {
    if (matchesIpOrCidr(ip, entry)) return true;
  }

  return false;
}

/**
 * Check if an IP matches a single entry (exact IP or CIDR block).
 * Handles IPv4 and IPv6.
 */
function matchesIpOrCidr(ip: string, entry: string): boolean {
  // Exact match (for IPv4, this is usually exact; for IPv6 normalize)
  if (ip === entry) return true;

  // For IPv6, try normalized comparison
  if (ip.includes(":") && entry.includes(":")) {
    const normalizedIp = normalizeIpv6(ip);
    const normalizedEntry = normalizeIpv6(entry);
    if (normalizedIp === normalizedEntry) return true;
  }

  // CIDR notation (contains /)
  if (entry.includes("/")) {
    return isIpInCidr(ip, entry);
  }

  return false;
}

/**
 * Normalize an IPv6 address to a consistent format (full colon-separated groups).
 * This allows matching different representations of the same address.
 */
function normalizeIpv6(ip: string): string {
  ip = ip.trim();

  // Handle :: (zero compression)
  if (ip.includes("::")) {
    const [left, right] = ip.split("::");
    const leftParts = left ? left.split(":").filter(Boolean) : [];
    const rightParts = right ? right.split(":").filter(Boolean) : [];
    const totalParts = leftParts.length + rightParts.length;

    if (totalParts >= 8) return ip; // Invalid: too many groups

    const zeroParts = Array(8 - totalParts).fill("0");
    const allParts = [...leftParts, ...zeroParts, ...rightParts];
    ip = allParts.join(":");
  }

  // Now we have 8 groups separated by :
  const groups = ip.split(":");
  if (groups.length !== 8) return ip;

  // Normalize each group: lowercase and pad with leading zeros to 4 chars
  return groups.map((g) => g.toLowerCase().padStart(4, "0")).join(":");
}

/**
 * Check if an IP is within a CIDR block.
 * Handles both IPv4 and IPv6 CIDR notation.
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split("/");
  if (!network || !prefixStr) return false;

  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix)) return false;

  if (ip.includes(":")) {
    // IPv6
    return isIpv6InCidr(ip, network, prefix);
  } else {
    // IPv4
    return isIpv4InCidr(ip, network, prefix);
  }
}

/**
 * IPv4 CIDR check using bitwise operations.
 */
function isIpv4InCidr(ip: string, network: string, prefix: number): boolean {
  if (prefix < 0 || prefix > 32) return false;

  const ipNum = ipv4ToNumber(ip);
  const networkNum = ipv4ToNumber(network);

  if (ipNum === null || networkNum === null) return false;

  // Create mask: shift 1s to the left by (32 - prefix) positions
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Convert IPv4 string to a 32-bit number.
 * e.g., "192.168.1.1" -> 3232235777
 */
function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let num = 0;
  for (let i = 0; i < 4; i++) {
    const part = parseInt(parts[i], 10);
    if (isNaN(part) || part < 0 || part > 255) return null;
    num = (num << 8) | part;
  }

  return num >>> 0; // Ensure unsigned
}

/**
 * IPv6 CIDR check using BigInt for 128-bit addresses.
 */
function isIpv6InCidr(ip: string, network: string, prefix: number): boolean {
  if (prefix < 0 || prefix > 128) return false;

  const ipBig = ipv6ToNumber(ip);
  const networkBig = ipv6ToNumber(network);

  if (ipBig === null || networkBig === null) return false;

  // Create mask using BigInt (all 1s = 2^128 - 1)
  const max128bit = BigInt("340282366920938463463374607431768211455"); // 2^128 - 1
  const mask = prefix === 0 ? BigInt(0) : max128bit << (BigInt(128) - BigInt(prefix));

  return (ipBig & mask) === (networkBig & mask);
}

/**
 * Convert IPv6 string to a 128-bit number (BigInt).
 * Handles compressed notation (::) and full notation.
 * e.g., "2001:db8::1" -> BigInt representation
 */
function ipv6ToNumber(ip: string): bigint | null {
  // Remove leading/trailing spaces
  ip = ip.trim();

  // Handle IPv6-mapped IPv4 addresses (::ffff:192.0.2.1)
  if (ip.includes(".")) {
    const parts = ip.split(":");
    if (parts.length > 0 && parts[parts.length - 1].includes(".")) {
      const ipv4Part = parts.pop();
      if (ipv4Part) {
        const ipv4Num = ipv4ToNumber(ipv4Part);
        if (ipv4Num !== null) {
          // Reconstruct the IPv6 part
          parts.push(((ipv4Num >>> 16) & 0xffff).toString(16));
          parts.push((ipv4Num & 0xffff).toString(16));
          ip = parts.join(":");
        }
      }
    }
  }

  // Handle :: (zero compression)
  if (ip.includes("::")) {
    const [left, right] = ip.split("::");
    const leftParts = left ? left.split(":").filter(Boolean) : [];
    const rightParts = right ? right.split(":").filter(Boolean) : [];
    const totalParts = leftParts.length + rightParts.length;

    if (totalParts >= 8) return null; // Invalid: too many groups

    const zeroParts = Array(8 - totalParts).fill("0");
    const allParts = [...leftParts, ...zeroParts, ...rightParts];
    ip = allParts.join(":");
  }

  // Split into groups and convert each to a 16-bit number
  const groups = ip.split(":");
  if (groups.length !== 8) return null;

  let result = BigInt(0);
  for (let i = 0; i < 8; i++) {
    const group = groups[i].trim();
    if (group === "") return null;

    const num = parseInt(group, 16);
    if (isNaN(num) || num < 0 || num > 0xffff) return null;

    result = (result << BigInt(16)) | BigInt(num);
  }

  return result;
}
