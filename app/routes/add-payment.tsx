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

  let members = Array<Member>();
  formData.getAll("shareMember").forEach(async (member) => {
    if (typeof member === "string") {
      const memberData = await getMember(params.uniqueId?? "", member);
      memberData? members.push(memberData): null;
    }
  });

  const payerId = formData.get("payer") as string;
  const payer = await getMember(params.uniqueId, payerId);
  const payment: Payment = {
    name: formData.get("name") as string,
    payer: payer,
    cost: Number(formData.get("cost")),
    shareMember: members,
    createdAt : new Date().toISOString(),
  };


  await addPayment(params.uniqueId, payment);

  return redirect(`/groups/${params.uniqueId}`);
}