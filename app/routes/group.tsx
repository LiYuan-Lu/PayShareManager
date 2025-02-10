import { Form } from "react-router";
import { useState } from "react";

import { getGroup } from "../data/group-data";
import type { Route } from "./+types/contact";

import Modal from "../components/modal";
import { createPortal } from "react-dom";

export async function loader({ params }: Route.LoaderArgs) {
  if(!params.uniqueId)
  {
    return;
  }
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

  const [modalOpen, setModalOpen] = useState(false);

  const handleButtonClick = (msg: String) => setModalOpen(false);
  const openModal = () => setModalOpen(true);

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

        <h2>Members</h2>
        {
          Array.isArray(group.members) ? group.members.map((member: string, index: number) => (
            <div className="group-member-container" key={index}>
              <div className="group-member-item group-new-member">{member}</div>
            </div>
        )) : null}
        <h2>Payment list</h2>
        <div>
        <button className="btn btn-open" onClick={openModal}>
          Open
        </button>
        {modalOpen &&
        createPortal(
          <Modal
            closeModal={handleButtonClick}
            onSubmit={handleButtonClick}
            onCancel={handleButtonClick}
          >
            <h1>This is a modal</h1>
            <br />
            <p>This is the modal description</p>
          </Modal>,
          document.body
        )}
        </div>
        

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
      <div id="payment-list">

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