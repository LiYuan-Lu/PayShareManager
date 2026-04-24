import { Form, redirect, useActionData, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import type { MultiValue } from "react-select";
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
  const [memberError, setMemberError] = useState<string | null>(
    actionData?.memberError ?? null
  );

  useEffect(() => {
    setMemberError(actionData?.memberError ?? null);
  }, [actionData?.memberError]);

  const memberOptions = useMemo(() => {
    const optionsById = new Map<string, SelectOption>();
    (group.members ?? []).map(toOption).forEach((option) => {
      optionsById.set(option.value, option);
    });
    friends
      .map((friend) => ({ value: friend.uniqueId ?? "", label: friend.name }))
      .filter((option) => option.value && option.label)
      .forEach((option) => {
        optionsById.set(option.value, option);
      });
    return Array.from(optionsById.values());
  }, [friends, group.members]);

  const handleMembersChange = (nextValue: MultiValue<SelectOption>) => {
    const nextMembers = Array.from(nextValue);
    const removedMembers = members.filter(
      (member) => !nextMembers.some((nextMember) => nextMember.value === member.value)
    );
    const removedSelf = removedMembers.find((member) => member.value === "0");
    if (removedSelf) {
      setMemberError("You cannot remove yourself from a group.");
      return;
    }

    const removedBlockedMember = removedMembers.find((member) =>
      blockedMemberIdSet.has(member.value)
    );
    if (removedBlockedMember) {
      const message = `${removedBlockedMember.label} already participated in payments and cannot be removed.`;
      setMemberError(message);
      alert(message);
      return;
    }

    setMembers(nextMembers);
    setMemberError(null);
  };

  return (
    <Form key={group.uniqueId} method="post" className="group-form product-form">
      <div className="form-header">
        <p className="form-eyebrow">Group settings</p>
        <h1>Edit group</h1>
      </div>

      <section className="form-section">
        <div className="form-section-copy">
          <h2>Details</h2>
          <p>Update the group name and description shown to members.</p>
        </div>
        <div className="form-fields">
          <label className="form-field">
            <span>Name</span>
            <input
              aria-label="Name"
              defaultValue={group.name}
              name="name"
              placeholder="Group name"
              required
              type="text"
            />
          </label>
          <label className="form-field">
            <span>Description</span>
            <input
              aria-label="Description"
              defaultValue={group.description}
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
          <p>Add or remove friends. Members used in payments stay locked.</p>
        </div>
        <div className="form-fields">
          <Select<SelectOption, true>
            className="group-member-select"
            classNamePrefix="rs"
            closeMenuOnSelect={false}
            isClearable={false}
            isMulti
            onChange={handleMembersChange}
            options={memberOptions}
            placeholder="Select friends"
            value={members}
          />
          {memberError ? <p className="field-error">{memberError}</p> : null}
          <input type="hidden" name="membersString" value={JSON.stringify(members)} />
        </div>
      </section>
      <input type="hidden" name="uniqueId" value={group.uniqueId}></input>
      <div className="form-actions">
        <button type="submit">Save</button>
        <button onClick={() => navigate(-1)} type="button">
          Cancel
        </button>
      </div>
    </Form>
  );
}
