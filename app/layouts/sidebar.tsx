import {
  Form,
  Link,
  NavLink,
  Outlet,
  useNavigation,
  useSubmit,
} from "react-router";

import { getContacts, getGroups } from "../data";
import type { Route } from "./+types/sidebar";
import { useEffect } from "react";

export async function loader({
  request,
}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const contacts = await getContacts(q);
  const groups = await getGroups();
  return { contacts, q, groups };
}

export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
    const { contacts, q, groups } = loaderData;
    const navigation = useNavigation();
    const submit = useSubmit();
    const searching =
    navigation.location &&
    new URLSearchParams(navigation.location.search).has(
      "q"
    );

    useEffect(() => {
        const searchField = document.getElementById("q");
        if (searchField instanceof HTMLInputElement) {
            searchField.value = q || "";
        }
    }, [q]);

  return (
    <>
      <div id="sidebar">
        <h1>
          <Link to="about">React Router Contacts</Link>
        </h1>
        <div>
          <Form id="search-form" 
          onChange={(event) => {
            const isFirstSearch = q === null;
            submit(event.currentTarget, {
                replace: !isFirstSearch,
            });
            }}
          role="search">
            <input
              aria-label="Search contacts"
              className={searching ? "loading" : ""}
              defaultValue={q || ""}
              id="q"
              name="q"
              placeholder="Search"
              type="search"
            />
            <div
              aria-hidden
              hidden={!searching}
              id="search-spinner"
            />
          </Form>
          <Form method="post">
            <button type="submit">New</button>
          </Form>
        </div>
        <nav>
          <div>
            <h1>Groups</h1>
          </div>
          {
          groups.length ? (
            <ul>
              {groups.map((group) => (
                <li key={group.uniqueId}>
                  <NavLink
                    to={`groups/${group.uniqueId}`}
                  >
                    {group.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              <i> No groups</i>
            </p>
          )}
          <div>
            <h1>Contacts</h1>
          </div>
          {contacts.length ? (
            <ul>
              {contacts.map((contact) => (
                <li key={contact.id}>
                    <NavLink
                        className={({ isActive, isPending }) =>
                        isActive
                            ? "active"
                            : isPending
                            ? "pending"
                            : ""
                        }
                        to={`contacts/${contact.id}`}
                    >
                    {contact.first || contact.last ? (
                      <>
                        {contact.first} {contact.last}
                      </>
                    ) : (
                      <i>No Name</i>
                    )}
                    {contact.favorite ? (
                      <span>★</span>
                    ) : null}
                    </NavLink>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              <i>No contacts</i>
            </p>
          )}
        </nav>
      </div>
      <div 
        className={
            navigation.state === "loading" && !searching
            ? "loading"
            : ""
            }
        id="detail">
        <Outlet />
      </div>
    </>
  );
}