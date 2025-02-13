import { Form, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/create-group";
import { updateGroup, createEmptyGroup } from "../data/group-data";
import { useRef, useState, type JSXElementConstructor, type ReactElement, type ReactNode, type ReactPortal } from "react";

import "./create-group.css";
import { getContact } from "../data";
import type { GroupBase } from "react-select";

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

    let members = group.members ?? [];

    if (updates.membersString) {
      try {
        JSON.parse(updates.membersString as string).map((member: string) => members.push(member));
      } catch (error) {
        console.error('Error parsing members:', error);
      }
    }

    if(!group.uniqueId)
    {
      return;
    }
    await updateGroup(group.uniqueId, updates, members);
    return redirect(`/groups/${group.uniqueId}`);
}

export default function CreateGroup({
  loaderData,
}: Route.ComponentProps) {
  const navigate = useNavigate();

  // let groupMember: { first: string | undefined; last: string | undefined; }[] = [];
  const [members, setMembers] = useState<any>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddMember = () => {
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

  const handleDelete = (indexToDelete: number) => {
    setMembers(members.filter((_: any, index: number) => index !== indexToDelete));
  };

    return (
    <Form id="contact-form" method="post">
      <p>
        <span>Name</span>
        <input
          aria-label="Name"
          defaultValue="New Group"
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
                placeholder="Name"
                type="text"
                ref={inputRef}
              />
              <div className="group-member-item group-member-button" id="add-member-button" 
              onClick={handleAddMember}
              >Add member</div>
            </div>
            <input type="hidden" name="membersString" value={JSON.stringify(members)} />
            {
              members.map((member: string, index: number) => (
                <div className="group-member-container" key={index}>
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