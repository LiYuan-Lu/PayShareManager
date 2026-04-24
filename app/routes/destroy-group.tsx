import { redirect } from "react-router";
import type { Route } from "./+types/destroy-group";

import { deleteGroup } from "../data/group-data";
import { requireUserId } from "../data/auth.server";

export default function DestroyGroupRoute() {
  return null;
}

export async function action({ params, request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  await deleteGroup(userId, params.uniqueId);
  return redirect("/");
}
