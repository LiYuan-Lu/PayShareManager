import type { FriendMutation } from "../friend-data";
import type { GroupRecord, GroupMutation, Payment } from "../group-data";

export type FriendRepository = {
  getFriends: (ownerUserId: string) => Promise<FriendMutation[]>;
  getFriend: (ownerUserId: string, uniqueId: string) => Promise<FriendMutation | null>;
  createFriend: (ownerUserId: string, values: FriendMutation) => Promise<FriendMutation>;
  updateFriend: (ownerUserId: string, uniqueId: string, values: FriendMutation) => Promise<FriendMutation>;
  deleteFriend: (ownerUserId: string, uniqueId: string) => Promise<void>;
  getFriendUsage: (ownerUserId: string, uniqueId: string) => Promise<FriendUsage>;
  createFriendInvite: (senderUserId: string, recipientEmail: string) => Promise<FriendInviteRecord>;
  getReceivedFriendInvites: (recipientUserId: string) => Promise<FriendInviteRecord[]>;
  getSentFriendInvites: (senderUserId: string) => Promise<FriendInviteRecord[]>;
  respondToFriendInvite: (
    recipientUserId: string,
    inviteId: string,
    status: "accepted" | "declined"
  ) => Promise<FriendInviteRecord>;
};

export type GroupRepository = {
  getGroups: (ownerUserId: string) => Promise<GroupRecord[]>;
  getGroup: (ownerUserId: string, uniqueId: string) => Promise<GroupRecord | null>;
  createGroup: (ownerUserId: string, values: GroupMutation) => Promise<GroupRecord>;
  updateGroup: (
    ownerUserId: string,
    uniqueId: string,
    values: GroupMutation,
    members?: GroupRecord["members"]
  ) => Promise<GroupRecord>;
  settleGroup: (ownerUserId: string, uniqueId: string, settledAt: string) => Promise<GroupRecord>;
  deleteGroup: (ownerUserId: string, uniqueId: string) => Promise<void>;
  addPayment: (ownerUserId: string, uniqueId: string, payment: Payment) => Promise<void>;
  deletePayment: (ownerUserId: string, uniqueId: string, paymentId: number) => Promise<void>;
  updatePayment: (ownerUserId: string, uniqueId: string, paymentId: number, payment: Payment) => Promise<Payment>;
};

export type UserRecord = {
  uniqueId: string;
  email: string;
  name: string;
  role: "admin" | "user";
};

export type InviteCodeRecord = {
  code: string;
  createdByUserId: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  disabledAt: string | null;
  createdAt: string;
};

export type PasswordResetTokenRecord = {
  token: string;
  user: UserRecord;
  expiresAt: string;
};

export type LoginRateLimitRecord = {
  identifier: string;
  failedCount: number;
  lockedUntil: string | null;
  lastFailedAt: string;
};

export type FriendInviteRecord = {
  uniqueId: string;
  sender: UserRecord;
  recipient: UserRecord;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  respondedAt?: string;
};

export type UserRepository = {
  getUserById: (uniqueId: string) => Promise<UserRecord | null>;
  getUserByEmail: (email: string) => Promise<UserRecord | null>;
  createUser: (values: { email: string; name: string; passwordHash: string }) => Promise<UserRecord>;
  updateUserProfile: (userId: string, values: { name: string }) => Promise<UserRecord>;
  updateUserPassword: (userId: string, passwordHash: string) => Promise<void>;
  getUserPasswordHash: (email: string) => Promise<string | null>;
  createSession: (userId: string, expiresAt: string) => Promise<string>;
  getSessionUser: (sessionId: string) => Promise<UserRecord | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  getLoginRateLimit: (identifier: string) => Promise<LoginRateLimitRecord | null>;
  recordLoginFailure: (
    identifier: string,
    values: { failedAt: string; lockedUntil: string | null }
  ) => Promise<LoginRateLimitRecord>;
  clearLoginFailures: (identifier: string) => Promise<void>;
  hasActiveInviteCodes: () => Promise<boolean>;
  createInviteCode: (
    adminUserId: string,
    values: { code: string; maxUses: number | null; expiresAt: string | null }
  ) => Promise<InviteCodeRecord>;
  getInviteCodes: () => Promise<InviteCodeRecord[]>;
  disableInviteCode: (adminUserId: string, code: string) => Promise<void>;
  validateInviteCode: (code: string) => Promise<InviteCodeRecord | null>;
  markInviteCodeUsed: (code: string, userId: string) => Promise<void>;
  createPasswordResetToken: (
    adminUserId: string,
    userEmail: string,
    tokenHash: string,
    expiresAt: string
  ) => Promise<PasswordResetTokenRecord>;
  getPasswordResetToken: (tokenHash: string) => Promise<PasswordResetTokenRecord | null>;
  markPasswordResetTokenUsed: (tokenHash: string, passwordHash: string) => Promise<void>;
};

export type DataRepositories = FriendRepository & GroupRepository & UserRepository;

export type FriendUsage = {
  groupCount: number;
  paymentCount: number;
};
