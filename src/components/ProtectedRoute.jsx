import { Navigate, useLocation } from "react-router-dom";
import { getOwnerToken } from "../services/api";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = getOwnerToken();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
