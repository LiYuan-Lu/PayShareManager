import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, describe, it } from "node:test";
import Database from "better-sqlite3";

import type * as AuthModule from "../app/data/auth.server.js";
import type * as FriendDataModule from "../app/data/friend-data.js";
import type * as GroupDataModule from "../app/data/group-data.js";

let auth: typeof AuthModule;
let friendData: typeof FriendDataModule;
let groupData: typeof GroupDataModule;
let testDbPath: string;

function createLegacyDb(dbPath: string) {
  const database = new Database(dbPath);
  database.exec(`
    CREATE TABLE friends (
      unique_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE groups (
      unique_id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      payment_next_id INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE group_members (
      group_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (group_id, member_id)
    );
  `);
  database
    .prepare("INSERT INTO friends (unique_id, name, email, created_at) VALUES (?, ?, ?, ?)")
    .run("legacy-friend", "Legacy Friend", "", "2026-04-27T00:00:00.000Z");
  database
    .prepare(`
      INSERT INTO groups (unique_id, name, description, favorite, created_at, payment_next_id)
      VALUES (?, ?, ?, 0, ?, 0)
    `)
    .run("legacy-group", "Legacy Group", "Migrated from local data", "2026-04-27T00:00:00.000Z");
  database
    .prepare("INSERT INTO group_members (group_id, member_id, name, sort_order) VALUES (?, ?, ?, ?)")
    .run("legacy-group", "0", "You", 0);
  database.close();
}

