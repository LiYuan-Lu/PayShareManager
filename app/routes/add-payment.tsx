import { redirect } from "react-router";
import { addPayment, getMember } from "../data/group-data";
import type { Payment, Member } from "../data/group-data";
import type { Route } from "./+types/contact";

export async function action({ params, request }: Route.ActionArgs) {
  if(!params.uniqueId)
  {
    return;
  }

  const formData = await request.formData();

  const members: Member[] = [];
  const shareMemberIds = formData.getAll("shareMember");
  for (const member of shareMemberIds) {
    if (typeof member === "string") {
      const memberData = await getMember(params.uniqueId, member);
      members.push(memberData);
    }
  }

  const payerId = formData.get("payer") as string;
  const payer = await getMember(params.uniqueId, payerId);
  const createdAtRaw = formData.get("createdAt");
  const createdAt =
    typeof createdAtRaw === "string" && createdAtRaw
      ? new Date(`${createdAtRaw}T00:00:00`).toISOString()
      : new Date().toISOString();

  const payment: Payment = {
    name: formData.get("name") as string,
    payer: payer,
    cost: Number(formData.get("cost")),
    shareMember: members,
    createdAt,
  };


  await addPayment(params.uniqueId, payment);

  return redirect(`/groups/${params.uniqueId}`);
}
