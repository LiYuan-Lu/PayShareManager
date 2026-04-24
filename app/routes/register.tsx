import { Form, Link, redirect, useActionData, useSearchParams } from "react-router";

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
  const redirectTo = getSafeRedirectTo(formData.get("redirectTo"));

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." } satisfies AuthActionData;
  }

  try {
    const user = await registerUser({ email, name, password });
    return createUserSession(user.uniqueId, redirectTo);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create account.",
    } satisfies AuthActionData;
  }
}

export default function Register() {
  const actionData = useActionData<AuthActionData>();
  const [searchParams] = useSearchParams();
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"));

  return (
    <main className="auth-page">
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
          <span>Password</span>
          <input autoComplete="new-password" name="password" placeholder="At least 8 characters" required type="password" />
        </label>
        {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}
        <button type="submit">Create account</button>
        <p className="auth-switch">
          Already have an account? <Link to={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}>Sign in</Link>
        </p>
      </Form>
    </main>
  );
}
