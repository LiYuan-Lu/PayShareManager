import { defaultCurrency, normalizeCurrency } from "./currencies.js";

export type Payment = 
{
  name: string, 
  payer: Member, 
  cost: number, 
  currency?: string;
  shareMember: Array<Member>;
  shareDetails?: Array<PaymentShare>;
  splitMode?: "equal" | "shares";
  createdAt?: string;
  createdBy?: PaymentAuditUser;
  updatedBy?: PaymentAuditUser;
  updatedAt?: string;
  youShouldPay?: number;
};

export type PaymentAuditUser = {
  uniqueId: string;
  name: string;
  email: string;
};

export type PaymentList = Map<number, Payment>;

export type PaymentShare = {
  member: Member;
  shares: number;
};

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
  currency?: string;
  memberSettlements: MemberSettlement[];
  transfers: SettlementTransfer[];
};

export type CurrencyGroupSettlement = {
  currency: string;
  settlement: GroupSettlement;
};

export type MemberPairBalance = {
  currency?: string;
  member: Member;
  counterparty: Member;
  paidForCounterparty: number;
  counterpartyPaidForMember: number;
  net: number;
  paymentCount: number;
  groupCount: number;
};

export type CurrencyMemberPairBalance = MemberPairBalance & {
  currency: string;
};

export interface Member {
  uniqueId: string;
  name: string;
  accountUserId?: string | null;
}

export type GroupMutation = {
  uniqueId?: string;
  name?: string;
  description?: string;
  favorite?: boolean;
  settledAt?: string | null;
  members?: Array<Member>;
  paymentList?: PaymentList;
  paymentNextId?: number;
};

export type GroupRecord = GroupMutation & {
  createdAt: string;
  ownerUserId?: string;
  viewerMemberId?: string;
};

const kUserUniqueId = "0";
const kUserName = "You";
const kUser = {uniqueId: kUserUniqueId, name: kUserName};

function getPaymentShareDetails(payment: Payment): PaymentShare[] {
  if (payment.splitMode === "equal") {
    return (payment.shareMember ?? []).map((member) => ({ member, shares: 1 }));
  }

  const weightedShares = (payment.shareDetails ?? []).filter((item) => item.shares > 0);
  if (weightedShares.length) {
    return weightedShares;
  }

  return (payment.shareMember ?? []).map((member) => ({ member, shares: 1 }));
}

function getPaymentShareAmount(payment: Payment, memberId: string) {
  const shareDetails = getPaymentShareDetails(payment);
  const totalShares = shareDetails.reduce((sum, item) => sum + item.shares, 0);
  if (totalShares <= 0) {
    return 0;
  }

  const memberShare = shareDetails.find((item) => item.member.uniqueId === memberId);
  if (!memberShare) {
    return 0;
  }

  return payment.cost * (memberShare.shares / totalShares);
}

export function calculateYouShouldPay(payment: Payment) {
  const shareDetails = getPaymentShareDetails(payment);
  const youShare = shareDetails.find((item) => item.member.uniqueId === kUser.uniqueId);
  const isPayByYou = payment.payer.uniqueId === kUser.uniqueId;
  const totalShares = shareDetails.reduce((sum, item) => sum + item.shares, 0);

  if(!youShare && isPayByYou) {
    return -payment.cost
  }

  if(!youShare) {
    return 0;
  }

  if(totalShares <= 0) {
    return 0;
  }

  const shareCost = payment.cost * (youShare.shares / totalShares);

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
  return calculateGroupSettlementForPayments(group, group?.paymentList);
}

