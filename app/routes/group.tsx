import { Form } from "react-router";
import { useState, useRef, useEffect, type FormEvent, type JSX } from "react";

import { calculateGroupSettlement, getGroup} from "../data/group-data";
import type { Member } from "../data/group-data";
import type { Payment, PaymentList } from "../data/group-data";
import type { Route } from "./+types/group";

import Modal from "../components/modal";
import { createPortal } from "react-dom";
import Select from 'react-select'

import "./group.css";

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
}: { loaderData: { group: any } }) {
  const { group } = loaderData;
  type SelectOption = { label: string; value: string };
  type PaymentFormErrors = {
    cost?: string;
    payer?: string;
    shareMember?: string;
  };
  const defaultPaymentDate = new Date().toISOString().slice(0, 10);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPayer, setSelectedPayer] = useState<SelectOption | null>(null);
  const [selectedShareMembers, setSelectedShareMembers] = useState<SelectOption[]>([]);
  const [paymentFormErrors, setPaymentFormErrors] = useState<PaymentFormErrors>({});

  const [paymentList, setPaymentList] = useState<PaymentList>();
  const paymentNametRef = useRef<HTMLInputElement>(null);
  const paymentCostRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModalOpen(false);
  }, [group]);

  useEffect(() => {
    setPaymentList(group.paymentList);
  }, [group.paymentList])


  const handleButtonClick = (msg: String) => {
    setModalOpen(false);
    setSelectedPayer(null);
    setSelectedShareMembers([]);
    setPaymentFormErrors({});
  };

  const openModal = () => {
    setSelectedPayer(null);
    setSelectedShareMembers([]);
    setPaymentFormErrors({});
    setModalOpen(true);
  };

  const options: SelectOption[] = group.members.map((member: Member) => {
    return {label: member.name, value: member.uniqueId};
  });
  const settlement = calculateGroupSettlement(group);
  const formatPaymentDate = (dateStr?: string) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : "-";

  const validatePaymentForm = () => {
    const errors: PaymentFormErrors = {};
    const cost = Number(paymentCostRef.current?.value ?? "");

    if (!Number.isFinite(cost) || cost <= 0) {
      errors.cost = "Cost must be greater than 0.";
    }
    if (!selectedPayer) {
      errors.payer = "Please select who paid for this payment.";
    }
    if (selectedShareMembers.length === 0) {
      errors.shareMember = "Please select at least one shared member.";
    }

    setPaymentFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddPaymentSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!validatePaymentForm()) {
      event.preventDefault();
    }
  };

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


        <div className="group-edit">
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


        <Form action={`/groups/${group.uniqueId}/members`}>
          <button className="add-button member-button" type="submit">
            👥 Member : {Array.isArray(group.members) ? group.members.length : 0} people
          </button>
        </Form>
        <h2>Payment list</h2>
        <div>
          <button className="add-button bottom-space" onClick={openModal}>
            Add Payment
          </button>
          <div className="payment-container payment-intructions">
            <div>Date</div>
            <div>Name</div>
            <div>Cost</div>
            <div>Payer</div>
            <div>Shared by</div>
            <div>You Shoud Pay</div>
            <div>Action</div>
          </div>
          <div id="payment-list">
            {(() => {
              const divElements: JSX.Element[] = [];
              paymentList && paymentList.forEach((payment: Payment, id: number) => (
                divElements.push(
                <div className="payment-container" key={id}>
                  <div>{formatPaymentDate(payment.createdAt)}</div>
                  <div>{payment.name}</div>
                  <div>{payment.cost.toString()}</div>
                  <div>{payment.payer.name}</div>
                  <div>
                    {payment.shareMember.map((member: Member, memberIndex: number)=>(<div key={memberIndex}>{member.name}</div>))}
                  </div>
                  <div>
                    {payment.youShouldPay}
                  </div>
                  <div>
                    <Form action={`/groups/${group.uniqueId}/edit-payment/${id}`}>
                      <button type="submit">Edit</button>
                    </Form>
                    <Form action={`/groups/${group.uniqueId}/delete-payment/${id}`} method="post">
                      <button type="submit" className="delete-button">Delete</button>
                    </Form>
                  </div>
                </div>
                )
              ));
              return divElements;
            })()}
          </div>
          {modalOpen &&
          createPortal(
            <Modal
              closeModal={handleButtonClick}
              onSubmit={handleAddPaymentSubmit}
              onCancel={handleButtonClick}
              postTarget={`/groups/${group.uniqueId}/add-payment`}
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
                  type="text"
                  ref={paymentCostRef}
                />
              </p>
              {paymentFormErrors.cost ? (
                <p className="field-error">{paymentFormErrors.cost}</p>
              ) : null}
              <p>
                <span>Date</span>
                <input
                  aria-label="Date"
                  defaultValue={defaultPaymentDate}
                  name="createdAt"
                  type="date"
                />
              </p>
              <div>
                <p>Paid by</p>
                <Select 
                  name="payer"
                  options={options}
                  classNamePrefix="rs"
                  value={selectedPayer}
                  onChange={(option) => {
                    setSelectedPayer(option as SelectOption | null);
                    if (paymentFormErrors.payer) {
                      setPaymentFormErrors((prev) => ({ ...prev, payer: undefined }));
                    }
                  }}
                />
                {paymentFormErrors.payer ? (
                  <p className="field-error">{paymentFormErrors.payer}</p>
                ) : null}
                <p>Shared by</p>
                <Select
                  name="shareMember"
                  options={options} 
                  classNamePrefix="rs"
                  value={selectedShareMembers}
                  onChange={(selectedOptions) => {
                    setSelectedShareMembers((selectedOptions as SelectOption[]) ?? []);
                    if (paymentFormErrors.shareMember) {
                      setPaymentFormErrors((prev) => ({ ...prev, shareMember: undefined }));
                    }
                  }}
                  isMulti
                />
                {paymentFormErrors.shareMember ? (
                  <p className="field-error">{paymentFormErrors.shareMember}</p>
                ) : null}
              </div>
            </Modal>,
            document.body
          )}
        </div>
        <h2>Settlement Summary</h2>
        <div className="payment-container payment-intructions">
          <div>Member</div>
          <div>Paid</div>
          <div>Share</div>
          <div>Net</div>
        </div>
        <div>
          {settlement.memberSettlements.map((item) => (
            <div className="payment-container" key={item.member.uniqueId}>
              <div>{item.member.name}</div>
              <div>{item.paid.toFixed(2)}</div>
              <div>{item.share.toFixed(2)}</div>
              <div
                className={
                  item.net > 0
                    ? "settlement-net-positive"
                    : item.net < 0
                    ? "settlement-net-negative"
                    : "settlement-net-zero"
                }
              >
                {item.net.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <h2>Who Pays Whom</h2>
        <div className="transfer-list">
          {settlement.transfers.length ? (
            settlement.transfers.map((transfer, index) => (
              <div className="payment-container settlement-transfer-item" key={index}>
                <div>{transfer.from.name}</div>
                <div className="settlement-transfer-arrow">pays</div>
                <div>{transfer.to.name}</div>
                <div className="settlement-transfer-amount">{transfer.amount.toFixed(2)}</div>
              </div>
            ))
          ) : (
            <p className="settlement-empty">All settled.</p>
          )}
        </div>
      </div>
    </div>
  );
}
