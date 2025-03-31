import { useState } from "react";
import Navbar from "../components/Navbar";
import adminProfileIcon from "../assets/admin-profile-icon.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faUsers } from "@fortawesome/free-solid-svg-icons";
import AdminDoctorsPatientDashboard from "../components/AdminDoctorsPatientDashboard";
import AdminManagementDashboard from "../components/AdminManagementDashboard";
import { useAuth } from "../AuthContext";

function Admin() {
  const { user } = useAuth();
  const [selectedOperation, setSelectedOperation] = useState(0);

  const operations = [
    {
      id: 0,
      name: "Medici e Pazienti",
      icon: faUsers,
      component: <AdminDoctorsPatientDashboard />,
    },
    {
      id: 1,
      name: "Gestione ospedale",
      icon: faFileLines,
      component: <AdminManagementDashboard />,
    },
  ];

  return (
    <div className="page-layout">
      <Navbar
        section="Controllo"
        icon={adminProfileIcon}
        userName={user.name}
        userEmail={user.email}
      >
        <ul>
          {operations.map((operation) => {
            return (
              <li
                key={operation.id}
                className="navbar-admin-control-item"
                style={{
                  background:
                    operation.id === selectedOperation ? "#fff" : "transparent",
                  boxShadow:
                    operation.id === selectedOperation
                      ? "0 0 16px #0742800d"
                      : "none",
                  transition: "0.2s ease",
                }}
                onClick={(e) => setSelectedOperation(operation.id)}
              >
                <div
                  className="flex v-center h-center font-xsm"
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "#adf3ff",
                    borderRadius: "4px",
                  }}
                >
                  <FontAwesomeIcon icon={operation.icon} />
                </div>
                <div
                  className="flex v-center bold"
                  style={{ paddingLeft: "8px" }}
                >
                  {operation.name}
                </div>
              </li>
            );
          })}
        </ul>
      </Navbar>
      {operations[selectedOperation].component}
    </div>
  );
}

export default Admin;
