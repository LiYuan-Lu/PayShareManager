import {
  Form,
  Link,
  NavLink,
  Outlet,
  useNavigation,
} from "react-router";

import { getFriends } from "../data/friend-data";
import { getGroups } from "../data/group-data";
import type { Route } from "./+types/sidebar";
import { useEffect, useState } from "react";

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
    const [theme, setTheme] = useState<"light" | "dark">("light");
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

    useEffect(() => {
      const stored = window.localStorage.getItem("theme");
      const resolvedTheme =
        stored === "dark" || stored === "light"
          ? stored
          : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      setTheme(resolvedTheme);
      document.documentElement.setAttribute("data-theme", resolvedTheme);
    }, []);

    const toggleTheme = () => {
      const nextTheme = theme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
      window.localStorage.setItem("theme", nextTheme);
    };

  return (
    <>
      <div id="sidebar">
        <div className="sidebar-brand">
          <h1 className="brand-title">
            <Link to="about">Pay Share Manager</Link>
          </h1>
          <button
            aria-label="Toggle dark mode"
            aria-pressed={theme === "dark"}
            className="theme-toggle"
            onClick={toggleTheme}
            type="button"
          >
            <span className="theme-toggle-track">
              <span className="theme-toggle-thumb" />
            </span>
            <span className="theme-toggle-label">
              {theme === "dark" ? "Dark" : "Light"}
            </span>
          </button>
        </div>
        <nav>
          <div className="nav-section-title nav-section-title-groups">
            <h2>Groups</h2>
          </div>
          <div className="nav-cta">
            <Form method="post" action="/create-group">
            <button type="submit" className="center nav-cta-button">New Group</button>
            </Form>
          </div>
          {
          groups.length ? (
            <ul className="nav-list">
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
            <p className="nav-empty">
              <i> No groups</i>
            </p>
          )}
          <div className="nav-section-title nav-section-title-friends">
            <h2>Friends</h2>
          </div>
          <div className="nav-cta">
            <Form method="post" action="/friends/create">
              <button type="submit" className="center nav-cta-button">New Friend</button>
            </Form>
          </div>
          {friends.length ? (
            <ul className="nav-list">
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
            <p className="nav-empty">
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
