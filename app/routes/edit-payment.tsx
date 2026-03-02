import { Form, redirect, useNavigate } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import Select from "react-select";

import { getGroup, getMember, getPayment, updatePayment } from "../data/group-data";
import type { Member, Payment } from "../data/group-data";

import "./create-group.css";

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.uniqueId || !params.paymentId) {
    throw new Response("Not Found", { status: 404 });
  }

  const paymentId = Number(params.paymentId);
  const group = await getGroup(params.uniqueId);
  if (!group) {
    throw new Response("Not Found", { status: 404 });
  }

  const payment = await getPayment(params.uniqueId, paymentId);
  return { group, payment, paymentId };
}

export async function action({ params, request }: ActionFunctionArgs) {
  if (!params.uniqueId || !params.paymentId) {
    throw new Response("Not Found", { status: 404 });
  }

  const paymentId = Number(params.paymentId);
  const formData = await request.formData();

  const members: Member[] = [];
  const shareMemberIds = formData.getAll("shareMember");
  for (const member of shareMemberIds) {
    if (typeof member === "string") {
      const memberData = await getMember(params.uniqueId, member);
      members.push(memberData);
    }
  }

  const payerId = formData.get("payer");
  if (typeof payerId !== "string") {
    throw new Response("Bad Request", { status: 400 });
  }

  const payer = await getMember(params.uniqueId, payerId);
  const payment: Payment = {
    name: formData.get("name")?.toString() ?? "",
    payer,
    cost: Number(formData.get("cost")),
    shareMember: members,
    createdAt: new Date().toISOString(),
  };

  await updatePayment(params.uniqueId, paymentId, payment);
  return redirect(`/groups/${params.uniqueId}`);
}

export default function EditPayment({
  loaderData,
}: {
  loaderData: {
    group: { uniqueId: string; members?: Member[] };
    payment: Payment;
    paymentId: number;
  };
}) {
  const { group, payment } = loaderData;
  const navigate = useNavigate();

  const memberOptions = (Array.isArray(group.members) ? group.members : []).map((member) => ({
    label: member.name,
    value: member.uniqueId,
  }));
  const selectedPayer =
    memberOptions.find((option) => option.value === payment.payer.uniqueId) ?? null;
  const selectedShareMembers = payment.shareMember
    .map((member) => memberOptions.find((option) => option.value === member.uniqueId))
    .filter((option): option is { label: string; value: string } => option !== undefined);

  return (
    <Form method="post" className="group-form">
      <h2>Edit Payment</h2>
      <p>
        <span>Name</span>
        <input
          aria-label="Name"
          defaultValue={payment.name}
          name="name"
          placeholder="Name"
          type="text"
          required
        />
      </p>
      <p>
        <span>Cost</span>
        <input
          aria-label="Cost"
          defaultValue={payment.cost}
          min={0}
          name="cost"
          placeholder="Cost"
          step="0.01"
          type="number"
          required
        />
      </p>
      <p>
        <span>Payer</span>
        <Select
          name="payer"
          options={memberOptions}
          defaultValue={selectedPayer}
        />
      </p>
      <p>
        <span>Shared By</span>
        <Select
          name="shareMember"
          options={memberOptions}
          defaultValue={selectedShareMembers}
          isMulti
        />
      </p>
      <p>
        <button type="submit">Save</button>
        <button onClick={() => navigate(-1)} type="button">
          Cancel
        </button>
      </p>
    </Form>
  );
}
