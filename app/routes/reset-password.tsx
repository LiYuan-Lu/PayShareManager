import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { useState } from "react";

import { AuthPageFrame } from "../components/auth-page-frame";
import { PasswordVisibilityIcon } from "../components/password-visibility-icon";
import { getPasswordResetToken, resetPasswordWithToken } from "../data/auth.server";
import type { Route } from "./+types/reset-password";

type ResetPasswordActionData = {
  error?: string;
};

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const resetToken = token ? await getPasswordResetToken(token) : null;
  if (!resetToken) {
    return { token: "", email: "" };
  }
  return { token, email: resetToken.user.email };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const token = formData.get("token")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." } satisfies ResetPasswordActionData;
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." } satisfies ResetPasswordActionData;
  }

  try {
    await resetPasswordWithToken(token, password);
    throw redirect("/login");
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return {
      error: error instanceof Error ? error.message : "Unable to reset password.",
    } satisfies ResetPasswordActionData;
  }
}

export default function ResetPassword() {
  const { token, email } = useLoaderData<typeof loader>();
  const actionData = useActionData<ResetPasswordActionData>();
  const navigation = useNavigation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isSubmitting = navigation.state === "submitting";

  return (
    <AuthPageFrame>
      <Form className="auth-card" method="post">
        <div className="auth-header">
          <img alt="" className="auth-icon" src="/icons/app.svg" />
          <div>
            <p className="auth-eyebrow">Account recovery</p>
            <h1>Reset password</h1>
          </div>
        </div>
        {token ? (
          <>
            <input name="token" type="hidden" value={token} />
            <p className="auth-switch">Resetting password for {email}</p>
            <label className="auth-field">
              <span>New password</span>
              <div className="auth-password-control">
                <input
                  autoComplete="new-password"
                  name="password"
                  placeholder="At least 8 characters"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  <PasswordVisibilityIcon visible={showPassword} />
                </button>
              </div>
            </label>
            <label className="auth-field">
              <span>Confirm password</span>
              <div className="auth-password-control">
                <input
                  autoComplete="new-password"
                  name="confirmPassword"
                  placeholder="Re-enter password"
                  required
                  type={showConfirmPassword ? "text" : "password"}
                />
                <button
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  type="button"
                >
                  <PasswordVisibilityIcon visible={showConfirmPassword} />
                </button>
              </div>
            </label>
            {actionData?.error ? <div className="auth-alert">{actionData.error}</div> : null}
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : "Reset password"}
            </button>
          </>
        ) : (
          <>
            <div className="auth-alert">This reset link is invalid or has expired.</div>
            <p className="auth-switch">
              Ask an admin to generate a new reset link, then <Link to="/login">return to sign in</Link>.
            </p>
          </>
        )}
      </Form>
    </AuthPageFrame>
  );
}
