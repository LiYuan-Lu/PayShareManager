import { Form } from "react-router";
import { useState, useRef, useEffect, type FormEvent } from "react";

import { getGroup, settleGroup } from "../data/group-data";
import { requireUserId } from "../data/auth.server";
import {
  calculateGroupSettlement,
  type Member,
  type Payment,
  type PaymentList,
} from "../data/settlement";
import type { Route } from "./+types/group";

import Modal from "../components/modal";
import PaymentFormFields, { type PaymentFormFieldsHandle } from "../components/payment-form-fields";
import { createPortal } from "react-dom";

import "./group.css";

export async function loader({ params, request }: Route.LoaderArgs) {
  if(!params.uniqueId)
  {
    return;
  }
  const userId = await requireUserId(request);
  const group = await getGroup(userId, params.uniqueId);
  if (!group) {
    throw new Response("Not Found", { status: 404 });
  }
  return { group };
}

export async function action({ params, request }: Route.ActionArgs) {
  if (!params.uniqueId) {
    throw new Response("Not Found", { status: 404 });
  }

  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  if (intent === "settle") {
    await settleGroup(userId, params.uniqueId);
  }

  return null;
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


  const handleModalClose = () => {
    setModalOpen(false);
  };

  const openModal = () => {
    setModalOpen(true);
  };

  const settlement = calculateGroupSettlement(group);
  const payments = Array.from(paymentList?.entries() ?? []);
  const memberCount = Array.isArray(group.members) ? group.members.length : 0;
  const totalPaid = payments.reduce(
    (sum, [, payment]) => sum + Number(payment.cost ?? 0),
    0
  );
  const formatAmount = (amount: number) => amount.toFixed(2);
  const settledDate = group.settledAt
    ? new Date(group.settledAt).toLocaleDateString()
    : null;
  const formatPaymentDate = (dateStr?: string) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : "-";
  const viewerMemberId = group.viewerMemberId ?? "0";
  const getViewerShareAmount = (payment: Payment) => {
    const shareDetails =
      payment.splitMode === "shares" && payment.shareDetails?.length
        ? payment.shareDetails
        : payment.shareMember.map((member) => ({ member, shares: 1 }));
    const totalShares = shareDetails.reduce((sum, item) => sum + item.shares, 0);
    if (totalShares <= 0) {
      return 0;
    }
    const viewerShare = shareDetails.find((item) => item.member.uniqueId === viewerMemberId);
    if (!viewerShare) {
      return 0;
    }
    return payment.cost * (viewerShare.shares / totalShares);
  };
  const getPaymentSummary = (payment: Payment) => {
    const isYouPayer = payment.payer.uniqueId === viewerMemberId;
    const isYouShared =
      (payment.shareDetails ?? []).some((item) => item.member.uniqueId === viewerMemberId) ||
      payment.shareMember.some((member) => member.uniqueId === viewerMemberId);

    if (!isYouPayer && !isYouShared) {
      return "not involved";
    }

    const viewerShareAmount = getViewerShareAmount(payment);
    const youShouldPay = isYouPayer
      ? -(Number(payment.cost ?? 0) - viewerShareAmount)
      : viewerShareAmount;
    if (youShouldPay > 0) {
      return `you borrowed ${youShouldPay.toFixed(2)}`;
    }
    if (youShouldPay < 0) {
      return `you lent ${Math.abs(youShouldPay).toFixed(2)}`;
    }
    return "not involved";
  };
  const getSummaryToneClass = (payment: Payment) => {
    const viewerShareAmount = getViewerShareAmount(payment);
    const youShouldPay =
      payment.payer.uniqueId === viewerMemberId
        ? -(Number(payment.cost ?? 0) - viewerShareAmount)
        : viewerShareAmount;
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
      <div className="group-shell">
        <section className="group-hero">
          <div className="group-hero-main">
            <p className="group-eyebrow">Group</p>
            <h1>{group.name ? group.name : <i>No Name</i>}</h1>
            {group.description ? (
              <p className="group-description">{group.description}</p>
            ) : (
              <p className="group-description muted">No description</p>
            )}
            {settledDate ? (
              <div className="group-status-badge">
                Settled on {settledDate}
              </div>
            ) : null}
          </div>

          <div className="group-hero-actions">
            {!group.settledAt ? (
              <Form
                method="post"
                onSubmit={(event) => {
                  const response = confirm(
                    "Mark this group as settled? Future friend balances will ignore this group's payments."
                  );
                  if (!response) {
                    event.preventDefault();
                  }
                }}
              >
                <button className="settle-button" name="intent" type="submit" value="settle">
                  Settle
                </button>
              </Form>
            ) : null}
            <Form action="edit">
              <button className="secondary-button" type="submit">Edit</button>
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
              <button className="danger-button" type="submit">Delete</button>
            </Form>
          </div>
        </section>

        <section className="group-overview">
          <div className="metric-card">
            <span>Members</span>
            <strong>{memberCount}</strong>
          </div>
          <div className="metric-card">
            <span>Payments</span>
            <strong>{payments.length}</strong>
          </div>
          <div className="metric-card">
            <span>Total paid</span>
            <strong>{formatAmount(totalPaid)}</strong>
          </div>
        </section>

        <section className="group-section members-section">
          <div className="section-heading">
            <div>
              <h2>Members</h2>
              <p>{memberCount ? "Hover to scan everyone in this group." : "No members yet."}</p>
            </div>
            <div className="member-summary">
              <button
                aria-describedby={`members-${group.uniqueId}`}
                className="secondary-button member-button"
                type="button"
              >
                View members
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
          </div>
        </section>

        <section className="group-section">
          <div className="section-heading">
            <div>
              <h2>Payments</h2>
              <p>{payments.length ? "Recent expenses in this group." : "Start by adding the first payment."}</p>
            </div>
            <button className="add-button" onClick={openModal} type="button">
              Add payment
            </button>
          </div>
          <div id="payment-list">
            {payments.length ? (
              payments.map(([id, payment]: [number, Payment]) => (
                <div className="payment-item" key={id}>
                  <div className="payment-content">
                    <div className="payment-meta">
                      <span className="payment-date">{formatPaymentDate(payment.createdAt)}</span>
                      <span className="payment-name">{payment.name}</span>
                    </div>
                    <div className="payment-detail">
                      <span>{payment.payer.name}</span>
                      <span>paid {formatAmount(payment.cost)}</span>
                    </div>
                  </div>
                  <div className={`payment-summary ${getSummaryToneClass(payment)}`}>
                    {getPaymentSummary(payment)}
                  </div>
                  <div className="payment-actions">
                    <Form action={`/groups/${group.uniqueId}/edit-payment/${id}`}>
                      <button className="secondary-button compact-button" type="submit">Edit</button>
                    </Form>
                    <Form action={`/groups/${group.uniqueId}/delete-payment/${id}`} method="post">
                      <button type="submit" className="danger-button compact-button">Delete</button>
                    </Form>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No payments yet.</div>
            )}
          </div>
          {modalOpen &&
          createPortal(
            <Modal
              closeModal={handleModalClose}
              onSubmit={handleAddPaymentSubmit}
              onCancel={handleModalClose}
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
        </section>

        <section className="group-section settlement-section">
          <div className="section-heading">
            <div>
              <h2>Settlement</h2>
              <p>Balances are calculated from every saved payment.</p>
            </div>
          </div>
          <div className="settlement-grid">
            <div className="settlement-card">
              <div className="settlement-table settlement-table-header">
                <div>Member</div>
                <div>Paid</div>
                <div>Share</div>
                <div>Net</div>
              </div>
              {settlement.memberSettlements.map((item) => (
                <div className="settlement-table" key={item.member.uniqueId}>
                  <div>{item.member.name}</div>
                  <div>{formatAmount(item.paid)}</div>
                  <div>{formatAmount(item.share)}</div>
                  <div
                    className={
                      item.net > 0
                        ? "settlement-net-positive"
                        : item.net < 0
                        ? "settlement-net-negative"
                        : "settlement-net-zero"
                    }
                  >
                    {formatAmount(item.net)}
                  </div>
                </div>
              ))}
            </div>

            <div className="settlement-card transfer-list">
              <h3>Who pays whom</h3>
              {settlement.transfers.length ? (
                settlement.transfers.map((transfer, index) => (
                  <div className="settlement-transfer-item" key={index}>
                    <div>
                      <strong>{transfer.from.name}</strong>
                      <span>pays {transfer.to.name}</span>
                    </div>
                    <strong className="settlement-transfer-amount">
                      {formatAmount(transfer.amount)}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="settlement-empty">All settled.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
