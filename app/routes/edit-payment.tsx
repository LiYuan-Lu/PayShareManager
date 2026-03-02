import { Form, redirect, useNavigate } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import Select from "react-select";
import { useState, type FormEvent } from "react";

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
  const createdAtRaw = formData.get("createdAt");
  const createdAt =
    typeof createdAtRaw === "string" && createdAtRaw
      ? new Date(`${createdAtRaw}T00:00:00`).toISOString()
      : undefined;

  const payment: Payment = {
    name: formData.get("name")?.toString() ?? "",
    payer,
    cost: Number(formData.get("cost")),
    shareMember: members,
    createdAt,
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
  const defaultPayer =
    memberOptions.find((option) => option.value === payment.payer.uniqueId) ?? null;
  const defaultShareMembers = payment.shareMember
    .map((member) => memberOptions.find((option) => option.value === member.uniqueId))
    .filter((option): option is { label: string; value: string } => option !== undefined);
  const [selectedPayer, setSelectedPayer] = useState<{ label: string; value: string } | null>(
    defaultPayer
  );
  const [selectedShareMembers, setSelectedShareMembers] = useState<
    { label: string; value: string }[]
  >(defaultShareMembers);
  const [formErrors, setFormErrors] = useState<{
    cost?: string;
    payer?: string;
    shareMember?: string;
  }>({});
  const paymentDate = payment.createdAt
    ? new Date(payment.createdAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const errors: { cost?: string; payer?: string; shareMember?: string } = {};
    const form = event.currentTarget;
    const costField = form.elements.namedItem("cost");
    const costValue =
      costField instanceof HTMLInputElement ? Number(costField.value) : Number.NaN;

    if (!Number.isFinite(costValue) || costValue <= 0) {
      errors.cost = "Cost must be greater than 0.";
    }
    if (!selectedPayer) {
      errors.payer = "Please select who paid for this payment.";
    }
    if (selectedShareMembers.length === 0) {
      errors.shareMember = "Please select at least one shared member.";
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      event.preventDefault();
    }
  };

  return (
    <Form method="post" className="group-form" onSubmit={handleSubmit}>
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
      {formErrors.cost ? (
        <p className="field-error">{formErrors.cost}</p>
      ) : null}
      <p>
        <span>Date</span>
        <input
          aria-label="Date"
          defaultValue={paymentDate}
          name="createdAt"
          type="date"
          required
        />
      </p>
      <p>
        <span>Payer</span>
        <Select
          name="payer"
          options={memberOptions}
          classNamePrefix="rs"
          value={selectedPayer}
          onChange={(option) => {
            setSelectedPayer(option as { label: string; value: string } | null);
            if (formErrors.payer) {
              setFormErrors((prev) => ({ ...prev, payer: undefined }));
            }
          }}
        />
      </p>
      {formErrors.payer ? (
        <p className="field-error">{formErrors.payer}</p>
      ) : null}
      <p>
        <span>Shared By</span>
        <Select
          name="shareMember"
          options={memberOptions}
          classNamePrefix="rs"
          value={selectedShareMembers}
          onChange={(selectedOptions) => {
            setSelectedShareMembers((selectedOptions as { label: string; value: string }[]) ?? []);
            if (formErrors.shareMember) {
              setFormErrors((prev) => ({ ...prev, shareMember: undefined }));
            }
          }}
          isMulti
        />
      </p>
      {formErrors.shareMember ? (
        <p className="field-error">{formErrors.shareMember}</p>
      ) : null}
      <p>
        <button type="submit">Save</button>
        <button onClick={() => navigate(-1)} type="button">
          Cancel
        </button>
      </p>
    </Form>
  );
}
