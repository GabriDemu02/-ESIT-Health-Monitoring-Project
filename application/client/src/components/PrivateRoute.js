import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const PrivateRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole && user.role !== requiredRole)
    return <Navigate to={user.role === "admin" ? "/admin" : "/"} />;

  return children;
};

export default PrivateRoute;
