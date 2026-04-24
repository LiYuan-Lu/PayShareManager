export default function About() {
  return (
    <div id="about">
      <div className="about-header">
        <img alt="" className="about-icon" src="/icons/app.svg" />
        <div>
          <p className="about-eyebrow">About</p>
          <h1>Pay Share Manager</h1>
        </div>
      </div>

      <div>
        <p>
          This is a web application designed to record who paid what amount and calculate how to split shared expenses.
        </p>
        <h2>Features</h2>
        <ul className="about-feature-list">
          <li><span>Payment records</span>Add, edit, and delete payment entries inside a group.</li>
          <li><span>Split modes</span>Split expenses equally or by custom shares.</li>
          <li><span>Settlement summary</span>Calculate who should pay whom after all expenses are recorded.</li>
          <li><span>Local storage</span>Persist app data with SQLite for local development and deployment.</li>
        </ul>
      </div>
    </div>
  );
}
