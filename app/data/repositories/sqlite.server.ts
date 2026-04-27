import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import type { FriendMutation } from "../friend-data";
import type {
  GroupMutation,
  GroupRecord,
  Member,
  Payment,
  PaymentShare,
} from "../group-data";
import type { DataRepositories } from "./types";

type DbUser = {
  unique_id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
};

type DbFriend = {
  unique_id: string;
  owner_user_id: string;
  name: string;
  email: string;
  created_at: string;
};

type DbGroup = {
  unique_id: string;
  owner_user_id: string;
  name: string | null;
  description: string | null;
  favorite: number;
  created_at: string;
  settled_at: string | null;
  payment_next_id: number;
};

type DbMember = {
  member_id: string;
  name: string;
};

type DbPayment = {
  payment_id: number;
  name: string;
  payer_id: string;
  payer_name: string;
  cost: number;
  split_mode: "equal" | "shares" | null;
  created_at: string | null;
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
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(unique_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS friends (
      unique_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL DEFAULT '${demoUserId}',
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(unique_id) ON DELETE CASCADE
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
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (group_id, member_id),
      FOREIGN KEY (group_id) REFERENCES groups(unique_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      group_id TEXT NOT NULL,
      payment_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      payer_id TEXT NOT NULL,
      payer_name TEXT NOT NULL,
      cost REAL NOT NULL,
      split_mode TEXT NOT NULL DEFAULT 'equal',
      created_at TEXT,
      you_should_pay REAL,
      PRIMARY KEY (group_id, payment_id),
      FOREIGN KEY (group_id) REFERENCES groups(unique_id) ON DELETE CASCADE
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
  ensureColumn(database, "friends", "owner_user_id", `TEXT NOT NULL DEFAULT '${demoUserId}'`);
  ensureColumn(database, "groups", "owner_user_id", `TEXT NOT NULL DEFAULT '${demoUserId}'`);
  ensureColumn(database, "groups", "settled_at", "TEXT");
  backfillOwnerUserId(database);
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
  markMigration(database, "20260427_auth_user_scope");
  markMigration(database, "20260427_group_settlement_state");
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
    INSERT OR IGNORE INTO users (unique_id, email, name, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
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

function backfillOwnerUserId(database: Database.Database) {
  database
    .prepare("UPDATE friends SET owner_user_id = ? WHERE owner_user_id IS NULL OR owner_user_id = ''")
    .run(demoUserId);
  database
    .prepare("UPDATE groups SET owner_user_id = ? WHERE owner_user_id IS NULL OR owner_user_id = ''")
    .run(demoUserId);
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
    saveMembers(database, uniqueId, [
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
      SELECT unique_id, owner_user_id, name, email, created_at
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

function getUniqueId(table: "friends" | "groups" | "users" | "sessions", column = "unique_id") {
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

function mapGroup(row: DbGroup): GroupRecord {
  const database = getDb();
  const members = database
    .prepare(`
      SELECT member_id, name
      FROM group_members
      WHERE group_id = ?
      ORDER BY sort_order, name
    `)
    .all(row.unique_id) as DbMember[];
  const payments = database
    .prepare(`
      SELECT payment_id, name, payer_id, payer_name, cost, split_mode, created_at, you_should_pay
      FROM payments
      WHERE group_id = ?
      ORDER BY payment_id
    `)
    .all(row.unique_id) as DbPayment[];

  return {
    uniqueId: row.unique_id,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
    favorite: Boolean(row.favorite),
    createdAt: row.created_at,
    settledAt: row.settled_at ?? null,
    members: members.map((member) => ({
      uniqueId: member.member_id,
      name: member.name,
    })),
    paymentList: new Map(
      payments.map((payment) => [payment.payment_id, mapPayment(row.unique_id, payment)])
    ),
    paymentNextId: row.payment_next_id,
  };
}

function mapPayment(groupId: string, row: DbPayment): Payment {
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
    member: {
      uniqueId: share.member_id,
      name: share.member_name,
    },
    shares: share.shares,
  }));

  return {
    name: row.name,
    payer: {
      uniqueId: row.payer_id,
      name: row.payer_name,
    },
    cost: row.cost,
    shareMember: shareDetails.map((share) => share.member),
    shareDetails,
    splitMode: row.split_mode === "shares" ? "shares" : "equal",
    createdAt: row.created_at ?? undefined,
    youShouldPay: row.you_should_pay ?? undefined,
  };
}

function saveMembers(database: Database.Database, groupId: string, members: Member[] = []) {
  const insertMember = database.prepare(`
    INSERT INTO group_members (group_id, member_id, name, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  database.prepare("DELETE FROM group_members WHERE group_id = ?").run(groupId);
  members.forEach((member, index) => {
    insertMember.run(groupId, member.uniqueId, member.name, index);
  });
}

function savePayment(database: Database.Database, groupId: string, paymentId: number, payment: Payment) {
  database.prepare(`
    INSERT OR REPLACE INTO payments (
      group_id,
      payment_id,
      name,
      payer_id,
      payer_name,
      cost,
      split_mode,
      created_at,
      you_should_pay
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    groupId,
    paymentId,
    payment.name,
    payment.payer.uniqueId,
    payment.payer.name,
    payment.cost,
    payment.splitMode ?? "equal",
    payment.createdAt ?? null,
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
        .prepare("SELECT unique_id, email, name, password_hash, created_at FROM users WHERE unique_id = ?")
        .get(uniqueId) as DbUser | undefined;
      return row
        ? { uniqueId: row.unique_id, email: row.email, name: row.name }
        : null;
    },

    async getUserByEmail(email) {
      const row = getDb()
        .prepare("SELECT unique_id, email, name, password_hash, created_at FROM users WHERE lower(email) = lower(?)")
        .get(email) as DbUser | undefined;
      return row
        ? { uniqueId: row.unique_id, email: row.email, name: row.name }
        : null;
    },

    async createUser(values) {
      const uniqueId = getUniqueId("users");
      const createdAt = new Date().toISOString();
      getDb().prepare(`
        INSERT INTO users (unique_id, email, name, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uniqueId, values.email.toLowerCase(), values.name, values.passwordHash, createdAt);
      return { uniqueId, email: values.email.toLowerCase(), name: values.name };
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
          SELECT users.unique_id, users.email, users.name, users.password_hash, users.created_at
          FROM sessions
          JOIN users ON users.unique_id = sessions.user_id
          WHERE sessions.session_id = ? AND sessions.expires_at > ?
        `)
        .get(sessionId, new Date().toISOString()) as DbUser | undefined;
      return row
        ? { uniqueId: row.unique_id, email: row.email, name: row.name }
        : null;
    },

    async deleteSession(sessionId) {
      getDb().prepare("DELETE FROM sessions WHERE session_id = ?").run(sessionId);
    },

    async getFriends(ownerUserId) {
      return getFriendsFromDb(getDb(), ownerUserId);
    },

    async getFriend(ownerUserId, uniqueId) {
      const row = getDb()
        .prepare(`
          SELECT unique_id, owner_user_id, name, email, created_at
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
        INSERT INTO friends (unique_id, owner_user_id, name, email, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uniqueId, ownerUserId, values.name, values.email, createdAt);
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
          SET name = ?, email = ?
          WHERE owner_user_id = ? AND unique_id = ?
        `).run(values.name, values.email, ownerUserId, uniqueId);
        database.prepare(`
          UPDATE group_members
          SET name = ?
          WHERE member_id = ? AND group_id IN (SELECT unique_id FROM groups WHERE owner_user_id = ?)
        `).run(values.name, uniqueId, ownerUserId);
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

    async getGroups(ownerUserId) {
      const rows = getDb()
        .prepare(`
          SELECT unique_id, owner_user_id, name, description, favorite, created_at, settled_at, payment_next_id
          FROM groups
          WHERE owner_user_id = ?
          ORDER BY name, created_at
        `)
        .all(ownerUserId) as DbGroup[];
      return rows.map(mapGroup);
    },

    async getGroup(ownerUserId, uniqueId) {
      const row = getDb()
        .prepare(`
          SELECT unique_id, owner_user_id, name, description, favorite, created_at, settled_at, payment_next_id
          FROM groups
          WHERE owner_user_id = ? AND unique_id = ?
        `)
        .get(ownerUserId, uniqueId) as DbGroup | undefined;
      return row ? mapGroup(row) : null;
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
      saveMembers(getDb(), uniqueId, values.members ?? []);
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
        saveMembers(getDb(), uniqueId, members);
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
        savePayment(database, uniqueId, paymentId, payment);
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
      savePayment(getDb(), uniqueId, paymentId, payment);
      const updated = await this.getGroup(ownerUserId, uniqueId);
      const updatedPayment = updated?.paymentList?.get(paymentId);
      if (!updatedPayment) {
        throw new Error(`No payment found for ${paymentId}`);
      }
      return updatedPayment;
    },
  };
}
