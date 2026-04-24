import type { FriendMutation } from "../friend-data";
import type { GroupRecord, GroupMutation, Payment } from "../group-data";

export type FriendRepository = {
  getFriends: () => Promise<FriendMutation[]>;
  getFriend: (uniqueId: string) => Promise<FriendMutation | null>;
  createFriend: (values: FriendMutation) => Promise<FriendMutation>;
  updateFriend: (uniqueId: string, values: FriendMutation) => Promise<FriendMutation>;
  deleteFriend: (uniqueId: string) => Promise<void>;
};

export type GroupRepository = {
  getGroups: () => Promise<GroupRecord[]>;
  getGroup: (uniqueId: string) => Promise<GroupRecord | null>;
  createGroup: (values: GroupMutation) => Promise<GroupRecord>;
  updateGroup: (
    uniqueId: string,
    values: GroupMutation,
    members?: GroupRecord["members"]
  ) => Promise<GroupRecord>;
  deleteGroup: (uniqueId: string) => Promise<void>;
  addPayment: (uniqueId: string, payment: Payment) => Promise<void>;
  deletePayment: (uniqueId: string, paymentId: number) => Promise<void>;
  updatePayment: (uniqueId: string, paymentId: number, payment: Payment) => Promise<Payment>;
};

export type DataRepositories = FriendRepository & GroupRepository;
