import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { isIpAllowed, isValidAllowlistEntry, shouldBlockAdminByAllowlist } from "./allowlist";

describe("isIpAllowed", () => {
  describe("empty allowlist", () => {
    test("fail-open: empty allowlist allows any IP", () => {
      assert.equal(isIpAllowed("192.168.1.1", []), true);
      assert.equal(isIpAllowed("2001:db8::1", []), true);
      assert.equal(isIpAllowed("10.0.0.1", []), true);
    });

    test("fail-open: null or undefined IP with any list", () => {
      assert.equal(isIpAllowed(null, ["192.168.1.0/24"]), true);
      assert.equal(isIpAllowed(undefined, ["192.168.1.0/24"]), true);
    });

    test("fail-open: empty IP with empty list", () => {
      assert.equal(isIpAllowed(null, []), true);
    });
  });

  describe("IPv4 exact match", () => {
    test("exact IP match", () => {
      const allowlist = ["192.168.1.1", "10.0.0.5"];
      assert.equal(isIpAllowed("192.168.1.1", allowlist), true);
      assert.equal(isIpAllowed("10.0.0.5", allowlist), true);
    });

    test("exact IP no match", () => {
      const allowlist = ["192.168.1.1"];
      assert.equal(isIpAllowed("192.168.1.2", allowlist), false);
      assert.equal(isIpAllowed("10.0.0.1", allowlist), false);
    });
  });

  describe("IPv4 CIDR", () => {
    test("CIDR /24 range", () => {
      const allowlist = ["192.168.1.0/24"];
      assert.equal(isIpAllowed("192.168.1.0", allowlist), true);
      assert.equal(isIpAllowed("192.168.1.1", allowlist), true);
      assert.equal(isIpAllowed("192.168.1.128", allowlist), true);
      assert.equal(isIpAllowed("192.168.1.255", allowlist), true);
      assert.equal(isIpAllowed("192.168.2.0", allowlist), false);
      assert.equal(isIpAllowed("192.168.0.255", allowlist), false);
    });

    test("CIDR /32 (single IP)", () => {
      const allowlist = ["10.0.0.5/32"];
      assert.equal(isIpAllowed("10.0.0.5", allowlist), true);
      assert.equal(isIpAllowed("10.0.0.4", allowlist), false);
    });

    test("CIDR /16 range", () => {
      const allowlist = ["10.0.0.0/16"];
      assert.equal(isIpAllowed("10.0.0.0", allowlist), true);
      assert.equal(isIpAllowed("10.0.255.255", allowlist), true);
      assert.equal(isIpAllowed("10.1.0.0", allowlist), false);
    });

    test("CIDR /8 range", () => {
      const allowlist = ["172.16.0.0/8"];
      assert.equal(isIpAllowed("172.16.0.0", allowlist), true);
      assert.equal(isIpAllowed("172.255.255.255", allowlist), true);
      assert.equal(isIpAllowed("173.0.0.0", allowlist), false);
    });

    test("CIDR /0 (allow all)", () => {
      const allowlist = ["0.0.0.0/0"];
      assert.equal(isIpAllowed("192.168.1.1", allowlist), true);
      assert.equal(isIpAllowed("0.0.0.0", allowlist), true);
      assert.equal(isIpAllowed("255.255.255.255", allowlist), true);
    });
  });

  describe("IPv6 exact match", () => {
    test("exact IPv6 match", () => {
      const allowlist = ["2001:db8::1", "fe80::1"];
      assert.equal(isIpAllowed("2001:db8::1", allowlist), true);
      assert.equal(isIpAllowed("fe80::1", allowlist), true);
    });

    test("exact IPv6 no match", () => {
      const allowlist = ["2001:db8::1"];
      assert.equal(isIpAllowed("2001:db8::2", allowlist), false);
    });

    test("IPv6 compressed notation variations", () => {
      const allowlist = ["2001:0db8:0000:0000:0000:0000:0000:0001"];
      assert.equal(isIpAllowed("2001:db8::1", allowlist), true);
      assert.equal(isIpAllowed("2001:db8:0:0:0:0:0:1", allowlist), true);
    });
  });

  describe("IPv6 CIDR", () => {
    test("CIDR /64 range", () => {
      const allowlist = ["2001:db8::/64"];
      assert.equal(isIpAllowed("2001:db8::0", allowlist), true);
      assert.equal(isIpAllowed("2001:db8::1", allowlist), true);
      assert.equal(isIpAllowed("2001:db8::ffff", allowlist), true);
      assert.equal(isIpAllowed("2001:db8:0:0:ffff:ffff:ffff:ffff", allowlist), true);
      assert.equal(isIpAllowed("2001:db8:1::1", allowlist), false);
    });

    test("CIDR /128 (single IP)", () => {
      const allowlist = ["2001:db8::1/128"];
      assert.equal(isIpAllowed("2001:db8::1", allowlist), true);
      assert.equal(isIpAllowed("2001:db8::2", allowlist), false);
    });

    test("CIDR /0 (allow all IPv6)", () => {
      const allowlist = ["::/0"];
      assert.equal(isIpAllowed("2001:db8::1", allowlist), true);
      assert.equal(isIpAllowed("fe80::1", allowlist), true);
      assert.equal(isIpAllowed("::", allowlist), true);
    });

    test("CIDR /48 range", () => {
      const allowlist = ["2001:db8:0:0::/48"];
      assert.equal(isIpAllowed("2001:db8:0:0::", allowlist), true);
      assert.equal(isIpAllowed("2001:db8:0:0::1", allowlist), true);
      assert.equal(isIpAllowed("2001:db8:1:0::1", allowlist), false);
    });
  });

  describe("mixed IPv4 and IPv6", () => {
    test("allowlist with both", () => {
      const allowlist = ["192.168.0.0/16", "2001:db8::/32"];
      assert.equal(isIpAllowed("192.168.1.1", allowlist), true);
      assert.equal(isIpAllowed("2001:db8::1", allowlist), true);
      assert.equal(isIpAllowed("10.0.0.1", allowlist), false);
      assert.equal(isIpAllowed("fe80::1", allowlist), false);
    });
  });

  describe("invalid entries", () => {
    test("invalid CIDR notation is ignored", () => {
      const allowlist = ["192.168.1.0/33", "invalid", "2001:db8::/129"];
      // Invalid entries are filtered; should fail-open on empty list after filtering
      // or the specific valid ranges should be checked
      assert.equal(isIpAllowed("192.168.1.1", allowlist), false);
    });

    test("commented lines are ignored", () => {
      const allowlist = ["# 192.168.1.0/24", "192.168.2.0/24"];
      assert.equal(isIpAllowed("192.168.1.1", allowlist), false);
      assert.equal(isIpAllowed("192.168.2.1", allowlist), true);
    });

    test("whitespace is trimmed", () => {
      const allowlist = ["  192.168.1.0/24  ", "\t10.0.0.0/8\n"];
      assert.equal(isIpAllowed("192.168.1.1", allowlist), true);
      assert.equal(isIpAllowed("10.0.0.1", allowlist), true);
    });
  });

  describe("edge cases", () => {
    test("localhost", () => {
      const allowlist = ["127.0.0.1", "::1"];
      assert.equal(isIpAllowed("127.0.0.1", allowlist), true);
      assert.equal(isIpAllowed("::1", allowlist), true);
      assert.equal(isIpAllowed("127.0.0.2", allowlist), false);
    });

    test("IPv4-mapped IPv6 addresses", () => {
      const allowlist = ["::ffff:192.0.2.1"];
      assert.equal(isIpAllowed("::ffff:192.0.2.1", allowlist), true);
      // Direct IPv4 doesn't match IPv6-mapped entry
      assert.equal(isIpAllowed("192.0.2.1", allowlist), false);
    });

    test("broadcast addresses", () => {
      const allowlist = ["255.255.255.255"];
      assert.equal(isIpAllowed("255.255.255.255", allowlist), true);
    });

    test("empty entry in allowlist", () => {
      const allowlist = ["192.168.1.0/24", "", "10.0.0.1"];
      assert.equal(isIpAllowed("192.168.1.1", allowlist), true);
      assert.equal(isIpAllowed("10.0.0.1", allowlist), true);
    });
  });
});

