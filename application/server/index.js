const awsIot = require("aws-iot-device-sdk");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const http = require("http");
const socketIo = require("socket.io");
const app = express();
const socketServer = http.createServer(app);
const io = socketIo(socketServer);
app.use(express.json());

const AWS = require("aws-sdk");

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const dbclient = new DynamoDBClient({
  region: "eu-north-1",
  credentials: {
    accessKeyId: "AKIARHJJNAE7WBW763MI",
    secretAccessKey: "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",
  },
});

const docClient = DynamoDBDocumentClient.from(dbclient);


app.use(cors());

const server = awsIot.device({
  keyPath: process.env.AWS_CERT_KEY,
  certPath: process.env.AWS_CERT_CRT,
  caPath: process.env.AWS_CERT_CA,
  clientId: process.env.AWS_THING_NAME,
  host: process.env.AWS_IOT_ENDPOINT,
});

server.on("connect", () => {
  console.log("Connected to AWS IoT");
  server.subscribe(process.env.MQTT_SUB_TOPIC);
});

function sendAllarm(device, state) {
  server.publish(
    `devices/${device}/commands`,
    JSON.stringify({ alarm: state })
  );
}

// avrg reads class
class ReadingsAverage {
  constructor(size) {
    this.size = size;
    this.values = [];
  }

  addValue(newValue) {
    this.values.push(newValue);

    if (this.values.length > this.size) {
      this.values.shift();
    }

    const sum = this.values.reduce((acc, val) => acc + val, 0);
    return sum / this.values.length;
  }
}

let avrgHR = new ReadingsAverage(30);
let avrgBP = new ReadingsAverage(30);

server.on("message", (topic, payload) => {
  if (topic === MQTT_SUB_TOPIC) {
    const data = JSON.parse(payload.toString());

    let heartRate = undefined;
    if (data && data.state.reported["heart-rate"] !== undefined)
      heartRate = data.state.reported["heart-rate"];

    let bloodPressure = undefined;
    if (data && data.state.reported["blood-pressure"] !== undefined)
      bloodPressure = data.state.reported["blood-pressure"];

    let device = topic.split("/")[2];
    sendAllarm(device, true);

    io.emit(`/${device}/updates`, {
      device: device,
      heartRate: heartRate,
      heartRateAvg: Math.floor(avrgHR.addValue(heartRate)),
      bloodPressure: bloodPressure,
      bloodPressureAvg: Math.floor(avrgBP.addValue(bloodPressure)),
    });
  }

  // Gestione del controllo del buzzer del device
  if (bloodPressure > 120 || heartRate > 120) {
    sendAllarm(device, true);
  } else sendAllarm(device, false);
});

