import { Form, redirect, useActionData, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import type { Route } from "./+types/edit-group";

import {
  getGroup,
  getGroupPaymentMemberIds,
  updateGroup,
  type Member,
} from "../data/group-data";
import { getFriends } from "../data/friend-data";
import "./create-group.css";

type SelectOption = { label: string; value: string };
type EditGroupActionData = {
  memberError?: string;
};

function toMember(option: SelectOption): Member {
  return {
    uniqueId: option.value,
    name: option.label,
  };
}

function toOption(member: Member): SelectOption {
  return {
    value: member.uniqueId,
    label: member.name,
  };
}

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
    .map(toMember);
}

export async function action({
  params,
  request,
}: Route.ActionArgs) {
  if (!params.uniqueId) {
    throw new Response("Not Found", { status: 404 });
  }

  const group = await getGroup(params.uniqueId);
  if (!group) {
    throw new Response("Not Found", { status: 404 });
  }

  const formData = await request.formData();
  const nextMembers = parseMembers(formData.get("membersString"));
  const paymentMemberIds = getGroupPaymentMemberIds(group);
  const removedBlockedMembers = (group.members ?? []).filter(
    (member) =>
      paymentMemberIds.has(member.uniqueId) &&
      !nextMembers.some((nextMember) => nextMember.uniqueId === member.uniqueId)
  );

  if (removedBlockedMembers.length) {
    return {
      memberError: `${removedBlockedMembers
        .map((member) => member.name)
        .join(", ")} already participated in payments and cannot be removed.`,
    } satisfies EditGroupActionData;
  }

  await updateGroup(
    params.uniqueId,
    {
      name: formData.get("name")?.toString() ?? "",
      description: formData.get("description")?.toString() ?? "",
    },
    nextMembers
  );
  return redirect(`/groups/${params.uniqueId}`);
}

export async function loader({ params }: Route.LoaderArgs) {
  const group = await getGroup(params.uniqueId);
  if (!group) {
    throw new Response("Not Found", { status: 404 });
  }

  const friends = await getFriends();
  return {
    blockedMemberIds: Array.from(getGroupPaymentMemberIds(group)),
    friends,
    group,
  };
}

export default function EditGroup({
  loaderData,
}: Route.ComponentProps) {
  const { blockedMemberIds, friends, group } = loaderData;
  const actionData = useActionData<EditGroupActionData>();
  const navigate = useNavigate();
  const blockedMemberIdSet = useMemo(
    () => new Set(blockedMemberIds),
    [blockedMemberIds]
  );
  const [members, setMembers] = useState<SelectOption[]>(
    (group.members ?? []).map(toOption)
  );
  const [selectedFriend, setSelectedFriend] = useState<SelectOption | null>(null);
  const [memberError, setMemberError] = useState<string | null>(
    actionData?.memberError ?? null
  );

  useEffect(() => {
    setMemberError(actionData?.memberError ?? null);
  }, [actionData?.memberError]);
  const friendOptions = friends
    .map((friend) => ({ value: friend.uniqueId ?? "", label: friend.name }))
    .filter(
      (option) =>
        option.value &&
        !members.some((member) => member.value === option.value)
    );

  const handleAddMember = () => {
    if (!selectedFriend) {
      return;
    }

    if (members.some((member) => member.value === selectedFriend.value)) {
      return;
    }

    setMembers((prev) => [...prev, selectedFriend]);
    setSelectedFriend(null);
    setMemberError(null);
  };

  const handleDeleteMember = (memberToDelete: SelectOption) => {
    if (memberToDelete.value === "0") {
      setMemberError("You cannot remove yourself from a group.");
      return;
    }

    if (blockedMemberIdSet.has(memberToDelete.value)) {
      const message = `${memberToDelete.label} already participated in payments and cannot be removed.`;
      setMemberError(message);
      alert(message);
      return;
    }

    setMembers((prev) => prev.filter((member) => member.value !== memberToDelete.value));
    setMemberError(null);
  };

  return (
    <Form key={group.uniqueId} method="post" className="group-form">
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
      <p>
        <span>Description</span>
        <input
          aria-label="Description"
          defaultValue={group.description}
          name="description"
          placeholder="Description"
          type="text"
        />
      </p>
      <div id="group-member">
        <h2>Group members</h2>
        <div className="group-member-list-container">
          {members.map((member) => (
            <div className="group-member-container" key={member.value}>
              <div className="group-member-item group-new-member">{member.label}</div>
              <button
                className="group-member-item delete-group-member-button"
                onClick={() => handleDeleteMember(member)}
                type="button"
              >
                Delete
              </button>
            </div>
          ))}

          <div className="group-member-add">
            <div className="group-member-select">
              <Select
                options={friendOptions}
                classNamePrefix="rs"
                onChange={(option) => setSelectedFriend(option as SelectOption | null)}
                value={selectedFriend}
              />
            </div>
            <button
              className="group-member-item add-group-member-button"
              onClick={handleAddMember}
              type="button"
            >
              Add member
            </button>
          </div>
          {memberError ? <p className="field-error">{memberError}</p> : null}
          <input type="hidden" name="membersString" value={JSON.stringify(members)} />
        </div>
      </div>
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