describe("isValidAllowlistEntry", () => {
  test("accepts blank lines and comments", () => {
    assert.equal(isValidAllowlistEntry(""), true);
    assert.equal(isValidAllowlistEntry("   "), true);
    assert.equal(isValidAllowlistEntry("# a comment"), true);
  });

  test("accepts valid IPv4 and IPv6 addresses and CIDR ranges", () => {
    assert.equal(isValidAllowlistEntry("192.168.1.1"), true);
    assert.equal(isValidAllowlistEntry("192.168.1.0/24"), true);
    assert.equal(isValidAllowlistEntry("2001:db8::1"), true);
    assert.equal(isValidAllowlistEntry("2001:db8::/32"), true);
  });

  test("rejects malformed addresses and out-of-range prefixes", () => {
    assert.equal(isValidAllowlistEntry("not-an-ip"), false);
    assert.equal(isValidAllowlistEntry("999.1.1.1"), false);
    assert.equal(isValidAllowlistEntry("192.168.1.0/33"), false);
    assert.equal(isValidAllowlistEntry("2001:db8::/129"), false);
    assert.equal(isValidAllowlistEntry("192.168.1.0/abc"), false);
  });
});

describe("shouldBlockAdminByAllowlist (proxy decision helper, R22)", () => {
  test("empty list never blocks", () => {
    assert.equal(shouldBlockAdminByAllowlist("203.0.113.9", []), false);
    assert.equal(shouldBlockAdminByAllowlist("unknown", []), false);
  });

  test("an unknown caller IP never blocks, even with a non-empty list (R22 fail-open)", () => {
    assert.equal(shouldBlockAdminByAllowlist("unknown", ["203.0.113.9"]), false);
  });

  test("a known IP not on the list is blocked", () => {
    assert.equal(shouldBlockAdminByAllowlist("198.51.100.1", ["203.0.113.9"]), true);
  });

  test("a known IP on the list is not blocked", () => {
    assert.equal(shouldBlockAdminByAllowlist("203.0.113.9", ["203.0.113.0/24"]), false);
  });
});
