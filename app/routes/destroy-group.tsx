import { redirect } from "react-router";
import type { Route } from "./+types/destroy-group";

import { deleteGroup } from "../data/group-data";

export async function action({ params }: Route.ActionArgs) {
  await deleteGroup(params.uniqueId);
  return redirect("/");
}