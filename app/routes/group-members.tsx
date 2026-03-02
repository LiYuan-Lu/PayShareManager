import { Form } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { getGroup } from "../data/group-data";
import type { Member } from "../data/group-data";

import "./create-group.css";

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.uniqueId) {
    throw new Response("Not Found", { status: 404 });
  }

  const group = await getGroup(params.uniqueId);
  if (!group) {
    throw new Response("Not Found", { status: 404 });
  }

  return { group };
}

export default function GroupMembers({
  loaderData,
}: {
  loaderData: {
    group: { uniqueId: string; name?: string; members?: Member[] };
  };
}) {
  const { group } = loaderData;
  const members = Array.isArray(group.members) ? group.members : [];

  return (
    <div className="group-form">
      <h2>Members ({members.length})</h2>
      {members.length ? (
        <div className="group-member-list-container">
          {members.map((member) => (
            <div className="group-member-container" key={member.uniqueId}>
              <div className="group-member-item group-new-member">{member.name}</div>
            </div>
          ))}
        </div>
      ) : (
        <p>No members.</p>
      )}
      <p>
        <Form action={`/groups/${group.uniqueId}`}>
          <button type="submit">Back to Group</button>
        </Form>
      </p>
    </div>
  );
}
