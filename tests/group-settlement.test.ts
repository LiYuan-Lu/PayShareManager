import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateGroupSettlement,
  calculateGroupSettlementByCurrency,
  calculateMemberPairBalance,
  calculateMemberPairBalancesByCurrency,
  type GroupRecord,
  type Member,
  type Payment,
} from "../app/data/settlement.js";

const you: Member = { uniqueId: "0", name: "You" };
const alex: Member = { uniqueId: "alex", name: "Alex" };
const blair: Member = { uniqueId: "blair", name: "Blair" };
const casey: Member = { uniqueId: "casey", name: "Casey" };

function payment(values: Partial<Payment> & Pick<Payment, "payer" | "cost" | "shareMember">) {
  return {
    name: "Test payment",
    splitMode: "equal",
    ...values,
  } satisfies Payment;
}

function group(payments: Payment[], members: Member[] = [alex, blair, casey]): GroupRecord {
  return {
    uniqueId: "group-1",
    createdAt: "2026-04-24T00:00:00.000Z",
    name: "Trip",
    members,
    paymentList: new Map(payments.map((item, index) => [index, item])),
    paymentNextId: payments.length,
  };
}

function settlementsByName(result: ReturnType<typeof calculateGroupSettlement>) {
  return Object.fromEntries(
    result.memberSettlements.map((item) => [
      item.member.name,
      {
        paid: item.paid,
        share: item.share,
        net: item.net,
      },
    ])
  );
}

function transfers(result: ReturnType<typeof calculateGroupSettlement>) {
  return result.transfers.map((item) => ({
    from: item.from.name,
    to: item.to.name,
    amount: item.amount,
  }));
}

describe("calculateGroupSettlement", () => {
  it("splits a payment equally among shared members", () => {
    const result = calculateGroupSettlement(
      group([
        payment({
          payer: alex,
          cost: 90,
          shareMember: [alex, blair, casey],
        }),
      ])
    );

    assert.deepEqual(settlementsByName(result), {
      Alex: { paid: 90, share: 30, net: 60 },
      Blair: { paid: 0, share: 30, net: -30 },
      Casey: { paid: 0, share: 30, net: -30 },
    });
    assert.deepEqual(transfers(result), [
      { from: "Blair", to: "Alex", amount: 30 },
      { from: "Casey", to: "Alex", amount: 30 },
    ]);
  });

  it("uses share weights for by-shares payments", () => {
    const result = calculateGroupSettlement(
      group([
        payment({
          payer: alex,
          cost: 120,
          shareMember: [alex, blair, casey],
          splitMode: "shares",
          shareDetails: [
            { member: alex, shares: 1 },
            { member: blair, shares: 2 },
            { member: casey, shares: 3 },
          ],
        }),
      ])
    );

    assert.deepEqual(settlementsByName(result), {
      Alex: { paid: 120, share: 20, net: 100 },
      Blair: { paid: 0, share: 40, net: -40 },
      Casey: { paid: 0, share: 60, net: -60 },
    });
    assert.deepEqual(transfers(result), [
      { from: "Casey", to: "Alex", amount: 60 },
      { from: "Blair", to: "Alex", amount: 40 },
    ]);
  });

  it("credits a payer who is not included in the shared members", () => {
    const result = calculateGroupSettlement(
      group([
        payment({
          payer: alex,
          cost: 60,
          shareMember: [blair, casey],
        }),
      ])
    );

    assert.deepEqual(settlementsByName(result), {
      Alex: { paid: 60, share: 0, net: 60 },
      Blair: { paid: 0, share: 30, net: -30 },
      Casey: { paid: 0, share: 30, net: -30 },
    });
    assert.deepEqual(transfers(result), [
      { from: "Blair", to: "Alex", amount: 30 },
      { from: "Casey", to: "Alex", amount: 30 },
    ]);
  });

  it("nets multiple payments into the minimum transfer list", () => {
    const result = calculateGroupSettlement(
      group([
        payment({
          payer: alex,
          cost: 100,
          shareMember: [alex, blair, casey],
        }),
        payment({
          payer: blair,
          cost: 50,
          shareMember: [alex, blair, casey],
        }),
      ])
    );

    assert.deepEqual(settlementsByName(result), {
      Alex: { paid: 100, share: 50, net: 50 },
      Blair: { paid: 50, share: 50, net: 0 },
      Casey: { paid: 0, share: 50, net: -50 },
    });
    assert.deepEqual(transfers(result), [
      { from: "Casey", to: "Alex", amount: 50 },
    ]);
  });

  it("returns empty results for a missing group", () => {
    assert.deepEqual(calculateGroupSettlement(null), {
      memberSettlements: [],
      transfers: [],
    });
  });

  it("includes members even when they have no payments", () => {
    const result = calculateGroupSettlement(group([], [you, alex]));

    assert.deepEqual(settlementsByName(result), {
      Alex: { paid: 0, share: 0, net: 0 },
      You: { paid: 0, share: 0, net: 0 },
    });
    assert.deepEqual(transfers(result), []);
  });

  it("keeps settlement totals separate by currency", () => {
    const result = calculateGroupSettlementByCurrency(
      group([
        payment({
          payer: alex,
          cost: 90,
          currency: "TWD",
          shareMember: [alex, blair, casey],
        }),
        payment({
          payer: blair,
          cost: 3000,
          currency: "JPY",
          shareMember: [alex, blair],
        }),
      ])
    );

    assert.deepEqual(
      result.map((item) => item.currency),
      ["JPY", "TWD"]
    );
    assert.deepEqual(settlementsByName(result[0].settlement), {
      Alex: { paid: 0, share: 1500, net: -1500 },
      Blair: { paid: 3000, share: 1500, net: 1500 },
      Casey: { paid: 0, share: 0, net: 0 },
    });
    assert.deepEqual(settlementsByName(result[1].settlement), {
      Alex: { paid: 90, share: 30, net: 60 },
      Blair: { paid: 0, share: 30, net: -30 },
      Casey: { paid: 0, share: 30, net: -30 },
    });
  });
});

