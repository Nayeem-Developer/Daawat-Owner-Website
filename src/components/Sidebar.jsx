import { NavLink } from "react-router-dom";
import logo from "../assets/images/daawat-logo.png";

const navLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/orders", label: "Orders" },
  { to: "/categories", label: "Categories" },
  { to: "/menu-items", label: "Menu Items" },
  { to: "/promotions", label: "Promotions" },
  { to: "/banners", label: "Banners" },
  { to: "/settings", label: "Settings" },
];

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src={logo} alt="Daawat Logo" />
          <div>
            <h2>Daawat Owner</h2>
            <p>Control Center</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
              onClick={onClose}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {isOpen && <button className="sidebar-backdrop" onClick={onClose} />}
    </>
  );
}
