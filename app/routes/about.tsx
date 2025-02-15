import { Link } from "react-router";

export default function About() {
  return (
    <div id="about">
      <Link to="/">← Go to home</Link>
      <h1>About Pay Share Manager</h1>

      <div>
        <p>
        This is a web application designed to record who paid what amount and to calculate how to evenly split the bill.
        </p>
        <h2>Features</h2>
        <li><span>Payment Records: </span>Add, edit, and delete payment entries with payer names and amounts inside event.</li>
        <li><span>Payment Records: </span>Add, edit, and delete payment entries with payer names and amounts inside event.</li>
        <li><span>Payment Records: </span>Even Split Calculation: Automatically computes the average amount each person should contribute.</li>
        <li><span>React Router: </span>Implements multi-page routing with React Router.</li>
        <li><span>Intuitive Interface: </span>A clean and user-friendly design.</li>
      </div>
    </div>
  );
}