import { Form, redirect, useActionData } from "react-router";

import type { FriendMutation } from "../data/friend-data";

import { deleteFriend, getFriend, getFriendUsage, updateFriend } from "../data/friend-data";
import { requireUserId } from "../data/auth.server";
import { getGroups } from "../data/group-data";
import { formatCurrencyAmount } from "../data/currencies";
import { calculateViewerMemberPairBalancesByCurrency } from "../data/settlement";
import type { Route } from "./+types/friend";

type FriendActionData = {
  error?: string;
};

export async function action({
  params,
  request,
}: Route.ActionArgs) {
    if(!params.uniqueId) {
        throw new Response("Not Found", { status: 404 });
    }
    const userId = await requireUserId(request);
    const formData = await request.formData();
    const intent = formData.get("intent")?.toString();

    if (intent === "delete") {
      try {
        await deleteFriend(userId, params.uniqueId);
      } catch (error) {
        return {
          error: error instanceof Error
            ? error.message
            : "This friend cannot be deleted right now.",
        } satisfies FriendActionData;
      }
      return redirect("/");
    }

    const updates: FriendMutation = {
        name: formData.get("name")?.toString() ?? "",
        email: ""
    };
    await updateFriend(userId, params.uniqueId, updates);
    return redirect(`/friends/${params.uniqueId}`);
}

export async function loader({ params, request }: Route.LoaderArgs) {
  if (!params.uniqueId) {
    throw new Response("Not Found", { status: 404 });
  }
  const userId = await requireUserId(request);
  const friend = await getFriend(userId, params.uniqueId);
  if (!friend) {
    throw new Response("Not Found", { status: 404 });
  }
  const [usage, groups] = await Promise.all([
    getFriendUsage(userId, params.uniqueId),
    getGroups(userId),
  ]);
  const directGroupIds = new Set<string>();
  groups.forEach((group) => {
    const groupId = group.uniqueId;
    if (group.settledAt || !groupId) {
      return;
    }
    const viewerMemberId = group.viewerMemberId ?? "";
    const counterpartyMember = group.members?.find((member) => {
      if (friend.accountUserId && member.accountUserId === friend.accountUserId) {
        return true;
      }
      return member.uniqueId === params.uniqueId;
    });
    if (!counterpartyMember) {
      return;
    }
    group.paymentList?.forEach((payment) => {
      const shareMembers = payment.shareDetails?.length
        ? payment.shareDetails.map((item) => item.member)
        : payment.shareMember;
      const youPaidForFriend =
        payment.payer.uniqueId === viewerMemberId &&
        shareMembers.some((member) => member.uniqueId === counterpartyMember.uniqueId);
      const friendPaidForYou =
        payment.payer.uniqueId === counterpartyMember.uniqueId &&
        shareMembers.some((member) => member.uniqueId === viewerMemberId);
      if (youPaidForFriend || friendPaidForYou) {
        directGroupIds.add(groupId);
      }
    });
  });
  const balances = calculateViewerMemberPairBalancesByCurrency(groups, {
    uniqueId: params.uniqueId,
    name: friend.name ?? "",
    accountUserId: friend.accountUserId,
  });
  return { friend, usage, balances, balanceGroupCount: directGroupIds.size };
}

