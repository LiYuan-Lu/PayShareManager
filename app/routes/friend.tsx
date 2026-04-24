import { Form, redirect, useActionData } from "react-router";

import type { FriendMutation } from "../data/friend-data";

import { deleteFriend, getFriend, getFriendUsage, updateFriend } from "../data/friend-data";
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
    const formData = await request.formData();
    const intent = formData.get("intent")?.toString();

    if (intent === "delete") {
      try {
        await deleteFriend(params.uniqueId);
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
    await updateFriend(params.uniqueId, updates);
    return redirect(`/friends/${params.uniqueId}`);
}

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.uniqueId) {
    throw new Response("Not Found", { status: 404 });
  }
  const friend = await getFriend(params.uniqueId);
  if (!friend) {
    throw new Response("Not Found", { status: 404 });
  }
  const usage = await getFriendUsage(params.uniqueId);
  return { friend, usage };
}

export default function Friend({
  loaderData,
}: Route.ComponentProps) {
  const { friend, usage } = loaderData;
  const actionData = useActionData<FriendActionData>();
  const isDeleteDisabled = usage.groupCount > 0 || usage.paymentCount > 0;

  return (
    <div id="friend">
      <div className="friend-header">
        <h1>
          {friend.name ? (
            <>
              {friend.name}
            </>
          ) : (
            <i>No Name</i>
          )}
        </h1>

      </div>

      <Form key={friend.uniqueId} method="post" className="friend-form">
        <label>
          <span>Name</span>
          <input
            aria-label="Name"
            defaultValue={friend.name}
            name="name"
            placeholder="Name"
            required
            type="text"
          />
        </label>

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

      {isDeleteDisabled ? (
        <p className="friend-usage-note">
          This friend is used in {usage.groupCount} group
          {usage.groupCount === 1 ? "" : "s"} and {usage.paymentCount} payment
          {usage.paymentCount === 1 ? "" : "s"}, so they cannot be deleted.
        </p>
      ) : null}
      {actionData?.error ? <p className="field-error">{actionData.error}</p> : null}
    </div>
  );
}
