import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/healthmonitor.svg";
import { useRef, useState } from "react";
import axios from "axios";

function Signup({ onSuccess }) {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [telegramUsername, settelegramUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const nameInput = useRef(null);
  const surnameInput = useRef(null);
  const taxCodeInput = useRef(null);
  const telegramUsernameInput = useRef(null);
  const passwordInput = useRef(null);
  const confirmPasswordInput = useRef(null);
  const globalError = useRef(null);

  const handleName = (e) => {
    setName(e.target.value);
    nameInput.current.children[1].style.border = "";
    nameInput.current.children[2].innerText = "";
    globalError.current.innerText = "";
  };

  const handleSurname = (e) => {
    setSurname(e.target.value);
    surnameInput.current.children[1].style.border = "";
    surnameInput.current.children[2].innerText = "";
    globalError.current.innerText = "";
  };

  const handleTaxCode = (e) => {
    setTaxCode(e.target.value);
    taxCodeInput.current.children[1].style.border = "";
    taxCodeInput.current.children[2].innerText = "";
    globalError.current.innerText = "";
  };

  const handletelegramUsername = (e) => {
    settelegramUsername(e.target.value);
    telegramUsernameInput.current.children[1].style.border = "";
    telegramUsernameInput.current.children[2].innerText = "";
    globalError.current.innerText = "";
  };

  const handlePassword = (e) => {
    setPassword(e.target.value);
    passwordInput.current.children[1].style.border = "";
    passwordInput.current.children[2].innerText = "";
    globalError.current.innerText = "";
  };

  const handleConfirmPassword = (e) => {
    setConfirmPassword(e.target.value);
    confirmPasswordInput.current.children[1].style.border = "";
    confirmPasswordInput.current.children[2].innerText = "";
    globalError.current.innerText = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let validRequest = true;

    let nameTrim = name.trim();
    let surnameTrim = surname.trim();
    let taxCodeTrim = taxCode.trim();
    let telegramUsernameTrim = telegramUsername.trim();
    let passwordTrim = password.trim();
    let confirmPasswordTrim = confirmPassword.trim();

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
    if (telegramUsernameTrim.length === 0) {
      validRequest = false;
      telegramUsernameInput.current.children[1].style.border = "2px solid red";
      telegramUsernameInput.current.children[2].innerText =
        "Inserire username Telegram";
    }
    let minPasswordLength = 5;
    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{5,}$/.test(passwordTrim)) {
      validRequest = false;
      passwordInput.current.children[1].style.border = "2px solid red";
      passwordInput.current.children[2].innerText =
        passwordTrim.length === 0
          ? "Inserire una password"
          : passwordTrim.length < minPasswordLength
          ? "La password deve contenere almeno 5 caratteri"
          : "La password deve contenere sia lettere che numeri";
    }
    if (confirmPasswordTrim !== passwordTrim) {
      validRequest = false;
      confirmPasswordInput.current.children[1].style.border = "2px solid red";
      confirmPasswordInput.current.children[2].innerText =
        "La password inserita non corrisponde";
    }

    if (validRequest) {
      axios
        .post(
          `${process.env.REACT_APP_SERVER_API_URL}/signup`,
          {
            name: nameTrim,
            surname: surnameTrim,
            taxCode: taxCodeTrim,
            telegramUsername: telegramUsernameTrim,
            password: passwordTrim,
          },
          { headers: { "Content-Type": "application/json" } }
        )
        .then(() => {
          onSuccess(true);
          navigate("/success");
        })
        .catch((error) => {
          globalError.current.innerText =
            error.response.data.error || "Errore di connessione";
        });
    }
  };

  return (
    <div className="login-signup-layout">
      <div style={{ width: "400px" }}>
        <div className="flex f-row v-center" style={{ marginBottom: "8px" }}>
          <img
            src={logo}
            alt="logo"
            style={{ width: "24px", height: "24px" }}
          />
          <div className="logo-title">
            Health<span style={{ color: "var(--blue-color)" }}>Monitor</span>
          </div>
        </div>
        <div ref={globalError} className="form-input-error"></div>
        <form className="login-signup-form" onSubmit={handleSubmit}>
          <div ref={nameInput} className="flex f-col">
            <label>Nome:</label>
            <input
              type="text"
              placeholder="Inserire nome"
              value={name}
              onChange={handleName}
            />
            <div className="form-input-error"></div>
          </div>
          <div ref={surnameInput} className="flex f-col">
            <label>Cognome:</label>
            <input
              type="text"
              placeholder="Inserire cognome"
              value={surname}
              onChange={handleSurname}
            />
            <div className="form-input-error"></div>
          </div>
          <div ref={taxCodeInput} className="flex f-col">
            <label>Codice fiscale:</label>
            <input
              type="text"
              placeholder="Inserire codice fiscale"
              value={taxCode}
              onChange={handleTaxCode}
            />
            <div className="form-input-error"></div>
          </div>
          <div ref={telegramUsernameInput} className="flex f-col">
            <label>Username Telegram:</label>
            <input
              type="text"
              placeholder="Inserire username Telegram"
              value={telegramUsername}
              onChange={handletelegramUsername}
            />
            <div className="form-input-error"></div>
          </div>
          <div ref={passwordInput} className="flex f-col">
            <label>Password:</label>
            <input
              type="password"
              placeholder="Inserire password"
              value={password}
              onChange={handlePassword}
            />
            <div className="form-input-error"></div>
          </div>
          <div ref={confirmPasswordInput} className="flex f-col">
            <label>Conferma Password:</label>
            <input
              type="password"
              placeholder="Inserire conferma password"
              value={confirmPassword}
              onChange={handleConfirmPassword}
            />
            <div className="form-input-error"></div>
          </div>
          <input type="submit" value="Invia Candidatura" />
        </form>
        <div
          className="font-sm thin"
          style={{ marginTop: "24px", textAlign: "center" }}
        >
          Possiedi già un account come medico?{" "}
          <Link to="/login" className="bold">
            Accedi
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Signup;
