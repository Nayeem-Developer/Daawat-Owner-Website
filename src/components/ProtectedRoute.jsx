import { Navigate, useLocation } from "react-router-dom";
import { TOKEN_KEY } from "../services/api";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
