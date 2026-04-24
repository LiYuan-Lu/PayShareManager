import { Link } from "react-router";

import { getFriends } from "../data/friend-data";
import { getGroups, type GroupRecord } from "../data/group-data";
import type { Payment } from "../data/settlement";
import type { Route } from "./+types/home";

export async function loader() {
  const [groups, friends] = await Promise.all([getGroups(), getFriends()]);
  return { groups, friends };
}

function getPayments(group: GroupRecord) {
  return Array.from(group.paymentList?.values() ?? []);
}

function getGroupTotal(payments: Payment[]) {
  return payments.reduce((sum, payment) => sum + Number(payment.cost ?? 0), 0);
}

function formatAmount(amount: number) {
  return amount.toFixed(2);
}

export default function Home({
  loaderData,
}: Route.ComponentProps) {
  const { groups, friends } = loaderData;
  const groupSummaries = groups.map((group) => {
    const payments = getPayments(group);
    return {
      group,
      memberCount: group.members?.length ?? 0,
      paymentCount: payments.length,
      totalPaid: getGroupTotal(payments),
    };
  });
  const totalPayments = groupSummaries.reduce(
    (sum, summary) => sum + summary.paymentCount,
    0
  );
  const totalPaid = groupSummaries.reduce(
    (sum, summary) => sum + summary.totalPaid,
    0
  );

  return (
    <div id="index-page" className="home-dashboard">
      <section className="home-hero">
        <div>
          <p className="home-eyebrow">Dashboard</p>
          <h1>Overview</h1>
          <p>
            Track your groups, friends, and shared payments from one place.
          </p>
        </div>
        <img alt="" className="home-icon" src="/icons/app.svg" />
      </section>

      <section className="home-stats" aria-label="Summary">
        <div className="home-stat-card">
          <span>Groups</span>
          <strong>{groups.length}</strong>
        </div>
        <div className="home-stat-card">
          <span>Friends</span>
          <strong>{friends.length}</strong>
        </div>
        <div className="home-stat-card">
          <span>Payments</span>
          <strong>{totalPayments}</strong>
        </div>
        <div className="home-stat-card">
          <span>Total paid</span>
          <strong>{formatAmount(totalPaid)}</strong>
        </div>
      </section>

      <section className="home-actions" aria-label="Quick actions">
        <Link className="home-action-primary" to="/create-group">
          New Group
        </Link>
        <Link className="home-action-secondary" to="/friends/create">
          New Friend
        </Link>
      </section>

      <section className="home-section">
        <div className="home-section-header">
          <div>
            <h2>Groups</h2>
            <p>
              {groupSummaries.length
                ? "Open a group to add payments or review settlement."
                : "Create your first group to start tracking shared costs."}
            </p>
          </div>
        </div>

        {groupSummaries.length ? (
          <div className="home-group-list">
            {groupSummaries.map(({ group, memberCount, paymentCount, totalPaid }) => (
              <Link
                className="home-group-card"
                key={group.uniqueId}
                to={`/groups/${group.uniqueId}`}
              >
                <div>
                  <strong>{group.name || "No Name"}</strong>
                  <span>{group.description || "No description"}</span>
                </div>
                <div className="home-group-meta">
                  <span>{memberCount} members</span>
                  <span>{paymentCount} payments</span>
                  <span>{formatAmount(totalPaid)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="home-empty-state">
            <strong>No groups yet</strong>
            <p>Create a group, add friends, and record your first shared payment.</p>
          </div>
        )}
      </section>
    </div>
  );
}
