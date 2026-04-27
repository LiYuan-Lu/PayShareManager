export type Payment = 
{
  name: string, 
  payer: Member, 
  cost: number, 
  shareMember: Array<Member>;
  shareDetails?: Array<PaymentShare>;
  splitMode?: "equal" | "shares";
  createdAt?: string;
  youShouldPay?: number;
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
  memberSettlements: MemberSettlement[];
  transfers: SettlementTransfer[];
};

export type MemberPairBalance = {
  member: Member;
  counterparty: Member;
  paidForCounterparty: number;
  counterpartyPaidForMember: number;
  net: number;
  paymentCount: number;
  groupCount: number;
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

export function getGroupPaymentMemberIds(group: GroupRecord | null | undefined) {
  const memberIds = new Set<string>();

  group?.paymentList?.forEach((payment) => {
    memberIds.add(payment.payer.uniqueId);
    payment.shareMember?.forEach((member) => memberIds.add(member.uniqueId));
    payment.shareDetails?.forEach((item) => memberIds.add(item.member.uniqueId));
  });

  return memberIds;
}
