import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import Icon from "./Icon";
import LiveClock from "./LiveClock";

const NAV = [
  { to: "/", label: "Dashboard", icon: "dashboard", perm: "dashboard.view", end: true },
  { to: "/contacts", label: "Contacts", icon: "users", perm: "contacts.manage" },
  { to: "/lists", label: "Contact Lists", icon: "folder", perm: "lists.manage" },
  { to: "/templates", label: "Templates", icon: "file", perm: "templates.manage" },
  { to: "/campaigns", label: "Campaigns", icon: "send", perm: "campaigns.manage" },
  { to: "/surveys", label: "Surveys", icon: "clipboard", perm: "surveys.manage" },
  { to: "/reports", label: "Reports", icon: "chart", perm: "reports.view" },
  { to: "/roles", label: "Roles", icon: "shield", perm: "roles.manage" },
  { to: "/users", label: "Users", icon: "userCog", perm: "users.manage" },
  { to: "/settings", label: "Settings", icon: "settings", perm: "settings.manage" },
  { to: "/support", label: "Support", icon: "message", perm: null },
  { to: "/profile", label: "My Profile", icon: "user", perm: null },
  { to: "/guide.html", label: "User Guide", icon: "clipboard", perm: null, external: true },
  { to: "/presentation.html", label: "Presentation", icon: "file", perm: null, external: true },
];

const TITLES = {
  "/": "Dashboard",
  "/contacts": "Contacts",
  "/lists": "Contact Lists",
  "/templates": "Templates",
  "/campaigns": "Campaigns",
  "/surveys": "Surveys",
  "/reports": "Reports",
  "/roles": "Roles",
  "/users": "Users",
  "/settings": "Settings",
  "/support": "Support",
  "/profile": "My Profile",
};

export default function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [branding, setBranding] = useState(null);
  const location = useLocation();

  useEffect(() => {
    api.get("/branding").then((r) => setBranding(r.data.data)).catch(() => {});
  }, [location.pathname]);

  const companyName = branding?.companyName || "Campaign Admin";
  const poweredBy = branding?.poweredBy || branding?.companyName || "Campaign Management System";

  const title =
    TITLES[location.pathname] ||
    (location.pathname.startsWith("/campaigns/")
      ? "Campaign Details"
      : location.pathname.startsWith("/surveys/")
        ? "Survey Details"
        : "Administration");

  const items = NAV.filter((n) => n.perm === null || hasPermission(n.perm));
  const initial = (user?.name || "?").charAt(0).toUpperCase();

  return (
    <div className="dashboard-shell">
      {open && <div className="drawer-overlay" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="side-logo">
          {branding?.logoUrl && (
            <img src={branding.logoUrl} alt={companyName} className="side-logo-img" />
          )}
          <span className="side-logo-text">{companyName}</span>
        </div>
        <nav>
          {items.map((n) =>
            n.external ? (
              <a
                key={n.to}
                href={n.to}
                target="_blank"
                rel="noreferrer"
                className="side-item"
                onClick={() => setOpen(false)}
              >
                <Icon name={n.icon} size={15} />
                {n.label}
              </a>
            ) : (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => `side-item ${isActive ? "active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <Icon name={n.icon} size={15} />
                {n.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="side-foot">
          <div className="side-user">
            <strong>{user?.name}</strong>
            {user?.role?.replace(/_/g, " ")}
          </div>
          <button className="side-item" onClick={logout} style={{ width: "100%" }}>
            <Icon name="logout" size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Icon name="menu" size={20} />
          </button>
          <div className="topbar-brand">
            {title}
            <span className="topbar-sub">{companyName}</span>
          </div>
          <LiveClock />
          <div className="topbar-user">
            <span className="avatar">{initial}</span>
            <span>{user?.name}</span>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            Powered by <b>{poweredBy}</b>
          </span>
          <span className="footer-year">© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}
