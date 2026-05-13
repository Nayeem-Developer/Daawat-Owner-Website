import { useLocation } from "react-router-dom";
import logo from "../assets/images/daawat-logo.png";

const titles = {
  "/": "Dashboard",
  "/orders": "Orders",
  "/categories": "Categories",
  "/menu-items": "Menu Items",
};

export default function Header({
  onMenuToggle,
  onLogout,
}) {
  const location = useLocation();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn" onClick={onMenuToggle}>
          <span />
          <span />
          <span />
        </button>
        <img src={logo} alt="Daawat" className="topbar-logo" />
        <div>
          <h1>{titles[location.pathname] || "Owner Panel"}</h1>
          <p>Manage your restaurant smoothly</p>
        </div>
      </div>

      <div className="topbar-actions">
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
