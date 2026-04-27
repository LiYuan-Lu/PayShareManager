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
  getUserPasswordHash: (email: string) => Promise<string | null>;
  createSession: (userId: string, expiresAt: string) => Promise<string>;
  getSessionUser: (sessionId: string) => Promise<UserRecord | null>;
  deleteSession: (sessionId: string) => Promise<void>;
};

export type DataRepositories = FriendRepository & GroupRepository & UserRepository;

export type FriendUsage = {
  groupCount: number;
  paymentCount: number;
};
