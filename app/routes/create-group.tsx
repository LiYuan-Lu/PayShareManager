import { Form, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/create-group";

import { updateGroup, createEmptyGroup } from "../data/group-data";

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
    const group = await createEmptyGroup();
    const updates = Object.fromEntries(formData);
    await updateGroup(group.uniqueId, updates);
    return redirect(`/groups/${group.uniqueId}`);
}

export default function EditContact({
  loaderData,
}: Route.ComponentProps) {
  const navigate = useNavigate();

    return (
    <Form id="contact-form" method="post">
      <p>
        <span>Name</span>
        <input
          aria-label="Name"
          defaultValue=""
          name="name"
          placeholder="Name"
          type="text"
        />
      </p>
      <label>
        <span>Desription</span>
        <input
          aria-label="Description"
          defaultValue=""
          name="description"
          placeholder="Description"
          type="text"
        />
      </label>
      <p>
        <button type="submit">Save</button>
        <button onClick={() => navigate(-1)} type="button">
            Cancel
        </button>
      </p>
    </Form>
  );
}