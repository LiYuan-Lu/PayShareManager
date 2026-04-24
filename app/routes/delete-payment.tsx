import { redirect } from "react-router";
import { deletePayment } from "../data/group-data";
import { requireUserId } from "../data/auth.server";
import type { Route } from "./+types/delete-payment";

export default function DeletePaymentRoute() {
  return null;
}

export async function action({ params, request }: Route.ActionArgs) {
  if(!params.uniqueId || !params.paymentId)
  {
    return;
  }

  const userId = await requireUserId(request);
  const paymentId = Number(params.paymentId);

  await deletePayment(userId, params.uniqueId, paymentId);

  return redirect(`/groups/${params.uniqueId}`);
}
