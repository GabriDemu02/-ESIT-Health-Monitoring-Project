const awsIot = require("aws-iot-device-sdk");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const http = require("http");
const socketIo = require("socket.io");
const app = express();

app.use(express.json());
app.use(cors());

const socketServer = http.createServer(app);
const io = socketIo(socketServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
});
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  BatchGetCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
  ListTablesCommand,
} = require("@aws-sdk/lib-dynamodb");

const dbclient = new DynamoDBClient({
  region: "eu-north-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});
const docClient = DynamoDBDocumentClient.from(dbclient);

const DOC_DB = "AppliedDoctors";
const APP_DB = "ApplicationRequests";
const BED_DB = "BedroomCatalog";
const REC_DB = "RecoveryHistory";
const ADM_DB = "Admins";
const DEV_DB = "DeviceData";
const PAT_DB = "PatientThresholds";

const server = awsIot.device({
  keyPath: process.env.AWS_CERT_KEY,
  certPath: process.env.AWS_CERT_CRT,
  caPath: process.env.AWS_CERT_CA,
  clientId: process.env.AWS_THING_NAME,
  host: process.env.AWS_IOT_ENDPOINT,
});

var startTimestamp;
var endTimestamp;
const historyMinutesGroup = 5;

server.on("connect", () => {
  console.log("Connected to AWS IoT");
  server.subscribe(process.env.MQTT_SUB_TOPIC);

  // imposta data corrente
  const currentDate = new Date();
  const minutes = currentDate.getMinutes();
  const roundedMinutes =
    Math.floor(minutes / historyMinutesGroup) * historyMinutesGroup;
  currentDate.setMinutes(roundedMinutes);
  currentDate.setSeconds(0);
  currentDate.setMilliseconds(0);

  startTimestamp = currentDate.getTime() / 1000;
  endTimestamp = new Date(startTimestamp + historyMinutesGroup * 60).getTime();
});

socketServer.listen(process.env.SOCKET_SERVER_PORT, () => {
  console.log(
    `Socket server running on port ${process.env.SOCKET_SERVER_PORT}`
  );
});

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected to socket server`);
  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected to socket server`);
  });
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

const lastReadForDevice = {};
const avrgHistoryForDevice = {};

async function thresholdsControl(device, bloodPressure, heartRate) {
  let minThresholdBloodPressure, minThresholdHeartRate;
  let maxThresholdBloodPressure, maxThresholdHeartRate;

  const getParams = {
    TableName: BED_DB,
    FilterExpression: "ID_Dev = :dev",
    ExpressionAttributeValues: { ":dev": device },
  };
  const getRes = await docClient.send(new ScanCommand(getParams));
  if (!getRes && !getRes.Count === 0) {
    return res.status(500).json({
      error: `Il dispositivo ${device} non è assoicato ad alcun letto.`,
    });
  }

  taxCode = getRes.Items[0].ID_Patient;
  console.log("ID: ", taxCode);
  const getParamsThresholds = {
    TableName: PAT_DB,
    Key: { TaxCode: taxCode },
  };
  const getResTh = await docClient.send(new ScanCommand(getParamsThresholds));
  if (!getResTh && !getResTh.Count === 0) {
    return res.status(500).json({
      error: `Il paziente ${taxCode} non è registrato.`,
    });
  }

  thresholds = getResTh.Items[0];
  console.log(thresholds);

  minThresholdBloodPressure = thresholds.minThresholdBloodPressure;
  maxThresholdBloodPressure = thresholds.maxThresholdBloodPressure;
  minThresholdHeartRate = thresholds.minThresholdHeartRate;
  maxThresholdHeartRate = thresholds.maxThresholdHeartRate;

  // Gestione del controllo del buzzer del device
  if (
    bloodPressure < minThresholdBloodPressure ||
    bloodPressure > maxThresholdBloodPressure ||
    heartRate < minThresholdHeartRate ||
    heartRate > maxThresholdHeartRate
  ) {
    //sendAllarm(device, true);
    return true;
  } else {
    //sendAllarm(device, false);
    return false;
  }
}

