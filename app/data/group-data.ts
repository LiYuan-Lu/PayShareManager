import { matchSorter } from "match-sorter";
// @ts-expect-error - no types, but it's a tiny function
import sortBy from "sort-by";
import invariant from "tiny-invariant";
import { v4 as uuidv4 } from 'uuid';
import { getFriends } from "./friend-data";

export type Payment = 
{
  name: string, 
  payer: Member, 
  cost: number, 
  shareMember: Array<Member>
  createdAt?: string;
  youShouldPay?: number;
};

export type PaymentList = Map<number, Payment>;

export type MemberSettlement = {
  member: Member;
  paid: number;
  share: number;
  net: number;
};

export type SettlementTransfer = {
  from: Member;
  to: Member;
  amount: number;
};

export type GroupSettlement = {
  memberSettlements: MemberSettlement[];
  transfers: SettlementTransfer[];
};

export interface Member {
  uniqueId: string;
  name: string;
}

type GroupMutation = {
  uniqueId?: string;
  name?: string;
  description?: string;
  favorite?: boolean;
  members?: Array<Member>;
  paymentList?: PaymentList;
  paymentNextId?: number;
};

export type GroupRecord = GroupMutation & {
  createdAt: string;
};

const kUserUiqueId = "0";
const kUserName = "You";
const kUser = {uniqueId: kUserUiqueId, name: kUserName};

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
  group.members = [kUser];
  return group;
}

export async function getGroup(uniqueId: string) {
  const group = await fakeGroups.get(uniqueId); 
  if (!group) {
    console.log(`No group found for ${uniqueId}`);
  }
  return fakeGroups.get(uniqueId);
}

export async function updateGroup(uniqueId: string, updates: GroupMutation, members?: Member[]) {
  const group = await fakeGroups.get(uniqueId);
  if (!group) {
    throw new Error(`No group found for ${uniqueId}`);
  }
  const updatedGroup = members ? { ...group, ...updates, members } : { ...group, ...updates };
  await fakeGroups.set(uniqueId, updatedGroup);
  return group;
}

function calculateYouShouldPay(payment: Payment) {
  const isSharedByYou = payment.shareMember.includes(kUser);
  const isPayByYou = payment.payer === kUser;

  if(!isSharedByYou && isPayByYou) {
    return -payment.cost
  }

  if(!isSharedByYou) {
    return 0;
  }

  const shareMemberCount = payment.shareMember.length;
  const shareCost = payment.cost / shareMemberCount;

  if(isPayByYou) {
    return - (payment.cost - shareCost);
  }

  return shareCost;
}