function calculateGroupSettlementForPayments(
  group: GroupRecord | null | undefined,
  paymentList: PaymentList | undefined
): GroupSettlement {
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

  paymentList?.forEach((payment) => {
    const cost = Number(payment.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      return;
    }

    ensureMember(payment.payer);
    const payerSettlement = settlementMap.get(payment.payer.uniqueId);
    if (payerSettlement) {
      payerSettlement.paid = roundTo2(payerSettlement.paid + cost);
    }

    const shareDetails = getPaymentShareDetails(payment);
    if (shareDetails.length === 0) {
      return;
    }

    const totalShares = shareDetails.reduce((sum, item) => sum + item.shares, 0);
    if (totalShares <= 0) {
      return;
    }

    shareDetails.forEach((item) => {
      ensureMember(item.member);
      const memberSettlement = settlementMap.get(item.member.uniqueId);
      const shareAmount = cost * (item.shares / totalShares);
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

export function calculateGroupSettlementByCurrency(
  group: GroupRecord | null | undefined
): CurrencyGroupSettlement[] {
  if (!group) {
    return [];
  }

  const paymentsByCurrency = new Map<string, PaymentList>();
  group.paymentList?.forEach((payment, paymentId) => {
    const currency = normalizeCurrency(payment.currency ?? defaultCurrency);
    if (!paymentsByCurrency.has(currency)) {
      paymentsByCurrency.set(currency, new Map());
    }
    paymentsByCurrency.get(currency)?.set(paymentId, payment);
  });

  if (paymentsByCurrency.size === 0) {
    paymentsByCurrency.set(defaultCurrency, new Map());
  }

  return Array.from(paymentsByCurrency.entries())
    .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
    .map(([currency, paymentList]) => ({
      currency,
      settlement: {
        ...calculateGroupSettlementForPayments(group, paymentList),
        currency,
      },
    }));
}

export function calculateMemberPairBalance(
  groups: GroupRecord[],
  counterparty: Member,
  member: Member = kUser
): MemberPairBalance {
  let paidForCounterparty = 0;
  let counterpartyPaidForMember = 0;
  let paymentCount = 0;
  const groupIds = new Set<string>();

  groups.forEach((group) => {
    if (group.settledAt) {
      return;
    }

    group.paymentList?.forEach((payment) => {
      const cost = Number(payment.cost);
      if (!Number.isFinite(cost) || cost <= 0) {
        return;
      }

      const memberPaid = payment.payer.uniqueId === member.uniqueId;
      const counterpartyPaid = payment.payer.uniqueId === counterparty.uniqueId;
      if (!memberPaid && !counterpartyPaid) {
        return;
      }

      if (memberPaid) {
        const amount = getPaymentShareAmount(payment, counterparty.uniqueId);
        if (amount > 0) {
          paidForCounterparty = roundTo2(paidForCounterparty + amount);
          paymentCount += 1;
          if (group.uniqueId) {
            groupIds.add(group.uniqueId);
          }
        }
      }

      if (counterpartyPaid) {
        const amount = getPaymentShareAmount(payment, member.uniqueId);
        if (amount > 0) {
          counterpartyPaidForMember = roundTo2(counterpartyPaidForMember + amount);
          paymentCount += 1;
          if (group.uniqueId) {
            groupIds.add(group.uniqueId);
          }
        }
      }
    });
  });

  return {
    member,
    counterparty,
    paidForCounterparty,
    counterpartyPaidForMember,
    net: roundTo2(paidForCounterparty - counterpartyPaidForMember),
    paymentCount,
    groupCount: groupIds.size,
  };
}

export function calculateMemberPairBalancesByCurrency(
  groups: GroupRecord[],
  counterparty: Member,
  member: Member = kUser
): CurrencyMemberPairBalance[] {
  const groupsByCurrency = new Map<string, GroupRecord[]>();

  groups.forEach((group) => {
    if (group.settledAt) {
      return;
    }

    group.paymentList?.forEach((payment, paymentId) => {
      const currency = normalizeCurrency(payment.currency ?? defaultCurrency);
      if (!groupsByCurrency.has(currency)) {
        groupsByCurrency.set(currency, []);
      }

      const currencyGroups = groupsByCurrency.get(currency);
      let currencyGroup = currencyGroups?.find((item) => item.uniqueId === group.uniqueId);
      if (!currencyGroup) {
        currencyGroup = {
          ...group,
          paymentList: new Map(),
        };
        currencyGroups?.push(currencyGroup);
      }
      currencyGroup.paymentList?.set(paymentId, payment);
    });
  });

  return Array.from(groupsByCurrency.entries())
    .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
    .map(([currency, currencyGroups]) => ({
      ...calculateMemberPairBalance(currencyGroups, counterparty, member),
      currency,
    }));
}

function findGroupMemberByIdentity(group: GroupRecord, identity: Member) {
  return group.members?.find((member) => {
    if (identity.accountUserId && member.accountUserId === identity.accountUserId) {
      return true;
    }
    return member.uniqueId === identity.uniqueId;
  });
}

function getViewerMember(group: GroupRecord, fallback: Member = kUser) {
  if (!group.viewerMemberId) {
    return fallback;
  }
  return (
    group.members?.find((member) => member.uniqueId === group.viewerMemberId) ?? {
      ...fallback,
      uniqueId: group.viewerMemberId,
    }
  );
}

export function calculateViewerMemberPairBalancesByCurrency(
  groups: GroupRecord[],
  counterparty: Member,
  member: Member = kUser
): CurrencyMemberPairBalance[] {
  const groupsByCurrency = new Map<string, GroupRecord[]>();

  groups.forEach((group) => {
    if (group.settledAt) {
      return;
    }

    const viewerMember = getViewerMember(group, member);
    const groupCounterparty = findGroupMemberByIdentity(group, counterparty);
    if (!groupCounterparty) {
      return;
    }

    group.paymentList?.forEach((payment, paymentId) => {
      const currency = normalizeCurrency(payment.currency ?? defaultCurrency);
      if (!groupsByCurrency.has(currency)) {
        groupsByCurrency.set(currency, []);
      }

      const currencyGroups = groupsByCurrency.get(currency);
      let currencyGroup = currencyGroups?.find((item) => item.uniqueId === group.uniqueId);
      if (!currencyGroup) {
        currencyGroup = {
          ...group,
          paymentList: new Map(),
        };
        currencyGroups?.push(currencyGroup);
      }
      currencyGroup.paymentList?.set(paymentId, payment);
    });

    groupsByCurrency.forEach((currencyGroups) => {
      const currencyGroup = currencyGroups.find((item) => item.uniqueId === group.uniqueId);
      if (currencyGroup) {
        currencyGroup.viewerMemberId = viewerMember.uniqueId;
      }
    });
  });

  return Array.from(groupsByCurrency.entries())
    .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
    .map(([currency, currencyGroups]) => {
      let paidForCounterparty = 0;
      let counterpartyPaidForMember = 0;
      let paymentCount = 0;
      const groupIds = new Set<string>();
      let resolvedMember = member;
      let resolvedCounterparty = counterparty;

      currencyGroups.forEach((group) => {
        const viewerMember = getViewerMember(group, member);
        const groupCounterparty = findGroupMemberByIdentity(group, counterparty);
        if (!groupCounterparty) {
          return;
        }
        resolvedMember = viewerMember;
        resolvedCounterparty = groupCounterparty;

        const balance = calculateMemberPairBalance([group], groupCounterparty, viewerMember);
        paidForCounterparty = roundTo2(paidForCounterparty + balance.paidForCounterparty);
        counterpartyPaidForMember = roundTo2(
          counterpartyPaidForMember + balance.counterpartyPaidForMember
        );
        paymentCount += balance.paymentCount;
        if (balance.groupCount > 0 && group.uniqueId) {
          groupIds.add(group.uniqueId);
        }
      });

      return {
        currency,
        member: resolvedMember,
        counterparty: resolvedCounterparty,
        paidForCounterparty,
        counterpartyPaidForMember,
        net: roundTo2(paidForCounterparty - counterpartyPaidForMember),
        paymentCount,
        groupCount: groupIds.size,
      };
    });
}

export function getGroupPaymentMemberIds(group: GroupRecord | null | undefined) {
  const memberIds = new Set<string>();

  group?.paymentList?.forEach((payment) => {
    memberIds.add(payment.payer.uniqueId);
    payment.shareMember?.forEach((member) => memberIds.add(member.uniqueId));
    payment.shareDetails?.forEach((item) => memberIds.add(item.member.uniqueId));
  });

  return memberIds;
}
