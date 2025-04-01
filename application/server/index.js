const awsIot = require("aws-iot-device-sdk");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const http = require("http");
const socketIo = require("socket.io");
const app = express();
const socketServer = http.createServer(app);
const io = socketIo(socketServer);
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const dbclient = new DynamoDBClient({
  region: "eu-north-1",
  credentials: {
    accessKeyId: "AKIARHJJNAE7WBW763MI",
    secretAccessKey: "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",
  },
});
const docClient = DynamoDBDocumentClient.from(dbclient);

const DOC_DB = "AppliedDoctors";
const APP_DB = "ApplicationRequests";
const PAT_DB = "PatientData";
const ADM_DB = "Admins";
const DEV_DB = "DeviceData";

app.use(express.json());
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

    // Controllo se l'utente è già candidato
    const checkApplication = {
      TableName: APP_DB,
      Key: { TaxCode: taxCode },
    };
    const getRes = await docClient.send(new GetCommand(checkApplication));
    if (getRes && getRes.Item) {
      return res.status(400).json({ error: `L'utente "${taxCode}" ha già effettuato la candidatura.`, });
    }

    // Controllo se l'utente è già un dottore
    const checkDoctor = {
      TableName: DOC_DB,
      FilterExpression: "taxCode = :taxCode", // Definiamo la FilterExpression
      ExpressionAttributeValues: {
        ":taxCode": taxCode,
      },
    };
    const scanRes = await docClient.send(new ScanCommand(checkDoctor));
    if (scanRes.Items && scanRes.Items.length > 0) {
      return res.status(401).json({ error: `L'utente "${taxCode}" è gia registrato come dottore!` });
    }

    const newApp = {
      TableName: APP_DB,
      Item: {
        TaxCode: taxCode,
        name: name,
        surname: surname,
        telegramUsername: telegramUsername,
        password: password,
      },
    };
    await docClient.send(new PutCommand(newApp));

    res.json({ message: `L'tente "${taxCode}" candidato con successo!` }); // registrazione conclusa senza errori
  } catch (error) {
    console.error(`Errore nella candidatura dell'utente "${taxCode}".\nCausa: `, error);
    return res.status(403).json({ message: "Errore interno nella candidatura!", });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body; // dati ricevuti dal client
  console.log(req.body);
  let role = email.split(".")[2];
  console.log(role);
  
  try {
    const checkLogin = {
      TableName: role === "doctor" ? DOC_DB : ADM_DB,
      FilterExpression: "email = :email", // Definiamo la FilterExpression
      ExpressionAttributeValues: { ":email": email }
    };
    const scanRes = await docClient.send(new ScanCommand(checkLogin));
    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    // Se esiste, prendo il primo elemento
    const user = {...scanRes.Items[0], role: role};

    // Verifico che la password sia la medesima
    if (user.password !== password) {
      return res.status(405).json({ error: "Password errata" });
    }
    // Restituisco stato di corretto accesso e i dati utente
    return res.status(200).json({ message: "Login effettuato correttamente", user, });
  } catch (error) {
    console.error("Errore nel login: ", error);
    return res.status(406).json({
      message: "Errore interno nel controllo dell'utente su DynamoDB",
    });
  }
});

async function getApplicationRequests() {
  let items = [];
  let lastEvaluatedKey = undefined;
  try {
    do {
      const appParams = {
        TableName: APP_DB,
        ExclusiveStartKey: lastEvaluatedKey,
      };
      const data = await docClient.send(new ScanCommand(appParams));
      if (data.Items) {
        items = items.concat(data.Items);
      }
      lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;

  } catch (error) {
    console.error("Errore durante la scansione di DynamoDB:", error);
    throw error;
  }
}

app.get("/api/applications", async (req, res) => {
  try {
    const requests = await getApplicationRequests();
    res.json(requests);
  } catch (error) {
    res.status(407).send("Errore durante il recupero delle richieste.");
  }
});

// Rifiuto candidatura dottore
app.post("/api/application/:id/reject", async (req, res) => {
  try {
    const taxCode = req.params.id;

    const checkApplication = {
      TableName: APP_DB,
      FilterExpression: "TaxCode = :taxCode",
      ExpressionAttributeValues: {
        ":taxCode": taxCode,
      },
    };
    const scanRes = await docClient.send(new ScanCommand(checkApplication));
    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(408).json({ error: "Candidatura non trovata." });
    }

    const application = scanRes.Items[0];

    const refuse = {
      TableName: APP_DB,
      Key: {TaxCode: application.TaxCode},
      ReturnValues: "ALL_OLD",
    };
    const delRes = await docClient.send(new DeleteCommand(refuse));
    if (!delRes.Attributes) {
      return res.status(409).json({ error: "Candidatura non trovata." });
    }

    return res.status(200).json({
      message: "Candidatura rifiutata con successo."
    });
  } catch (error) {
    console.error("Errore nel rifiuto candidatura: ", error);
    return res.status(410).json({message: "Errore interno."});
  }
});

// Accettazione candidatura dottore
app.post("/api/application/:id/accept", async (req, res) => {

  try {
    const taxCode = req.params.id;

    const checkApplication = {
      TableName: APP_DB,
      FilterExpression: "TaxCode = :taxCode",
      ExpressionAttributeValues: {
        ":taxCode": taxCode,
      },
    };
    const scanRes = await docClient.send(new ScanCommand(checkApplication));
    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(411).json({ error: "Candidatura non trovata." });
    }

    const application = scanRes.Items[0];

    const deleteParams = {
      TableName: APP_DB,
      Key: {TaxCode: application.TaxCode},
      ReturnValues: "ALL_OLD",
    };
    const delRes = await docClient.send(new DeleteCommand(deleteParams));
    if (!delRes.Attributes) {
      return res.status(412).json({ error: "Elemento non trovato" });
    }

    const newDoc = {
      TableName: DOC_DB,
      Item: {
        ID: application.TaxCode,
        taxCode: application.TaxCode,
        name: application.name,
        surname: application.surname,
        telegramUsername: application.telegramUsername,
        password: application.password
      }
    };

    await docClient.send(new PutCommand(newDoc));

    return res.json({message: "Nuovo dottore accettato!", });

  } catch (error) {
    console.error("Errore nell'accettazione candidatura: ", error);
    return res.status(413).json({message: "Errore interno."});
  }
});

app.listen(process.env.SERVER_PORT, () => {
  console.log("Server running on port 8000");
});
