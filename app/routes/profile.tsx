import { Form, useActionData, useNavigation } from "react-router";

import { requireUser, updateCurrentUserProfile } from "../data/auth.server";
import type { Route } from "./+types/profile";

type ProfileActionData = {
  error?: string;
  success?: string;
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  try {
    await updateCurrentUserProfile(user.uniqueId, {
      name: formData.get("name")?.toString() ?? "",
    });
    return { success: "Profile updated." } satisfies ProfileActionData;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to update profile.",
    } satisfies ProfileActionData;
  }
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const actionData = useActionData<ProfileActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="profile-shell">
      <section className="admin-hero">
        <p className="home-eyebrow">Account</p>
        <h1>Profile</h1>
        <p>Update the name shown in the sidebar, groups, and shared payments.</p>
      </section>

      <Form className="admin-card profile-card" method="post">
        <label className="auth-field">
          <span>Name</span>
          <input
            autoComplete="name"
            defaultValue={user.name}
            maxLength={80}
            name="name"
            placeholder="Your display name"
            required
            type="text"
          />
        </label>
        <label className="auth-field">
          <span>Email</span>
          <input disabled value={user.email} type="email" />
        </label>
        <label className="auth-field">
          <span>Role</span>
          <input disabled value={user.role} type="text" />
        </label>
        {actionData?.error ? <div className="auth-alert">{actionData.error}</div> : null}
        {actionData?.success ? <div className="admin-result">{actionData.success}</div> : null}
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Save profile"}
        </button>
      </Form>
    </div>
  );
}
