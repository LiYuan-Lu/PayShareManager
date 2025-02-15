import { matchSorter } from "match-sorter";
// @ts-expect-error - no types, but it's a tiny function
import sortBy from "sort-by";
import invariant from "tiny-invariant";
import { v4 as uuidv4 } from 'uuid';

export type Payment = 
{
  name: string, 
  payer: string, 
  cost: Number, 
  shareMember: Array<string>
  createdAt?: string;
};

export type PaymentList = Map<number, Payment>;

type GroupMutation = {
  uniqueId?: string;
  name?: string;
  description?: string;
  favorite?: boolean;
  members?: Array<string>;
  paymentList?: PaymentList;
  paymentNextId?: number;
};

export type GroupRecord = GroupMutation & {
  createdAt: string;
};

const fakeGroups = {
  records: {} as Record<string, GroupRecord>,

  async getAll(): Promise<GroupMutation[]> {
    return Object.keys(fakeGroups.records)
      .map((key) => fakeGroups.records[key])
      .sort(sortBy("-createdAt", "name"));
  },

  async get(id: string): Promise<GroupRecord | null> {
    return fakeGroups.records[id] || null;
  },

  async getUniqueId(): Promise<string> {
    let uniqueId = '';
    do {
      uniqueId = uuidv4();
    } 
    while(uniqueId in fakeGroups.records);

    return uniqueId;
  },

  async create(values: GroupMutation): Promise<GroupRecord> {
    const uniqueId = await this.getUniqueId();
    const createdAt = new Date().toISOString();
    const newGroup = { uniqueId, createdAt, ...values };
    newGroup.members = ["You"];
    newGroup.paymentList = new Map<number, Payment>();
    newGroup.paymentNextId = 0;
    fakeGroups.records[uniqueId] = newGroup;
    return newGroup;
  },

  async set(uniqueId: string, values: GroupMutation): Promise<GroupRecord> {
    const group = await fakeGroups.get(uniqueId);
    invariant(group, `No group found for ${uniqueId}`);
    const updatedGroup = { ...group, ...values };
    fakeGroups.records[uniqueId] = updatedGroup;
    return updatedGroup;
  },

  destroy(uniqueId: string): null {
    delete fakeGroups.records[uniqueId];
    return null;
  },
};

export async function getGroups(query?: string | null) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  let groups = await fakeGroups.getAll();
  if (query) {
    groups = matchSorter(groups, query, {
      keys: ["name", "description"],
    });
  }
  return groups.sort(sortBy("name", "createdAt"));
}

export async function createEmptyGroup() {
  const group = await fakeGroups.create({});
  return group;
}

export async function getGroup(uniqueId: string) {
  const group = await fakeGroups.get(uniqueId); 
  if (!group) {
    console.log(`No group found for ${uniqueId}`);
  }
  return fakeGroups.get(uniqueId);
}

export async function updateGroup(uniqueId: string, updates: GroupMutation, members?: string[]) {
  const group = await fakeGroups.get(uniqueId);
  if (!group) {
    throw new Error(`No group found for ${uniqueId}`);
  }
  const updatedGroup = members ? { ...group, ...updates, members } : { ...group, ...updates };
  await fakeGroups.set(uniqueId, updatedGroup);
  return group;
}

export async function addPayment(uniqueId: string, payment: Payment) {
  const group = await fakeGroups.get(uniqueId);
  if (!group) {
    throw new Error(`No group found for ${uniqueId}`);
  }

  if (!group.paymentList) {
    group.paymentList = new Map<number, Payment>();
  }
  if (!group.paymentNextId) {
    group.paymentNextId = 0;
  }
  group.paymentList.set(group.paymentNextId++, payment);
}

export async function deletePayment(uniqueId: string, paymentId: number) {
  const group = await fakeGroups.get(uniqueId);
  if (!group) {
    throw new Error(`No group found for ${uniqueId}`);
  }
  if (!group.paymentList) {
    group.paymentList = new Map<number, Payment>();
  }
  group.paymentList.delete(paymentId);
}

export async function updatePaymentList(uniqueId: string, paymentList: PaymentList) {
  const group = await fakeGroups.get(uniqueId);
  if (!group) {
    throw new Error(`No group found for ${uniqueId}`);
  }
  await fakeGroups.set(uniqueId, { ...group, paymentList});
  return group;
}

export async function deleteGroup(uniqueId: string) {
  fakeGroups.destroy(uniqueId);
}

[
  {
    name: "Group 1",
    description: "This is group 1"
  },
  {
    name: "Group 2",
    description: "This is group 2"
  },
  {
    name: "Group 3",
    description: "This is group 3"
  },
].forEach((group) => {
  fakeGroups.create({
    ...group,
  });
});