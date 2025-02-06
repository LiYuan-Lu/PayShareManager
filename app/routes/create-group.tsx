import { Form, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/create-group";
import { updateGroup, createEmptyGroup } from "../data/group-data";
import { useRef, useState, type JSXElementConstructor, type ReactElement, type ReactNode, type ReactPortal } from "react";

import "./create-group.css";
import { getContact } from "../data";

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

  // let groupMember: { first: string | undefined; last: string | undefined; }[] = [];
  const [members, setMembers] = useState<any>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  async function addGroupMember() {
    if(!inputRef.current)
    {
      return;
    }
    const member = await getContact(inputRef.current.value.toString());
    
  };

  const handleAddMember = () => {
    if (inputRef.current) {
      console.log('Current Input Value:', inputRef.current.value);
    }
  }

  const handleDelete = (indexToDelete: number) => {
    setMembers(members.filter((_: any, index: number) => index !== indexToDelete));
  };

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
              <div className="group-member-item group-member-button" id="add-member-button" onClick=
              {() => { 
                const new_member_name = inputRef.current?.value.toString();
                if(!new_member_name)
                {
                  return;
                }
                if(members.includes(new_member_name)){
                  return;
                }
                setMembers([...members, inputRef.current?.value.toString()]);
              }
              }>Add member</div>
            </div>
            {
              members.map((member: string, index: number) => (
                <div className="group-member-container">
                  <div className="group-member-item group-new-member">{member}</div>
                  <div
                  id="delete-member" 
                  className="group-memeber-item delete-group-member-button"
                  onClick={ ()=>handleDelete(index) }
                  >Delete</div>
                </div>
            ))}
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