app.post("/api/signup", async (req, res) => {
  console.log("Entered signup!");
  // controlla della api /signup
  try {
    console.log(req.body);
    const { name, surname, taxCode, telegramUsername, password } = req.body; // dati ricevuti dal client

    let getRes;

    // Controllo se l'utente è in lista d'attesa
    const checkApplication = {
      TableName: "ApplicationRequests",
      Key: { TaxCode: taxCode },
    };
    getRes = await docClient.send(new GetCommand(checkApplication));

    if (getRes && getRes.Item) {
      return res.status(400).json({
        error: `L'utente "${taxCode}" ha già effettuato la candidatura`,
      });
    }

    // Controllo se l'utente è già un dottore
    const checkDoctor = {
      TableName: "AppliedDoctors",
      FilterExpression: "TaxCode = :taxCode", // Definiamo la FilterExpression
      ExpressionAttributeValues: {
        ":taxCode": taxCode,
      },
    };
    scanRes = await docClient.send(new ScanCommand(checkDoctor));

    if (scanRes.Items && scanRes.Items.length > 0) {
      return res
        .status(400)
        .json({ error: `L'utente "${taxCode}" è gia registrato nel sistema` });
    }

    // Aggiunta utente al db
    const params = {
      TableName: "ApplicationRequests",
      Item: {
        TaxCode: taxCode,
        name: name,
        surname: surname,
        telegramUsername: telegramUsername,
        password: password,
      },
    };
    await docClient.send(new PutCommand(params));

    res.json({ message: "User registrato su DynamoDB!" }); // registrazione conclusa senza errori
  } catch (error) {
    console.error("Errore nella registrazione su DynamoDB: ", error);
    return res.status(500).json({
      message: "Errore interno nel salvataggio dell'utente su DynamoDB",
    });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body; // dati ricevuti dal client
  console.log(req.body);

  let scanRes;

  let role = email.split(".")[2];
  console.log(role);
  
  try {
    // Controllo se l'utente è in lista d'attesa
    const checkLogin = {
      TableName: role === "doctor" ? "AppliedDoctors" : "Admins",
      FilterExpression: "email = :email", // Definiamo la FilterExpression
      ExpressionAttributeValues: { ":email": email }
    };
    scanRes = await docClient.send(new ScanCommand(checkLogin));

    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    // Se esiste, prendo il primo elemento
    const user = {...scanRes.Items[0], role: role};

    // Verifico che la password sia la medesima
    if (user.password !== password) {
      return res.status(401).json({ error: "Password errata" });
    }
    // Restituisco stato di corretto accesso e i dati utente
    return res.status(200).json({
      message: "Login effettuato correttamente",
      user,
    });
  } catch (error) {
    console.error("Errore nel login: ", error);
    return res.status(500).json({
      message: "Errore interno nel controllo dell'utente su DynamoDB",
    });
  }

   
});

// effettuo il controllo per il rifiuto candidatura
app.post("/api/application/:id/reject", async (req, res) => {

  try {
    const { taxCode } = req.body;

    let scanRes;

    // Controllo se l'utente è in lista d'attesa
    const checkApplication = {
      TableName: "ApplicationRequests",
      FilterExpression: "TaxCode = :taxCode",  // Definiamo la FilterExpression
      ExpressionAttributeValues: {
        ":taxCode": taxCode,
      },
    };
    scanRes = await docClient.send(new ScanCommand(checkApplication));

    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(404).json({ error: "Candidatura non trovata." });
    }
    // Se esiste, prendo il primo elemento
    const application = scanRes.Items[0];

    const refuse = {
      TableName: "ApplicationRequests",
      Key: {TaxCode: taxCode}
    };
    const delRes = await docClient.send(new DeleteCommand(refuse));

    // Se l'elemento non esiste, il risultato potrebbe non contenere l'elemento cancellato
    if (!delRes.Attributes) {
      return res.status(404).json({ error: "Elemento non trovato" });
    }

    return res.status(200).json({
      message: "Elemento eliminato con successo"
    });


  } catch (error) {
    console.error("Errore nel rifiuto candidatura: ", error);
    return res.status(500).json({message: 
      "Errore interno."});
  }

});

// effettuo il controllo per il rifiuto candidatura
app.post("/api/application/:id/accept", async (req, res) => {

  try {
    const { taxCode } = req.body;

    let scanRes;

    // Controllo se l'utente è in lista d'attesa
    const checkApplication = {
      TableName: "ApplicationRequests",
      FilterExpression: "TaxCode = :taxCode",  // Definiamo la FilterExpression
      ExpressionAttributeValues: {
        ":taxCode": taxCode,
      },
    };
    scanRes = await docClient.send(new ScanCommand(checkApplication));

    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(404).json({ error: "Candidatura non trovata." });
    }
    // Se esiste, prendo il primo elemento
    const application = scanRes.Items[0];

    const deleteParams = {
      TableName: "ApplicationRequests",
      Key: {TaxCode: taxCode}
    };
    const delRes = await docClient.send(new DeleteCommand(deleteParams));

    // Se l'elemento non esiste, il risultato potrebbe non contenere l'elemento cancellato
    if (!delRes.Attributes) {
      return res.status(404).json({ error: "Elemento non trovato" });
    }

    // Aggiunta utente al db
    const newDoc = {
      TableName: "AppliedDoctors",
      Item: {
        TaxCode: taxCode,
        Name: application.Name,
        Surname: application.Surname,
        TelegramUsername: application.TelegramUsername,
        Password: application.Password
      }
    };
    await docClient.send(new PutCommand(newDoc));

    return res.json({message: "Nuovo dottore accettato!", }); // registrazione conclusa senza errori

  } catch (error) {
    console.error("Errore nel rifiuto candidatura: ", error);
    return res.status(500).json({message: 
      "Errore interno."});
  }

});

app.listen(process.env.SERVER_PORT, () => {
  console.log("Server running on port 8000");
});