server.on("message", (topic, payload) => {
  const device = topic.split("/")[2];
  const data = JSON.parse(payload.toString());

  // memorizza timestamp ultima letture del sensore
  let deviceTimestamp = data.state.reported["timestamp"];
  lastReadForDevice[device] = deviceTimestamp;

  // lettura dati sensori
  let heartRate = undefined;
  if (data && data.state.reported["heart-rate"] !== undefined)
    heartRate = data.state.reported["heart-rate"];

  let bloodPressure = undefined;
  if (data && data.state.reported["blood-pressure"] !== undefined)
    bloodPressure = data.state.reported["blood-pressure"];

  // aggiornamento in tempo reale history paziente
  if (!(device in avrgHistoryForDevice))
    avrgHistoryForDevice[device] = {
      "heart-rate": 0,
      "blood-pressure": 0,
      count: 0,
    };

  if (deviceTimestamp < endTimestamp) {
    avrgHistoryForDevice[device]["heart-rate"] += heartRate;
    avrgHistoryForDevice[device]["blood-pressure"] += bloodPressure;
    avrgHistoryForDevice[device]["count"] += 1;
  } else {
    const itemDate = new Date(startTimestamp * 1000) / 1000;
    const hours = itemDate.getHours().toString().padStart(2, "0");
    const minutes = itemDate.getMinutes().toString().padStart(2, "0");

    io.emit(`/device/${device}/param/HeartRate/history/updates`, {
      timestamp: `${hours}:${minutes}`,
      value: parseInt(
        avrgHistoryForDevice[device]["heart-rate"] /
          avrgHistoryForDevice[device]["count"]
      ),
    });
    io.emit(`/device/${device}/param/BloodPressure/history/updates`, {
      timestamp: `${hours}:${minutes}`,
      value: parseInt(
        avrgHistoryForDevice[device]["blood-pressure"] /
          avrgHistoryForDevice[device]["count"]
      ),
    });

    avrgHistoryForDevice[device]["heart-rate"] = 0;
    avrgHistoryForDevice[device]["blood-pressure"] = 0;
    avrgHistoryForDevice[device]["count"] = 0;
  }

  // ERRORE: se ci sono piu device, fai la media dei dati di tutti i device (avrgHR e avrgBP)
  io.emit(`/device/${device}/updates`, {
    device: device,
    heartRate: heartRate,
    heartRateAvg: Math.floor(avrgHR.addValue(heartRate)),
    bloodPressure: bloodPressure,
    bloodPressureAvg: Math.floor(avrgBP.addValue(bloodPressure)),
  });

  console.log(device);
  thresholdsControl(device, bloodPressure, heartRate);
});

// ****** REGISTRAZIONE ****** //
/////////////////////////////////

