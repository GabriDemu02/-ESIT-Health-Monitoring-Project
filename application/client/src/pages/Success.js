import { Link } from "react-router-dom";

function Success() {
  return (
    <div
      className="flex h-center v-center"
      style={{ width: "100vw", height: "100vh" }}
    >
      <div className="flex f-col v-center" style={{ width: "376px" }}>
        <div className="bold" style={{ fontSize: "48px", lineHeight: 1.1 }}>
          Candidatura Inviata!
        </div>
        <div style={{ textAlign: "justify", margin: "24px 0" }}>
          La tua candidatura è stata inoltrata nel sistema di{" "}
          <b>healthmonitor</b>, l'<b>esito</b> della tua proposta verrà inviato
          nel <b>contatto Telegram</b> fornito in fase di registrazione.
        </div>
        <div style={{ width: "100%", fontWeight: "bold" }}>
          <Link to="/login">Torna alla schermata di Accesso</Link>
        </div>
      </div>
    </div>
  );
}

export default Success;
