import { Form, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/create-group";
import { updateGroup, createEmptyGroup } from "../data/group-data";
import { useState} from "react";
import { getFriends } from "../data/friend-data";
import Select from 'react-select'
import type { Member } from "../data/group-data";

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

    let members = group.members ?? [];
    const membersString = updates.membersString as string;
    try {
      const parsedMembers = JSON.parse(membersString);
      const newMembers: Member[] = parsedMembers.map((item: any) => ({
        uniqueId: item.value,
        name: item.label,
      }));
      members = [...newMembers];
    } catch (error) {
      console.error("Error parsing members:", error);
    }

    if(!group.uniqueId)
    {
      return;
    }
    await updateGroup(group.uniqueId, updates, members);
    return redirect(`/groups/${group.uniqueId}`);
}

export async function loader({ params }: Route.LoaderArgs) {
  const friends = await getFriends();
  return { friends };
}

export default function CreateGroup({
  loaderData,
}: Route.ComponentProps) {
  const navigate = useNavigate();

  const [members, setMembers] = useState<any>([]);

  const [selectedFriend, setSelectedFriend] = useState(null);


  const handleFriendChange = (option: any) => {
    setSelectedFriend(option);
  };

  const handleAddMember = () => {
    if(!selectedFriend)
    {
      return;
    }
    
    if(members.includes(selectedFriend)){
      return;
    }
    setMembers([...members, selectedFriend]);
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
              <div>
                <Select 
                  options={loaderData.friends.map((friend: any) => ({value: friend.uniqueId, label: friend.name}))} 
                  onChange={handleFriendChange}
                />
              </div>
              <br/>
              <div className="group-member-item group-member-button" id="add-member-button" 
              onClick={handleAddMember}
              >Add member</div>
            </div>
            <input type="hidden" name="membersString" value={JSON.stringify(members)} />
            {
              members.map((member: any, index: number) => (
                <div className="group-member-container" key={index}>
                  <div className="group-member-item group-new-member">{member.label}</div>
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