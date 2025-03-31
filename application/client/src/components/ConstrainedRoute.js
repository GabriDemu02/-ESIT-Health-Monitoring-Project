import { Navigate } from "react-router-dom";

const ConstrainedRoute = ({ access, children }) => {
  return access ? children : <Navigate to="/" replace />;
};

export default ConstrainedRoute;
