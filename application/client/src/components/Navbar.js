import React from "react";
import ReactDOM from "react-dom";
import "./Navbar.css";
import logo from "../assets/healthmonitor.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";

import toast from "react-hot-toast";

function showConfirmToast(message, onConfirm) {
  toast.custom(
    (t) =>
      ReactDOM.createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "24px",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              minWidth: "300px",
              textAlign: "center",
            }}
          >
            <div>{message}</div>
            <div
              style={{
                marginTop: "16px",
                display: "flex",
                justifyContent: "center",
                gap: "16px",
              }}
            >
              <button
                style={{
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  fontWeight: "bold",
                  background: "#fff",
                  justifyContent: "center",
                  border: "2px solid var(--font-color-m-transparent)",
                  outline: "none",
                  color: "inherit",
                  padding: "8px",
                  width: "50%",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
                onClick={() => toast.dismiss(t.id)}
              >
                Annulla
              </button>
              <button
                style={{
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  fontWeight: "bold",
                  background: "var(--blue-color)",
                  justifyContent: "center",
                  border: "2px solid var(--blue-color)",
                  outline: "none",
                  color: "#fff",
                  padding: "8px",
                  width: "50%",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  toast.dismiss(t.id);
                  onConfirm();
                }}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>,
        document.body
      ),
    {
      duration: Infinity,
      enter: "animate__animated animate__fadeInDown",
      exit: "animate__animated animate__fadeOutUp",
    }
  );
}

function Navbar({ section, icon, userName, userEmail, children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="navbar-layout">
      <div className="flex f-row v-center">
        <img src={logo} alt="logo" style={{ width: "24px", height: "24px" }} />
        <div className="logo-title">
          Health<span style={{ color: "var(--blue-color)" }}>Monitor</span>
        </div>
      </div>
      <div>
        <div className="thin" style={{ height: "24px" }}>
          Profilo
        </div>
        <div className="navbar-profile-card">
          <div className="navbar-profile-user-icon">
            <img
              src={icon}
              alt="icon"
              style={{ width: "24px", height: "24px" }}
            />
          </div>
          <div style={{ padding: "0 16px" }}>
            <div className="bold font-big">{userName}</div>
            <div className="thin font-sm">{userEmail}</div>
          </div>
          <div
            className="navbar-profile-logout"
            onClick={() => {
              showConfirmToast("Sei sicuro di voler disconnetterti?", () => {
                logout();
                navigate("/login");
              });
            }}
          >
            <FontAwesomeIcon icon={faRightFromBracket} />
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateRows: "24px auto" }}>
        <div className="thin">{section}</div>
        <div style={{ height: "100%", overflow: "hidden" }}>{children}</div>
      </div>
    </nav>
  );
}

export default Navbar;
