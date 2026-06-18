import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, {
  API_BASE_URL,
  TOKEN_KEY,
  clearOwnerSession,
  consumeSessionMessage,
  getErrorMessage,
  getOwnerToken,
} from "../services/api";
import logo from "../assets/images/daawat-logo.png";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const sessionMessage = consumeSessionMessage();
    if (sessionMessage) {
      setError(sessionMessage);
    }

    const token = getOwnerToken();
    if (token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const response = await api.post("/api/owner/login", { email, password });
      const token =
        response.data?.token ||
        response.data?.data?.token ||
        response.data?.jwt ||
        response.data?.accessToken;

      if (!token) {
        throw new Error("Token not returned from login API");
      }

      clearOwnerSession();
      localStorage.setItem(TOKEN_KEY, token);

      const redirectPath = location.state?.from?.pathname || "/";
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={logo} alt="Daawat" className="login-logo" />
        <h1>Owner Login</h1>
        <p>Sign in to manage Daawat orders, menu, and categories</p>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@daawat.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <small>Backend URL: {API_BASE_URL}</small>
      </div>
    </div>
  );
}
