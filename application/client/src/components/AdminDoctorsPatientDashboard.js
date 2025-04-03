import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBed,
  faFilter,
  faSearch,
  faUserDoctor,
} from "@fortawesome/free-solid-svg-icons";

function AdminDoctorsPatientDashboard({ doctors, patients }) {
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
              {doctors.map((doctor) => {
                return (
                  <tr key={doctor.id}>
                    <th>{doctor.id}</th>
                    <th className="bold">
                      {doctor.name} {doctor.surname}
                    </th>
                    <th>{doctor.taxCode}</th>
                    <th>{doctor.email}</th>
                    <th>{doctor.telegramUsername}</th>
                    <th>{doctor.patients}</th>
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
                {doctors.map((doctor) => {
                  return (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.id}
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
              {patients.map((patient) => {
                return (
                  <tr key={patient.id}>
                    <th>{patient.id}</th>
                    <th className="bold">
                      {patient.name} {patient.surname}
                    </th>
                    <th>{patient.taxCode}</th>
                    <th>{patient.bedroom}</th>
                    <th>{patient.deviceStatus}</th>
                    <th className="bold">
                      <select
                        value={patient.doctor}
                        className="admin-dashboard-doctors-patients-patient-select"
                      >
                        {doctors.map((doctor) => {
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.id}
                          </option>;
                        })}
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
