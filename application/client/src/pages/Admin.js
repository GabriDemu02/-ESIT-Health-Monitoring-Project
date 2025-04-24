import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import adminProfileIcon from "../assets/admin-profile-icon.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faUsers } from "@fortawesome/free-solid-svg-icons";
import AdminDoctorsPatientDashboard from "../components/AdminDoctorsPatientDashboard";
import AdminManagementDashboard from "../components/AdminManagementDashboard";
import { useAuth } from "../AuthContext";
import axios from "axios";

function Admin() {
  const { user } = useAuth();
  const [selectedOperation, setSelectedOperation] = useState(0);

  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);

  const operations = [
    {
      id: 0,
      name: "Medici e Pazienti",
      icon: faUsers,
      component: (
        <AdminDoctorsPatientDashboard
          doctors={doctors}
          setDoctors={setDoctors}
          patients={patients}
          setPatients={setPatients}
        />
      ),
    },
    {
      id: 1,
      name: "Gestione ospedale",
      icon: faFileLines,
      component: (
        <AdminManagementDashboard
          availableDoctors={doctors}
          setPatients={setPatients}
          setDoctors={setDoctors}
        />
      ),
    },
  ];

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_SERVER_API_URL}/doctors`)
      .then((res) => setDoctors(res.data))
      .catch((error) => console.log(error));

    axios
      .get(`${process.env.REACT_APP_SERVER_API_URL}/patients`)
      .then((res) => setPatients(res.data))
      .catch((error) => console.log(error));
  }, []);

  return (
    <div className="page-layout">
      <Navbar
        section="Controllo"
        icon={adminProfileIcon}
        userName={user.name + " " + user.surname}
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
