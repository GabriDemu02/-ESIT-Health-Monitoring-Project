import Doctor from "./pages/Doctor";
import Admin from "./pages/Admin";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PrivateRoute from "./components/PrivateRoute";
import { AuthProvider } from "./AuthContext";
import PublicRoute from "./components/PublicRoute";
import ConstrainedRoute from "./components/ConstrainedRoute";
import Success from "./pages/Success";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

function App() {
  const [successPageAccess, setSuccessPageAccess] = useState("");

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <AuthProvider>
        <Router>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
              <Route
                path="/signup"
                element={<Signup onSuccess={setSuccessPageAccess} />}
              />
            </Route>
            <Route
              path="/"
              element={
                <PrivateRoute requiredRole="doctor">
                  <Doctor />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <PrivateRoute requiredRole="admin">
                  <Admin />
                </PrivateRoute>
              }
            />
            <Route
              path="/success"
              element={
                <ConstrainedRoute access={successPageAccess}>
                  <Success taxCode={successPageAccess} />
                </ConstrainedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </>
  );
}

export default App;
