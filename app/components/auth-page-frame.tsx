import type { ReactNode } from "react";

type AuthPageFrameProps = {
  children: ReactNode;
};

export function AuthPageFrame({ children }: AuthPageFrameProps) {
  return (
    <main className="auth-page">
      <section className="auth-shell" aria-label="Pay Share Manager authentication">
        <aside className="auth-showcase" aria-hidden="true">
          <div className="auth-showcase-brand">
            <img alt="" className="auth-showcase-icon" src="/icons/app.svg" />
            <div>
              <p>Pay Share Manager</p>
              <span>Settle together cleanly</span>
            </div>
          </div>
          <div className="auth-preview">
            <div className="auth-preview-header">
              <span>Group trip</span>
              <strong>$2,500</strong>
            </div>
            <div className="auth-preview-row">
              <span>Paid by You</span>
              <strong>$1,200</strong>
            </div>
            <div className="auth-preview-row">
              <span>Friend 1 owes</span>
              <strong>$650</strong>
            </div>
            <div className="auth-preview-row">
              <span>Friend 2 owes</span>
              <strong>$650</strong>
            </div>
          </div>
        </aside>
        <div className="auth-panel">{children}</div>
      </section>
    </main>
  );
}
