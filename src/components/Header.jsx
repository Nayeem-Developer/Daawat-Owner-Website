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
  appStatusControl,
}) {
  const location = useLocation();
  const isDashboard = location.pathname === "/";

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

      <div className="topbar-center">
        {isDashboard && appStatusControl ? (
          <div
            className={`app-status-control ${appStatusControl.isActive ? "active" : "inactive"} ${
              appStatusControl.isLoading ? "loading" : ""
            }`}
          >
            <div className="app-status-text">
              <span>App Status</span>
              <strong>
                {appStatusControl.isLoading
                  ? "Checking status..."
                  : appStatusControl.isActive
                    ? "App Active"
                    : "App Inactive"}
              </strong>
            </div>
            <button
              type="button"
              className="app-status-switch"
              onClick={appStatusControl.onToggle}
              disabled={appStatusControl.isLoading || appStatusControl.isUpdating}
              aria-pressed={appStatusControl.isActive}
            >
              <span className={`app-status-track ${appStatusControl.isActive ? "on" : "off"}`}>
                <span className="app-status-thumb" />
              </span>
              <span className="app-status-value">
                {appStatusControl.isUpdating
                  ? "Updating..."
                  : appStatusControl.isActive
                    ? "Active"
                    : "Inactive"}
              </span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="topbar-actions">
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
