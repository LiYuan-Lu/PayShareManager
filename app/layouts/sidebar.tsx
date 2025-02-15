import {
  Form,
  Link,
  NavLink,
  Outlet,
  useNavigation,
  useSubmit,
} from "react-router";

import { getFriends } from "../data/friend-data";
import { getGroups } from "../data/group-data";
import type { Route } from "./+types/sidebar";
import { useEffect } from "react";

export async function loader({
  request,
}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const friends = await getFriends();
  const groups = await getGroups();
  return { friends, q, groups };
}

export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
    const { friends, q, groups } = loaderData;
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
          <Link to="about">Pay Share Manager</Link>
        </h1>
        <nav>
          <div>
            <h1>Groups</h1>
          </div>
          <div>
            <Form method="post" action="/create-group">
            <button type="submit" className="center">New Group</button>
            </Form>
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
            <h1>Friends</h1>
          </div>
          <div>
            <Form method="post" action="/friends/create">
              <button type="submit" className="center">New Friend</button>
            </Form>
          </div>
          {friends.length ? (
            <ul>
              {friends.map((friend) => (
                <li key={friend.uniqueId}>
                    <NavLink
                        className={({ isActive, isPending }) =>
                        isActive
                            ? "active"
                            : isPending
                            ? "pending"
                            : ""
                        }
                        to={`friends/${friend.uniqueId}`}
                    >
                    {friend.name ? (
                      <>
                        {friend.name}
                      </>
                    ) : (
                      <i>No Name</i>
                    )}
                    </NavLink>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              <i>No friends</i>
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