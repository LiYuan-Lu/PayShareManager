import { scryptSync } from "node:crypto";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { defaultCurrency, normalizeCurrency } from "../currencies.js";
import type { FriendMutation } from "../friend-data";
import type {
  GroupMutation,
  GroupRecord,
  Member,
  Payment,
  PaymentShare,
} from "../group-data";
import type { DataRepositories } from "./types";
import type { FriendInviteRecord, InviteCodeRecord, UserRecord } from "./types";

type DbUser = {
  unique_id: string;
  email: string;
  name: string;
  password_hash: string;
  role: "admin" | "user";
  created_at: string;
};

type DbInviteCode = {
  code: string;
  created_by_user_id: string;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  disabled_at: string | null;
  created_at: string;
};

type DbPasswordResetToken = {
  token_hash: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_role: "admin" | "user";
  created_by_user_id: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

type DbFriend = {
  unique_id: string;
  owner_user_id: string;
  friend_user_id: string | null;
  name: string;
  email: string;
  created_at: string;
};

type DbFriendInvite = {
  unique_id: string;
  sender_user_id: string;
  sender_email: string;
  sender_name: string;
  recipient_user_id: string;
  recipient_email: string;
  recipient_name: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
};

type DbGroup = {
  unique_id: string;
  owner_user_id: string;
  owner_name: string;
  name: string | null;
  description: string | null;
  favorite: number;
  created_at: string;
  settled_at: string | null;
  payment_next_id: number;
};

type DbMember = {
  member_id: string;
  member_user_id: string | null;
  name: string;
};

type DbPayment = {
  payment_id: number;
  name: string;
  payer_id: string;
  payer_name: string;
  cost: number;
  currency: string | null;
  split_mode: "equal" | "shares" | null;
  created_at: string | null;
  created_by_user_id: string | null;
  created_by_email: string | null;
  created_by_name: string | null;
  updated_by_user_id: string | null;
  updated_by_email: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
  you_should_pay: number | null;
};

type DbPaymentShare = {
  member_id: string;
  member_name: string;
  shares: number;
};

const kUser: Member = { uniqueId: "0", name: "You" };
const demoUserId = "demo-user";
const demoPasswordHash =
  "scrypt:demo-auth-salt-2026:a2ef900b153f1a7ab22894746d7027b6d5e9c92c0bef7f50bfaf76c04aca6d47b565840fe690dd05b2c6389e6936c53025660885dfe14bce9d601790c008d0c5";
const envAdminPasswordSalt = "payshare-env-admin-2026";
const defaultDbPath = path.join(process.cwd(), "data", "payshare.db");
const dbPath = process.env.PAYSHARE_DB_PATH || defaultDbPath;
let db: Database.Database | null = null;

function getDb() {
  if (db) {
    return db;
  }

  mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      unique_id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(unique_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      created_by_user_id TEXT NOT NULL,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      disabled_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(unique_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invite_code_uses (
      code TEXT NOT NULL,
      user_id TEXT NOT NULL,
      used_at TEXT NOT NULL,
      PRIMARY KEY (code, user_id),
      FOREIGN KEY (code) REFERENCES invite_codes(code) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(unique_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(unique_id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_user_id) REFERENCES users(unique_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS friends (
      unique_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL DEFAULT '${demoUserId}',
      friend_user_id TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(unique_id) ON DELETE CASCADE,
      FOREIGN KEY (friend_user_id) REFERENCES users(unique_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS friend_invites (
      unique_id TEXT PRIMARY KEY,
      sender_user_id TEXT NOT NULL,
      recipient_user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      responded_at TEXT,
      FOREIGN KEY (sender_user_id) REFERENCES users(unique_id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_user_id) REFERENCES users(unique_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS groups (
      unique_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL DEFAULT '${demoUserId}',
      name TEXT,
      description TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      settled_at TEXT,
      payment_next_id INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (owner_user_id) REFERENCES users(unique_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_user_id TEXT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (group_id, member_id),
      FOREIGN KEY (group_id) REFERENCES groups(unique_id) ON DELETE CASCADE,
      FOREIGN KEY (member_user_id) REFERENCES users(unique_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      group_id TEXT NOT NULL,
      payment_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      payer_id TEXT NOT NULL,
      payer_name TEXT NOT NULL,
      cost REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT '${defaultCurrency}',
      split_mode TEXT NOT NULL DEFAULT 'equal',
      created_at TEXT,
      created_by_user_id TEXT,
      updated_by_user_id TEXT,
      updated_at TEXT,
      you_should_pay REAL,
      PRIMARY KEY (group_id, payment_id),
      FOREIGN KEY (group_id) REFERENCES groups(unique_id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_user_id) REFERENCES users(unique_id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by_user_id) REFERENCES users(unique_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payment_shares (
      group_id TEXT NOT NULL,
      payment_id INTEGER NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      shares INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (group_id, payment_id, member_id),
      FOREIGN KEY (group_id, payment_id) REFERENCES payments(group_id, payment_id) ON DELETE CASCADE
    );
  `);

  ensureDemoUser(database);
  ensureColumn(database, "users", "role", "TEXT NOT NULL DEFAULT 'user'");
  database.prepare("UPDATE users SET role = 'admin' WHERE unique_id = ?").run(demoUserId);
  provisionConfiguredAdmin(database);
  ensureColumn(database, "friends", "owner_user_id", `TEXT NOT NULL DEFAULT '${demoUserId}'`);
  ensureColumn(database, "friends", "friend_user_id", "TEXT");
  ensureColumn(database, "groups", "owner_user_id", `TEXT NOT NULL DEFAULT '${demoUserId}'`);
  ensureColumn(database, "groups", "settled_at", "TEXT");
  ensureColumn(database, "group_members", "member_user_id", "TEXT");
  ensureColumn(database, "payments", "created_by_user_id", "TEXT");
  ensureColumn(database, "payments", "updated_by_user_id", "TEXT");
  ensureColumn(database, "payments", "updated_at", "TEXT");
  ensureColumn(database, "payments", "currency", `TEXT NOT NULL DEFAULT '${defaultCurrency}'`);
  backfillOwnerUserId(database);
  backfillAccountLinks(database);
  backfillPaymentAudit(database);
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
  markMigration(database, "20260427_auth_user_scope");
  markMigration(database, "20260427_group_settlement_state");
  markMigration(database, "20260427_friend_invites");
  markMigration(database, "20260427_shared_group_members");
  markMigration(database, "20260427_payment_audit");
  markMigration(database, "20260427_payment_currency");
  markMigration(database, "20260427_admin_invites_password_reset");
}

function ensureColumn(
  database: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function ensureDemoUser(database: Database.Database) {
  database.prepare(`
    INSERT OR IGNORE INTO users (unique_id, email, name, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, 'admin', ?)
  `).run(
    demoUserId,
    "demo@payshare.local",
    "Demo User",
    demoPasswordHash,
    new Date().toISOString()
  );
  database
    .prepare("UPDATE users SET password_hash = ? WHERE unique_id = ? AND password_hash = ?")
    .run(demoPasswordHash, demoUserId, "local-dev-password");
}

function hashConfiguredAdminPassword(password: string) {
  const derivedKey = scryptSync(password, envAdminPasswordSalt, 64);
  return `scrypt:${envAdminPasswordSalt}:${derivedKey.toString("hex")}`;
}

function provisionConfiguredAdmin(database: Database.Database) {
  const email = (process.env.PAYSHARE_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.PAYSHARE_ADMIN_PASSWORD ?? "";
  if (!email && !password) {
    return;
  }
  if (!email || !password) {
    console.warn("PAYSHARE_ADMIN_EMAIL and PAYSHARE_ADMIN_PASSWORD must be set together.");
    return;
  }
  if (password.length < 8) {
    console.warn("PAYSHARE_ADMIN_PASSWORD must be at least 8 characters.");
    return;
  }

  const existing = database
    .prepare("SELECT unique_id FROM users WHERE lower(email) = lower(?)")
    .get(email) as { unique_id: string } | undefined;
  const passwordHash = hashConfiguredAdminPassword(password);
  const name = email.split("@")[0] || "Admin";

  if (existing) {
    database.prepare(`
      UPDATE users
      SET name = COALESCE(NULLIF(name, ''), ?),
          password_hash = ?,
          role = 'admin'
      WHERE unique_id = ?
    `).run(name, passwordHash, existing.unique_id);
    return;
  }

  database.prepare(`
    INSERT INTO users (unique_id, email, name, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, 'admin', ?)
  `).run(randomUUID(), email, name, passwordHash, new Date().toISOString());
}

function backfillOwnerUserId(database: Database.Database) {
  database
    .prepare("UPDATE friends SET owner_user_id = ? WHERE owner_user_id IS NULL OR owner_user_id = ''")
    .run(demoUserId);
  database
    .prepare("UPDATE groups SET owner_user_id = ? WHERE owner_user_id IS NULL OR owner_user_id = ''")
    .run(demoUserId);
}

function backfillAccountLinks(database: Database.Database) {
  database.prepare(`
    UPDATE friends
    SET friend_user_id = (
      SELECT users.unique_id
      FROM users
      WHERE lower(users.email) = lower(friends.email)
    )
    WHERE friend_user_id IS NULL
      AND email <> ''
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE lower(users.email) = lower(friends.email)
      )
  `).run();

  database.prepare(`
    UPDATE group_members
    SET member_user_id = (
      SELECT groups.owner_user_id
      FROM groups
      WHERE groups.unique_id = group_members.group_id
    )
    WHERE member_id = '0'
      AND (member_user_id IS NULL OR member_user_id = '')
  `).run();

  database.prepare(`
    UPDATE group_members
    SET member_user_id = (
      SELECT friends.friend_user_id
      FROM groups
      JOIN friends
        ON friends.owner_user_id = groups.owner_user_id
       AND friends.unique_id = group_members.member_id
      WHERE groups.unique_id = group_members.group_id
    )
    WHERE member_id <> '0'
      AND (member_user_id IS NULL OR member_user_id = '')
      AND EXISTS (
        SELECT 1
        FROM groups
        JOIN friends
          ON friends.owner_user_id = groups.owner_user_id
         AND friends.unique_id = group_members.member_id
        WHERE groups.unique_id = group_members.group_id
          AND friends.friend_user_id IS NOT NULL
      )
  `).run();
}

function backfillPaymentAudit(database: Database.Database) {
  database.prepare(`
    UPDATE payments
    SET created_by_user_id = (
      SELECT groups.owner_user_id
      FROM groups
      WHERE groups.unique_id = payments.group_id
    )
    WHERE created_by_user_id IS NULL OR created_by_user_id = ''
  `).run();
}

function markMigration(database: Database.Database, version: string) {
  database.prepare(`
    INSERT OR IGNORE INTO schema_migrations (version, applied_at)
    VALUES (?, ?)
  `).run(version, new Date().toISOString());
}

function seed(database: Database.Database) {
  ensureDemoUser(database);

  const friendCount = database.prepare("SELECT COUNT(*) AS count FROM friends").get() as {
    count: number;
  };
  const groupCount = database.prepare("SELECT COUNT(*) AS count FROM groups").get() as {
    count: number;
  };

  if (friendCount.count === 0) {
    const insertFriend = database.prepare(`
      INSERT INTO friends (unique_id, owner_user_id, name, email, created_at)
      VALUES (@uniqueId, @ownerUserId, @name, @email, @createdAt)
    `);
    [
      { name: "Friend 1", email: "test@test.com" },
      { name: "Friend 2", email: "test@test.com" },
      { name: "Friend 3", email: "test@test.com" },
    ].forEach((friend) => {
      insertFriend.run({
        uniqueId: randomUUID(),
        ownerUserId: demoUserId,
        createdAt: new Date().toISOString(),
        ...friend,
      });
    });
  }

  if (groupCount.count === 0) {
    const uniqueId = randomUUID();
    const createdAt = new Date().toISOString();
    database.prepare(`
      INSERT INTO groups (unique_id, owner_user_id, name, description, favorite, created_at, payment_next_id)
      VALUES (?, ?, ?, ?, 0, ?, 0)
    `).run(uniqueId, demoUserId, "Group 1", "This is group 1", createdAt);

    const friends = getFriendsFromDb(database, demoUserId);
    saveMembers(database, demoUserId, uniqueId, [
      ...friends.map((friend) => ({
        uniqueId: friend.uniqueId ?? "",
        name: friend.name,
      })),
      kUser,
    ]);
  }
}

function getFriendsFromDb(database: Database.Database, ownerUserId: string) {
  const rows = database
    .prepare(`
      SELECT unique_id, owner_user_id, friend_user_id, name, email, created_at
      FROM friends
      WHERE owner_user_id = ?
      ORDER BY name, created_at
    `)
    .all(ownerUserId) as DbFriend[];

  return rows.map((row) => ({
    uniqueId: row.unique_id,
    name: row.name,
    email: row.email,
  }));
}

function getUniqueId(table: "friends" | "groups" | "users" | "sessions" | "friend_invites", column = "unique_id") {
  const database = getDb();
  let uniqueId = "";
  do {
    uniqueId = randomUUID();
  } while (
    database
      .prepare(`SELECT 1 FROM ${table} WHERE ${column} = ?`)
      .get(uniqueId)
  );
  return uniqueId;
}

function mapUser(row: DbUser): UserRecord {
  return {
    uniqueId: row.unique_id,
    email: row.email,
    name: row.name,
    role: row.role === "admin" ? "admin" : "user",
  };
}

function mapInviteCode(row: DbInviteCode): InviteCodeRecord {
  return {
    code: row.code,
    createdByUserId: row.created_by_user_id,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    expiresAt: row.expires_at,
    disabledAt: row.disabled_at,
    createdAt: row.created_at,
  };
}

function mapFriendInvite(row: DbFriendInvite): FriendInviteRecord {
  return {
    uniqueId: row.unique_id,
    sender: {
      uniqueId: row.sender_user_id,
      email: row.sender_email,
      name: row.sender_name,
      role: "user",
    },
    recipient: {
      uniqueId: row.recipient_user_id,
      email: row.recipient_email,
      name: row.recipient_name,
      role: "user",
    },
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? undefined,
  };
}

function getFriendInviteById(database: Database.Database, inviteId: string) {
  return database
    .prepare(`
      SELECT
        friend_invites.unique_id,
        friend_invites.sender_user_id,
        sender.email AS sender_email,
        sender.name AS sender_name,
        friend_invites.recipient_user_id,
        recipient.email AS recipient_email,
        recipient.name AS recipient_name,
        friend_invites.status,
        friend_invites.created_at,
        friend_invites.responded_at
      FROM friend_invites
      JOIN users sender ON sender.unique_id = friend_invites.sender_user_id
      JOIN users recipient ON recipient.unique_id = friend_invites.recipient_user_id
      WHERE friend_invites.unique_id = ?
    `)
    .get(inviteId) as DbFriendInvite | undefined;
}

function ensureFriendRecord(
  database: Database.Database,
  ownerUserId: string,
  friendUser: UserRecord
) {
  const existing = database
    .prepare("SELECT unique_id FROM friends WHERE owner_user_id = ? AND email = ?")
    .get(ownerUserId, friendUser.email) as { unique_id: string } | undefined;
  if (existing) {
    return existing.unique_id;
  }

  const uniqueId = getUniqueId("friends");
  database.prepare(`
    INSERT INTO friends (unique_id, owner_user_id, friend_user_id, name, email, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    uniqueId,
    ownerUserId,
    friendUser.uniqueId,
    friendUser.name,
    friendUser.email,
    new Date().toISOString()
  );
  return uniqueId;
}

function getMemberUserId(database: Database.Database, ownerUserId: string, member: Member) {
  if (member.uniqueId === kUser.uniqueId) {
    return ownerUserId;
  }
  if (member.accountUserId) {
    return member.accountUserId;
  }
  const friend = database
    .prepare("SELECT friend_user_id FROM friends WHERE owner_user_id = ? AND unique_id = ?")
    .get(ownerUserId, member.uniqueId) as { friend_user_id: string | null } | undefined;
  return friend?.friend_user_id ?? null;
}

function mapGroup(row: DbGroup, viewerUserId: string): GroupRecord {
  const database = getDb();
  const members = database
    .prepare(`
      SELECT member_id, member_user_id, name
      FROM group_members
      WHERE group_id = ?
      ORDER BY sort_order, name
    `)
    .all(row.unique_id) as DbMember[];
  const displayMembers = members.map((member) => {
    const isViewer = member.member_user_id === viewerUserId;
    const isOwnerPlaceholder = member.member_id === kUser.uniqueId;
    return {
      uniqueId: member.member_id,
      name: isViewer ? kUser.name : isOwnerPlaceholder ? row.owner_name : member.name,
      accountUserId: member.member_user_id,
    };
  });
  const membersById = new Map(displayMembers.map((member) => [member.uniqueId, member]));
  const payments = database
    .prepare(`
      SELECT
        payments.payment_id,
        payments.name,
        payments.payer_id,
        payments.payer_name,
        payments.cost,
        payments.currency,
        payments.split_mode,
        payments.created_at,
        payments.created_by_user_id,
        creator.email AS created_by_email,
        creator.name AS created_by_name,
        payments.updated_by_user_id,
        updater.email AS updated_by_email,
        updater.name AS updated_by_name,
        payments.updated_at,
        payments.you_should_pay
      FROM payments
      LEFT JOIN users creator ON creator.unique_id = payments.created_by_user_id
      LEFT JOIN users updater ON updater.unique_id = payments.updated_by_user_id
      WHERE payments.group_id = ?
      ORDER BY payments.payment_id
    `)
    .all(row.unique_id) as DbPayment[];

  return {
    uniqueId: row.unique_id,
    ownerUserId: row.owner_user_id,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
    favorite: Boolean(row.favorite),
    createdAt: row.created_at,
    settledAt: row.settled_at ?? null,
    members: displayMembers,
    paymentList: new Map(
      payments.map((payment) => [
        payment.payment_id,
        mapPayment(row.unique_id, payment, membersById),
      ])
    ),
    paymentNextId: row.payment_next_id,
    viewerMemberId:
      displayMembers.find((member) => member.accountUserId === viewerUserId)?.uniqueId ??
      (row.owner_user_id === viewerUserId ? kUser.uniqueId : undefined),
  };
}

function mapPayment(groupId: string, row: DbPayment, membersById: Map<string, Member>): Payment {
  const database = getDb();
  const shares = database
    .prepare(`
      SELECT member_id, member_name, shares
      FROM payment_shares
      WHERE group_id = ? AND payment_id = ?
      ORDER BY sort_order
    `)
    .all(groupId, row.payment_id) as DbPaymentShare[];
  const shareDetails: PaymentShare[] = shares.map((share) => ({
    member: membersById.get(share.member_id) ?? {
      uniqueId: share.member_id,
      name: share.member_name,
    },
    shares: share.shares,
  }));

  return {
    name: row.name,
    payer: {
      uniqueId: row.payer_id,
      name: membersById.get(row.payer_id)?.name ?? row.payer_name,
    },
    cost: row.cost,
    currency: normalizeCurrency(row.currency ?? defaultCurrency),
    shareMember: shareDetails.map((share) => share.member),
    shareDetails,
    splitMode: row.split_mode === "shares" ? "shares" : "equal",
    createdAt: row.created_at ?? undefined,
    createdBy:
      row.created_by_user_id && row.created_by_email && row.created_by_name
        ? {
            uniqueId: row.created_by_user_id,
            email: row.created_by_email,
            name: row.created_by_name,
          }
        : undefined,
    updatedBy:
      row.updated_by_user_id && row.updated_by_email && row.updated_by_name
        ? {
            uniqueId: row.updated_by_user_id,
            email: row.updated_by_email,
            name: row.updated_by_name,
          }
        : undefined,
    updatedAt: row.updated_at ?? undefined,
    youShouldPay: row.you_should_pay ?? undefined,
  };
}

function saveMembers(
  database: Database.Database,
  ownerUserId: string,
  groupId: string,
  members: Member[] = []
) {
  const insertMember = database.prepare(`
    INSERT INTO group_members (group_id, member_id, member_user_id, name, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  database.prepare("DELETE FROM group_members WHERE group_id = ?").run(groupId);
  members.forEach((member, index) => {
    insertMember.run(
      groupId,
      member.uniqueId,
      getMemberUserId(database, ownerUserId, member),
      member.name,
      index
    );
  });
}

function savePayment(
  database: Database.Database,
  groupId: string,
  paymentId: number,
  payment: Payment,
  actorUserId: string,
  mode: "create" | "update"
) {
  const existingAudit = database
    .prepare(`
      SELECT created_by_user_id
      FROM payments
      WHERE group_id = ? AND payment_id = ?
    `)
    .get(groupId, paymentId) as { created_by_user_id: string | null } | undefined;
  const createdByUserId =
    mode === "create" ? actorUserId : existingAudit?.created_by_user_id ?? actorUserId;
  const updatedByUserId = mode === "update" ? actorUserId : null;
  const updatedAt = mode === "update" ? new Date().toISOString() : null;

  database.prepare(`
    INSERT OR REPLACE INTO payments (
      group_id,
      payment_id,
      name,
      payer_id,
      payer_name,
      cost,
      currency,
      split_mode,
      created_at,
      created_by_user_id,
      updated_by_user_id,
      updated_at,
      you_should_pay
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    groupId,
    paymentId,
    payment.name,
    payment.payer.uniqueId,
    payment.payer.name,
    payment.cost,
    normalizeCurrency(payment.currency ?? defaultCurrency),
    payment.splitMode ?? "equal",
    payment.createdAt ?? null,
    createdByUserId,
    updatedByUserId,
    updatedAt,
    payment.youShouldPay ?? null
  );

  database
    .prepare("DELETE FROM payment_shares WHERE group_id = ? AND payment_id = ?")
    .run(groupId, paymentId);

  const insertShare = database.prepare(`
    INSERT INTO payment_shares (group_id, payment_id, member_id, member_name, shares, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const shareDetails =
    payment.shareDetails?.length
      ? payment.shareDetails
      : payment.shareMember.map((member) => ({ member, shares: 1 }));

  shareDetails.forEach((share, index) => {
    insertShare.run(
      groupId,
      paymentId,
      share.member.uniqueId,
      share.member.name,
      Math.max(1, Math.round(share.shares)),
      index
    );
  });
}

export function getSqliteRepositories(): DataRepositories {
  return {
    async getUserById(uniqueId) {
      const row = getDb()
        .prepare("SELECT unique_id, email, name, password_hash, role, created_at FROM users WHERE unique_id = ?")
        .get(uniqueId) as DbUser | undefined;
      return row ? mapUser(row) : null;
    },

    async getUserByEmail(email) {
      const row = getDb()
        .prepare("SELECT unique_id, email, name, password_hash, role, created_at FROM users WHERE lower(email) = lower(?)")
        .get(email) as DbUser | undefined;
      return row ? mapUser(row) : null;
    },

    async createUser(values) {
      const uniqueId = getUniqueId("users");
      const createdAt = new Date().toISOString();
      getDb().prepare(`
        INSERT INTO users (unique_id, email, name, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, 'user', ?)
      `).run(uniqueId, values.email.toLowerCase(), values.name, values.passwordHash, createdAt);
      return { uniqueId, email: values.email.toLowerCase(), name: values.name, role: "user" };
    },

    async updateUserPassword(userId, passwordHash) {
      getDb()
        .prepare("UPDATE users SET password_hash = ? WHERE unique_id = ?")
        .run(passwordHash, userId);
    },

    async getUserPasswordHash(email) {
      const row = getDb()
        .prepare("SELECT password_hash FROM users WHERE lower(email) = lower(?)")
        .get(email) as { password_hash: string } | undefined;
      return row?.password_hash ?? null;
    },

    async createSession(userId, expiresAt) {
      const sessionId = randomUUID();
      getDb().prepare(`
        INSERT INTO sessions (session_id, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `).run(sessionId, userId, expiresAt, new Date().toISOString());
      return sessionId;
    },

    async getSessionUser(sessionId) {
      const row = getDb()
        .prepare(`
          SELECT users.unique_id, users.email, users.name, users.password_hash, users.role, users.created_at
          FROM sessions
          JOIN users ON users.unique_id = sessions.user_id
          WHERE sessions.session_id = ? AND sessions.expires_at > ?
        `)
        .get(sessionId, new Date().toISOString()) as DbUser | undefined;
      return row ? mapUser(row) : null;
    },

    async deleteSession(sessionId) {
      getDb().prepare("DELETE FROM sessions WHERE session_id = ?").run(sessionId);
    },

    async hasActiveInviteCodes() {
      const row = getDb()
        .prepare(`
          SELECT 1
          FROM invite_codes
          WHERE disabled_at IS NULL
          LIMIT 1
        `)
        .get();
      return Boolean(row);
    },

    async createInviteCode(adminUserId, values) {
      const createdAt = new Date().toISOString();
      getDb().prepare(`
        INSERT INTO invite_codes (code, created_by_user_id, max_uses, used_count, expires_at, disabled_at, created_at)
        VALUES (?, ?, ?, 0, ?, NULL, ?)
      `).run(values.code.toUpperCase(), adminUserId, values.maxUses, values.expiresAt, createdAt);
      const row = getDb()
        .prepare("SELECT code, created_by_user_id, max_uses, used_count, expires_at, disabled_at, created_at FROM invite_codes WHERE code = ?")
        .get(values.code.toUpperCase()) as DbInviteCode;
      return mapInviteCode(row);
    },

    async getInviteCodes() {
      const rows = getDb()
        .prepare(`
          SELECT code, created_by_user_id, max_uses, used_count, expires_at, disabled_at, created_at
          FROM invite_codes
          ORDER BY created_at DESC
        `)
        .all() as DbInviteCode[];
      return rows.map(mapInviteCode);
    },

    async disableInviteCode(adminUserId, code) {
      getDb()
        .prepare("UPDATE invite_codes SET disabled_at = ? WHERE code = ? AND disabled_at IS NULL")
        .run(new Date().toISOString(), code.toUpperCase());
    },

    async validateInviteCode(code) {
      const row = getDb()
        .prepare(`
          SELECT code, created_by_user_id, max_uses, used_count, expires_at, disabled_at, created_at
          FROM invite_codes
          WHERE code = ?
            AND disabled_at IS NULL
            AND (expires_at IS NULL OR expires_at > ?)
            AND (max_uses IS NULL OR used_count < max_uses)
        `)
        .get(code.toUpperCase(), new Date().toISOString()) as DbInviteCode | undefined;
      return row ? mapInviteCode(row) : null;
    },

    async markInviteCodeUsed(code, userId) {
      const database = getDb();
      const transaction = database.transaction(() => {
        database.prepare(`
          INSERT INTO invite_code_uses (code, user_id, used_at)
          VALUES (?, ?, ?)
        `).run(code.toUpperCase(), userId, new Date().toISOString());
        database.prepare(`
          UPDATE invite_codes
          SET used_count = used_count + 1
          WHERE code = ?
        `).run(code.toUpperCase());
      });
      transaction();
    },

    async createPasswordResetToken(adminUserId, userEmail, tokenHash, expiresAt) {
      const user = await this.getUserByEmail(userEmail);
      if (!user) {
        throw new Error("No account found with that email.");
      }
      getDb().prepare(`
        INSERT INTO password_reset_tokens (
          token_hash,
          user_id,
          created_by_user_id,
          expires_at,
          used_at,
          created_at
        )
        VALUES (?, ?, ?, ?, NULL, ?)
      `).run(tokenHash, user.uniqueId, adminUserId, expiresAt, new Date().toISOString());
      return { token: tokenHash, user, expiresAt };
    },

    async getPasswordResetToken(tokenHash) {
      const row = getDb()
        .prepare(`
          SELECT
            password_reset_tokens.token_hash,
            password_reset_tokens.user_id,
            users.email AS user_email,
            users.name AS user_name,
            users.role AS user_role,
            password_reset_tokens.created_by_user_id,
            password_reset_tokens.expires_at,
            password_reset_tokens.used_at,
            password_reset_tokens.created_at
          FROM password_reset_tokens
          JOIN users ON users.unique_id = password_reset_tokens.user_id
          WHERE password_reset_tokens.token_hash = ?
            AND password_reset_tokens.used_at IS NULL
            AND password_reset_tokens.expires_at > ?
        `)
        .get(tokenHash, new Date().toISOString()) as DbPasswordResetToken | undefined;
      return row
        ? {
            token: row.token_hash,
            user: {
              uniqueId: row.user_id,
              email: row.user_email,
              name: row.user_name,
              role: row.user_role === "admin" ? "admin" : "user",
            },
            expiresAt: row.expires_at,
          }
        : null;
    },

    async markPasswordResetTokenUsed(tokenHash, passwordHash) {
      const resetToken = await this.getPasswordResetToken(tokenHash);
      if (!resetToken) {
        throw new Error("This reset link is invalid or has expired.");
      }
      const database = getDb();
      const transaction = database.transaction(() => {
        database
          .prepare("UPDATE users SET password_hash = ? WHERE unique_id = ?")
          .run(passwordHash, resetToken.user.uniqueId);
        database
          .prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?")
          .run(new Date().toISOString(), tokenHash);
        database
          .prepare("DELETE FROM sessions WHERE user_id = ?")
          .run(resetToken.user.uniqueId);
      });
      transaction();
    },

    async getFriends(ownerUserId) {
      return getFriendsFromDb(getDb(), ownerUserId);
    },

    async getFriend(ownerUserId, uniqueId) {
      const row = getDb()
        .prepare(`
          SELECT unique_id, owner_user_id, friend_user_id, name, email, created_at
          FROM friends
          WHERE owner_user_id = ? AND unique_id = ?
        `)
        .get(ownerUserId, uniqueId) as DbFriend | undefined;
      return row
        ? {
            uniqueId: row.unique_id,
            name: row.name,
            email: row.email,
          }
        : null;
    },

    async createFriend(ownerUserId, values) {
      const uniqueId = getUniqueId("friends");
      const createdAt = new Date().toISOString();
      getDb().prepare(`
        INSERT INTO friends (unique_id, owner_user_id, friend_user_id, name, email, created_at)
        VALUES (?, ?, (
          SELECT users.unique_id
          FROM users
          WHERE lower(users.email) = lower(?)
        ), ?, ?, ?)
      `).run(uniqueId, ownerUserId, values.email, values.name, values.email, createdAt);
      return { ...values, uniqueId };
    },

    async updateFriend(ownerUserId, uniqueId, values) {
      const existing = await this.getFriend(ownerUserId, uniqueId);
      if (!existing) {
        throw new Error(`No friend found for ${uniqueId}`);
      }
      const database = getDb();
      const transaction = database.transaction(() => {
        database.prepare(`
          UPDATE friends
          SET name = ?,
              email = ?,
              friend_user_id = (
                SELECT users.unique_id
                FROM users
                WHERE lower(users.email) = lower(?)
              )
          WHERE owner_user_id = ? AND unique_id = ?
        `).run(values.name, values.email, values.email, ownerUserId, uniqueId);
        database.prepare(`
          UPDATE group_members
          SET name = ?,
              member_user_id = (
                SELECT friends.friend_user_id
                FROM friends
                WHERE friends.owner_user_id = ?
                  AND friends.unique_id = ?
              )
          WHERE member_id = ? AND group_id IN (SELECT unique_id FROM groups WHERE owner_user_id = ?)
        `).run(values.name, ownerUserId, uniqueId, uniqueId, ownerUserId);
        database.prepare(`
          UPDATE payments
          SET payer_name = ?
          WHERE payer_id = ? AND group_id IN (SELECT unique_id FROM groups WHERE owner_user_id = ?)
        `).run(values.name, uniqueId, ownerUserId);
        database.prepare(`
          UPDATE payment_shares
          SET member_name = ?
          WHERE member_id = ? AND group_id IN (SELECT unique_id FROM groups WHERE owner_user_id = ?)
        `).run(values.name, uniqueId, ownerUserId);
      });
      transaction();
      return { ...existing, ...values, uniqueId };
    },

    async deleteFriend(ownerUserId, uniqueId) {
      getDb().prepare("DELETE FROM friends WHERE owner_user_id = ? AND unique_id = ?").run(ownerUserId, uniqueId);
    },

    async getFriendUsage(ownerUserId, uniqueId) {
      const database = getDb();
      const groupUsage = database
        .prepare(`
          SELECT COUNT(*) AS count
          FROM group_members
          JOIN groups ON groups.unique_id = group_members.group_id
          WHERE groups.owner_user_id = ? AND group_members.member_id = ?
        `)
        .get(ownerUserId, uniqueId) as { count: number };
      const payerUsage = database
        .prepare(`
          SELECT COUNT(*) AS count
          FROM payments
          JOIN groups ON groups.unique_id = payments.group_id
          WHERE groups.owner_user_id = ? AND payments.payer_id = ?
        `)
        .get(ownerUserId, uniqueId) as { count: number };
      const shareUsage = database
        .prepare(`
          SELECT COUNT(*) AS count
          FROM payment_shares
          JOIN groups ON groups.unique_id = payment_shares.group_id
          WHERE groups.owner_user_id = ? AND payment_shares.member_id = ?
        `)
        .get(ownerUserId, uniqueId) as { count: number };

      return {
        groupCount: groupUsage.count,
        paymentCount: payerUsage.count + shareUsage.count,
      };
    },

    async createFriendInvite(senderUserId, recipientEmail) {
      const database = getDb();
      const sender = await this.getUserById(senderUserId);
      if (!sender) {
        throw new Error("Unable to find your account.");
      }
      const recipient = await this.getUserByEmail(recipientEmail);
      if (!recipient) {
        throw new Error("No account found with that email.");
      }
      if (recipient.uniqueId === senderUserId) {
        throw new Error("You cannot invite yourself.");
      }

      const existingFriend = database
        .prepare("SELECT 1 FROM friends WHERE owner_user_id = ? AND email = ?")
        .get(senderUserId, recipient.email);
      if (existingFriend) {
        throw new Error("This user is already in your friends.");
      }

      const reverseFriend = database
        .prepare("SELECT 1 FROM friends WHERE owner_user_id = ? AND email = ?")
        .get(recipient.uniqueId, sender.email);
      if (reverseFriend) {
        ensureFriendRecord(database, senderUserId, recipient);
        const now = new Date().toISOString();
        return {
          uniqueId: "",
          sender,
          recipient,
          status: "accepted",
          createdAt: now,
          respondedAt: now,
        };
      }

      const existingInvite = database
        .prepare(`
          SELECT 1
          FROM friend_invites
          WHERE status = 'pending'
            AND (
              (sender_user_id = ? AND recipient_user_id = ?)
              OR (sender_user_id = ? AND recipient_user_id = ?)
            )
        `)
        .get(senderUserId, recipient.uniqueId, recipient.uniqueId, senderUserId);
      if (existingInvite) {
        throw new Error("There is already a pending invite between you and this user.");
      }

      const uniqueId = getUniqueId("friend_invites");
      database.prepare(`
        INSERT INTO friend_invites (unique_id, sender_user_id, recipient_user_id, status, created_at)
        VALUES (?, ?, ?, 'pending', ?)
      `).run(uniqueId, senderUserId, recipient.uniqueId, new Date().toISOString());

      const invite = getFriendInviteById(database, uniqueId);
      if (!invite) {
        throw new Error("Unable to create friend invite.");
      }
      return mapFriendInvite(invite);
    },

    async getReceivedFriendInvites(recipientUserId) {
      const rows = getDb()
        .prepare(`
          SELECT
            friend_invites.unique_id,
            friend_invites.sender_user_id,
            sender.email AS sender_email,
            sender.name AS sender_name,
            friend_invites.recipient_user_id,
            recipient.email AS recipient_email,
            recipient.name AS recipient_name,
            friend_invites.status,
            friend_invites.created_at,
            friend_invites.responded_at
          FROM friend_invites
          JOIN users sender ON sender.unique_id = friend_invites.sender_user_id
          JOIN users recipient ON recipient.unique_id = friend_invites.recipient_user_id
          WHERE friend_invites.recipient_user_id = ? AND friend_invites.status = 'pending'
          ORDER BY friend_invites.created_at DESC
        `)
        .all(recipientUserId) as DbFriendInvite[];
      return rows.map(mapFriendInvite);
    },

    async getSentFriendInvites(senderUserId) {
      const rows = getDb()
        .prepare(`
          SELECT
            friend_invites.unique_id,
            friend_invites.sender_user_id,
            sender.email AS sender_email,
            sender.name AS sender_name,
            friend_invites.recipient_user_id,
            recipient.email AS recipient_email,
            recipient.name AS recipient_name,
            friend_invites.status,
            friend_invites.created_at,
            friend_invites.responded_at
          FROM friend_invites
          JOIN users sender ON sender.unique_id = friend_invites.sender_user_id
          JOIN users recipient ON recipient.unique_id = friend_invites.recipient_user_id
          WHERE friend_invites.sender_user_id = ?
          ORDER BY friend_invites.created_at DESC
          LIMIT 12
        `)
        .all(senderUserId) as DbFriendInvite[];
      return rows.map(mapFriendInvite);
    },

    async respondToFriendInvite(recipientUserId, inviteId, status) {
      const database = getDb();
      const invite = getFriendInviteById(database, inviteId);
      if (!invite || invite.recipient_user_id !== recipientUserId) {
        throw new Error("Friend invite not found.");
      }
      if (invite.status !== "pending") {
        throw new Error("This invite has already been handled.");
      }

      const respondedAt = new Date().toISOString();
      const transaction = database.transaction(() => {
        database.prepare(`
          UPDATE friend_invites
          SET status = ?, responded_at = ?
          WHERE unique_id = ? AND recipient_user_id = ? AND status = 'pending'
        `).run(status, respondedAt, inviteId, recipientUserId);

        if (status === "accepted") {
          ensureFriendRecord(database, invite.recipient_user_id, {
            uniqueId: invite.sender_user_id,
            email: invite.sender_email,
            name: invite.sender_name,
            role: "user",
          });
          ensureFriendRecord(database, invite.sender_user_id, {
            uniqueId: invite.recipient_user_id,
            email: invite.recipient_email,
            name: invite.recipient_name,
            role: "user",
          });
        }
      });
      transaction();

      const updated = getFriendInviteById(database, inviteId);
      if (!updated) {
        throw new Error("Friend invite not found.");
      }
      return mapFriendInvite(updated);
    },

    async getGroups(ownerUserId) {
      const rows = getDb()
        .prepare(`
          SELECT
            groups.unique_id,
            groups.owner_user_id,
            users.name AS owner_name,
            groups.name,
            groups.description,
            groups.favorite,
            groups.created_at,
            groups.settled_at,
            groups.payment_next_id
          FROM groups
          JOIN users ON users.unique_id = groups.owner_user_id
          WHERE groups.owner_user_id = ?
             OR EXISTS (
               SELECT 1
               FROM group_members
               WHERE group_members.group_id = groups.unique_id
                 AND group_members.member_user_id = ?
             )
          ORDER BY groups.name, groups.created_at
        `)
        .all(ownerUserId, ownerUserId) as DbGroup[];
      return rows.map((row) => mapGroup(row, ownerUserId));
    },

    async getGroup(ownerUserId, uniqueId) {
      const row = getDb()
        .prepare(`
          SELECT
            groups.unique_id,
            groups.owner_user_id,
            users.name AS owner_name,
            groups.name,
            groups.description,
            groups.favorite,
            groups.created_at,
            groups.settled_at,
            groups.payment_next_id
          FROM groups
          JOIN users ON users.unique_id = groups.owner_user_id
          WHERE groups.unique_id = ?
            AND (
              groups.owner_user_id = ?
              OR EXISTS (
                SELECT 1
                FROM group_members
                WHERE group_members.group_id = groups.unique_id
                  AND group_members.member_user_id = ?
              )
            )
        `)
        .get(uniqueId, ownerUserId, ownerUserId) as DbGroup | undefined;
      return row ? mapGroup(row, ownerUserId) : null;
    },

    async createGroup(ownerUserId, values) {
      const uniqueId = getUniqueId("groups");
      const createdAt = new Date().toISOString();
      getDb().prepare(`
        INSERT INTO groups (unique_id, owner_user_id, name, description, favorite, created_at, payment_next_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uniqueId,
        ownerUserId,
        values.name ?? null,
        values.description ?? null,
        values.favorite ? 1 : 0,
        createdAt,
        values.paymentNextId ?? 0
      );
      saveMembers(getDb(), ownerUserId, uniqueId, values.members ?? []);
      return (await this.getGroup(ownerUserId, uniqueId)) as GroupRecord;
    },

    async updateGroup(ownerUserId, uniqueId, values, members) {
      const existing = await this.getGroup(ownerUserId, uniqueId);
      if (!existing) {
        throw new Error(`No group found for ${uniqueId}`);
      }

      getDb().prepare(`
        UPDATE groups
        SET name = ?, description = ?, favorite = ?, settled_at = ?, payment_next_id = ?
        WHERE owner_user_id = ? AND unique_id = ?
      `).run(
        values.name ?? existing.name ?? null,
        values.description ?? existing.description ?? null,
        values.favorite ?? existing.favorite ? 1 : 0,
        values.settledAt === undefined ? existing.settledAt ?? null : values.settledAt,
        values.paymentNextId ?? existing.paymentNextId ?? 0,
        ownerUserId,
        uniqueId
      );

      if (members) {
        saveMembers(getDb(), existing.ownerUserId ?? ownerUserId, uniqueId, members);
      }

      return (await this.getGroup(ownerUserId, uniqueId)) as GroupRecord;
    },

    async settleGroup(ownerUserId, uniqueId, settledAt) {
      const existing = await this.getGroup(ownerUserId, uniqueId);
      if (!existing) {
        throw new Error(`No group found for ${uniqueId}`);
      }

      getDb()
        .prepare("UPDATE groups SET settled_at = ? WHERE owner_user_id = ? AND unique_id = ?")
        .run(settledAt, ownerUserId, uniqueId);

      return (await this.getGroup(ownerUserId, uniqueId)) as GroupRecord;
    },

    async deleteGroup(ownerUserId, uniqueId) {
      getDb().prepare("DELETE FROM groups WHERE owner_user_id = ? AND unique_id = ?").run(ownerUserId, uniqueId);
    },

    async addPayment(ownerUserId, uniqueId, payment) {
      const database = getDb();
      const existing = await this.getGroup(ownerUserId, uniqueId);
      if (!existing) {
        throw new Error(`No group found for ${uniqueId}`);
      }

      const paymentId = existing.paymentNextId ?? 0;
      const transaction = database.transaction(() => {
        savePayment(database, uniqueId, paymentId, payment, ownerUserId, "create");
        database
          .prepare("UPDATE groups SET payment_next_id = ? WHERE unique_id = ?")
          .run(paymentId + 1, uniqueId);
      });
      transaction();
    },

    async deletePayment(ownerUserId, uniqueId, paymentId) {
      const existing = await this.getGroup(ownerUserId, uniqueId);
      if (!existing) {
        throw new Error(`No group found for ${uniqueId}`);
      }
      getDb()
        .prepare("DELETE FROM payments WHERE group_id = ? AND payment_id = ?")
        .run(uniqueId, paymentId);
    },

    async updatePayment(ownerUserId, uniqueId, paymentId, payment) {
      const existing = await this.getGroup(ownerUserId, uniqueId);
      if (!existing?.paymentList?.has(paymentId)) {
        throw new Error(`No payment found for ${paymentId}`);
      }
      savePayment(getDb(), uniqueId, paymentId, payment, ownerUserId, "update");
      const updated = await this.getGroup(ownerUserId, uniqueId);
      const updatedPayment = updated?.paymentList?.get(paymentId);
      if (!updatedPayment) {
        throw new Error(`No payment found for ${paymentId}`);
      }
      return updatedPayment;
    },
  };
}
