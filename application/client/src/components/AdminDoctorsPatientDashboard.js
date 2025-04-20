import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBed,
  faFilter,
  faSearch,
  faUserDoctor,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";

function AdminDoctorsPatientDashboard() {
  const [searchDoctor, setSearchDoctor] = useState("");
  const [searchPatient, setSearchPatient] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_SERVER_API_URL}/doctors`)
      .then((res) => {
        setDoctors(res.data);
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_SERVER_API_URL}/patients`)
      .then((res) => {
        setPatients(res.data);
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);
  
  

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
                  <tr key={`${doctor.Doctor_Prefix}${doctor.Doctor_ID}`}>
                    <th>{`${doctor.Doctor_Prefix}${doctor.Doctor_ID}`}</th>
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
                  <tr key={patient.TaxCode}>
                    <th>{patient.TaxCode}</th>
                    <th className="bold">
                      {patient.name} {patient.surname}
                    </th>
                    <th>{patient.TaxCode}</th>
                    <th>{patient.bed}</th>
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
                      <div
                        className="admin-dashboard-doctors-patients-patient-release"
                        onClick={(e) => {
                          axios
                            .post(
                              `${process.env.REACT_APP_SERVER_API_URL}/patient/${patient.TaxCode}/release`
                            )
                            .then((data) => {
                              const { [patient.id]: _, ...filteredPatients } =
                                patients;
                              setPatients(filteredPatients);
                            })
                            .catch((error) => console.log(error));
                        }}
                      >
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
