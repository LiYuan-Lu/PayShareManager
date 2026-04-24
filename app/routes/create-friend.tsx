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
    <Form id="friend-form" className="group-form product-form" method="post">
      <div className="form-header">
        <p className="form-eyebrow">Friend setup</p>
        <h1>Create friend</h1>
      </div>

      <section className="form-section">
        <div className="form-section-copy">
          <h2>Profile</h2>
          <p>Add a local friend by name. Account invitations can come later.</p>
        </div>
        <div className="form-fields">
          <label className="form-field">
            <span>Name</span>
            <input
              aria-label="Name"
              name="name"
              placeholder="Friend name"
              required
              type="text"
            />
          </label>
        </div>
      </section>

      <div className="form-actions">
        <button type="submit">Create friend</button>
        <button onClick={() => navigate(-1)} type="button">
          Cancel
        </button>
      </div>
    </Form>
  );
}
