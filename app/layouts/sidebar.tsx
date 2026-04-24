import {
  Form,
  Link,
  NavLink,
  Outlet,
  useNavigation,
} from "react-router";

import { getFriends } from "../data/friend-data";
import { getGroups } from "../data/group-data";
import { requireUser } from "../data/auth.server";
import type { Route } from "./+types/sidebar";
import { useEffect, useState } from "react";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`nav-section-chevron-icon${open ? " nav-section-chevron-icon-open" : ""}`}
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

export async function loader({
  request,
}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const user = await requireUser(request);
  const friends = await getFriends(user.uniqueId);
  const groups = await getGroups(user.uniqueId);
  return { friends, q, groups, user };
}

export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  const { friends, q, groups, user } = loaderData;
  const navigation = useNavigation();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [friendsOpen, setFriendsOpen] = useState(true);
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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const collapseIfMobile = (isMobile: boolean) => {
      if (isMobile) {
        setGroupsOpen(false);
        setFriendsOpen(false);
      }
    };

    collapseIfMobile(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      collapseIfMobile(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
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
            <Link to="/">
              <img alt="" className="brand-icon" src="/icons/app.svg" />
              <span>Pay Share Manager</span>
            </Link>
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
            <button
              aria-expanded={groupsOpen}
              className="nav-section-toggle"
              onClick={() => setGroupsOpen((prev) => !prev)}
              type="button"
            >
              <span className="nav-section-label">
                <img alt="" className="nav-section-icon" src="/icons/groups.svg" />
                Groups
              </span>
              <span className="nav-section-chevron">
                <ChevronIcon open={groupsOpen} />
              </span>
            </button>
          </div>
          {groupsOpen ? (
            <>
              <div className="nav-cta">
                <Form method="post" action="/create-group">
                  <button type="submit" className="center nav-cta-button">New Group</button>
                </Form>
              </div>
              {groups.length ? (
                <ul className="nav-list">
                  {groups.map((group) => (
                    <li key={group.uniqueId}>
                      <NavLink to={`groups/${group.uniqueId}`}>
                        {group.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="nav-empty">
                  <i>No groups</i>
                </p>
              )}
            </>
          ) : null}
          <div className="nav-section-title nav-section-title-friends">
            <button
              aria-expanded={friendsOpen}
              className="nav-section-toggle"
              onClick={() => setFriendsOpen((prev) => !prev)}
              type="button"
            >
              <span className="nav-section-label">
                <img alt="" className="nav-section-icon" src="/icons/friend.svg" />
                Friends
              </span>
              <span className="nav-section-chevron">
                <ChevronIcon open={friendsOpen} />
              </span>
            </button>
          </div>
          {friendsOpen ? (
            <>
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
            </>
          ) : null}
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/about">
            <img alt="" className="nav-section-icon" src="/icons/app.svg" />
            About
          </NavLink>
          <div className="sidebar-user">
            <span>{user.name}</span>
            <Form action="/logout" method="post">
              <button type="submit">Sign out</button>
            </Form>
          </div>
        </div>
      </div>
      <div
        className={
          navigation.state === "loading" && !searching
            ? "loading"
            : ""
        }
        id="detail"
      >
        <Outlet />
      </div>
    </>
  );
}
