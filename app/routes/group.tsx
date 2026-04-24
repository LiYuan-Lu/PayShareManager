import { Form } from "react-router";
import { useState, useRef, useEffect, type FormEvent, type JSX } from "react";

import { calculateGroupSettlement, getGroup} from "../data/group-data";
import type { Member, Payment, PaymentList } from "../data/group-data";
import type { Route } from "./+types/group";

import Modal from "../components/modal";
import PaymentFormFields, { type PaymentFormFieldsHandle } from "../components/payment-form-fields";
import { createPortal } from "react-dom";

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
  const defaultPaymentDate = new Date().toISOString().slice(0, 10);

  const [modalOpen, setModalOpen] = useState(false);

  const [paymentList, setPaymentList] = useState<PaymentList>();
  const paymentFormRef = useRef<PaymentFormFieldsHandle>(null);

  useEffect(() => {
    setModalOpen(false);
  }, [group]);

  useEffect(() => {
    setPaymentList(group.paymentList);
  }, [group.paymentList])


  const handleButtonClick = (msg: String) => {
    setModalOpen(false);
  };

  const openModal = () => {
    setModalOpen(true);
  };

  const settlement = calculateGroupSettlement(group);
  const formatPaymentDate = (dateStr?: string) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : "-";
  const kUserId = "0";
  const getPaymentSummary = (payment: Payment) => {
    const isYouPayer = payment.payer.uniqueId === kUserId;
    const isYouShared =
      (payment.shareDetails ?? []).some((item) => item.member.uniqueId === kUserId) ||
      payment.shareMember.some((member) => member.uniqueId === kUserId);

    if (!isYouPayer && !isYouShared) {
      return "not involved";
    }

    const youShouldPay = Number(payment.youShouldPay ?? 0);
    if (youShouldPay > 0) {
      return `you borrowed ${youShouldPay.toFixed(2)}`;
    }
    if (youShouldPay < 0) {
      return `you lent ${Math.abs(youShouldPay).toFixed(2)}`;
    }
    return "not involved";
  };
  const getSummaryToneClass = (payment: Payment) => {
    const youShouldPay = Number(payment.youShouldPay ?? 0);
    if (youShouldPay > 0) {
      return "payment-summary-borrowed";
    }
    if (youShouldPay < 0) {
      return "payment-summary-lent";
    }
    return "payment-summary-neutral";
  };

  const handleAddPaymentSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!paymentFormRef.current?.validate()) {
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


        <div className="member-summary">
          <button
            aria-describedby={`members-${group.uniqueId}`}
            className="add-button member-button"
            type="button"
          >
            Members: {Array.isArray(group.members) ? group.members.length : 0}
          </button>
          <div className="member-popover" id={`members-${group.uniqueId}`} role="tooltip">
            <h3>Members</h3>
            {Array.isArray(group.members) && group.members.length ? (
              <ul>
                {group.members.map((member: Member) => (
                  <li key={member.uniqueId}>{member.name}</li>
                ))}
              </ul>
            ) : (
              <p>No members.</p>
            )}
          </div>
        </div>
        <h2>Payments</h2>
        <div>
          <button className="add-button bottom-space" onClick={openModal}>
            Add Payment
          </button>
          <div id="payment-list">
            {(() => {
              const divElements: JSX.Element[] = [];
              paymentList && paymentList.forEach((payment: Payment, id: number) => (
                divElements.push(
                <div className="payment-item" key={id}>
                  <div className="payment-content">
                    <div className="payment-meta">
                      <span className="payment-date">{formatPaymentDate(payment.createdAt)}</span>
                      <span className="payment-name">{payment.name}</span>
                    </div>
                    <div className="payment-detail">{payment.payer.name} paid {payment.cost.toFixed(2)}</div>
                    <div className={`payment-summary ${getSummaryToneClass(payment)}`}>
                      {getPaymentSummary(payment)}
                    </div>
                  </div>
                  <div className="payment-actions">
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
              <PaymentFormFields
                defaultDate={defaultPaymentDate}
                members={group.members ?? []}
                ref={paymentFormRef}
              />
            </Modal>,
            document.body
          )}
        </div>
        <h2>Settlement Summary</h2>
        <div className="payment-container payment-instructions">
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
