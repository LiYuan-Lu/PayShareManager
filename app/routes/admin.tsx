import { Form, useActionData } from "react-router";

import {
  createInviteCode,
  createManualPasswordReset,
  disableInviteCode,
  getInviteCodes,
  requireAdmin,
} from "../data/auth.server";
import type { InviteCodeRecord, PasswordResetTokenRecord } from "../data/repositories/types";
import type { Route } from "./+types/admin";

type AdminActionData = {
  error?: string;
  inviteCode?: InviteCodeRecord;
  resetToken?: PasswordResetTokenRecord & { resetUrl: string };
};

function getLocalDateTimeValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) {
    return null;
  }
  return new Date(value).toISOString();
}

function getResetUrl(request: Request, token: string) {
  const url = new URL(request.url);
  return `${url.origin}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const inviteCodes = await getInviteCodes();
  return { inviteCodes };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  try {
    if (intent === "createInviteCode") {
      const maxUsesRaw = formData.get("maxUses")?.toString() ?? "";
      const inviteCode = await createInviteCode(admin.uniqueId, {
        code: formData.get("code")?.toString(),
        maxUses: maxUsesRaw ? Number(maxUsesRaw) : null,
        expiresAt: getLocalDateTimeValue(formData.get("expiresAt")),
      });
      return { inviteCode } satisfies AdminActionData;
    }

    if (intent === "disableInviteCode") {
      await disableInviteCode(admin.uniqueId, formData.get("code")?.toString() ?? "");
      return null;
    }

    if (intent === "createPasswordReset") {
      const resetToken = await createManualPasswordReset(
        admin.uniqueId,
        formData.get("email")?.toString() ?? ""
      );
      return {
        resetToken: {
          ...resetToken,
          resetUrl: getResetUrl(request, resetToken.token),
        },
      } satisfies AdminActionData;
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Admin action failed.",
    } satisfies AdminActionData;
  }

  return null;
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  const { inviteCodes } = loaderData;
  const actionData = useActionData<AdminActionData>();

  return (
    <div className="admin-shell">
      <section className="admin-hero">
        <p className="home-eyebrow">Admin</p>
        <h1>Access controls</h1>
        <p>Manage invite-only registration and manual password resets.</p>
      </section>

      {actionData?.error ? <div className="auth-alert">{actionData.error}</div> : null}
      {actionData?.inviteCode ? (
        <div className="admin-result">
          <span>Invite code created</span>
          <strong>{actionData.inviteCode.code}</strong>
        </div>
      ) : null}
      {actionData?.resetToken ? (
        <div className="admin-result">
          <span>Password reset link for {actionData.resetToken.user.email}</span>
          <strong>{actionData.resetToken.resetUrl}</strong>
          <small>Expires at {new Date(actionData.resetToken.expiresAt).toLocaleString()}</small>
        </div>
      ) : null}

      <section className="admin-grid">
        <Form className="admin-card" method="post">
          <h2>Create invite code</h2>
          <label className="auth-field">
            <span>Code</span>
            <input name="code" placeholder="Leave blank to generate" type="text" />
          </label>
          <label className="auth-field">
            <span>Max uses</span>
            <input min="1" name="maxUses" placeholder="Unlimited" type="number" />
          </label>
          <label className="auth-field">
            <span>Expires at</span>
            <input name="expiresAt" type="datetime-local" />
          </label>
          <button name="intent" type="submit" value="createInviteCode">
            Create code
          </button>
        </Form>

        <Form className="admin-card" method="post">
          <h2>Password reset</h2>
          <label className="auth-field">
            <span>User email</span>
            <input name="email" placeholder="friend@example.com" required type="email" />
          </label>
          <button name="intent" type="submit" value="createPasswordReset">
            Generate reset link
          </button>
        </Form>
      </section>

      <section className="admin-card">
        <h2>Invite codes</h2>
        <div className="admin-code-list">
          {inviteCodes.length ? (
            inviteCodes.map((inviteCode) => (
              <div className="admin-code-row" key={inviteCode.code}>
                <div>
                  <strong>{inviteCode.code}</strong>
                  <span>
                    {inviteCode.usedCount}
                    {inviteCode.maxUses === null ? " uses" : ` / ${inviteCode.maxUses} uses`}
                    {inviteCode.expiresAt
                      ? `, expires ${new Date(inviteCode.expiresAt).toLocaleString()}`
                      : ""}
                  </span>
                </div>
                {inviteCode.disabledAt ? (
                  <span className="admin-status">Disabled</span>
                ) : (
                  <Form method="post">
                    <input name="code" type="hidden" value={inviteCode.code} />
                    <button
                      className="secondary-button compact-button"
                      name="intent"
                      type="submit"
                      value="disableInviteCode"
                    >
                      Disable
                    </button>
                  </Form>
                )}
              </div>
            ))
          ) : (
            <p className="nav-empty">No invite codes yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