export default function Friend({
  loaderData,
}: Route.ComponentProps) {
  const { friend, usage, balances, balanceGroupCount } = loaderData;
  const actionData = useActionData<FriendActionData>();
  const isDeleteDisabled = usage.groupCount > 0 || usage.paymentCount > 0;
  const activeBalances = balances.filter((balance) => Math.abs(balance.net) > 0.005);
  const balanceLabel =
    activeBalances.length === 0
      ? "All settled"
      : activeBalances.length === 1
        ? activeBalances[0].net > 0
          ? `${friend.name} owes you`
          : `You owe ${friend.name}`
        : "Open balances by currency";
  const balanceAmount =
    activeBalances
      .map((balance) => formatCurrencyAmount(Math.abs(balance.net), balance.currency))
      .join(" / ") || formatCurrencyAmount(0, "TWD");
  const paymentCount = balances.reduce((sum, balance) => sum + balance.paymentCount, 0);
  const balanceToneClass = (net: number) =>
    net < -0.005
      ? "friend-balance-negative"
      : net > 0.005
        ? "friend-balance-positive"
        : "friend-balance-neutral";

  return (
    <div id="friend" className="friend-shell">
      <div className="friend-hero">
        <div>
          <p className="friend-eyebrow">Friend settings</p>
          <h1>{friend.name ? friend.name : <i>No Name</i>}</h1>
          <p className="friend-subtitle">
            Manage this local friend record. Account invites can be added after login is available.
          </p>
        </div>
        <div className="friend-usage-metrics">
          <div className="friend-metric">
            <span>Groups</span>
            <strong>{usage.groupCount}</strong>
          </div>
          <div className="friend-metric">
            <span>Payments</span>
            <strong>{usage.paymentCount}</strong>
          </div>
          <div className="friend-metric friend-balance-metric">
            <span>Balance</span>
            {activeBalances.length ? (
              <div className="friend-balance-metric-list">
                {activeBalances.map((balance) => (
                  <strong className={balanceToneClass(balance.net)} key={balance.currency}>
                    {formatCurrencyAmount(Math.abs(balance.net), balance.currency)}
                  </strong>
                ))}
              </div>
            ) : (
              <strong className="friend-balance-neutral">{balanceAmount}</strong>
            )}
          </div>
        </div>
      </div>

      <section className="friend-balance-section">
        <div>
          <p className="friend-eyebrow">Between you two</p>
          <h2>{balanceLabel}</h2>
          <p>
            Based on {paymentCount} direct payment
            {paymentCount === 1 ? "" : "s"} across {balanceGroupCount} group
            {balanceGroupCount === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="friend-balance-breakdown">
          {balances.length ? (
            balances.map((balance) => (
              <div className={balanceToneClass(balance.net)} key={balance.currency}>
                <span>{balance.currency}</span>
                <strong>
                  {balance.net > 0
                    ? `${friend.name} owes you ${formatCurrencyAmount(balance.net, balance.currency)}`
                    : balance.net < 0
                      ? `You owe ${friend.name} ${formatCurrencyAmount(Math.abs(balance.net), balance.currency)}`
                      : "All settled"}
                </strong>
              </div>
            ))
          ) : (
            <div>
              <span>No shared payments</span>
              <strong>All settled</strong>
            </div>
          )}
        </div>
      </section>

      <Form key={friend.uniqueId} method="post" className="friend-settings-form">
        <section className="friend-section">
          <div className="friend-section-copy">
            <h2>Profile</h2>
            <p>This name is used in groups and payment records.</p>
          </div>
          <label className="friend-field">
            <span>Name</span>
            <input
              aria-label="Name"
              defaultValue={friend.name}
              name="name"
              placeholder="Friend name"
              required
              type="text"
            />
          </label>
        </section>

        {isDeleteDisabled ? (
          <div className="friend-warning">
            <strong>Delete unavailable</strong>
            <p>
              This friend is used in {usage.groupCount} group
              {usage.groupCount === 1 ? "" : "s"} and {usage.paymentCount} payment
              {usage.paymentCount === 1 ? "" : "s"}. Remove those references before deleting.
            </p>
          </div>
        ) : null}
        {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}

        <div className="friend-actions">
          <button name="intent" type="submit" value="save">
            Save
          </button>
          <button
            className="danger-button"
            disabled={isDeleteDisabled}
            name="intent"
            onClick={(event) => {
              if (!confirm("Delete this friend?")) {
                event.preventDefault();
              }
            }}
            type="submit"
            value="delete"
          >
            Delete
          </button>
        </div>
      </Form>
    </div>
  );
}
