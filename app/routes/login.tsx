import { Form, Link, redirect, useActionData, useSearchParams } from "react-router";

import { createUserSession, getCurrentUser, loginUser } from "../data/auth.server";
import type { Route } from "./+types/login";

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
  const password = formData.get("password")?.toString() ?? "";
  const redirectTo = getSafeRedirectTo(formData.get("redirectTo"));

  try {
    const user = await loginUser(email, password);
    return createUserSession(user.uniqueId, redirectTo);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to sign in.",
    } satisfies AuthActionData;
  }
}

export default function Login() {
  const actionData = useActionData<AuthActionData>();
  const [searchParams] = useSearchParams();
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"));

  return (
    <main className="auth-page">
      <Form className="auth-card" method="post">
        <div className="auth-header">
          <img alt="" className="auth-icon" src="/icons/app.svg" />
          <div>
            <p className="auth-eyebrow">Welcome back</p>
            <h1>Sign in</h1>
          </div>
        </div>
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <label className="auth-field">
          <span>Email</span>
          <input autoComplete="email" name="email" placeholder="you@example.com" required type="email" />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input autoComplete="current-password" name="password" placeholder="Password" required type="password" />
        </label>
        {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}
        <button type="submit">Sign in</button>
        <p className="auth-switch">
          New here? <Link to={`/register?redirectTo=${encodeURIComponent(redirectTo)}`}>Create an account</Link>
        </p>
      </Form>
    </main>
  );
}