describe("calculateMemberPairBalance", () => {
  it("nets direct payment shares between you and one friend", () => {
    const trip = group(
      [
        payment({
          payer: you,
          cost: 90,
          shareMember: [you, alex, blair],
        }),
        payment({
          payer: alex,
          cost: 80,
          shareMember: [you, alex],
        }),
        payment({
          payer: blair,
          cost: 120,
          shareMember: [you, alex, blair],
        }),
      ],
      [you, alex, blair]
    );
    const dinner = {
      ...group(
        [
          payment({
            payer: you,
            cost: 120,
            shareMember: [you, alex],
            splitMode: "shares",
            shareDetails: [
              { member: you, shares: 1 },
              { member: alex, shares: 3 },
            ],
          }),
        ],
        [you, alex]
      ),
      uniqueId: "group-2",
    };
    const settledGroup = {
      ...group(
        [
          payment({
            payer: alex,
            cost: 200,
            shareMember: [you, alex],
          }),
        ],
        [you, alex]
      ),
      uniqueId: "group-3",
      settledAt: "2026-04-27T00:00:00.000Z",
    };

    const result = calculateMemberPairBalance([trip, dinner, settledGroup], alex, you);

    assert.deepEqual(result, {
      member: you,
      counterparty: alex,
      paidForCounterparty: 120,
      counterpartyPaidForMember: 40,
      net: 80,
      paymentCount: 3,
      groupCount: 2,
    });
  });

  it("nets direct friend balances separately by currency", () => {
    const trip = group(
      [
        payment({
          payer: you,
          cost: 90,
          currency: "TWD",
          shareMember: [you, alex],
        }),
        payment({
          payer: alex,
          cost: 3000,
          currency: "JPY",
          shareMember: [you, alex],
        }),
      ],
      [you, alex]
    );

    const result = calculateMemberPairBalancesByCurrency([trip], alex, you);

    assert.deepEqual(
      result.map((item) => ({
        currency: item.currency,
        paidForCounterparty: item.paidForCounterparty,
        counterpartyPaidForMember: item.counterpartyPaidForMember,
        net: item.net,
      })),
      [
        {
          currency: "JPY",
          paidForCounterparty: 0,
          counterpartyPaidForMember: 1500,
          net: -1500,
        },
        {
          currency: "TWD",
          paidForCounterparty: 45,
          counterpartyPaidForMember: 0,
          net: 45,
        },
      ]
    );
  });
});
