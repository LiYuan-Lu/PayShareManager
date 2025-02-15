import { redirect } from "react-router";
import { addPayment } from "../data/group-data";
import type { Payment } from "../data/group-data";
import type { Route } from "./+types/contact";

export async function action({ params, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const payment: Payment = {
    name: formData.get("name") as string,
    payer: formData.get("payer") as string,
    cost: Number(formData.get("cost")),
    shareMember: formData.getAll("shareMember") as string[],
    createdAt : new Date().toISOString(),
  };

  if(!params.uniqueId)
  {
    return;
  }
  await addPayment(params.uniqueId, payment);

  return redirect(`/groups/${params.uniqueId}`);
}