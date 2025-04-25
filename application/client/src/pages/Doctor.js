import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBed,
  faCircleExclamation,
  faDroplet,
  faHeart,
  faMicrochip,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import ParameterDashboard from "../components/ParameterDashboard";
import doctorProfileIcon from "../assets/doctor-profile-icon.png";
import { useAuth } from "../AuthContext";
import io from "socket.io-client";
import axios from "axios";

const socket = io(process.env.REACT_APP_SOCKET_URL);

function Doctor() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState({});
  const [emergencyPatients, setEmergencyPatients] = useState({});
  const [selectedPatientDeviceLastValues, setSelectedPatientDeviceLastValues] =
    useState({});
  const [emergencies, setEmergencies] = useState([]);

  useEffect(() => {
    axios
      .get(
        `${process.env.REACT_APP_SERVER_API_URL}/doctor/${
          user.Doctor_Prefix + user.Doctor_ID
        }/patients`
      )
      .then((res) => {
        setPatients(res.data);
      })
      .catch((error) => console.log(error));
  }, []);

  useEffect(() => {
    socket.on(`/device/emergencies/start`, (data) => {
      for (let patient in patients) {
        if (patients[patient].device === data.device) {
          setEmergencyPatients((prev) => {
            let newState = { ...prev };
            if (newState[patient]) newState[patient].push(data.param);
            else newState[patient] = [data.param];
            return newState;
          });
          break;
        }
      }
    });

    socket.on(`/device/emergencies/end`, (data) => {
      for (let patient in patients) {
        if (patients[patient].device === data.device) {
          // TODO: problema del cambio del testo accennato in ParameterDashboard,
          // forse qualcosa non funziona qui
          setEmergencyPatients((prev) => {
            let newState = { ...prev };
            newState[patient] = newState[patient].filter(
              (param) => param !== data.param
            );
            if (newState[patient].length === 0) delete newState[patient];
            return newState;
          });
          break;
        }
      }
      setEmergencies((prev) => [data, ...prev]);
    });

    return () => {
      socket.off(`/device/emergencies/start`);
      socket.off(`/device/emergencies/end`);
    };
  }, [patients]);

  useEffect(() => {
    if (selectedPatient) {
      axios
        .post(
          `${process.env.REACT_APP_SERVER_API_URL}/device/${patients[selectedPatient].device}/emergencies`,
          { start_timestamp: patients[selectedPatient].start_timestamp },
          { headers: { "Content-Type": "application/json" } }
        )
        .then((res) => {
          setEmergencies(res.data);
        })
        .catch((error) => {
          console.log(error);
        });

      socket.on(
        `/device/${patients[selectedPatient].device}/updates`,
        (data) => {
          setSelectedPatientDeviceLastValues(data);
        }
      );

      return () => {
        socket.off(`/device/${patients[selectedPatient].device}/updates`);
      };
    }
  }, [selectedPatient]);

  return (
    <div className="page-layout">
      <Navbar
        section="Pazienti"
        icon={doctorProfileIcon}
        userName={user.name + " " + user.surname}
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
              {Object.keys(emergencyPatients).map((patient) => {
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
                        background: "var(--red-color)",
                        color: "#6c0707",
                        borderRadius: "4px",
                      }}
                    >
                      <FontAwesomeIcon icon={faCircleExclamation} />
                    </div>
                    <div className="flex f-row v-center space-btw">
                      <div className="bold" style={{ paddingLeft: "8px" }}>
                        {patients[patient].name +
                          " " +
                          patients[patient].surname}
                      </div>
                      <div className="flex f-row v-center">
                        <div style={{ width: "42px", textAlign: "right" }}>
                          {patients[patient].bed}
                        </div>
                        <div
                          className={`flex v-center font-xsm ${
                            patients[patient].deviceStatus
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
                            {patients[patient].deviceStatus
                              ? "Attivo"
                              : "Non Attivo"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
              {Object.keys(patients).map((patient) => {
                if (patient in emergencyPatients) return null;

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
                        {patients[patient].name +
                          " " +
                          patients[patient].surname}
                      </div>
                      <div className="flex f-row v-center">
                        <div style={{ width: "42px", textAlign: "right" }}>
                          {patients[patient].bed}
                        </div>
                        <div
                          className={`flex v-center font-xsm ${
                            patients[patient].deviceStatus
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
                            {patients[patient].deviceStatus
                              ? "Attivo"
                              : "Non Attivo"}
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
                {patients[selectedPatient].name +
                  " " +
                  patients[selectedPatient].surname}
              </div>
            </div>
            <div>{patients[selectedPatient].bed}</div>
            <div
              className={`flex v-center font-xsm ${
                patients[selectedPatient].deviceStatus
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
                {patients[selectedPatient].deviceStatus
                  ? "Attivo"
                  : "Non Attivo"}
              </span>
            </div>
          </div>
          <div>
            <ParameterDashboard
              patients={patients}
              emergency={
                selectedPatient in emergencyPatients &&
                emergencyPatients[selectedPatient].includes("Battito Cardiaco")
              }
              selectedPatient={selectedPatient}
              parameter="Battito Cardiaco"
              parameterID="HeartRate"
              unit="bpm"
              icon={faHeart}
              value={selectedPatientDeviceLastValues.heartRate ?? "---"}
              avg={selectedPatientDeviceLastValues.heartRateAvg ?? "---"}
              color="var(--red-color)"
              minThreshold={Number(
                process.env.REACT_APP_HEART_RATE_MIN_THRESHOLD
              )}
              maxThreshold={Number(
                process.env.REACT_APP_HEART_RATE_MAX_THRESHOLD
              )}
            />
            <ParameterDashboard
              patients={patients}
              emergency={
                selectedPatient in emergencyPatients &&
                emergencyPatients[selectedPatient].includes(
                  "Pressione Sanguigna"
                )
              }
              selectedPatient={selectedPatient}
              parameter="Pressione Sanguigna"
              parameterID="BloodPressure"
              unit="mmHg"
              icon={faDroplet}
              value={selectedPatientDeviceLastValues.bloodPressure ?? "---"}
              avg={selectedPatientDeviceLastValues.bloodPressureAvg ?? "---"}
              color="var(--orange-color)"
              minThreshold={Number(
                process.env.REACT_APP_BLOOD_PRESSURE_MIN_THRESHOLD
              )}
              maxThreshold={Number(
                process.env.REACT_APP_BLOOD_PRESSURE_MAX_THRESHOLD
              )}
            />
          </div>
          <div className="patient-dashboard-allarms-layout">
            <div className="bold">Registro Allarmi</div>
            <table style={{ height: "fit-content" }}>
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
                {emergencies.map((emergency, i) => {
                  const date = new Date(emergency.start_timestamp * 1000);
                  const duration = Math.floor(
                    (new Date(emergency.end_timestamp * 1000) - date) / 1000
                  );
                  const minutes = Math.floor(duration / 60);
                  const seconds = duration % 60;

                  const unit =
                    emergency.param === "Battito Cardiaco" ? "bpm" : "mmHg";

                  return (
                    <tr key={i}>
                      <th className="bold">
                        {/* TODO: quando viene aggiunto in real-time un nuovo record, qua crasha */}
                        {Intl.DateTimeFormat("it-IT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(date)}
                      </th>
                      <th>
                        {`${date.getHours().toString().padStart(2, "0")}:${date
                          .getMinutes()
                          .toString()
                          .padStart(2, "0")}`}
                        <span className="font-xsm thin">
                          {`:${date.getSeconds().toString().padStart(2, "0")}`}
                        </span>
                      </th>
                      <th>
                        {minutes.toString().padStart(2, "0")}
                        <span className="font-xsm thin">min</span>{" "}
                        {seconds.toString().padStart(2, "0")}
                        <span className="font-xsm thin">sec</span>
                      </th>
                      <th className="bold">{emergency.param}</th>
                      <th>
                        <span className="bold">{emergency.avrg}</span>
                        <span className="font-xsm thin">{unit}</span>
                      </th>
                      <th>
                        {emergency.minThreshold}
                        <span className="font-xsm thin">{unit}</span>
                      </th>
                      <th>
                        {emergency.maxThreshold}
                        <span className="font-xsm thin">{unit}</span>
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
