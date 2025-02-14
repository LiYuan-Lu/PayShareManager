import { redirect } from "react-router";
import { getGroup, updatePaymentList } from "../data/group-data";
import type { Payment } from "../data/group-data";
import type { Route } from "./+types/contact";

export async function action({ params, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const payment: Payment = {
    name: formData.get("name") as string,
    payer: formData.get("payer") as string,
    cost: Number(formData.get("cost")),
    shareMember: formData.getAll("shareMember") as string[],
  };

  if(!params.uniqueId)
  {
    return;
  }

  const group = await getGroup(params.uniqueId);
  if (!group) {
    throw new Response("Not Found", { status: 404 });
  }

  const updatedPaymentList = [...(group.paymentList || []), payment];

  console.log("updatedPaymentList", updatedPaymentList);
  await updatePaymentList(params.uniqueId, updatedPaymentList);

  return redirect(`/groups/${params.uniqueId}`);
}