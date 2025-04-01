import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBed,
  faDroplet,
  faHeart,
  faMicrochip,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import ParameterDashboard from "../components/ParameterDashboard";
import doctorProfileIcon from "../assets/doctor-profile-icon.png";
import { useAuth } from "../AuthContext";
import io from "socket.io-client";

const socket = io(process.env.REACT_APP_CLIENT_URL);

function Doctor() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  // todo: lettura dal database
  const [patients, setPatients] = useState({
    "hm-device-001": {
      name: "Pietro Frongia",
      room: "102A",
      device: true,
    },
    // "hm-device-002": {
    //   name: "Alberto Pricope",
    //   room: "102B",
    //   device: false,
    // },
  });

  const [selectedPatientLastValues, setSelectedPatientLastValues] = useState({
    device: "hm-device-001",
    heartRate: 12,
    heartRateAvg: 12,
    bloodPressure: 34,
    bloodPressureAvg: 34,
  });

  useEffect(() => {
    // const socket = new WebSocket("ws://localhost:4000");

    // socket.onmessage = (event) => {
    //   const data = JSON.parse(event.data);
    //   if (data.device === selectedPatient) setSelectedPatientLastValues(data);
    // };

    socket.on(`/${selectedPatient}/updates`, (data) => {
      setSelectedPatientLastValues(data);
    });

    return () => socket.off(`/${selectedPatient}/updates`);
  }, [selectedPatient]);

  useEffect(() => {
    // todo: recupero dal database dell'ultima lettura effettuata per quel paziente
  }, [selectedPatient]);

  return (
    <div className="page-layout">
      <Navbar
        section="Pazienti"
        icon={doctorProfileIcon}
        userName={user.name}
        userEmail={user.email}
      >
        <div
          style={{
            display: "grid",
            gridTemplateRows: "40px auto",
            height: "100%",
          }}
        >
          <div className="searchbar">
            <div
              className="flex v-center h-center font-sm"
              style={{ width: "24px", height: "24px" }}
            >
              <FontAwesomeIcon icon={faSearch} />
            </div>
            <input
              type="text"
              value={search}
              placeholder="Cerca paziente"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {Object.keys(patients).length === 0 ? (
            <div style={{ marginTop: "8px" }}>Nessun paziente assegnato</div>
          ) : (
            <ul style={{ overflow: "auto", marginTop: "16px" }}>
              {Object.keys(patients).map((patient) => {
                return (
                  <li
                    key={patient}
                    className="navbar-doctor-patient-card"
                    style={{
                      background:
                        patient === selectedPatient ? "#fff" : "transparent",
                      boxShadow:
                        patient === selectedPatient
                          ? "0 0 16px #0742800d"
                          : "none",
                      transition: "0.2s ease",
                    }}
                    onClick={(e) => setSelectedPatient(patient)}
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
                      <FontAwesomeIcon icon={faBed} />
                    </div>
                    <div className="flex f-row v-center space-btw">
                      <div className="bold" style={{ paddingLeft: "8px" }}>
                        {patients[patient].name}
                      </div>
                      <div className="flex f-row v-center">
                        <div style={{ width: "42px", textAlign: "right" }}>
                          {patients[patient].room}
                        </div>
                        <div
                          className={`flex v-center font-xsm ${
                            patients[patient].device
                              ? "device-active"
                              : "device-not-active"
                          }`}
                          style={{
                            padding: "6px",
                            height: "24px",
                            borderRadius: "3px",
                            marginLeft: "8px",
                          }}
                        >
                          <FontAwesomeIcon icon={faMicrochip} />
                          <span style={{ paddingLeft: "4px" }}>
                            {patients[patient].device ? "Attivo" : "Non Attivo"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Navbar>
      {selectedPatient ? (
        <div className="patient-dashboard-layout">
          <div className="patient-dashboard-header">
            <div className="flex f-row v-center">
              <div
                className="flex v-center h-center font-xsm"
                style={{
                  width: "24px",
                  height: "24px",
                  background: "#adf3ff",
                  borderRadius: "4px",
                }}
              >
                <FontAwesomeIcon icon={faBed} />
              </div>
              <div className="bold font-big" style={{ paddingLeft: "8px" }}>
                {patients[selectedPatient].name}
              </div>
            </div>
            <div>{patients[selectedPatient].room}</div>
            <div
              className={`flex v-center font-xsm ${
                patients[selectedPatient].device
                  ? "device-active"
                  : "device-not-active"
              }`}
              style={{
                padding: "6px",
                height: "24px",
                borderRadius: "3px",
              }}
            >
              <FontAwesomeIcon icon={faMicrochip} />
              <span style={{ paddingLeft: "4px" }}>
                {patients[selectedPatient].device ? "Attivo" : "Non Attivo"}
              </span>
            </div>
          </div>
          <div>
            <ParameterDashboard
              parameter="Battito Cardiaco"
              unit="bpm"
              icon={faHeart}
              value={selectedPatientLastValues.heartRate}
              avg={selectedPatientLastValues.heartRateAvg}
              color="var(--red-color)"
              minThreshold={0}
              maxThreshold={250}
            />
            <ParameterDashboard
              parameter="Pressione Sanguigna"
              unit="mmHg"
              icon={faDroplet}
              value={selectedPatientLastValues.bloodPressure}
              avg={selectedPatientLastValues.bloodPressureAvg}
              color="var(--orange-color)"
              minThreshold={0}
              maxThreshold={250}
            />
          </div>
          <div className="patient-dashboard-allarms-layout">
            <div className="bold">Registro Allarmi</div>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Orario</th>
                  <th>Durata</th>
                  <th>Parametro</th>
                  <th>Media</th>
                  <th>Soglia min</th>
                  <th>Soglia max</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                  return (
                    <tr key={i}>
                      <th className="bold">16 Feb 2025</th>
                      <th>12:05:12</th>
                      <th>
                        2<span className="font-xsm thin">min</span> 2
                        <span className="font-xsm thin">sec</span>
                      </th>
                      <th className="bold">Pressione Sanguigna</th>
                      <th>
                        <span className="bold">156</span>
                        <span className="font-xsm thin">mmHg</span>
                      </th>
                      <th>
                        80<span className="font-xsm thin">mmHg</span>
                      </th>
                      <th>
                        124<span className="font-xsm thin">mmHg</span>
                      </th>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex h-center v-center">
          Nessun paziente selezionato
        </div>
      )}
    </div>
  );
}

export default Doctor;
