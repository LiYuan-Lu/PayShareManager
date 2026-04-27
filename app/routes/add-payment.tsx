import { redirect } from "react-router";
import { addPayment, getMember } from "../data/group-data";
import { requireUserId } from "../data/auth.server";
import { normalizeCurrency } from "../data/currencies";
import type { Payment, Member, PaymentShare } from "../data/group-data";
import type { Route } from "./+types/add-payment";

export default function AddPaymentRoute() {
  return null;
}

export async function action({ params, request }: Route.ActionArgs) {
  if(!params.uniqueId)
  {
    return;
  }

  const userId = await requireUserId(request);
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

  const payerId = formData.get("payer") as string;
  const payer = await getMember(userId, params.uniqueId, payerId);
  const createdAtRaw = formData.get("createdAt");
  const createdAt =
    typeof createdAtRaw === "string" && createdAtRaw
      ? new Date(`${createdAtRaw}T00:00:00`).toISOString()
      : new Date().toISOString();

  const payment: Payment = {
    name: formData.get("name") as string,
    payer: payer,
    cost: Number(formData.get("cost")),
    currency: normalizeCurrency(formData.get("currency")),
    shareMember: members,
    shareDetails,
    splitMode,
    createdAt,
  };


  await addPayment(userId, params.uniqueId, payment);

  return redirect(`/groups/${params.uniqueId}`);
}
