import { faTelegram } from "@fortawesome/free-brands-svg-icons";
import {
  faAddressBook,
  faAddressCard,
  faUser,
  faUserPlus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import io from "socket.io-client";

const socket = io(process.env.REACT_APP_CLIENT_URL);

function AdminManagementDashboard({onSuccess}) {
  const [applicationRequests, setApplicationRequests] = useState([]);
  const [availableBedrooms, setAvailableBedrooms] = useState([]);
  const [availableDoctors, setAvailableDoctors] = useState([]);

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [doctor, setDoctor] = useState("");
  const [bedroom, setBedroom] = useState("");

  const nameInput = useRef(null);
  const surnameInput = useRef(null);
  const taxCodeInput = useRef(null);
  const doctorInput = useRef(null);
  const bedroomInput = useRef(null);

  const handleName = (e) => {
    setName(e.target.value);
    nameInput.current.children[1].style.border = "";
    nameInput.current.children[2].innerText = "";
  };

  const handleSurname = (e) => {
    setSurname(e.target.value);
    surnameInput.current.children[1].style.border = "";
    surnameInput.current.children[2].innerText = "";
  };

  const handleTaxCode = (e) => {
    setTaxCode(e.target.value);
    taxCodeInput.current.children[1].style.border = "";
    taxCodeInput.current.children[2].innerText = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let validRequest = true;

    let nameTrim = name.trim();
    let surnameTrim = surname.trim();
    let taxCodeTrim = taxCode.trim();

    if (!/^[A-Za-z]+$/.test(nameTrim)) {
      validRequest = false;
      nameInput.current.children[1].style.border = "2px solid red";
      nameInput.current.children[2].innerText =
        nameTrim.length === 0 ? "Inserire un nome" : "Nome inserito non valido";
    }
    if (!/^[A-Za-z]+$/.test(surnameTrim)) {
      validRequest = false;
      surnameInput.current.children[1].style.border = "2px solid red";
      surnameInput.current.children[2].innerText =
        surnameTrim.length === 0
          ? "Inserire un cognome"
          : "Cognome inserito non valido";
    }
    if (!/^[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z]\d{3}[A-Z]$/i.test(taxCodeTrim)) {
      validRequest = false;
      taxCodeInput.current.children[1].style.border = "2px solid red";
      taxCodeInput.current.children[2].innerText =
        taxCodeTrim.length === 0
          ? "Inserire un codice fiscale"
          : "Codice fiscale inserito non valido";
    }
  
    if (validRequest) {
      axios
        .post(
          `${process.env.REACT_APP_SERVER_API_URL}/addPatient`,
          {
            name: nameTrim,
            surname: surnameTrim,
            taxCode: taxCodeTrim,
            bed: bedroom,
            doctor: doctor
          },
          { headers: { "Content-Type": "application/json" } }
        )
        .then(() => {
          onSuccess(true);
        })
        .catch((error) => console.log(error));
    }
  };

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_SERVER_API_URL}/doctors`)
      .then((res) => {
        setAvailableDoctors(res.data);
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_SERVER_API_URL}/bedrooms`)
      .then((res) => {
        setAvailableBedrooms(res.data);
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  const handleApplicationRejection = (remove) => {
    axios
      .post(
        `${process.env.REACT_APP_SERVER_API_URL}/application/${remove}/reject`
      )
      .then((_) => {
        setApplicationRequests((prev) =>
          prev.filter((application) => application.TaxCode !== remove)
        );
      })
      .catch((error) => console.log(error));
  };

  const handleApplicationReception = (add) => {
    axios
      .post(`${process.env.REACT_APP_SERVER_API_URL}/application/${add}/accept`)
      .then((_) => {
        setApplicationRequests((prev) =>
          prev.filter((application) => application.TaxCode !== add)
        );
      })
      .catch((error) => console.log(error));
  };

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_SERVER_API_URL}/applications`)
      .then((res) => {
        setApplicationRequests(res.data);
      })
      .catch((error) => {
        console.log(error);
      });

    socket.on("newApplicationRequest", (newApplicationRequest) => {
      setApplicationRequests((prev) => [...prev, newApplicationRequest]);
    });

    return () => socket.off("newApplicationRequest");
  }, []);

  

  return (
    <div className="admin-management-layout">
      <div className="admin-management-section">
        <div className="admin-management-section-header">
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
              <FontAwesomeIcon icon={faAddressBook} />
            </div>
            <div className="bold font-big" style={{ paddingLeft: "8px" }}>
              Candidature
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "0 var(--padding-big)",
            overflow: "auto",
          }}
        >
          {applicationRequests.map((application, i) => {
            // applicationRequests deve essere un array di object [{name, surname, taxcode, telegram}]
            return (
              <div key={i} className="admin-management-application-layout">
                <div>
                  <div>
                    <div>
                      <div>
                        <FontAwesomeIcon icon={faUser} />
                      </div>
                      Nome
                    </div>
                    <div>{application.name}</div>
                  </div>
                  <div>
                    <div>
                      <div>
                        <FontAwesomeIcon icon={faUser} />
                      </div>
                      Cognome
                    </div>
                    <div>{application.surname}</div>
                  </div>
                  <div>
                    <div>
                      <div>
                        <FontAwesomeIcon icon={faAddressCard} />
                      </div>
                      Codice fiscale
                    </div>
                    <div>{application.TaxCode}</div>
                  </div>
                  <div>
                    <div>
                      <div>
                        <FontAwesomeIcon icon={faTelegram} />
                      </div>
                      Telegram
                    </div>
                    <div>{application.telegramUsername}</div>
                  </div>
                </div>
                <div className="admin-management-application-operations">
                  <div
                    onClick={() =>
                      handleApplicationRejection(application.TaxCode)
                    }
                  >
                    Rifiuta
                  </div>
                  <div
                    onClick={() =>
                      handleApplicationReception(application.TaxCode)
                    }
                  >
                    Accetta
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="admin-management-section">
        <div className="admin-management-section-header">
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
              <FontAwesomeIcon icon={faUserPlus} />
            </div>
            <div className="bold font-big" style={{ paddingLeft: "8px" }}>
              Aggiungi paziente
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "var(--padding-big)",
            paddingTop: "0",
            overflow: "auto",
          }}
        >
          <form
            className="admin-management-patient-form"
            onSubmit={handleSubmit}
          >
            <div ref={nameInput} className="flex f-col">
              <label>Nome:</label>
              <input
                type="text"
                placeholder="Inserire nome del paziente"
                value={name}
                onChange={handleName}
              />
              <div className="form-input-error"></div>
            </div>
            <div ref={surnameInput} className="flex f-col">
              <label>Cognome:</label>
              <input
                type="text"
                placeholder="Inserire cognome del paziente"
                value={surname}
                onChange={handleSurname}
              />
              <div className="form-input-error"></div>
            </div>
            <div ref={taxCodeInput} className="flex f-col">
              <label>Codice fiscale:</label>
              <input
                type="text"
                placeholder="Inserire codice fiscale del paziente"
                value={taxCode}
                onChange={handleTaxCode}
              />
              <div className="form-input-error"></div>
            </div>
            <div className="flex f-row">
              <div
                ref={doctorInput}
                className="flex f-col"
                style={{ width: "50%", marginRight: "8px" }}
              >
                <label>Medico curante:</label>
                <select
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                >
                  <option value="">---</option>
                  {availableDoctors.map((availableDoctor) => (
                    <option key={availableDoctor.Doctor_Prefix+availableDoctor.Doctor_ID} 
                    value={availableDoctor.Doctor_Prefix+availableDoctor.Doctor_ID}>
                      {availableDoctor.Doctor_Prefix+availableDoctor.Doctor_ID}
                    </option>
                  ))}
                </select>
                <div className="form-input-error"></div>
              </div>
              <div
                ref={bedroomInput}
                className="flex f-col"
                style={{ width: "50%", marginLeft: "8px" }}
              >
                <label>Stanza:</label>
                <select
                  value={bedroom}
                  onChange={(e) => setBedroom(e.target.value)}
                >
                  <option value="">---</option>
                  {availableBedrooms.map((availableBedroom) => (
                    <option key={availableBedroom.ID_Bed} value={availableBedroom.ID_Bed}>
                      {availableBedroom.ID_Bed}
                    </option>
                  ))}
                </select>
                <div className="form-input-error"></div>
              </div>
            </div>
            <input type="submit" value="Aggiungi paziente" />
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminManagementDashboard;