app.post("/api/signup", async (req, res) => {
  console.log("Entered signup!");
  // controlla della api /signup
  try {
    console.log(req.body);
    const { name, surname, taxCode, telegramUsername, password } = req.body; // dati ricevuti dal client

    // Controllo se l'utente è già candidato
    const appGetParams = {
      TableName: APP_DB,
      Key: { TaxCode: taxCode },
    };
    const getRes = await docClient.send(new GetCommand(appGetParams));
    if (getRes && getRes.Item) {
      return res.status(409).json({
        error: `L'utente "${taxCode}" ha già effettuato la candidatura.`,
      });
    }

    // Controllo se l'utente è già un dottore
    const docScanParams = {
      TableName: DOC_DB,
      FilterExpression: "#Att = :Val",
      ExpressionAttributeNames: { "#Att": "taxCode" },
      ExpressionAttributeValues: { ":Val": taxCode },
    };
    const scanRes = await docClient.send(new ScanCommand(docScanParams));
    if (scanRes.Items && scanRes.Items.length > 0) {
      return res.status(409).json({
        error: `L'utente "${taxCode}" è gia registrato come dottore!`,
      });
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

    io.emit("newApplicationRequest", {
      TaxCode: taxCode,
      name: name,
      surname: surname,
      telegramUsername: telegramUsername,
      password: password,
    });

    res.json({ message: `L'utente "${taxCode}" candidato con successo!` }); // registrazione conclusa senza errori
  } catch (error) {
    console.error(
      `Errore nella candidatura dell'utente "${taxCode}".\nCausa: `,
      error
    );
    return res
      .status(500)
      .json({ message: "Errore interno nella candidatura!" });
  }
});

// ****** ACCESSO ****** //
///////////////////////////

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body; // dati ricevuti dal client
  console.log(req.body);
  let role = email.split(".")[2];
  console.log(role);

  try {
    const logScanParams = {
      TableName: role === "doctor" ? DOC_DB : ADM_DB,
      FilterExpression: "#Att = :Val",
      ExpressionAttributeNames: { "#Att": "email" },
      ExpressionAttributeValues: { ":Val": email },
    };
    const scanRes = await docClient.send(new ScanCommand(logScanParams));
    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(404).json({ message: "Utente non trovato" });
    }

    // Se esiste, prendo il primo elemento
    const user = { ...scanRes.Items[0], role: role };

    // Verifico che la password sia la medesima
    if (user.password !== password) {
      return res.status(400).json({ message: "Password errata" });
    }
    // Restituisco stato di corretto accesso e i dati utente
    return res
      .status(200)
      .json({ message: "Login effettuato correttamente", user });
  } catch (error) {
    console.error("Errore nel login: ", error);
    return res.status(500).json({
      message: "Errore interno nel controllo dell'utente su DynamoDB",
    });
  }
});

// ****** ADMIN DASHBOARD ****** //
///////////////////////////////////

async function getDoctorsPatients(doctor) {
  scanParams = {
    TableName: REC_DB,
    FilterExpression: "doctor = :doc AND end_timestamp = :open",
    ExpressionAttributeValues: {
      ":doc": doctor,
      ":open": -1,
    },
  };
  const scanRes = await docClient.send(new ScanCommand(scanParams));
  return scanRes.Count;
}

