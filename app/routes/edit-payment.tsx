import { Form, redirect, useNavigate } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import Select from "react-select";
import { useState, type FormEvent } from "react";

import { getGroup, getMember, getPayment, updatePayment } from "../data/group-data";
import type { Member, Payment, PaymentShare } from "../data/group-data";

import "./create-group.css";

type SelectOption = { label: string; value: string };

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
  const splitModeRaw = formData.get("splitMode");
  const splitMode = splitModeRaw === "shares" ? "shares" : "equal";

  const members: Member[] = [];
  const shareDetails: PaymentShare[] = [];
  const shareMemberIds = formData.getAll("shareMember");
  const uniqueShareMemberIds = Array.from(
    new Set(shareMemberIds.filter((item): item is string => typeof item === "string"))
  );

  for (const memberId of uniqueShareMemberIds) {
    const memberData = await getMember(params.uniqueId, memberId);
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
    shareDetails,
    splitMode,
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
    .filter((option): option is SelectOption => option !== undefined);

  const [selectedPayer, setSelectedPayer] = useState<SelectOption | null>(defaultPayer);
  const [selectedShareMembers, setSelectedShareMembers] = useState<SelectOption[]>(
    defaultShareMembers
  );
  const [splitMode, setSplitMode] = useState<"equal" | "shares">(
    payment.splitMode === "shares" ? "shares" : "equal"
  );
  const [shareUnitsMap, setShareUnitsMap] = useState<Record<string, number>>(() => {
    const mapped: Record<string, number> = {};
    if (payment.shareDetails?.length) {
      payment.shareDetails.forEach((item) => {
        mapped[item.member.uniqueId] = item.shares;
      });
    } else {
      payment.shareMember.forEach((member) => {
        mapped[member.uniqueId] = 1;
      });
    }
    return mapped;
  });
  const [formErrors, setFormErrors] = useState<{
    cost?: string;
    payer?: string;
    shareMember?: string;
    shareUnits?: string;
  }>({});
  const [paymentCostValue, setPaymentCostValue] = useState<number>(Number(payment.cost) || 0);
  const paymentDate = payment.createdAt
    ? new Date(payment.createdAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const getShareEstimate = (memberId: string) => {
    const totalCost = Number(paymentCostValue ?? 0);
    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      return 0;
    }
    const totalShares = selectedShareMembers.reduce(
      (sum, member) => sum + Math.max(1, Number(shareUnitsMap[member.value] ?? 1)),
      0
    );
    if (totalShares <= 0) {
      return 0;
    }
    const memberShares = Math.max(1, Number(shareUnitsMap[memberId] ?? 1));
    return (totalCost * memberShares) / totalShares;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const errors: { cost?: string; payer?: string; shareMember?: string; shareUnits?: string } = {};
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
    if (
      splitMode === "shares" &&
      selectedShareMembers.some((member) => {
        const units = Number(shareUnitsMap[member.value] ?? 0);
        return !Number.isFinite(units) || units <= 0 || !Number.isInteger(units);
      })
    ) {
      errors.shareUnits = "Each shared member must have integer shares greater than 0.";
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
          onChange={(event) => setPaymentCostValue(Number(event.target.value))}
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
            setSelectedPayer(option as SelectOption | null);
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
        <span>Split Mode</span>
        <select
          name="splitMode"
          onChange={(event) => setSplitMode(event.target.value === "shares" ? "shares" : "equal")}
          value={splitMode}
        >
          <option value="equal">Equal</option>
          <option value="shares">By Shares</option>
        </select>
      </p>
      <p>
        <span>Shared By</span>
        <Select
          options={memberOptions}
          classNamePrefix="rs"
          value={selectedShareMembers}
          onChange={(selectedOptions) => {
            const nextSelected = (selectedOptions as SelectOption[]) ?? [];
            setSelectedShareMembers(nextSelected);
            setShareUnitsMap((prev) => {
              const nextMap: Record<string, number> = {};
              nextSelected.forEach((item) => {
                nextMap[item.value] = prev[item.value] ?? 1;
              });
              return nextMap;
            });
            if (formErrors.shareMember) {
              setFormErrors((prev) => ({ ...prev, shareMember: undefined }));
            }
            if (formErrors.shareUnits) {
              setFormErrors((prev) => ({ ...prev, shareUnits: undefined }));
            }
          }}
          isMulti
        />
      </p>
      {formErrors.shareMember ? (
        <p className="field-error">{formErrors.shareMember}</p>
      ) : null}
      {splitMode === "shares" && selectedShareMembers.length ? (
        <div className="share-units-list">
          {selectedShareMembers.map((member) => (
            <p key={member.value}>
              <span>{member.label} shares</span>
              <div className="share-stepper">
                <button
                  className="share-stepper-btn"
                  onClick={() => {
                    setShareUnitsMap((prev) => ({
                      ...prev,
                      [member.value]: Math.max(1, (prev[member.value] ?? 1) - 1),
                    }));
                  }}
                  type="button"
                >
                  -
                </button>
                <input
                  className="share-stepper-value"
                  name={`shareUnits:${member.value}`}
                  readOnly
                  type="number"
                  value={shareUnitsMap[member.value] ?? 1}
                />
                <button
                  className="share-stepper-btn"
                  onClick={() => {
                    setShareUnitsMap((prev) => ({
                      ...prev,
                      [member.value]: (prev[member.value] ?? 1) + 1,
                    }));
                    if (formErrors.shareUnits) {
                      setFormErrors((prev) => ({ ...prev, shareUnits: undefined }));
                    }
                  }}
                  type="button"
                >
                  +
                </button>
              </div>
              <span className="share-estimate">
                ${getShareEstimate(member.value).toFixed(2)}
              </span>
            </p>
          ))}
        </div>
      ) : null}
      {selectedShareMembers.map((member) => (
        <input key={member.value} name="shareMember" type="hidden" value={member.value} />
      ))}
      {formErrors.shareUnits ? (
        <p className="field-error">{formErrors.shareUnits}</p>
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
