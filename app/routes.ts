import type { RouteConfig } from "@react-router/dev/routes";

import { 
    index, 
    layout,
    route 
} from "@react-router/dev/routes";

export default [
    route("login", "routes/login.tsx"),
    route("register", "routes/register.tsx"),
    route("reset-password", "routes/reset-password.tsx"),
    route("logout", "routes/logout.tsx"),
    layout("layouts/sidebar.tsx", [
    index("routes/home.tsx"),
    route(
        "groups/:uniqueId", 
        "routes/group.tsx"
    ),
    route(
        "create-group",
        "routes/create-group.tsx"
    ),
    route(
        "groups/:uniqueId/edit", 
        "routes/edit-group.tsx"
    ),
    route(
        "groups/:uniqueId/members",
        "routes/group-members.tsx"
    ),
    route(
        "groups/:uniqueId/destroy", 
        "routes/destroy-group.tsx"
    ),
    route(
        "groups/:uniqueId/add-payment", 
        "routes/add-payment.tsx"
    ),
    route(
        "groups/:uniqueId/delete-payment/:paymentId", 
        "routes/delete-payment.tsx"
    ),
    route(
        "groups/:uniqueId/edit-payment/:paymentId",
        "routes/edit-payment.tsx"
    ),
    route(
        "friends/create",
        "routes/create-friend.tsx"
    ),
    route(
        "friends/invites",
        "routes/friend-invites.tsx"
    ),
    route(
        "friends/:uniqueId", 
        "routes/friend.tsx"
    ),
    route(
        "about",
        "routes/about.tsx"
    ),
    route(
        "admin",
        "routes/admin.tsx"
    ),
  ]),
] satisfies RouteConfig;
