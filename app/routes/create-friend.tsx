import { Form, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/create-friend";
import { createFriend } from "../data/friend-data";

import "./create-group.css";

export async function action({
  params,
  request,
}: Route.ActionArgs) {
    const formData = await request.formData();

    const values = {
      name: formData.get('name')?.toString() || '',
      email: "",
    };
    if (!values.name.trim()) {
      return null;
    }

    const friend = await createFriend(values);
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
