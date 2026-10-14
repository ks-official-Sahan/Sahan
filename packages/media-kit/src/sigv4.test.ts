import assert from "node:assert/strict";
import { test } from "node:test";

import { EMPTY_PAYLOAD_SHA256, presignS3Url, signS3Request } from "./sigv4";

// The examples from AWS's "Signature Version 4: Amazon S3" documentation.
const credentials = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" };
const scope = { region: "us-east-1" };
const now = new Date(Date.UTC(2013, 4, 24, 0, 0, 0));

test("a presigned GET matches AWS's query-string example", () => {
  const url = new URL(presignS3Url({ method: "GET", url: "https://examplebucket.s3.amazonaws.com/test.txt", expiresSeconds: 86_400, credentials, scope, now }));
  assert.equal(url.searchParams.get("X-Amz-Signature"), "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  assert.equal(url.searchParams.get("X-Amz-Credential"), "AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request");
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "host");
  assert.equal(url.pathname, "/test.txt");
});

test("a header-signed GET matches AWS's Authorization-header example", () => {
  const headers = signS3Request({
    method: "GET",
    url: "https://examplebucket.s3.amazonaws.com/test.txt",
    headers: { range: "bytes=0-9" },
    payloadHash: EMPTY_PAYLOAD_SHA256,
    credentials,
    scope,
    now,
  });
  assert.equal(
    headers.authorization,
    "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
  );
  assert.equal(headers["x-amz-date"], "20130524T000000Z");
  assert.equal(headers.host, undefined, "fetch sets Host itself");
});

test("an upload URL pins content type and length, and keys are encoded once", () => {
  const url = new URL(
    presignS3Url({
      method: "PUT",
      url: "https://acc.r2.cloudflarestorage.com/bucket/uploads/a b+c.png",
      headers: { "content-type": "image/png", "content-length": "1234" },
      expiresSeconds: 300,
      credentials,
      scope: { region: "auto" },
      now,
    })
  );
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "content-length;content-type;host");
  assert.equal(url.pathname, "/bucket/uploads/a%20b%2Bc.png");
  assert.match(url.searchParams.get("X-Amz-Credential") ?? "", /\/auto\/s3\/aws4_request$/);
  assert.throws(() => presignS3Url({ method: "PUT", url: "https://x.example/k", expiresSeconds: 0, credentials, scope }), /expiresSeconds/);
});
