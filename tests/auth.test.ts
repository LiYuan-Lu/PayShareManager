import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, describe, it } from "node:test";

import type * as AuthModule from "../app/data/auth.server.js";
import type * as FriendDataModule from "../app/data/friend-data.js";
import type * as GroupDataModule from "../app/data/group-data.js";

let auth: typeof AuthModule;
let friendData: typeof FriendDataModule;
let groupData: typeof GroupDataModule;

before(async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), "payshare-auth-test-"));
  process.env.PAYSHARE_DB_PATH = path.join(dbDir, "test.db");
  auth = await import("../app/data/auth.server.js");
  friendData = await import("../app/data/friend-data.js");
  groupData = await import("../app/data/group-data.js");
});

describe("auth", () => {
  it("registers users and rejects duplicate emails", async () => {
    const user = await auth.registerUser({
      email: "Alice@Example.com",
      name: "Alice",
      password: "password123",
    });

    assert.equal(user.email, "alice@example.com");
    assert.equal(user.name, "Alice");

    await assert.rejects(
      () =>
        auth.registerUser({
          email: "alice@example.com",
          name: "Another Alice",
          password: "password123",
        }),
      /already exists/
    );
  });

  it("logs in users with valid credentials only", async () => {
    const user = await auth.loginUser("alice@example.com", "password123");

    assert.equal(user.email, "alice@example.com");
    await assert.rejects(
      () => auth.loginUser("alice@example.com", "wrong-password"),
      /Invalid email or password/
    );
  });

  it("creates a session cookie that resolves the current user", async () => {
    const user = await auth.loginUser("alice@example.com", "password123");
    const response = await auth.createUserSession(user.uniqueId, "/");
    const cookie = response.headers.get("Set-Cookie");

    assert.equal(response.status, 302);
    assert.match(response.headers.get("Location") ?? "", /^\//);
    assert.match(cookie ?? "", /payshare_session=/);
    assert.match(cookie ?? "", /HttpOnly/);

    const currentUser = await auth.getCurrentUser(
      new Request("http://localhost/", {
        headers: { Cookie: cookie ?? "" },
      })
    );

    assert.equal(currentUser?.uniqueId, user.uniqueId);
  });

  it("redirects unauthenticated requests to login", async () => {
    await assert.rejects(
      () => auth.requireUser(new Request("http://localhost/groups/123?tab=payments")),
      (error) => {
        assert.ok(error instanceof Response);
        assert.equal(error.status, 302);
        assert.equal(
          error.headers.get("Location"),
          "/login?redirectTo=%2Fgroups%2F123%3Ftab%3Dpayments"
        );
        return true;
      }
    );
  });
});

describe("user scoped data", () => {
  it("keeps friends and groups isolated by owner user", async () => {
    const alice = await auth.loginUser("alice@example.com", "password123");
    const bob = await auth.registerUser({
      email: "bob@example.com",
      name: "Bob",
      password: "password123",
    });

    await friendData.createFriend(alice.uniqueId, { name: "Alice Friend", email: "" });
    const aliceGroup = await groupData.createEmptyGroup(alice.uniqueId);
    await groupData.updateGroup(
      alice.uniqueId,
      aliceGroup.uniqueId ?? "",
      { name: "Alice Group", description: "Private" },
      aliceGroup.members
    );

    const aliceFriends = await friendData.getFriends(alice.uniqueId);
    const bobFriends = await friendData.getFriends(bob.uniqueId);
    const aliceGroups = await groupData.getGroups(alice.uniqueId);
    const bobGroups = await groupData.getGroups(bob.uniqueId);

    assert.equal(aliceFriends.length, 1);
    assert.equal(aliceFriends[0].name, "Alice Friend");
    assert.equal(bobFriends.length, 0);
    assert.equal(aliceGroups.length, 1);
    assert.equal(aliceGroups[0].name, "Alice Group");
    assert.equal(bobGroups.length, 0);

    const originalLog = console.log;
    let bobCannotReadAliceGroup;
    try {
      console.log = () => {};
      bobCannotReadAliceGroup = await groupData.getGroup(
        bob.uniqueId,
        aliceGroup.uniqueId ?? ""
      );
    } finally {
      console.log = originalLog;
    }
    assert.equal(bobCannotReadAliceGroup, null);
  });
});
