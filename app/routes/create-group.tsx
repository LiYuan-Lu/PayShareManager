import { Form, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/create-group";
import { updateGroup, createEmptyGroup } from "../data/group-data";
import { useState} from "react";
import { getFriends } from "../data/friend-data";
import { requireUserId } from "../data/auth.server";
import Select from 'react-select'
import type { MultiValue } from "react-select";
import type { Member } from "../data/group-data";

import "./create-group.css";

type SelectOption = { label: string; value: string };

function parseMembers(membersString: FormDataEntryValue | null) {
  if (typeof membersString !== "string") {
    return [];
  }

  let parsedMembers: unknown;
  try {
    parsedMembers = JSON.parse(membersString);
  } catch {
    return [];
  }
  if (!Array.isArray(parsedMembers)) {
    return [];
  }

  return parsedMembers
    .filter(
      (item): item is SelectOption =>
        item &&
        typeof item.value === "string" &&
        typeof item.label === "string"
    )
    .map((item) => ({
      uniqueId: item.value,
      name: item.label,
    }));
}

export async function action({
  params,
  request,
}: Route.ActionArgs) {
    const userId = await requireUserId(request);
    const formData = await request.formData();

    const name = formData.get('name');
    if(!name)
    {
        return;
    }
    const group = await createEmptyGroup(userId);
    const selectedMembers = parseMembers(formData.get("membersString"));
    const existingMembers = group.members ?? [];
    const selectedMemberIds = new Set(selectedMembers.map((member) => member.uniqueId));
    const members: Member[] = [
      ...existingMembers.filter((member) => !selectedMemberIds.has(member.uniqueId)),
      ...selectedMembers,
    ];

    if(!group.uniqueId)
    {
      return;
    }
    await updateGroup(
      userId,
      group.uniqueId,
      {
        name: formData.get("name")?.toString() ?? "",
        description: formData.get("description")?.toString() ?? "",
      },
      members
    );
    return redirect(`/groups/${group.uniqueId}`);
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const friends = await getFriends(userId);
  return { friends };
}

export default function CreateGroup({
  loaderData,
}: Route.ComponentProps) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<SelectOption[]>([]);
  const friendOptions = loaderData.friends
    .map((friend) => ({ value: friend.uniqueId ?? "", label: friend.name }))
    .filter((option) => option.value && option.label);

  const handleMembersChange = (nextValue: MultiValue<SelectOption>) => {
    setMembers(Array.from(nextValue));
  };

    return (
    <Form className="group-form product-form" method="post">
      <div className="form-header">
        <p className="form-eyebrow">Group setup</p>
        <h1>Create group</h1>
      </div>

      <section className="form-section">
        <div className="form-section-copy">
          <h2>Details</h2>
          <p>Name the shared space and add a short note if it helps.</p>
        </div>
        <div className="form-fields">
          <label className="form-field">
            <span>Name</span>
            <input
              aria-label="Name"
              name="name"
              placeholder="Trip to Tokyo"
              required
              type="text"
            />
          </label>
          <label className="form-field">
            <span>Description</span>
            <input
              aria-label="Description"
              name="description"
              placeholder="Optional description"
              type="text"
            />
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-copy">
          <h2>Members</h2>
          <p>You are included automatically. Select friends to add them now.</p>
        </div>
        <div className="form-fields">
          <div className="member-included">
            <span>You</span>
            <small>Included</small>
          </div>
          <Select<SelectOption, true>
            className="group-member-select"
            classNamePrefix="rs"
            closeMenuOnSelect={false}
            isClearable={false}
            isMulti
            onChange={handleMembersChange}
            options={friendOptions}
            placeholder="Select friends"
            value={members}
          />
          <input type="hidden" name="membersString" value={JSON.stringify(members)} />
        </div>
      </section>

      <div className="form-actions">
        <button type="submit">Create group</button>
        <button onClick={() => navigate(-1)} type="button">
          Cancel
        </button>
      </div>
    </Form>
  );
}
