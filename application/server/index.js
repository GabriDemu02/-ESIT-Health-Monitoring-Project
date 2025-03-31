const awsIot = require("aws-iot-device-sdk");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const http = require("http");
const socketIo = require("socket.io");
const socketServer = http.createServer(app);
const io = socketIo(socketServer);

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

const app = express();
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

app.post("/signup", async (req, res) => {
  // controlla della api /signup
  try {
    const { name, surname, taxCode, telegramUsername, password } = req.body; // dati ricevuti dal client
    //console.log(req.body);

    let getRes;

    // Controllo se l'utente è in lista d'attesa
    const checkApplication = {
      TableName: "ApplicationRequests",
      Key: { TaxCode: taxCode },
    };
    getRes = await docClient.send(new GetCommand(checkApplication));

    if (getRes && getRes.Item) {
      return res.status(400).json({
        error: "L'ID (taxCode) esiste già in tabella ApplicationRequests",
      });
    }

    // Controllo se l'utente è già un dottore
    const checkDoctor = {
      TableName: "AppliedDoctors",
      Key: { taxCode },
    };
    getRes = await docClient.send(new GetCommand(checkDoctor));

    if (getRes && getRes.Item) {
      return res
        .status(400)
        .json({ error: "L'ID (taxCode) esiste già in tabella AppliedDoctors" });
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

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body; // dati ricevuti dal client
    console.log(req.body);

    let scanRes;

    // Controllo se l'utente è in lista d'attesa
    const checkLogin = {
      TableName: "AppliedDoctors",
      FilterExpression: "Email = :email", // Definiamo la FilterExpression
      ExpressionAttributeValues: {
        ":email": email,
      },
    };
    scanRes = await docClient.send(new ScanCommand(checkLogin));

    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    // Se esiste, prendo il primo elemento
    const user = scanRes.Items[0];

    // Verifico che la password sia la medesima
    if (user.Password !== password) {
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

app.listen(process.env.SERVER_PORT, () => {
  console.log("Server running on port 8000");
});
