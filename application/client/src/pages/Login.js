import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/healthmonitor.svg";
import { useRef, useState } from "react";
import { useAuth } from "../AuthContext";
import axios from "axios";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const emailInput = useRef(null);
  const passwordInput = useRef(null);
  const globalError = useRef(null);

  const handleEmail = (e) => {
    setEmail(e.target.value);
    emailInput.current.children[1].style.border = "";
    emailInput.current.children[2].innerText = "";
    globalError.current.innerText = "";
  };

  const handlePassword = (e) => {
    setPassword(e.target.value);
    passwordInput.current.children[1].style.border = "";
    passwordInput.current.children[2].innerText = "";
    globalError.current.innerText = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let validRequest = true;

    let emailTrim = email.trim();
    let passwordTrim = password.trim();

    if (!/^([a-zA-Z]\.)+[a-zA-Z]+\d@hm\.(admin|doctor)\.it$/.test(emailTrim)) {
      validRequest = false;
      emailInput.current.children[1].style.border = "2px solid red";
      emailInput.current.children[2].innerText =
        emailTrim.length === 0
          ? "Inserire una email"
          : "Email inserita non valida";
    }

    if (passwordTrim.length === 0) {
      validRequest = false;
      passwordInput.current.children[1].style.border = "2px solid red";
      passwordInput.current.children[2].innerText = "Inserire una password";
    }

    if (validRequest) {
      axios
        .post(
          `${process.env.REACT_APP_SERVER_API_URL}/login`,
          {
            email: emailTrim,
            password: passwordTrim,
          },
          { headers: { "Content-Type": "application/json" } }
        )
        .then((res) => {
          let user = res.data.user;
          localStorage.setItem("user", user);
          login(user);
          navigate(user.role === "admin" ? "/admin" : "/");
        })
        .catch((error) => {
          globalError.current.innerText = error.response.data.message;
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
          <div ref={emailInput} className="flex f-col">
            <label>Email:</label>
            <input
              type="text"
              placeholder="Inserire email"
              value={email}
              onChange={handleEmail}
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
          <input type="submit" value="Login" />
        </form>
        <div
          className="font-sm thin"
          style={{ marginTop: "24px", textAlign: "center" }}
        >
          Non hai un'account e sei interessato a essere assunto? <br />
          <Link to="/signup" className="bold">
            Compila la tua Candidatura
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
