import { matchSorter } from "match-sorter";
// @ts-expect-error - no types, but it's a tiny function
import sortBy from "sort-by";
import type { DataRepositories } from "./repositories/types";
import {
  calculateYouShouldPay,
  getGroupPaymentMemberIds,
  type GroupMutation,
  type GroupRecord,
  type Member,
  type Payment,
} from "./settlement.js";

export {
  calculateGroupSettlement,
  getGroupPaymentMemberIds,
  type GroupMutation,
  type GroupRecord,
  type GroupSettlement,
  type Member,
  type MemberSettlement,
  type Payment,
  type PaymentList,
  type PaymentShare,
  type SettlementTransfer,
} from "./settlement.js";

const kUserUniqueId = "0";
const kUserName = "You";
const kUser = {uniqueId: kUserUniqueId, name: kUserName};

let repositories: DataRepositories | null = null;

async function getRepositories() {
  if (!repositories) {
    const { getRepositories } = await import("./repositories/index.server.js");
    repositories = getRepositories();
  }
  return repositories;
}

export async function getGroups(query?: string | null) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const repository = await getRepositories();
  let groups = await repository.getGroups();
  if (query) {
    groups = matchSorter(groups, query, {
      keys: ["name", "description"],
    });
  }
  return groups.sort(sortBy("name", "createdAt"));
}

export async function createEmptyGroup() {
  const repository = await getRepositories();
  return repository.createGroup({ members: [kUser] });
}

export async function getGroup(uniqueId: string) {
  const repository = await getRepositories();
  const group = await repository.getGroup(uniqueId); 
  if (!group) {
    console.log(`No group found for ${uniqueId}`);
  }
  return group;
}

export async function updateGroup(uniqueId: string, updates: GroupMutation, members?: Member[]) {
  const repository = await getRepositories();
  return repository.updateGroup(uniqueId, updates, members);
}

export async function addPayment(uniqueId: string, payment: Payment) {
  const paymentToSave: Payment = {
    ...payment,
    createdAt: payment.createdAt ?? new Date().toISOString(),
  };
  paymentToSave.youShouldPay = calculateYouShouldPay(paymentToSave);
  const repository = await getRepositories();
  await repository.addPayment(uniqueId, paymentToSave);
}

export async function deletePayment(uniqueId: string, paymentId: number) {
  const repository = await getRepositories();
  await repository.deletePayment(uniqueId, paymentId);
}

export async function getPayment(uniqueId: string, paymentId: number) {
  const repository = await getRepositories();
  const group = await repository.getGroup(uniqueId);
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
  const repository = await getRepositories();
  const group = await repository.getGroup(uniqueId);
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
    createdAt: payment.createdAt ?? existingPayment.createdAt ?? new Date().toISOString(),
  };
  updatedPayment.youShouldPay = calculateYouShouldPay(updatedPayment);
  return repository.updatePayment(uniqueId, paymentId, updatedPayment);
}

export async function deleteGroup(uniqueId: string) {
  const repository = await getRepositories();
  await repository.deleteGroup(uniqueId);
}

export async function getMember(uniqueId: string, memberId: string) {
  const repository = await getRepositories();
  const group = await repository.getGroup(uniqueId);
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