app.get("/api/doctors", async (req, res) => {
  try {
    const scanRes = await docClient.send(
      new ScanCommand({ TableName: DOC_DB })
    );

    const data = [];

    for (let doc of scanRes.Items) {
      let count = await getDoctorsPatients(doc.Doctor_Prefix + doc.Doctor_ID);
      data.push({ ...doc, patients: count });
    }

    res.json(data);
  } catch (error) {
    console.error("Errore nello scan del DB: ", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/patients", async (req, res) => {
  try {
    const params = {
      TableName: REC_DB,
      FilterExpression: "end_timestamp = :open",
      ExpressionAttributeValues: { ":open": -1 },
    };

    const scanRes = await docClient.send(new ScanCommand(params));

    res.json(scanRes.Items);
  } catch (error) {
    console.error("Errore nello scan del DB: ", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/patient/:id/doctor", async (req, res) => {
  try {
    taxCode = req.params.id;
    start_ts = req.body.start_ts;
    const updateParams = {
      TableName: REC_DB,
      Key: {
        TaxCode: taxCode,
        start_timestamp: start_ts,
      },
      UpdateExpression: "SET doctor = :newDoc",
      ExpressionAttributeValues: {
        ":newDoc": req.body.doctor,
      },
      ReturnValues: "ALL_NEW",
    };

    const updateDoc = await docClient.send(new UpdateCommand(updateParams));

    return res.json({
      message: `Dottore del paziente "${taxCode}" aggiornato con successo.`,
    });
  } catch (error) {
    console.error("Errore nell'update del DB: ", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/patient/:id/release", async (req, res) => {
  try {
    const taxCode = req.params.id;
    console.log("release: ", taxCode);

    const queryParams = {
      TableName: REC_DB,
      KeyConditionExpression: "TaxCode = :tax",
      ExpressionAttributeValues: { ":tax": taxCode },
      ScanIndexForward: false,
      Limit: 1,
    };
    const { Items = [] } = await docClient.send(new QueryCommand(queryParams));
    const lastRec = Items[0];
    if (!lastRec || lastRec.end_timestamp !== -1) {
      return res.status(409).json({
        error: `Nessun ricovero aperto per il paziente "${taxCode}".`,
      });
    }

    const deleteResult = await docClient.send(
      new DeleteCommand({ TableName: PAT_DB, Key: { TaxCode: taxCode } })
    );

    const updateParamsBed = {
      TableName: BED_DB,
      Key: {
        ID_Bed: lastRec.bed,
      },
      UpdateExpression: "SET ID_Patient = :open",
      ExpressionAttributeValues: {
        ":open": "-1",
      },
      ReturnValues: "ALL_NEW",
    };

    const updateBed = await docClient.send(new UpdateCommand(updateParamsBed));

    const now = Date.now();
    const updateParams = {
      TableName: REC_DB,
      Key: {
        TaxCode: taxCode,
        start_timestamp: lastRec.start_timestamp,
      },
      UpdateExpression: "SET end_timestamp = :ts",
      ConditionExpression: "end_timestamp = :open",
      ExpressionAttributeValues: {
        ":ts": now,
        ":open": -1,
      },
      ReturnValues: "ALL_NEW",
    };

    const update = await docClient.send(new UpdateCommand(updateParams));

    return res.json({
      message: `Paziente "${taxCode}" dimesso con successo.`,
      end_timestamp: update.end_timestamp,
    });
  } catch (error) {
    console.error("Errore nello scan del DB: ", error);
    res.status(500).json({ error: error.message });
  }
});

// ****** ADMIN MANAGEMENT ****** //
////////////////////////////////////

// ****** CANDIDATURE ****** //
///////////////////////////////

async function getApplicationRequests() {
  let items = [];
  let lastEvaluatedKey = undefined;
  try {
    do {
      const appScanParams = {
        TableName: APP_DB,
        ExclusiveStartKey: lastEvaluatedKey,
      };
      const data = await docClient.send(new ScanCommand(appScanParams));
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
    res.status(500).send("Errore durante il recupero delle richieste.");
  }
});

app.post("/api/application/:id/reject", async (req, res) => {
  try {
    const taxCode = req.params.id;

    const appScanParams = {
      TableName: APP_DB,
      FilterExpression: "#Att = :Val",
      ExpressionAttributeNames: { "#Att": "TaxCode" },
      ExpressionAttributeValues: { ":Val": taxCode },
    };
    const scanRes = await docClient.send(new ScanCommand(appScanParams));
    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(404).json({ error: "Candidatura non trovata." });
    }

    const application = scanRes.Items[0];

    const refuse = {
      TableName: APP_DB,
      Key: { TaxCode: application.TaxCode },
      ReturnValues: "ALL_OLD",
    };
    const delRes = await docClient.send(new DeleteCommand(refuse));
    if (!delRes.Attributes) {
      return res.status(404).json({ error: "Candidatura non trovata." });
    }

    return res
      .status(200)
      .json({ message: "Candidatura rifiutata con successo." });
  } catch (error) {
    console.error("Errore nel rifiuto candidatura: ", error);
    return res.status(500).json({ message: "Errore interno." });
  }
});

app.post("/api/application/:id/accept", async (req, res) => {
  try {
    const taxCode = req.params.id;

    const appScanParams = {
      TableName: APP_DB,
      FilterExpression: "#Att = :Val",
      ExpressionAttributeNames: { "#Att": "TaxCode" },
      ExpressionAttributeValues: { ":Val": taxCode },
    };
    const scanRes = await docClient.send(new ScanCommand(appScanParams));
    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(404).json({ error: "Candidatura non trovata." });
    }

    const { name, surname } = scanRes.Items[0];
    console.log(name, surname);
    const userPrefix = name.toLowerCase()[0] + "." + surname.toLowerCase();

    const params = {
      TableName: "AppliedDoctors",
      KeyConditionExpression: "Doctor_Prefix = :prefix",
      ExpressionAttributeValues: {
        ":prefix": userPrefix,
      },
      Select: "COUNT",
    };

    const result = await docClient.send(new QueryCommand(params));
    const userID = result.Count + 1;

    // rimuovi la richiesta e aggiungi l'utente nella tabella dottori
    const application = scanRes.Items[0];

    const delParams = {
      TableName: APP_DB,
      Key: { TaxCode: application.TaxCode },
      ReturnValues: "ALL_OLD",
    };
    const delRes = await docClient.send(new DeleteCommand(delParams));
    if (!delRes.Attributes) {
      return res.status(404).json({ error: "Elemento non trovato" });
    }

    const newDoc = {
      TableName: DOC_DB,
      Item: {
        Doctor_Prefix: userPrefix,
        Doctor_ID: userID,
        taxCode: application.TaxCode,
        email: userPrefix + userID + "@hm.doctor.it",
        name: application.name,
        surname: application.surname,
        telegramUsername: application.telegramUsername,
        password: application.password,
      },
    };

    await docClient.send(new PutCommand(newDoc));

    return res.status(200).json({
      message: "Nuovo dottore accettato!",
      doctor: {
        Doctor_Prefix: userPrefix,
        Doctor_ID: userID,
        taxCode: application.TaxCode,
        email: userPrefix + userID + "@hm.doctor.it",
        name: application.name,
        surname: application.surname,
        telegramUsername: application.telegramUsername,
        password: application.password,
        patients: 0,
      },
    });
  } catch (error) {
    console.error("Errore nell'accettazione candidatura: ", error);
    return res.status(500).json({ message: "Errore interno." });
  }
});

// ****** AGGIUNTA PAZIENTE ****** //
/////////////////////////////////////

app.post("/api/addPatient", async (req, res) => {
  try {
    console.log(req.body);
    const { name, surname, TaxCode, bed, doctor } = req.body; // dati ricevuti dal client

    // PRENDO L'ULTIMO RICOVERO APERTO DEL PAZIENTE INDICATO (SE ESISTE)
    const queryParams = {
      TableName: REC_DB,
      KeyConditionExpression: "TaxCode = :tax",
      ExpressionAttributeValues: { ":tax": TaxCode },
      ScanIndexForward: false,
      Limit: 1,
    };
    const { Items = [] } = await docClient.send(new QueryCommand(queryParams));
    const lastRec = Items[0];
    if (lastRec && lastRec.end_timestamp === -1) {
      return res.status(409).json({
        message: `Il paziente "${TaxCode}" risulta già ricoverato.`,
      });
    }

    // SE NON E' ATTUALMENTE RICOVERATO

    // crea threshold paziente
    await docClient.send(
      new PutCommand({
        TableName: PAT_DB,
        Item: {
          TaxCode: TaxCode,
          minThresholdHeartRate: 50,
          maxThresholdHeartRate: 150,
          minThresholdBloodPressure: 50,
          maxThresholdBloodPressure: 150,
        },
      })
    );

    // AGGIORNO IL LETTO SELEZIONATO COME ASSOCIATO AL PAZIENTE
    const updateParams = {
      TableName: BED_DB,
      Key: {
        ID_Bed: bed,
      },
      UpdateExpression: "SET ID_Patient = :tc",
      ConditionExpression:
        "attribute_not_exists(ID_Patient) OR ID_Patient = :open",
      ExpressionAttributeValues: {
        ":tc": TaxCode,
        ":open": "-1",
      },
      ReturnValues: "ALL_NEW",
    };
    const update = await docClient.send(new UpdateCommand(updateParams));

    // INSERISCO IL NUOVO RICOVERO DEL PAZIENTE
    const startTs = Date.now().toString();
    const newPat = {
      TableName: REC_DB,
      Item: {
        TaxCode: TaxCode,
        start_timestamp: startTs,
        end_timestamp: -1,
        name: name,
        surname: surname,
        bed: bed,
        doctor: doctor,
      },
      // Evita inserimenti duplicati con PK+SK identici
      ConditionExpression:
        "attribute_not_exists(TaxCode) AND attribute_not_exists(start_timestamp)",
    };
    await docClient.send(new PutCommand(newPat));

    res.json({
      message: `Ricovero del paziente "${TaxCode}" registrato con successo!`,
    }); // registrazione conclusa senza errori
  } catch (error) {
    console.error("Errore nell'aggiunta del paziente al DB': ", error);
    res.status(500).json({ error: error.message });
  }
});

// ****** CATALOGO LETTI ****** //
//////////////////////////////////

app.get("/api/bedrooms", async (req, res) => {
  try {
    const params = {
      TableName: BED_DB,
      FilterExpression: "ID_Patient = :free",
      ExpressionAttributeValues: { ":free": "-1" },
    };

    const { Items = [] } = await docClient.send(new ScanCommand(params));
    res.json(Items);
  } catch (error) {
    console.error("Errore nello scan del DB:", error);
    res.status(500).json({ error: error.message });
  }
});

// ****** RICOVERI ****** //
////////////////////////////

async function getRicoveries() {
  try {
    const recScanParams = {
      TableName: REC_DB,
      FilterExpression: "#Att = :Val",
      ExpressionAttributeNames: { "#Att": "end_timestamp" },
      ExpressionAttributeValues: { ":Val": "-1" },
    };

    const scanRes = await docClient.send(new ScanCommand(recScanParams));

    const patientCodes = scanRes.Items.map((item) => item.patientId);

    if (!patientCodes.length) {
      return [];
    }

    const uniquePatientCodes = [...new Set(patientCodes)];

    const patBatchGetParams = {
      RequestItems: {
        PatientData: {
          Keys: uniquePatientCodes.map((taxCode) => ({ taxCode })),
        },
      },
    };

    const batchGetRes = await docClient.send(
      new BatchGetCommand(patBatchGetParams)
    );

    return batchGetRes.Responses[REC_DB] || [];
  } catch (error) {
    console.error("Errore durante il recupero dei pazienti ricoverati:", error);
    throw error;
  }
}

app.post("/api/recoveries", async (req, res) => {
  try {
    const requests = await getRicoveries();
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).send("Errore durante il recupero dei ricoveri.");
  }
});

// ****** DOCTOR DASHBOARD ****** //
////////////////////////////////////

app.get("/api/doctor/:id/patients", async (req, res) => {
  let doctorID = req.params.id;

  try {
    const command = new ScanCommand({
      TableName: REC_DB,
      FilterExpression: "doctor = :id AND end_timestamp = :recovered",
      ExpressionAttributeValues: {
        ":id": doctorID,
        ":recovered": -1,
      },
    });

    const result = await docClient.send(command);
    const data = {};

    for (let patient of result.Items) {
      const paramsDevice = new GetCommand({
        TableName: BED_DB,
        Key: { ID_Bed: patient.bed },
      });

      const deviceResult = await docClient.send(paramsDevice);

      const { TaxCode, ...rest } = patient;
      data[TaxCode] = { ...rest, device: deviceResult.Item?.ID_Dev };
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send("Errore durante il recupero dei pazienti.");
  }
});

// ****** PATIENT CARD ****** //
////////////////////////////////

app.get("/api/patient/:id/thresholds/:param", async (req, res) => {
  const taxCode = req.params.id;
  const param = req.params.param;

  if (param !== "HeartRate" && param !== "BloodPressure")
    return res.status(400).json({
      message: `Richiesta non valida, "${param}" non e' un parametro valido`,
    });

  try {
    const patientParams = new GetCommand({
      TableName: PAT_DB,
      Key: { TaxCode: taxCode },
    });
    const patient = await docClient.send(patientParams);

    if (!patient.Item || patient.Item.length === 0) {
      return res.status(404).json({ error: "Paziente non trovato." });
    }

    const data = [
      patient.Item[`minThreshold${param}`],
      patient.Item[`maxThreshold${param}`],
    ];

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send("Errore durante il recupero delle soglie");
  }
});

app.post("/api/patient/:id/thresholds/:param", async (req, res) => {
  const taxCode = req.params.id;
  const param = req.params.param;

  if (param !== "HeartRate" && param !== "BloodPressure")
    return res.status(400).json({
      message: `Richiesta non valida, "${param}" non e' un parametro valido`,
    });

  try {
    const patientParams = new GetCommand({
      TableName: PAT_DB,
      Key: { TaxCode: taxCode },
    });
    const patient = await docClient.send(patientParams);

    if (!patient.Item || patient.Item.length === 0) {
      return res.status(404).json({ error: "Paziente non trovato." });
    }

    const updateThresholdsParams = {
      TableName: PAT_DB,
      Key: {
        TaxCode: taxCode,
      },
      UpdateExpression: "SET #min = :min, #max = :max",
      ExpressionAttributeNames: {
        "#min": `minThreshold${param}`,
        "#max": `maxThreshold${param}`,
      },
      ExpressionAttributeValues: {
        ":min": req.body.minThreshold,
        ":max": req.body.maxThreshold,
      },
      ReturnValues: "ALL_NEW",
    };

    await docClient.send(new UpdateCommand(updateThresholdsParams));

    res.status(200).json({ message: "Thresholds aggiornate con successo" });
  } catch (error) {
    res.status(500).send("Errore durante l'aggiornamento delle soglie");
  }
});

function groupData(data, param, time) {
  const buckets = {};
  const factor = time * 60 * 1000;

  for (const item of data) {
    const ts = item.timestamp;
    const rounded = Math.floor(ts / factor) * factor;

    if (!buckets[rounded]) {
      buckets[rounded] = { sum: 0, count: 0 };
    }

    buckets[rounded].sum += item[param];
    buckets[rounded].count += 1;
  }

  const result = {};
  for (const [timestamp, { sum, count }] of Object.entries(buckets)) {
    const itemDate = new Date(Number(timestamp));
    const hours = itemDate.getHours().toString().padStart(2, "0");
    const minutes = itemDate.getMinutes().toString().padStart(2, "0");
    const key = `${hours}:${minutes}`;
    result[key] = Math.floor(sum / count);
  }

  return result;
}

app.get(
  "/api/device/:id/param/:param/history/:selectedDate",
  async (req, res) => {
    const device = req.params.id;
    const param = req.params.param;
    const date = req.params.selectedDate;

    if (param !== "HeartRate" && param !== "BloodPressure")
      return res.status(400).json({
        message: `Richiesta non valida, "${param}" non e' un parametro valido`,
      });

    const from = new Date(`${date}T00:00`).getTime() / 1000;
    const to = new Date(`${date}T23:59:59`).getTime() / 1000;

    try {
      const params = {
        TableName: DEV_DB,
        KeyConditionExpression: "ID = :id AND #ts BETWEEN :from AND :to",
        ExpressionAttributeNames: {
          "#ts": "timestamp",
        },
        ExpressionAttributeValues: {
          ":id": device,
          ":from": from,
          ":to": to,
        },
      };

      const result = await docClient.send(new QueryCommand(params));

      const paramAttr = {
        HeartRate: "heart_rate",
        BloodPressure: "blood_pressure",
      };
      const data = groupData(result.Items, paramAttr[param], 5);

      res.status(200).json(data);
    } catch (error) {
      res.status(500).send("Errore durante il recupero dei dati del sensore");
    }
  }
);

app.listen(process.env.SERVER_PORT, () => {
  console.log(`Server running on port ${process.env.SERVER_PORT}`);
});
