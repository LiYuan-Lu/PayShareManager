import { redirect } from "react-router";
import { deletePayment } from "../data/group-data";
import type { Route } from "./+types/contact";

export async function action({ params, request }: Route.ActionArgs) {
  if(!params.uniqueId || !params.paymentId)
  {
    return;
  }

  const paymentId = Number(params.paymentId);

  deletePayment(params.uniqueId, paymentId);

  return redirect(`/groups/${params.uniqueId}`);
}