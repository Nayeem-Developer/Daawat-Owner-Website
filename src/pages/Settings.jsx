import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, {
  clearOwnerSession,
  getErrorMessage,
  storeSessionNotice,
} from "../services/api";
import { disconnectSocket } from "../services/socket";

const PASSWORD_CHANGED_MESSAGE = "Password changed successfully. Please login again.";

export default function Settings() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  const handleLogout = () => {
    clearOwnerSession();
    disconnectSocket();
    navigate("/login", { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Confirm new password must match.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      await api.post("/api/owner/change-password", {
        currentPassword,
        newPassword,
      });

      clearOwnerSession();
      disconnectSocket();
      storeSessionNotice(PASSWORD_CHANGED_MESSAGE, "success");
      navigate("/login", { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Failed to change password"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-stack settings-page">
      <div className="page-actions">
        <h2>Settings</h2>
      </div>

      <section className="panel settings-panel">
        <div className="settings-section-head">
          <h3>Owner Security</h3>
          <p>Manage account access for the Daawat owner panel.</p>
        </div>

        <div className="settings-card-grid">
          <article className="settings-card">
            <div>
              <h4>Change Password</h4>
              <p>Update your owner login password.</p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setIsModalOpen(true)}
            >
              Change Password
            </button>
          </article>

          <article className="settings-card settings-card-danger">
            <div>
              <h4>Logout</h4>
              <p>Sign out of the owner website on this device.</p>
            </div>
            <button type="button" className="btn danger" onClick={handleLogout}>
              Logout
            </button>
          </article>
        </div>
      </section>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card settings-modal">
            <h3>Change Password</h3>
            <p>Update the owner login password used by the website and app.</p>

            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                Current Password
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
              </label>

              <label>
                New Password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </label>

              <label>
                Confirm New Password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </label>

              {error && <p className="error-msg">{error}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
