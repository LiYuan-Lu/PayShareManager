import { matchSorter } from "match-sorter";
// @ts-expect-error - no types, but it's a tiny function
import sortBy from "sort-by";
import { defaultCurrency, normalizeCurrency } from "./currencies.js";
import type { DataRepositories } from "./repositories/types";
import {
  calculateMemberShouldPay,
  getGroupPaymentMemberIds,
  type GroupMutation,
  type GroupRecord,
  type Member,
  type Payment,
} from "./settlement.js";

export {
  calculateGroupSettlement,
  calculateGroupSettlementByCurrency,
  calculateMemberPairBalancesByCurrency,
  calculateMemberShouldPay,
  getGroupPaymentMemberIds,
  type GroupMutation,
  type GroupRecord,
  type GroupSettlement,
  type CurrencyGroupSettlement,
  type CurrencyMemberPairBalance,
  type Member,
  type MemberSettlement,
  type Payment,
  type PaymentList,
  type PaymentShare,
  type SettlementTransfer,
} from "./settlement.js";

let repositories: DataRepositories | null = null;

async function getRepositories() {
  if (!repositories) {
    const { getRepositories } = await import("./repositories/index.server.js");
    repositories = getRepositories();
  }
  return repositories;
}

export async function getGroups(ownerUserId: string, query?: string | null) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const repository = await getRepositories();
  let groups = await repository.getGroups(ownerUserId);
  if (query) {
    groups = matchSorter(groups, query, {
      keys: ["name", "description"],
    });
  }
  return groups.sort(sortBy("name", "createdAt"));
}

export async function createEmptyGroup(ownerUserId: string) {
  const repository = await getRepositories();
  return repository.createGroup(ownerUserId, { members: [] });
}

export async function getGroup(ownerUserId: string, uniqueId: string) {
  const repository = await getRepositories();
  const group = await repository.getGroup(ownerUserId, uniqueId); 
  if (!group) {
    console.log(`No group found for ${uniqueId}`);
  }
  return group;
}

export async function updateGroup(ownerUserId: string, uniqueId: string, updates: GroupMutation, members?: Member[]) {
  const repository = await getRepositories();
  return repository.updateGroup(ownerUserId, uniqueId, updates, members);
}

export async function settleGroup(ownerUserId: string, uniqueId: string) {
  const repository = await getRepositories();
  return repository.settleGroup(ownerUserId, uniqueId, new Date().toISOString());
}

export async function addPayment(ownerUserId: string, uniqueId: string, payment: Payment) {
  const repository = await getRepositories();
  const paymentToSave: Payment = {
    ...payment,
    currency: normalizeCurrency(payment.currency ?? defaultCurrency),
    createdAt: payment.createdAt ?? new Date().toISOString(),
  };
  const group = await repository.getGroup(ownerUserId, uniqueId);
  paymentToSave.youShouldPay = calculateMemberShouldPay(
    paymentToSave,
    group?.viewerMemberId
  );
  await repository.addPayment(ownerUserId, uniqueId, paymentToSave);
}

export async function deletePayment(ownerUserId: string, uniqueId: string, paymentId: number) {
  const repository = await getRepositories();
  await repository.deletePayment(ownerUserId, uniqueId, paymentId);
}

export async function getPayment(ownerUserId: string, uniqueId: string, paymentId: number) {
  const repository = await getRepositories();
  const group = await repository.getGroup(ownerUserId, uniqueId);
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

export async function updatePayment(ownerUserId: string, uniqueId: string, paymentId: number, payment: Payment) {
  const repository = await getRepositories();
  const group = await repository.getGroup(ownerUserId, uniqueId);
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
    currency: normalizeCurrency(payment.currency ?? existingPayment.currency ?? defaultCurrency),
    createdAt: payment.createdAt ?? existingPayment.createdAt ?? new Date().toISOString(),
  };
  updatedPayment.youShouldPay = calculateMemberShouldPay(
    updatedPayment,
    group.viewerMemberId
  );
  return repository.updatePayment(ownerUserId, uniqueId, paymentId, updatedPayment);
}

export async function deleteGroup(ownerUserId: string, uniqueId: string) {
  const repository = await getRepositories();
  await repository.deleteGroup(ownerUserId, uniqueId);
}

export async function getMember(ownerUserId: string, uniqueId: string, memberId: string) {
  const repository = await getRepositories();
  const group = await repository.getGroup(ownerUserId, uniqueId);
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
