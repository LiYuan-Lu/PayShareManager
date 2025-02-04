import type { RouteConfig } from "@react-router/dev/routes";

import { 
    index, 
    layout,
    route 
} from "@react-router/dev/routes";

export default [
    layout("layouts/sidebar.tsx", [
    index("routes/home.tsx"),
    route(
        "contacts/:contactId", 
        "routes/contact.tsx"
    ),
    route(
        "contacts/:contactId/edit",
        "routes/edit-contact.tsx"
    ),
    route(
        "contacts/:contactId/destroy",
        "routes/destroy-contact.tsx"
    ),
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
        "groups/:uniqueId/destroy", 
        "routes/destroy-group.tsx"
    ),
  ]),
    route("about", "routes/about.tsx"),
] satisfies RouteConfig;
