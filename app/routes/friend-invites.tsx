import { Form, useActionData } from "react-router";

import {
  getReceivedFriendInvites,
  respondToFriendInvite,
} from "../data/friend-data";
import { requireUserId } from "../data/auth.server";
import type { Route } from "./+types/friend-invites";

type FriendInvitesActionData = {
  error?: string;
};

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const invites = await getReceivedFriendInvites(userId);
  return { invites };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const inviteId = formData.get("inviteId")?.toString() ?? "";
  const intent = formData.get("intent")?.toString();

  if (!inviteId || (intent !== "accepted" && intent !== "declined")) {
    return { error: "Unable to update this invite." } satisfies FriendInvitesActionData;
  }

  try {
    await respondToFriendInvite(userId, inviteId, intent);
    return null;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to update this invite.",
    } satisfies FriendInvitesActionData;
  }
}

export default function FriendInvites({ loaderData }: Route.ComponentProps) {
  const { invites } = loaderData;
  const actionData = useActionData<FriendInvitesActionData>();

  return (
    <div id="friend" className="friend-shell">
      <div className="friend-hero">
        <div>
          <p className="friend-eyebrow">Friend invites</p>
          <h1>Pending requests</h1>
          <p className="friend-subtitle">
            Accept requests from people you want to share groups and payments with.
          </p>
        </div>
        <div className="friend-usage-metrics">
          <div className="friend-metric">
            <span>Pending</span>
            <strong>{invites.length}</strong>
          </div>
        </div>
      </div>

      {actionData?.error ? (
        <div className="friend-warning">
          <strong>Invite update failed</strong>
          <p>{actionData.error}</p>
        </div>
      ) : null}

      <section className="friend-invite-section">
        {invites.length ? (
          invites.map((invite) => (
            <div className="friend-invite-card" key={invite.uniqueId}>
              <div>
                <strong>{invite.sender.name}</strong>
                <span>{invite.sender.email}</span>
              </div>
              <div className="friend-invite-actions">
                <Form method="post">
                  <input name="inviteId" type="hidden" value={invite.uniqueId} />
                  <button name="intent" type="submit" value="accepted">
                    Accept
                  </button>
                </Form>
                <Form method="post">
                  <input name="inviteId" type="hidden" value={invite.uniqueId} />
                  <button
                    className="secondary-button"
                    name="intent"
                    type="submit"
                    value="declined"
                  >
                    Decline
                  </button>
                </Form>
              </div>
            </div>
          ))
        ) : (
          <div className="friend-empty-state">
            <strong>No pending invites</strong>
            <p>New requests will appear here when another user invites your email.</p>
          </div>
        )}
      </section>
    </div>
  );
}
