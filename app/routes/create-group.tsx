import { Form, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/create-group";
import { updateGroup, createEmptyGroup } from "../data/group-data";
import { useRef } from "react";


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
    const group = await createEmptyGroup();
    const updates = Object.fromEntries(formData);
    await updateGroup(group.uniqueId, updates);
    return redirect(`/groups/${group.uniqueId}`);
}

export default function EditContact({
  loaderData,
}: Route.ComponentProps) {
  const navigate = useNavigate();

  let groupMember = [];

  const addGroupMember = () => {
    groupMember.push({
      name: "",
      email: ""
    });
  };

  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddMember = () => {
    if (inputRef.current) {
      console.log('Current Input Value:', inputRef.current.value);
    }
  }

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
      <div id="group-member">
        <label>
          <span>Group member</span>
          <div className="group-member-list-container">
            <div className="group-member-container">
              <div className="group-member-item">You</div>
              <div className="group-member-item">test@test.com</div>
            </div>
            <div className="group-member-container">
              <input 
                id="add-member-name"
                className="group-member-item"
                aria-label="Name"
                defaultValue=""
                name="member-name"
                placeholder="Name"
                type="text"
                ref={inputRef}
              />
              <input 
                className="group-member-item"
                aria-label="Email"
                defaultValue=""
                name="member-email"
                placeholder="Email"
                readOnly
              />
              <div className="group-member-item" id="add-member-button" onClick={handleAddMember}>Add member</div>
            </div>
          </div>
        </label>
      </div>
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