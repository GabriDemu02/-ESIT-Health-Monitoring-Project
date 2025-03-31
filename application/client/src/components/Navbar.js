import React from "react";
import "./Navbar.css";
import logo from "../assets/healthmonitor.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";

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
              logout();
              navigate("/login");
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
