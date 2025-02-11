import { Form } from "react-router";
import { useState } from "react";

import { getGroup } from "../data/group-data";
import type { Route } from "./+types/contact";

import Modal from "../components/modal";
import { createPortal } from "react-dom";
import Select from 'react-select'

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

  const options = group.members.map((member: string) => {
    return {label: member, value: member};
  });

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
          Add Payment
        </button>
        {modalOpen &&
        createPortal(
          <Modal
            closeModal={handleButtonClick}
            onSubmit={handleButtonClick}
            onCancel={handleButtonClick}
          >
            <h1>Payment</h1>
            <br/>
            <p>
              <span>Name</span>
              <input
                aria-label="Name"
                defaultValue="Name"
                name="name"
                placeholder="Name"
                type="text"
              />
            </p>
            <p>
              <span>Cost</span>
              <input
                aria-label="Cost"
                defaultValue={0}
                name="cost"
                placeholder="Cos"
                type="number"
              />
            </p>
            <div>
              <p>Paid by</p>
              <Select 
                options={options} 
              />
              <p>Shared by</p>
              <Select 
                options={options} 
                isMulti
              />
            </div>
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