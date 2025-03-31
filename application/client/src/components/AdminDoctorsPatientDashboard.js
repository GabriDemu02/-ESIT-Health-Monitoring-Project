import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBed,
  faFilter,
  faSearch,
  faUserDoctor,
} from "@fortawesome/free-solid-svg-icons";

function AdminDoctorsPatientDashboard() {
  const [searchDoctor, setSearchDoctor] = useState("");
  const [searchPatient, setSearchPatient] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");

  return (
    <div>
      <div className="admin-dashboard-doctors-patients">
        <div className="admin-dashboard-doctors-patients-header">
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
              <FontAwesomeIcon icon={faUserDoctor} />
            </div>
            <div className="bold font-big" style={{ paddingLeft: "8px" }}>
              Medici
            </div>
          </div>
          <div className="searchbar" style={{ width: "352px" }}>
            <div
              className="flex v-center h-center font-sm"
              style={{ width: "24px", height: "24px" }}
            >
              <FontAwesomeIcon icon={faSearch} />
            </div>
            <input
              type="text"
              value={searchDoctor}
              placeholder="Cerca medico"
              onChange={(e) => setSearchDoctor(e.target.value)}
            />
          </div>
        </div>
        <div className="admin-dashboard-doctors-patients-body">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome e Cognome</th>
                <th>Codice fiscale</th>
                <th>Email</th>
                <th>Telegram</th>
                <th>Pazienti</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                return (
                  <tr key={i}>
                    <th>m.meloni1</th>
                    <th className="bold">Maurizio Meloni</th>
                    <th>MLNMRZ01M24G015Q</th>
                    <th>m.meloni1@hm.doctor.it</th>
                    <th>@sigmoris</th>
                    <th>2</th>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="admin-dashboard-doctors-patients">
        <div className="admin-dashboard-doctors-patients-header">
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
              Pazienti
            </div>
          </div>
          <div className="flex f-row">
            <div className="searchbar" style={{ width: "352px" }}>
              <div
                className="flex v-center h-center font-sm"
                style={{ width: "24px", height: "24px" }}
              >
                <FontAwesomeIcon icon={faSearch} />
              </div>
              <input
                type="text"
                value={searchPatient}
                placeholder="Cerca paziente"
                onChange={(e) => setSearchPatient(e.target.value)}
              />
            </div>
            <div className="admin-dashboard-doctors-patients-doctor-filter">
              <div
                className="flex v-center h-center font-sm"
                style={{ width: "24px", height: "24px" }}
              >
                <FontAwesomeIcon icon={faFilter} />
              </div>
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
              >
                <option value="">---</option>
                {["m.meloni1", "g.demurtas1"].map((option) => {
                  return (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
        <div className="admin-dashboard-doctors-patients-body">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome e Cognome</th>
                <th>Codice fiscale</th>
                <th>Stanza</th>
                <th>Dispositivo</th>
                <th>Medico</th>
                <th>Rilascia</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                return (
                  <tr key={i}>
                    <th>6534-0012</th>
                    <th className="bold">Pietro Frongia</th>
                    <th>PTRFRN02M08G015Q</th>
                    <th>102A</th>
                    <th>Attivo</th>
                    <th className="bold">
                      <select
                        value="m.meloni1"
                        className="admin-dashboard-doctors-patients-patient-select"
                      >
                        <option value="m.meloni1">m.meloni1</option>
                        <option value="g.demurtas1">g.demurtas1</option>
                      </select>
                    </th>
                    <th>
                      <div className="admin-dashboard-doctors-patients-patient-release">
                        Rilascia
                      </div>
                    </th>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminDoctorsPatientDashboard;
