import { logout } from "../data/auth.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}

export default function Logout() {
  return null;
}
