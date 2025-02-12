import { Form } from "react-router";
import { useState, useRef } from "react";

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

type PayerOption = {label: String, value: String}
type ShareMemberOption = {label: String, value: String};
type Payment = {name: String, payer: String, cost: Number, shareMember: Array<String>}

export default function Group({
  loaderData,
}: Route.ComponentProps) {
  const { group } = loaderData;

  const [modalOpen, setModalOpen] = useState(false);

  const [shareMember, setShareMember] = useState<string[]>([]);
  const [payer, setPayer] = useState('');
  const [paymentList, setPaymentList] = useState<Payment[]>([]);
  const paymentNametRef = useRef<HTMLInputElement>(null);
  const paymentCostRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = (msg: String) => setModalOpen(false);
  const handleModalSubmit = (msg: String) => {
    const payment: Payment = {
      name: paymentNametRef.current?.value ?? "", 
      payer: payer,
      cost: Number(paymentCostRef.current?.value),
      shareMember: shareMember
    };

    setPaymentList(paymentList.concat(payment));
    
    setModalOpen(false);
  }

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
          <div>
            {
              paymentList.map((payment: Payment) => (
                <div>
                  <div>{payment.name}</div>
                  <div>{payment.cost.toString()}</div>
                  <div>{payment.payer}</div>
                  <div>
                    {payment.shareMember.map((member: String)=>(<div>{member}</div>))}
                  </div>
                </div>
              ))
            }
          </div>
          <button className="btn btn-open" onClick={openModal}>
            Add Payment
          </button>
          {modalOpen &&
          createPortal(
            <Modal
              closeModal={handleButtonClick}
              onSubmit={handleModalSubmit}
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
                  ref={paymentNametRef}
                />
              </p>
              <p>
                <span>Cost</span>
                <input
                  aria-label="Cost"
                  defaultValue={0}
                  name="cost"
                  placeholder="Cost"
                  type="number"
                  ref={paymentCostRef}
                />
              </p>
              <div>
                <p>Paid by</p>
                <Select 
                  options={options} 
                  onChange={(option: PayerOption | null) => setPayer(option?.value?? "" )}
                />
                <p>Shared by</p>
                <Select 
                  options={options} 
                  onChange={(options: readonly ShareMemberOption[]) => setShareMember(options.map(option => option.value))}
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