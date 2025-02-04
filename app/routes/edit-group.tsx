import { Form, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/edit-group";

import { getGroup, updateGroup } from "../data/group-data";

export async function action({
  params,
  request,
}: Route.ActionArgs) {
  const formData = await request.formData();
  const updates = Object.fromEntries(formData);
  await updateGroup(params.uniqueId, updates);
  return redirect(`/groups/${params.uniqueId}`);
}

export async function loader({ params }: Route.LoaderArgs) {
  const group = await getGroup(params.uniqueId);
  if (!group) {
    throw new Response("Not Found", { status: 404 });
  }
  return { group };
}

export default function EditGroup({
  loaderData,
}: Route.ComponentProps) {
  const { group } = loaderData;
  const navigate = useNavigate();

  return (
    <Form key={group.uniqueId} id="contact-form" method="post">
      <p>
        <span>Name</span>
        <input
          aria-label="Name"
          defaultValue={group.name}
          name="name"
          placeholder="Name"
          type="text"
        />
      </p>
      <label>
        <span>Desription</span>
        <input
          aria-label="Description"
          defaultValue={group.description}
          name="description"
          placeholder="Description"
          type="text"
        />
      </label>
      <input type="hidden" name="uniqueId" value={group.uniqueId}></input>
      <p>
        <button type="submit">Save</button>
        <button onClick={() => navigate(-1)} type="button">
            Cancel
        </button>
      </p>
    </Form>
  );
}