import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { useState } from "react";

import { AuthPageFrame } from "../components/auth-page-frame";
import { PasswordVisibilityIcon } from "../components/password-visibility-icon";
import { createUserSession, getCurrentUser, registerUser } from "../data/auth.server";
import type { Route } from "./+types/register";

type AuthActionData = {
  error?: string;
};

function getSafeRedirectTo(value: FormDataEntryValue | string | null, fallback = "/") {
  const redirectTo = typeof value === "string" ? value : fallback;
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return fallback;
  }
  return redirectTo;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  if (user) {
    throw redirect("/");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email")?.toString() ?? "";
  const name = formData.get("name")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";
  const inviteCode = formData.get("inviteCode")?.toString() ?? "";
  const redirectTo = getSafeRedirectTo(formData.get("redirectTo"));

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." } satisfies AuthActionData;
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." } satisfies AuthActionData;
  }

  try {
    const user = await registerUser({ email, name, password, inviteCode });
    return createUserSession(user.uniqueId, redirectTo);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create account.",
    } satisfies AuthActionData;
  }
}

export default function Register() {
  const actionData = useActionData<AuthActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isSubmitting = navigation.state === "submitting";

  return (
    <AuthPageFrame>
      <Form className="auth-card" method="post">
        <div className="auth-header">
          <img alt="" className="auth-icon" src="/icons/app.svg" />
          <div>
            <p className="auth-eyebrow">Get started</p>
            <h1>Create account</h1>
          </div>
        </div>
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <label className="auth-field">
          <span>Name</span>
          <input autoComplete="name" name="name" placeholder="Your name" required type="text" />
        </label>
        <label className="auth-field">
          <span>Email</span>
          <input autoComplete="email" name="email" placeholder="you@example.com" required type="email" />
        </label>
        <label className="auth-field">
          <span>Invite code</span>
          <input
            autoComplete="off"
            name="inviteCode"
            placeholder="Required when registration is invite-only"
            type="text"
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
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
          <span>Confirm Password</span>
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
        {actionData?.error ? (
          <div className="auth-alert" role="alert">
            {actionData.error}
          </div>
        ) : null}
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}>Sign in</Link>
        </p>
      </Form>
    </AuthPageFrame>
  );
}
