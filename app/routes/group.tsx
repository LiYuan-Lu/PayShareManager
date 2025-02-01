import { Form, useFetcher } from "react-router";

import type { GroupRecord } from "../data";

import { getGroup, updateContact } from "../data";
import type { Route } from "./+types/contact";

// TODO: Update group function
// export async function action({
//   params,
//   request,
// }: Route.ActionArgs) {
//   const formData = await request.formData();
//   return updateContact(params.contactId, {
//     favorite: formData.get("favorite") === "true",
//   });
// }

export async function loader({ params }: Route.LoaderArgs) {
  const group = await getGroup(params.uniqueId);
  if (!group) {
    throw new Response("Not Found", { status: 404 });
  }
  return { group };
}

export default function Group({
  loaderData,
}: Route.ComponentProps) {
  const { group } = loaderData;

  return (
    <div id="group">
      <div>
        <h1>
          {group.name ? (
            <>
              {group.name}
            </>
          ) : (
            <i>No Name</i>
          )}
          {/* <Favorite group={group} /> */}
        </h1>
        {group.description ? <p>{group.description}</p> : null}

        <div>
          <Form action="edit">
            <button type="submit">Edit</button>
          </Form>

          <Form
            action="destroy"
            method="post"
            onSubmit={(event) => {
              const response = confirm(
                "Please confirm you want to delete this record."
              );
              if (!response) {
                event.preventDefault();
              }
            }}
          >
            <button type="submit">Delete</button>
          </Form>
        </div>
      </div>
    </div>
  );
}

// function Favorite({
//   contact,
// }: {
//   contact: Pick<GroupRecord, "favorite">;
// }) {
//   const fetcher = useFetcher();
//   const favorite = fetcher.formData
//     ? fetcher.formData.get("favorite") === "true"
//     : contact.favorite;

//   return (
//     <fetcher.Form method="post">
//       <button
//         aria-label={
//           favorite
//             ? "Remove from favorites"
//             : "Add to favorites"
//         }
//         name="favorite"
//         value={favorite ? "false" : "true"}
//       >
//         {favorite ? "★" : "☆"}
//       </button>
//     </fetcher.Form>
//   );
// }