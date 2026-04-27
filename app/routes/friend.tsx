import { Form, redirect, useActionData } from "react-router";

import type { FriendMutation } from "../data/friend-data";

import { deleteFriend, getFriend, getFriendUsage, updateFriend } from "../data/friend-data";
import { requireUserId } from "../data/auth.server";
import { getGroups } from "../data/group-data";
import { calculateMemberPairBalance } from "../data/settlement";
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
  const balance = calculateMemberPairBalance(groups, {
    uniqueId: params.uniqueId,
    name: friend.name ?? "",
  });
  return { friend, usage, balance };
}

export default function Friend({
  loaderData,
}: Route.ComponentProps) {
  const { friend, usage, balance } = loaderData;
  const actionData = useActionData<FriendActionData>();
  const isDeleteDisabled = usage.groupCount > 0 || usage.paymentCount > 0;
  const balanceAmount = Math.abs(balance.net).toFixed(2);
  const balanceLabel =
    balance.net > 0
      ? `${friend.name} owes you`
      : balance.net < 0
        ? `You owe ${friend.name}`
        : "All settled";

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
            <strong className={balance.net < 0 ? "friend-balance-negative" : ""}>
              ${balanceAmount}
            </strong>
          </div>
        </div>
      </div>

      <section className="friend-balance-section">
        <div>
          <p className="friend-eyebrow">Between you two</p>
          <h2>{balanceLabel}</h2>
          <p>
            Based on {balance.paymentCount} direct payment
            {balance.paymentCount === 1 ? "" : "s"} across {balance.groupCount} group
            {balance.groupCount === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="friend-balance-breakdown">
          <div>
            <span>You paid for {friend.name}</span>
            <strong>${balance.paidForCounterparty.toFixed(2)}</strong>
          </div>
          <div>
            <span>{friend.name} paid for you</span>
            <strong>${balance.counterpartyPaidForMember.toFixed(2)}</strong>
          </div>
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