function roundTo2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildTransfers(memberSettlements: MemberSettlement[]) {
  const creditors = memberSettlements
    .filter((item) => item.net > 0.005)
    .map((item) => ({ member: item.member, amount: item.net }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = memberSettlements
    .filter((item) => item.net < -0.005)
    .map((item) => ({ member: item.member, amount: Math.abs(item.net) }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const transferAmount = roundTo2(Math.min(creditor.amount, debtor.amount));

    if (transferAmount > 0) {
      transfers.push({
        from: debtor.member,
        to: creditor.member,
        amount: transferAmount,
      });
    }

    creditor.amount = roundTo2(creditor.amount - transferAmount);
    debtor.amount = roundTo2(debtor.amount - transferAmount);

    if (creditor.amount <= 0.005) {
      creditorIndex += 1;
    }
    if (debtor.amount <= 0.005) {
      debtorIndex += 1;
    }
  }

  return transfers;
}

export function calculateGroupSettlement(group: GroupRecord | null | undefined): GroupSettlement {
  if (!group) {
    return { memberSettlements: [], transfers: [] };
  }

  const memberMap = new Map<string, Member>();
  const settlementMap = new Map<string, { member: Member; paid: number; share: number }>();

  const ensureMember = (member: Member) => {
    if (!memberMap.has(member.uniqueId)) {
      memberMap.set(member.uniqueId, member);
    }
    if (!settlementMap.has(member.uniqueId)) {
      settlementMap.set(member.uniqueId, { member, paid: 0, share: 0 });
    }
  };

  (group.members ?? []).forEach((member) => ensureMember(member));

  group.paymentList?.forEach((payment) => {
    const cost = Number(payment.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      return;
    }

    ensureMember(payment.payer);
    const payerSettlement = settlementMap.get(payment.payer.uniqueId);
    if (payerSettlement) {
      payerSettlement.paid = roundTo2(payerSettlement.paid + cost);
    }

    const sharedMembers = payment.shareMember ?? [];
    if (sharedMembers.length === 0) {
      return;
    }

    const shareAmount = cost / sharedMembers.length;
    sharedMembers.forEach((member) => {
      ensureMember(member);
      const memberSettlement = settlementMap.get(member.uniqueId);
      if (memberSettlement) {
        memberSettlement.share = roundTo2(memberSettlement.share + shareAmount);
      }
    });
  });

  const memberSettlements: MemberSettlement[] = Array.from(settlementMap.values())
    .map((item) => {
      const paid = roundTo2(item.paid);
      const share = roundTo2(item.share);
      return {
        member: item.member,
        paid,
        share,
        net: roundTo2(paid - share),
      };
    })
    .sort((a, b) => a.member.name.localeCompare(b.member.name));

  return {
    memberSettlements,
    transfers: buildTransfers(memberSettlements),
  };
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

  const paymentToSave: Payment = {
    ...payment,
    createdAt: payment.createdAt ?? new Date().toISOString(),
  };
  paymentToSave.youShouldPay = calculateYouShouldPay(paymentToSave);
  group.paymentList.set(group.paymentNextId++, paymentToSave);
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

export async function getPayment(uniqueId: string, paymentId: number) {
  const group = await fakeGroups.get(uniqueId);
  if (!group) {
    throw new Error(`No group found for ${uniqueId}`);
  }
  if (!group.paymentList) {
    throw new Error(`No payment list found for ${uniqueId}`);
  }
  const payment = group.paymentList.get(paymentId);
  if (!payment) {
    throw new Error(`No payment found for ${paymentId}`);
  }
  return payment;
}

export async function updatePayment(uniqueId: string, paymentId: number, payment: Payment) {
  const group = await fakeGroups.get(uniqueId);
  if (!group) {
    throw new Error(`No group found for ${uniqueId}`);
  }
  if (!group.paymentList) {
    throw new Error(`No payment list found for ${uniqueId}`);
  }

  const existingPayment = group.paymentList.get(paymentId);
  if (!existingPayment) {
    throw new Error(`No payment found for ${paymentId}`);
  }

  const updatedPayment: Payment = {
    ...existingPayment,
    ...payment,
    createdAt: existingPayment.createdAt ?? payment.createdAt ?? new Date().toISOString(),
  };
  updatedPayment.youShouldPay = calculateYouShouldPay(updatedPayment);
  group.paymentList.set(paymentId, updatedPayment);

  return updatedPayment;
}

export async function deleteGroup(uniqueId: string) {
  fakeGroups.destroy(uniqueId);
}

[
  {
    name: "Group 1",
    description: "This is group 1",
    members: [kUser],
  },
].forEach(async (group) => {
  const friends = await getFriends();
  let members = [];
  friends.forEach((friend) => {
    members.push({uniqueId: friend.uniqueId, name: friend.name});
  });
  members.push(kUser);
  group.members = members;
  fakeGroups.create({
    ...group,
  });
});

export async function getMember(uniqueId: string, memberId: string) {
  const group = await fakeGroups.get(uniqueId);
  if (!group) {
    throw new Error(`No group found for ${uniqueId}`);
  }

  if (!group.members) {
    throw new Error(`No members found for ${uniqueId}`);
  }
  const member = group.members.find((member) => member.uniqueId === memberId);
  if (!member) {
    throw new Error(`No member found for ${memberId}`);
  }
  return member;
}
