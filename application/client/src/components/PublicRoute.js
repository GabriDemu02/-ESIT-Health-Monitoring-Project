import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../AuthContext";

const PublicRoute = () => {
  const { user } = useAuth();

  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/"} />;

  return <Outlet />;
};

export default PublicRoute;
