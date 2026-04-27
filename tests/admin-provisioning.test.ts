import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

describe("admin provisioning", () => {
  it("creates and updates the configured admin account from environment variables", async () => {
    const dbDir = mkdtempSync(path.join(tmpdir(), "payshare-admin-test-"));
    process.env.PAYSHARE_DB_PATH = path.join(dbDir, "test.db");
    process.env.PAYSHARE_ADMIN_EMAIL = "owner@example.com";
    process.env.PAYSHARE_ADMIN_PASSWORD = "owner-password";

    const auth = await import(
      `../app/data/auth.server.js?admin-provisioning=${Date.now()}`
    );

    const admin = await auth.loginUser("owner@example.com", "owner-password");
    assert.equal(admin.email, "owner@example.com");
    assert.equal(admin.role, "admin");
  });
});
