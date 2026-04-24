import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { v4 as uuidv4 } from "uuid";

import type { FriendMutation } from "../friend-data";
import type {
  GroupMutation,
  GroupRecord,
  Member,
  Payment,
  PaymentShare,
} from "../group-data";
import type { DataRepositories } from "./types";

type DbFriend = {
  unique_id: string;
  name: string;
  email: string;
  created_at: string;
};

type DbGroup = {
  unique_id: string;
  name: string | null;
  description: string | null;
  favorite: number;
  created_at: string;
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
    CREATE TABLE IF NOT EXISTS friends (
      unique_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      unique_id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      payment_next_id INTEGER NOT NULL DEFAULT 0
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
}

function seed(database: Database.Database) {
  const friendCount = database.prepare("SELECT COUNT(*) AS count FROM friends").get() as {
    count: number;
  };
  const groupCount = database.prepare("SELECT COUNT(*) AS count FROM groups").get() as {
    count: number;
  };

  if (friendCount.count === 0) {
    const insertFriend = database.prepare(`
      INSERT INTO friends (unique_id, name, email, created_at)
      VALUES (@uniqueId, @name, @email, @createdAt)
    `);
    [
      { name: "Friend 1", email: "test@test.com" },
      { name: "Friend 2", email: "test@test.com" },
      { name: "Friend 3", email: "test@test.com" },
    ].forEach((friend) => {
      insertFriend.run({
        uniqueId: uuidv4(),
        createdAt: new Date().toISOString(),
        ...friend,
      });
    });
  }

  if (groupCount.count === 0) {
    const uniqueId = uuidv4();
    const createdAt = new Date().toISOString();
    database.prepare(`
      INSERT INTO groups (unique_id, name, description, favorite, created_at, payment_next_id)
      VALUES (?, ?, ?, 0, ?, 0)
    `).run(uniqueId, "Group 1", "This is group 1", createdAt);

    const friends = getFriendsFromDb(database);
    saveMembers(database, uniqueId, [
      ...friends.map((friend) => ({
        uniqueId: friend.uniqueId ?? "",
        name: friend.name,
      })),
      kUser,
    ]);
  }
}

function getFriendsFromDb(database: Database.Database) {
  const rows = database
    .prepare("SELECT unique_id, name, email, created_at FROM friends ORDER BY name, created_at")
    .all() as DbFriend[];

  return rows.map((row) => ({
    uniqueId: row.unique_id,
    name: row.name,
    email: row.email,
  }));
}

function getUniqueId(table: "friends" | "groups", column = "unique_id") {
  const database = getDb();
  let uniqueId = "";
  do {
    uniqueId = uuidv4();
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
    async getFriends() {
      return getFriendsFromDb(getDb());
    },

    async getFriend(uniqueId) {
      const row = getDb()
        .prepare("SELECT unique_id, name, email, created_at FROM friends WHERE unique_id = ?")
        .get(uniqueId) as DbFriend | undefined;
      return row
        ? {
            uniqueId: row.unique_id,
            name: row.name,
            email: row.email,
          }
        : null;
    },

    async createFriend(values) {
      const uniqueId = getUniqueId("friends");
      const createdAt = new Date().toISOString();
      getDb().prepare(`
        INSERT INTO friends (unique_id, name, email, created_at)
        VALUES (?, ?, ?, ?)
      `).run(uniqueId, values.name, values.email, createdAt);
      return { ...values, uniqueId };
    },

    async updateFriend(uniqueId, values) {
      const existing = await this.getFriend(uniqueId);
      if (!existing) {
        throw new Error(`No friend found for ${uniqueId}`);
      }
      getDb().prepare(`
        UPDATE friends
        SET name = ?, email = ?
        WHERE unique_id = ?
      `).run(values.name, values.email, uniqueId);
      return { ...existing, ...values, uniqueId };
    },

    async deleteFriend(uniqueId) {
      getDb().prepare("DELETE FROM friends WHERE unique_id = ?").run(uniqueId);
    },

    async getGroups() {
      const rows = getDb()
        .prepare(`
          SELECT unique_id, name, description, favorite, created_at, payment_next_id
          FROM groups
          ORDER BY name, created_at
        `)
        .all() as DbGroup[];
      return rows.map(mapGroup);
    },

    async getGroup(uniqueId) {
      const row = getDb()
        .prepare(`
          SELECT unique_id, name, description, favorite, created_at, payment_next_id
          FROM groups
          WHERE unique_id = ?
        `)
        .get(uniqueId) as DbGroup | undefined;
      return row ? mapGroup(row) : null;
    },

    async createGroup(values) {
      const uniqueId = getUniqueId("groups");
      const createdAt = new Date().toISOString();
      getDb().prepare(`
        INSERT INTO groups (unique_id, name, description, favorite, created_at, payment_next_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        uniqueId,
        values.name ?? null,
        values.description ?? null,
        values.favorite ? 1 : 0,
        createdAt,
        values.paymentNextId ?? 0
      );
      saveMembers(getDb(), uniqueId, values.members ?? []);
      return (await this.getGroup(uniqueId)) as GroupRecord;
    },

    async updateGroup(uniqueId, values, members) {
      const existing = await this.getGroup(uniqueId);
      if (!existing) {
        throw new Error(`No group found for ${uniqueId}`);
      }

      getDb().prepare(`
        UPDATE groups
        SET name = ?, description = ?, favorite = ?, payment_next_id = ?
        WHERE unique_id = ?
      `).run(
        values.name ?? existing.name ?? null,
        values.description ?? existing.description ?? null,
        values.favorite ?? existing.favorite ? 1 : 0,
        values.paymentNextId ?? existing.paymentNextId ?? 0,
        uniqueId
      );

      if (members) {
        saveMembers(getDb(), uniqueId, members);
      }

      return (await this.getGroup(uniqueId)) as GroupRecord;
    },

    async deleteGroup(uniqueId) {
      getDb().prepare("DELETE FROM groups WHERE unique_id = ?").run(uniqueId);
    },

    async addPayment(uniqueId, payment) {
      const database = getDb();
      const existing = await this.getGroup(uniqueId);
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

    async deletePayment(uniqueId, paymentId) {
      getDb()
        .prepare("DELETE FROM payments WHERE group_id = ? AND payment_id = ?")
        .run(uniqueId, paymentId);
    },

    async updatePayment(uniqueId, paymentId, payment) {
      const existing = await this.getGroup(uniqueId);
      if (!existing?.paymentList?.has(paymentId)) {
        throw new Error(`No payment found for ${paymentId}`);
      }
      savePayment(getDb(), uniqueId, paymentId, payment);
      const updated = await this.getGroup(uniqueId);
      const updatedPayment = updated?.paymentList?.get(paymentId);
      if (!updatedPayment) {
        throw new Error(`No payment found for ${paymentId}`);
      }
      return updatedPayment;
    },
  };
}
