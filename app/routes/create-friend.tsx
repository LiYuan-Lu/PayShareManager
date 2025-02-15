import { Form, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/create-friend";
import { updateFriend, createEmptyFriend } from "../data/friend-data";

import "./create-group.css";

export async function action({
  params,
  request,
}: Route.ActionArgs) {
    const formData = await request.formData();

    const name = formData.get('name');
    if(!name)
    {
        return;
    }
    const friend = await createEmptyFriend();
    if(!friend.uniqueId)
    {
      return;
    }

    const updates = {
      name: formData.get('name')?.toString() || '',
      email: formData.get('email')?.toString() || '',
    };
    await updateFriend(friend.uniqueId, updates);
    return redirect(`/friends/${friend.uniqueId}`);
}

export default function CreateFriend({
}: Route.ComponentProps) {
    const navigate = useNavigate();
    return (
    <Form id="friend-form" className="group-form" method="post">
        <p>
        <span>Name</span>
        <input
            aria-label="Name"
            name="name"
            placeholder="Name"
            type="text"
            required
        />
        </p>
        <p>
            <span>Email</span>
            <input
            aria-label="Email"
            name="email"
            placeholder="Email"
            type="email"
            required
            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
            />
        </p>
        <div id="last-element">

        </div>
        <p>
        <button type="submit">Save</button>
        <button onClick={() => navigate(-1)} type="button">
            Cancel
        </button>
        </p>
    </Form>
  );
}