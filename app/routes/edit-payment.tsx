import { Form, redirect, useNavigate } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useRef, type FormEvent } from "react";

import { getGroup, getMember, getPayment, updatePayment } from "../data/group-data";
import { requireUserId } from "../data/auth.server";
import type { Member, Payment, PaymentShare } from "../data/group-data";
import PaymentFormFields, { type PaymentFormFieldsHandle } from "../components/payment-form-fields";

import "./create-group.css";

export async function loader({ params, request }: LoaderFunctionArgs) {
  if (!params.uniqueId || !params.paymentId) {
    throw new Response("Not Found", { status: 404 });
  }

  const userId = await requireUserId(request);
  const paymentId = Number(params.paymentId);
  const group = await getGroup(userId, params.uniqueId);
  if (!group) {
    throw new Response("Not Found", { status: 404 });
  }

  const payment = await getPayment(userId, params.uniqueId, paymentId);
  return { group, payment, paymentId };
}

export async function action({ params, request }: ActionFunctionArgs) {
  if (!params.uniqueId || !params.paymentId) {
    throw new Response("Not Found", { status: 404 });
  }

  const userId = await requireUserId(request);
  const paymentId = Number(params.paymentId);
  const formData = await request.formData();
  const splitModeRaw = formData.get("splitMode");
  const splitMode = splitModeRaw === "shares" ? "shares" : "equal";

  const members: Member[] = [];
  const shareDetails: PaymentShare[] = [];
  const shareMemberIds = formData.getAll("shareMember");
  const uniqueShareMemberIds = Array.from(
    new Set(shareMemberIds.filter((item): item is string => typeof item === "string"))
  );

  for (const memberId of uniqueShareMemberIds) {
    const memberData = await getMember(userId, params.uniqueId, memberId);
    members.push(memberData);
    const shareUnitsRaw = formData.get(`shareUnits:${memberId}`);
    const shareUnits = Number(shareUnitsRaw ?? 1);
    shareDetails.push({
      member: memberData,
      shares:
        splitMode === "shares" && Number.isFinite(shareUnits) && shareUnits > 0
          ? Math.max(1, Math.round(shareUnits))
          : 1,
    });
  }

  const payerId = formData.get("payer");
  if (typeof payerId !== "string") {
    throw new Response("Bad Request", { status: 400 });
  }

  const payer = await getMember(userId, params.uniqueId, payerId);
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
    shareDetails,
    splitMode,
    createdAt,
  };

  await updatePayment(userId, params.uniqueId, paymentId, payment);
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
  const paymentFormRef = useRef<PaymentFormFieldsHandle>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!paymentFormRef.current?.validate()) {
      event.preventDefault();
    }
  };

  return (
    <Form method="post" className="group-form" onSubmit={handleSubmit}>
      <h2>Edit Payment</h2>
      <PaymentFormFields
        members={group.members ?? []}
        payment={payment}
        ref={paymentFormRef}
      />
      <p>
        <button type="submit">Save</button>
        <button onClick={() => navigate(-1)} type="button">
          Cancel
        </button>
      </p>
    </Form>
  );
}