before(async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), "payshare-auth-test-"));
  const dbPath = path.join(dbDir, "test.db");
  testDbPath = dbPath;
  createLegacyDb(dbPath);
  process.env.PAYSHARE_DB_PATH = dbPath;
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

  it("rate limits repeated failed sign-in attempts by email and IP", async () => {
    await auth.registerUser({
      email: "rate-limit@example.com",
      name: "Rate Limit",
      password: "password123",
    });
    const request = new Request("http://localhost/login", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    for (let index = 0; index < 4; index += 1) {
      await assert.rejects(
        () => auth.loginUserWithRateLimit(request, "rate-limit@example.com", "wrong-password"),
        /Invalid email or password/
      );
    }
    await assert.rejects(
      () => auth.loginUserWithRateLimit(request, "rate-limit@example.com", "wrong-password"),
      /Too many failed sign-in attempts/
    );
    await assert.rejects(
      () => auth.loginUserWithRateLimit(request, "rate-limit@example.com", "password123"),
      /Too many failed sign-in attempts/
    );

    const otherIpRequest = new Request("http://localhost/login", {
      headers: { "x-forwarded-for": "203.0.113.11" },
    });
    const user = await auth.loginUserWithRateLimit(
      otherIpRequest,
      "rate-limit@example.com",
      "password123"
    );
    assert.equal(user.email, "rate-limit@example.com");
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

  it("marks session cookies secure in production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    let cookie: string | null = null;
    try {
      process.env.NODE_ENV = "production";
      const user = await auth.loginUser("alice@example.com", "password123");
      const response = await auth.createUserSession(user.uniqueId, "/");
      cookie = response.headers.get("Set-Cookie");
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }

    assert.match(cookie ?? "", /Secure/);
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

  it("migrates legacy local data to the demo user", async () => {
    const demoUser = await auth.loginUser("demo@payshare.local", "password123");
    const [friends, groups] = await Promise.all([
      friendData.getFriends(demoUser.uniqueId),
      groupData.getGroups(demoUser.uniqueId),
    ]);

    assert.deepEqual(friends.map((friend) => friend.name), ["Legacy Friend"]);
    assert.deepEqual(groups.map((group) => group.name), ["Legacy Group"]);
    assert.equal(demoUser.role, "admin");
  });

  it("stores payment and group membership identities without cached member names", async () => {
    const database = new Database(testDbPath);
    const columns = (tableName: string) =>
      (database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map(
        (column) => column.name
      );

    assert.ok(!columns("group_members").includes("name"));
    assert.ok(!columns("payments").includes("payer_name"));
    assert.ok(!columns("payment_shares").includes("member_name"));
    assert.equal(
      (
        database
          .prepare("SELECT COUNT(*) AS count FROM group_members WHERE member_id = '0'")
          .get() as { count: number }
      ).count,
      0
    );
    database.close();
  });

  it("requires invite codes after an admin creates one", async () => {
    const demoUser = await auth.loginUser("demo@payshare.local", "password123");
    const inviteCode = await auth.createInviteCode(demoUser.uniqueId, {
      code: "FRIEND-ONLY",
      maxUses: 1,
    });
    assert.equal(inviteCode.code, "FRIEND-ONLY");

    await assert.rejects(
      () =>
        auth.registerUser({
          email: "no-code@example.com",
          name: "No Code",
          password: "password123",
        }),
      /valid invite code/
    );

    const invitedUser = await auth.registerUser({
      email: "with-code@example.com",
      name: "With Code",
      password: "password123",
      inviteCode: "friend-only",
    });
    assert.equal(invitedUser.email, "with-code@example.com");

    await assert.rejects(
      () =>
        auth.registerUser({
          email: "code-used@example.com",
          name: "Code Used",
          password: "password123",
          inviteCode: "FRIEND-ONLY",
        }),
      /valid invite code/
    );
    await auth.disableInviteCode(demoUser.uniqueId, inviteCode.code);
  });

  it("lets admins create one-time password reset tokens", async () => {
    const demoUser = await auth.loginUser("demo@payshare.local", "password123");
    const resetUser = await auth.registerUser({
      email: "reset-me@example.com",
      name: "Reset Me",
      password: "password123",
      inviteCode: "FRIEND-ONLY",
    }).catch(async () => {
      const inviteCode = await auth.createInviteCode(demoUser.uniqueId, {
        code: "RESET-CODE",
        maxUses: 1,
      });
      return auth.registerUser({
        email: "reset-me@example.com",
        name: "Reset Me",
        password: "password123",
        inviteCode: inviteCode.code,
      });
    });

    const resetToken = await auth.createManualPasswordReset(demoUser.uniqueId, resetUser.email);
    assert.equal(resetToken.user.email, resetUser.email);

    await auth.resetPasswordWithToken(resetToken.token, "new-password");
    await assert.rejects(
      () => auth.loginUser(resetUser.email, "password123"),
      /Invalid email or password/
    );
    const loggedIn = await auth.loginUser(resetUser.email, "new-password");
    assert.equal(loggedIn.uniqueId, resetUser.uniqueId);
    await assert.rejects(
      () => auth.resetPasswordWithToken(resetToken.token, "another-password"),
      /invalid or has expired/
    );
    await auth.disableInviteCode(demoUser.uniqueId, "RESET-CODE");
  });

  it("updates the current user's profile name", async () => {
    const user = await auth.registerUser({
      email: "profile@example.com",
      name: "Profile Before",
      password: "password123",
    });

    const updated = await auth.updateCurrentUserProfile(user.uniqueId, {
      name: "Profile After",
    });

    assert.equal(updated.name, "Profile After");
    const loggedIn = await auth.loginUser("profile@example.com", "password123");
    assert.equal(loggedIn.name, "Profile After");
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

  it("creates mutual friend records when an invite is accepted", async () => {
    const alice = await auth.loginUser("alice@example.com", "password123");
    const charlie = await auth.registerUser({
      email: "charlie@example.com",
      name: "Charlie",
      password: "password123",
    });

    const invite = await friendData.createFriendInvite(alice.uniqueId, "charlie@example.com");
    assert.equal(invite.sender.email, "alice@example.com");
    assert.equal(invite.recipient.email, "charlie@example.com");
    assert.equal(invite.status, "pending");

    const receivedInvites = await friendData.getReceivedFriendInvites(charlie.uniqueId);
    assert.equal(receivedInvites.length, 1);
    assert.equal(receivedInvites[0].uniqueId, invite.uniqueId);

    const acceptedInvite = await friendData.respondToFriendInvite(
      charlie.uniqueId,
      invite.uniqueId,
      "accepted"
    );
    assert.equal(acceptedInvite.status, "accepted");

    const aliceFriends = await friendData.getFriends(alice.uniqueId);
    const charlieFriends = await friendData.getFriends(charlie.uniqueId);

    assert.ok(aliceFriends.some((friend) => friend.email === "charlie@example.com"));
    assert.ok(charlieFriends.some((friend) => friend.email === "alice@example.com"));
  });

  it("shows groups to accepted account friends added as members", async () => {
    const owner = await auth.registerUser({
      email: "group-owner@example.com",
      name: "Group Owner",
      password: "password123",
    });
    const member = await auth.registerUser({
      email: "group-member@example.com",
      name: "Group Member",
      password: "password123",
    });

    const invite = await friendData.createFriendInvite(owner.uniqueId, member.email);
    await friendData.respondToFriendInvite(member.uniqueId, invite.uniqueId, "accepted");
    const ownerFriend = (await friendData.getFriends(owner.uniqueId)).find(
      (friend) => friend.email === member.email
    );
    assert.ok(ownerFriend?.uniqueId);

    const group = await groupData.createEmptyGroup(owner.uniqueId);
    await groupData.updateGroup(
      owner.uniqueId,
      group.uniqueId ?? "",
      { name: "Shared Trip", description: "Visible to account members" },
      [
        ...(group.members ?? []),
        { uniqueId: ownerFriend.uniqueId, name: ownerFriend.name },
      ]
    );

    const memberGroups = await groupData.getGroups(member.uniqueId);
    const sharedGroup = memberGroups.find((item) => item.uniqueId === group.uniqueId);

    assert.equal(sharedGroup?.name, "Shared Trip");
    assert.equal(sharedGroup?.viewerMemberId, ownerFriend.uniqueId);
    assert.ok(sharedGroup?.members?.some((item) => item.name === "You"));
  });

  it("tracks who created and last updated a shared payment", async () => {
    const owner = await auth.registerUser({
      email: "payment-owner@example.com",
      name: "Payment Owner",
      password: "password123",
    });
    const member = await auth.registerUser({
      email: "payment-member@example.com",
      name: "Payment Member",
      password: "password123",
    });

    const invite = await friendData.createFriendInvite(owner.uniqueId, member.email);
    await friendData.respondToFriendInvite(member.uniqueId, invite.uniqueId, "accepted");
    const ownerFriend = (await friendData.getFriends(owner.uniqueId)).find(
      (friend) => friend.email === member.email
    );
    assert.ok(ownerFriend?.uniqueId);

    const group = await groupData.createEmptyGroup(owner.uniqueId);
    const members = [
      ...(group.members ?? []),
      { uniqueId: ownerFriend.uniqueId, name: ownerFriend.name },
    ];
    await groupData.updateGroup(
      owner.uniqueId,
      group.uniqueId ?? "",
      { name: "Shared Payment Audit" },
      members
    );

    await groupData.addPayment(owner.uniqueId, group.uniqueId ?? "", {
      name: "Lunch",
      payer: members[0],
      cost: 42,
      currency: "JPY",
      shareMember: members,
      splitMode: "equal",
    });

    const database = new Database(testDbPath);
    assert.equal(
      (
        database
          .prepare(`
            SELECT COUNT(*) AS count
            FROM group_members
            WHERE group_id = ? AND member_id = '0'
          `)
          .get(group.uniqueId) as { count: number }
      ).count,
      0
    );
    assert.equal(
      (
        database
          .prepare("SELECT COUNT(*) AS count FROM payments WHERE group_id = ? AND payer_id = '0'")
          .get(group.uniqueId) as { count: number }
      ).count,
      0
    );
    assert.equal(
      (
        database
          .prepare(`
            SELECT COUNT(*) AS count
            FROM payment_shares
            WHERE group_id = ? AND member_id = '0'
          `)
          .get(group.uniqueId) as { count: number }
      ).count,
      0
    );
    database.close();

    let sharedGroup = await groupData.getGroup(member.uniqueId, group.uniqueId ?? "");
    let payment = sharedGroup?.paymentList?.get(0);
    assert.equal(payment?.createdBy?.email, owner.email);
    assert.equal(payment?.updatedBy, undefined);
    assert.equal(payment?.payer.name, owner.name);
    assert.equal(
      groupData.calculateMemberShouldPay(payment!, sharedGroup?.viewerMemberId ?? ""),
      21
    );

    const memberSettlements = groupData.calculateGroupSettlementByCurrency(sharedGroup);
    assert.deepEqual(
      memberSettlements[0].settlement.memberSettlements.map((item) => ({
        member: item.member.name,
        paid: item.paid,
        share: item.share,
        net: item.net,
      })),
      [
        { member: owner.name, paid: 42, share: 21, net: 21 },
        { member: "You", paid: 0, share: 21, net: -21 },
      ]
    );

    const memberFriend = (await friendData.getFriends(member.uniqueId)).find(
      (friend) => friend.email === owner.email
    );
    assert.ok(memberFriend?.uniqueId);
    assert.deepEqual(await friendData.getFriendUsage(owner.uniqueId, ownerFriend.uniqueId), {
      groupCount: 1,
      paymentCount: 1,
    });
    assert.deepEqual(await friendData.getFriendUsage(member.uniqueId, memberFriend.uniqueId), {
      groupCount: 1,
      paymentCount: 1,
    });
    await assert.rejects(
      () => friendData.deleteFriend(member.uniqueId, memberFriend.uniqueId ?? ""),
      /cannot be deleted/
    );

    await groupData.updatePayment(member.uniqueId, group.uniqueId ?? "", 0, {
      name: "Lunch and drinks",
      payer: members[1],
      cost: 48,
      shareMember: members,
      splitMode: "equal",
    });

    sharedGroup = await groupData.getGroup(owner.uniqueId, group.uniqueId ?? "");
    payment = sharedGroup?.paymentList?.get(0);
    assert.equal(payment?.currency, "JPY");
    assert.equal(payment?.createdBy?.email, owner.email);
    assert.equal(payment?.updatedBy?.email, member.email);
    assert.match(payment?.updatedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("friend invites", () => {
  it("rejects invites to yourself and unknown emails", async () => {
    const sender = await auth.registerUser({
      email: "invite-self@example.com",
      name: "Invite Self",
      password: "password123",
    });

    await assert.rejects(
      () => friendData.createFriendInvite(sender.uniqueId, "invite-self@example.com"),
      /cannot invite yourself/
    );
    await assert.rejects(
      () => friendData.createFriendInvite(sender.uniqueId, "missing@example.com"),
      /No account found/
    );
  });

  it("prevents duplicate pending invites in either direction", async () => {
    const sender = await auth.registerUser({
      email: "invite-duplicate-a@example.com",
      name: "Duplicate A",
      password: "password123",
    });
    const recipient = await auth.registerUser({
      email: "invite-duplicate-b@example.com",
      name: "Duplicate B",
      password: "password123",
    });

    await friendData.createFriendInvite(sender.uniqueId, recipient.email);

    await assert.rejects(
      () => friendData.createFriendInvite(sender.uniqueId, recipient.email),
      /already a pending invite/
    );
    await assert.rejects(
      () => friendData.createFriendInvite(recipient.uniqueId, sender.email),
      /already a pending invite/
    );
  });

  it("declines invites without creating friend records", async () => {
    const sender = await auth.registerUser({
      email: "invite-decline-a@example.com",
      name: "Decline A",
      password: "password123",
    });
    const recipient = await auth.registerUser({
      email: "invite-decline-b@example.com",
      name: "Decline B",
      password: "password123",
    });

    const invite = await friendData.createFriendInvite(sender.uniqueId, recipient.email);
    const declinedInvite = await friendData.respondToFriendInvite(
      recipient.uniqueId,
      invite.uniqueId,
      "declined"
    );
    assert.equal(declinedInvite.status, "declined");

    const senderFriends = await friendData.getFriends(sender.uniqueId);
    const recipientFriends = await friendData.getFriends(recipient.uniqueId);
    assert.equal(senderFriends.some((friend) => friend.email === recipient.email), false);
    assert.equal(recipientFriends.some((friend) => friend.email === sender.email), false);
    assert.deepEqual(await friendData.getReceivedFriendInvites(recipient.uniqueId), []);
  });

  it("prevents accepting an invite twice or from the wrong account", async () => {
    const sender = await auth.registerUser({
      email: "invite-owner-a@example.com",
      name: "Owner A",
      password: "password123",
    });
    const recipient = await auth.registerUser({
      email: "invite-owner-b@example.com",
      name: "Owner B",
      password: "password123",
    });
    const stranger = await auth.registerUser({
      email: "invite-owner-c@example.com",
      name: "Owner C",
      password: "password123",
    });

    const invite = await friendData.createFriendInvite(sender.uniqueId, recipient.email);

    await assert.rejects(
      () => friendData.respondToFriendInvite(stranger.uniqueId, invite.uniqueId, "accepted"),
      /not found/
    );

    await friendData.respondToFriendInvite(recipient.uniqueId, invite.uniqueId, "accepted");
    await assert.rejects(
      () => friendData.respondToFriendInvite(recipient.uniqueId, invite.uniqueId, "accepted"),
      /already been handled/
    );
  });

  it("prevents inviting a user who is already a friend", async () => {
    const sender = await auth.registerUser({
      email: "invite-existing-a@example.com",
      name: "Existing A",
      password: "password123",
    });
    const recipient = await auth.registerUser({
      email: "invite-existing-b@example.com",
      name: "Existing B",
      password: "password123",
    });

    const invite = await friendData.createFriendInvite(sender.uniqueId, recipient.email);
    await friendData.respondToFriendInvite(recipient.uniqueId, invite.uniqueId, "accepted");

    await assert.rejects(
      () => friendData.createFriendInvite(sender.uniqueId, recipient.email),
      /already in your friends/
    );
  });

  it("restores a deleted friend without sending a duplicate invite when the other side still has the relationship", async () => {
    const sender = await auth.registerUser({
      email: "invite-restore-a@example.com",
      name: "Restore A",
      password: "password123",
    });
    const recipient = await auth.registerUser({
      email: "invite-restore-b@example.com",
      name: "Restore B",
      password: "password123",
    });

    const invite = await friendData.createFriendInvite(sender.uniqueId, recipient.email);
    await friendData.respondToFriendInvite(recipient.uniqueId, invite.uniqueId, "accepted");

    const senderFriends = await friendData.getFriends(sender.uniqueId);
    const recipientFriends = await friendData.getFriends(recipient.uniqueId);
    const recipientFriendForSender = senderFriends.find(
      (friend) => friend.email === recipient.email
    );
    assert.ok(recipientFriendForSender?.uniqueId);
    assert.ok(recipientFriends.some((friend) => friend.email === sender.email));

    await friendData.deleteFriend(sender.uniqueId, recipientFriendForSender.uniqueId);
    assert.equal(
      (await friendData.getFriends(sender.uniqueId)).some(
        (friend) => friend.email === recipient.email
      ),
      false
    );

    const restoredInvite = await friendData.createFriendInvite(sender.uniqueId, recipient.email);
    assert.equal(restoredInvite.status, "accepted");
    assert.equal(restoredInvite.uniqueId, "");
    assert.equal(
      (await friendData.getFriends(sender.uniqueId)).some(
        (friend) => friend.email === recipient.email
      ),
      true
    );
    assert.deepEqual(await friendData.getReceivedFriendInvites(recipient.uniqueId), []);
  });
});
