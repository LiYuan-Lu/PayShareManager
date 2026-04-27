import { Form, useActionData, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/create-friend";
import { createFriendInvite, getSentFriendInvites } from "../data/friend-data";
import { requireUserId } from "../data/auth.server";

import "./create-group.css";

type CreateFriendActionData = {
  error?: string;
  success?: string;
};

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const sentInvites = await getSentFriendInvites(userId);
  return { sentInvites };
}

export async function action({
  request,
}: Route.ActionArgs) {
    const userId = await requireUserId(request);
    const formData = await request.formData();

    const email = formData.get("email")?.toString() ?? "";
    if (!email.trim()) {
      return { error: "Email is required." } satisfies CreateFriendActionData;
    }

    try {
      const invite = await createFriendInvite(userId, email);
      return {
        success: `Invite sent to ${invite.recipient.email}.`,
      } satisfies CreateFriendActionData;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unable to send invite.",
      } satisfies CreateFriendActionData;
    }
}

export default function CreateFriend({
}: Route.ComponentProps) {
    const navigate = useNavigate();
    const actionData = useActionData<CreateFriendActionData>();
    const { sentInvites } = useLoaderData<typeof loader>();

    return (
    <Form id="friend-form" className="group-form product-form" method="post">
      <div className="form-header">
        <p className="form-eyebrow">Friend setup</p>
        <h1>Invite friend</h1>
      </div>

      <section className="form-section">
        <div className="form-section-copy">
          <h2>Account invite</h2>
          <p>Invite an existing Pay Share Manager user by email.</p>
        </div>
        <div className="form-fields">
          <label className="form-field">
            <span>Email</span>
            <input
              aria-label="Email"
              autoComplete="email"
              name="email"
              placeholder="friend@example.com"
              required
              type="email"
            />
          </label>
          {actionData?.error ? (
            <div className="auth-alert" role="alert">
              {actionData.error}
            </div>
          ) : null}
          {actionData?.success ? (
            <div className="form-success" role="status">
              {actionData.success}
            </div>
          ) : null}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-copy">
          <h2>Recent invites</h2>
          <p>Track the latest invitations sent from your account.</p>
        </div>
        <div className="invite-list">
          {sentInvites.length ? (
            sentInvites.map((invite) => (
              <div className="invite-row" key={invite.uniqueId}>
                <div>
                  <strong>{invite.recipient.name}</strong>
                  <span>{invite.recipient.email}</span>
                </div>
                <span className={`invite-status invite-status-${invite.status}`}>
                  {invite.status}
                </span>
              </div>
            ))
          ) : (
            <p className="empty-state">No sent invites yet.</p>
          )}
        </div>
      </section>

      <div className="form-actions">
        <button type="submit">Send invite</button>
        <button onClick={() => navigate(-1)} type="button">
          Cancel
        </button>
      </div>
    </Form>
  );
}
