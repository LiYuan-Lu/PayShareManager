import { Form } from "react-router";

import type { FriendMutation } from "../data/friend-data";

import { getFriend, updateFriend } from "../data/friend-data";
import type { Route } from "./+types/friend";

export async function action({
  params,
  request,
}: Route.ActionArgs) {
    if(!params.uniqueId) {
        throw new Response("Not Found", { status: 404 });
    }
    const formData = await request.formData();
    const updates: FriendMutation = {
        name: formData.get("name")?.toString() ?? "",
        email: formData.get("email")?.toString() ?? ""
    };
    return updateFriend(params.uniqueId, updates);
}

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.uniqueId) {
    throw new Response("Not Found", { status: 404 });
  }
  const friend = await getFriend(params.uniqueId);
  if (!friend) {
    throw new Response("Not Found", { status: 404 });
  }
  return { friend };
}

export default function Friend({
  loaderData,
}: Route.ComponentProps) {
  const { friend } = loaderData;

  return (
    <div id="friend">
      <div>
        <h1>
          {friend.name ? (
            <>
              {friend.name}
            </>
          ) : (
            <i>No Name</i>
          )}
        </h1>

        {friend.email ? (
          <p>
            <a
              href={`mailto:${friend.email}`}
            >
              {friend.email}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}