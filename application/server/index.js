//import { createRequire } from 'node:module';
//const require = createRequire(import.meta.url);
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
const ALL_DB = "AlarmHistoryData";

const server = awsIot.device({
  keyPath: process.env.AWS_CERT_KEY,
  certPath: process.env.AWS_CERT_CRT,
  caPath: process.env.AWS_CERT_CA,
  clientId: process.env.AWS_THING_NAME,
  host: process.env.AWS_IOT_ENDPOINT,
});

const TelegramBot = require('node-telegram-bot-api');

const token  = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (messageText === '/start') {
    bot.sendMessage(chatId, `Welcome to the bot!`);
  }
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
  console.log(startTimestamp, endTimestamp);
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

function sendAlarm(device, state) {
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
    if (this.values.length > this.size) this.values.shift();
  }

  getAvrg() {
    return parseInt(
      this.values.reduce((acc, val) => acc + val, 0) / this.values.length
    );
  }
}

let avrgSampleSize = 30;
let deviceAvrg = {};

const lastReadForDevice = {};
const avrgHistoryForDevice = {};

// ****** CONTROLLO SOGLIE D'ALLARME ****** //
//////////////////////////////////////////////

const deviceAlarm = {};

async function thresholdsControl(device, bloodPressure, heartRate) {
  try {
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

    let taxCode = getRes.Items[0].ID_Patient;
    const getParamsThresholds = {
      TableName: PAT_DB,
      Key: { TaxCode: taxCode },
    };
    const getResTh = await docClient.send(new GetCommand(getParamsThresholds));
    if (!getResTh && !getResTh.Item) {
      return res.status(500).json({
        error: `Il paziente ${taxCode} non è registrato.`,
      });
    }

    const {
      minThresholdBloodPressure,
      maxThresholdBloodPressure,
      minThresholdHeartRate,
      maxThresholdHeartRate,
    } = getResTh.Item;

    return {
      "Pressione Sanguigna": {
        minThreshold: minThresholdBloodPressure,
        maxThreshold: maxThresholdBloodPressure,
        alarm:
          bloodPressure < minThresholdBloodPressure ||
          bloodPressure > maxThresholdBloodPressure,
      },
      "Battito Cardiaco": {
        minThreshold: minThresholdHeartRate,
        maxThreshold: maxThresholdHeartRate,
        alarm:
          heartRate < minThresholdHeartRate || heartRate > maxThresholdHeartRate,
      },
    };
  } catch (error) {
    return undefined;
  }
}

// ****** RICEZIONE DATI MQTT ****** //
///////////////////////////////////////

async function getPatientByDevice(device) {
  const params = {
    TableName: BED_DB,
    FilterExpression: "ID_Dev = :dev",
    ExpressionAttributeValues: {
      ":dev": device,
    },
  };
  const scanRes = await docClient.send(new ScanCommand(params));
  return scanRes.Items[0].ID_Patient;
}

async function getDoctorByID(doctor) {

  const pref = doctor.slice(0, -1)
  const id = Number(doctor[doctor.length - 1]);

  const params2 = {
    TableName: DOC_DB,
    Key: { Doctor_Prefix: pref, Doctor_ID: id },
  };
  const getRes2 = await docClient.send(new GetCommand(params2));
  return getRes2.Item;
}

async function getPatientByID(patient) {
  const params = {
    TableName: REC_DB,
    FilterExpression: "TaxCode = :tc AND end_timestamp = :open",
    ExpressionAttributeValues: { ":tc": patient, ":open": -1 },
  };
  const scanRes = await docClient.send(new ScanCommand(params));

  return scanRes.Items[0];
}

const is_active = {};
const timeoutHandle = {};

server.on("message", async (topic, payload) => {
  const device = topic.split("/")[2];
  const data = JSON.parse(payload.toString());

  last_read_timestamp = Date.now();

  if ((device in is_active) && !is_active[device]) io.emit(`/device/changeStatus`, { device: device, state: true });
  is_active[device] = true;

  patient = await getPatientByDevice(device);
  if (patient === "-1") return;

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

  if (!(device in deviceAvrg))
    deviceAvrg[device] = {
      "Pressione Sanguigna": new ReadingsAverage(avrgSampleSize),
      "Battito Cardiaco": new ReadingsAverage(avrgSampleSize),
    };

  deviceAvrg[device]["Pressione Sanguigna"].addValue(bloodPressure);
  deviceAvrg[device]["Battito Cardiaco"].addValue(heartRate);

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
    const itemDate = new Date(startTimestamp * 1000);
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

    startTimestamp = endTimestamp;
    endTimestamp = new Date(
      startTimestamp + historyMinutesGroup * 60
    ).getTime();
    console.log(startTimestamp, endTimestamp);
    console.log(new Date(startTimestamp * 1000), new Date(endTimestamp * 1000));
  }

  io.emit(`/device/${device}/updates`, {
    device: device,
    heartRate: heartRate,
    heartRateAvg: deviceAvrg[device]["Battito Cardiaco"].getAvrg(),
    bloodPressure: bloodPressure,
    bloodPressureAvg: deviceAvrg[device]["Pressione Sanguigna"].getAvrg(),
  });

  // CONTROLLO SOGLIE
  const alarmFlag = await thresholdsControl(
    device,
    deviceAvrg[device]["Pressione Sanguigna"].getAvrg(),
    deviceAvrg[device]["Battito Cardiaco"].getAvrg()
  );

  if (!(device in deviceAlarm))
    deviceAlarm[device] = {
      "Pressione Sanguigna": {
        state: false,
        start: undefined,
      },
      "Battito Cardiaco": {
        state: false,
        start: undefined,
      },
      lastState: false,
    };

  let lastStartTime = -1;
  let alarmState = false;

  if (!alarmFlag) return;

  patient_id = await getPatientByDevice(device);
  patient = await getPatientByID(patient_id);
  doctor = await getDoctorByID(patient.doctor);

  for (let param in alarmFlag) {
    if (deviceAlarm[device][param].state && !alarmFlag[param].alarm) {
      deviceAlarm[device][param].state = false;
      console.log(param, "disattiva allarme");

      const updateParams = {
        TableName: ALL_DB,
        Key: {
          ID: device,
          start_timestamp: deviceAlarm[device][param].start,
        },
        UpdateExpression: "SET end_timestamp = :end",
        ExpressionAttributeValues: {
          ":end": Math.floor(Date.now() / 1000),
        },
        ReturnValues: "ALL_NEW",
      };

      const updateAlarm = await docClient.send(new UpdateCommand(updateParams));

      bot.sendMessage(doctor.telegramUsername, `Comunicazione d'allarme!\n\
Il paziente associato al dispositivo <${device}> è tornato entro le soglie di salute di <${param}>.`);

      io.emit(`/device/emergencies/end`, updateAlarm.Attributes);
    } else if (!deviceAlarm[device][param].state && alarmFlag[param].alarm) {
      console.log(param, "attiva allarme");
      deviceAlarm[device][param].state = true;
      deviceAlarm[device][param].start = Math.floor(Date.now() / 1000);

      // evita che si abbia la stessa chiave [device, timestamp]
      if (deviceAlarm[device][param].start === lastStartTime)
        ++deviceAlarm[device][param].start;
      lastStartTime = deviceAlarm[device][param].start;

      const putParams = {
        TableName: ALL_DB,
        Item: {
          ID: device,
          start_timestamp: deviceAlarm[device][param].start,
          end_timestamp: -1,
          param: param,
          avrg: deviceAvrg[device][param].getAvrg(),
          minThreshold: alarmFlag[param].minThreshold,
          maxThreshold: alarmFlag[param].maxThreshold,
        },
      };

      await docClient.send(new PutCommand(putParams));
      bot.sendMessage(doctor.telegramUsername, `Comunicazione d'allarme!\n\
Il paziente associato al dispositivo <${device}> ha superato la soglia d'allarme di <${param}>.`);

      io.emit(`/device/emergencies/start`, { device: device, param: param });
    }

    alarmState ||= deviceAlarm[device][param].state;
  }

  if (alarmState !== deviceAlarm[device].lastState) {
    console.log(`[${device}]: ${alarmState ? "attiva" : "disattiva"} allarme`);
    sendAlarm(device, alarmState);
    deviceAlarm[device].lastState = alarmState;
  }

  // controllo se dispositivo attivo o meno
  if (timeoutHandle[device]) clearTimeout(timeoutHandle[device]);

  // Imposto un nuovo timeout per controllare inattività
  timeoutHandle[device] = setTimeout(() => {
    const now = parseInt(Date.now() / 1000);
    if (now - lastReadForDevice[device] >= 10) {
      is_active[device] = false;
      console.log("Nessun messaggio ricevuto negli ultimi 10 secondi. Flag impostata a false.");
      io.emit(`/device/changeStatus`, { device: device, state: false });
    }
  }, 10000);
  
});
app.get("/api/doctor/:id/device_state", async (req, res) =>{
  const doctor = req.params.id;

  try {
    const recRes = await docClient.send(
      new ScanCommand({
        TableName: REC_DB,
        FilterExpression: "doctor = :doc AND end_timestamp = :open",
        ExpressionAttributeValues: { ":doc": doctor, ":open": -1 },
        ProjectionExpression: "bed",
      })
    );
    const beds = recRes.Items;
    if (beds.length === 0) return res.status(200).json({});
  
    // recupero device associati ai letti
    const bedsBatch = beds.map((item) => {
      return {
        ID_Bed: item.bed,
      };
    });
    const bedRes = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [BED_DB]: {
            Keys: bedsBatch,
            ProjectionExpression: "ID_Dev",
          },
        },
      })
    );
    const deviceItems = bedRes.Responses[BED_DB];
    if (deviceItems.length === 0) return res.status(200).json({});
    
    const data = {}; 
    deviceItems.forEach(item => { data[item.ID_Dev] = is_active[item.ID_Dev] });
  
    res.json(data); // registrazione conclusa senza errori

  } catch (error) {
    console.error("Problema controllo dello stato del device: ", error);
  }
});


// ****** APIS INTERFACCIA UTENTE ****** //
///////////////////////////////////////////

// ****** REGISTRAZIONE ****** //
/////////////////////////////////

app.post("/api/signup", async (req, res) => {
  console.log("Entered signup!");
  // controlla della api /signup
  try {
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
  let role = email.split(".")[2];

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

async function getDeviceByPatient(patient) {
  const params = {
    TableName: BED_DB,
    FilterExpression: "ID_Patient = :tc",
    ExpressionAttributeValues: {
      ":tc": patient,
    },
  };
  const scanRes = await docClient.send(new ScanCommand(params));

  return scanRes.Items[0].ID_Dev;
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

    const data = [];
    for (let p of scanRes.Items) {
      let dev = await getDeviceByPatient(p.TaxCode);
      data.push({ ...p, device: dev });
    }

    res.json(data);
  } catch (error) {
    console.error("Errore nello scan del DB: ", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/patient/:id/doctor", async (req, res) => {
  try {
    taxCode = req.params.id;
    start_ts = req.body.start_ts;
    newDoc = req.body.doctor;
    prevDoc = req.body.prev_doctor;

    const updateParams = {
      TableName: REC_DB,
      Key: {
        TaxCode: taxCode,
        start_timestamp: start_ts,
      },
      UpdateExpression: "SET doctor = :newDoc",
      ExpressionAttributeValues: {
        ":newDoc": newDoc,
      },
      ReturnValues: "ALL_NEW",
    };

    await docClient.send(new UpdateCommand(updateParams));

    patient = await getPatientByID(taxCode);

    doctor = await getDoctorByID(newDoc);
    prev = await getDoctorByID(prevDoc);

    bot.sendMessage(doctor.telegramUsername, `Comunicazione!\n\
Ti è stato assegnato un nuovo paziente.`);

    bot.sendMessage(prev.telegramUsername, `Comunicazione!\n\
Il paziente a tuo carico:\n Nome: ${patient.name};\n Cognome: ${patient.surname};\n ID: ${patient.TaxCode};\nè stato riassegnato al dottor: ${newDoc}.`);
      

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
    await docClient.send( new DeleteCommand({ TableName: PAT_DB, Key: { TaxCode: taxCode } }) );

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
    await docClient.send(new UpdateCommand(updateParamsBed));

    const now = parseInt(Date.now() / 1000);
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

    let doctor = await GetDoctorByID(req.body.doc_id);
    
    bot.sendMessage(doctor.telegramUsername, `Comunicazione!\n\
Il paziente a tuo carico:\n Nome: ${lastRec.name};\n Cognome: ${lastRec.surname};\n ID: ${lastRec.TaxCode};\nè stato rilasciato.`);

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

    bot.sendMessage(application.telegramUsername, "La tua richiesta di candidatura è stata rifiutata.\nCordiali saluti.");

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

    bot.sendMessage(application.telegramUsername, "La tua candidatura è andata a buon fine!\n\
Di seguito ti verranno comunicate tutte le notifiche relative ai pazienti a tuo carico.");

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
    await docClient.send(new UpdateCommand(updateParams));

    // INSERISCO IL NUOVO RICOVERO DEL PAZIENTE
    const startTs = parseInt(Date.now() / 1000);
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


    doc = await GetDoctorByID(doctor);
    bot.sendMessage(doc.telegramUsername, "Ti è stato assegnato un nuovo paziente!\n\
Visualizza i suoi dati dall'applicazione.");

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
  const factor = time * 60;

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
    const itemDate = new Date(Number(timestamp) * 1000);
    const hours = itemDate.getHours().toString().padStart(2, "0");
    const minutes = itemDate.getMinutes().toString().padStart(2, "0");
    const key = `${hours}:${minutes}`;
    result[key] = Math.floor(sum / count);
  }

  return result;
}

app.post(
  "/api/device/:id/param/:param/history/:selectedDate",
  async (req, res) => {
    const device = req.params.id;
    const param = req.params.param;
    const date = req.params.selectedDate;
    const start_ts = req.body.start_ts

    if (param !== "HeartRate" && param !== "BloodPressure")
      return res.status(400).json({
        message: `Richiesta non valida, "${param}" non e' un parametro valido`,
      });

    const endOfTheDay = new Date(`${date}T23:59:59`).getTime() / 1000;
    let from = new Date(`${date}T00:00`).getTime() / 1000;
    const to = Math.min(endOfTheDay, startTimestamp - 1);

    if ( start_ts > from ) from = start_ts;

    if (to < from) {
      return res.status(200).json({});
    }
    

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

app.post("/api/device/:id/emergencies", async (req, res) => {
  let device = req.params.id;
  let start_ts = Number(req.body.start_timestamp);

  try {
    const params = {
      TableName: ALL_DB,
      KeyConditionExpression: "ID = :id AND start_timestamp >= :ts",
      FilterExpression: "end_timestamp <> :end",
      ExpressionAttributeValues: {
        ":id": device,
        ":ts": start_ts,
        ":end": -1,
      },
      ScanIndexForward: false,
    };

    const result = await docClient.send(new QueryCommand(params));

    res.status(200).json(result.Items);
  } catch (error) {
    res
      .status(500)
      .send("Errore durante il recupero del registro delle emergenze");
  }
});

app.get("/api/doctor/:id/emergencies", async (req, res) => {
  const doctor = req.params.id;

  try {
    const recRes = await docClient.send(
      new ScanCommand({
        TableName: REC_DB,
        FilterExpression: "doctor = :doc AND end_timestamp = :open",
        ExpressionAttributeValues: { ":doc": doctor, ":open": -1 },
        ProjectionExpression: "bed",
      })
    );
    const beds = recRes.Items;
    if (beds.length === 0) return res.status(200).json({});

    // recupero device associati ai letti
    const bedsBatch = beds.map((item) => {
      return {
        ID_Bed: item.bed,
      };
    });
    const bedRes = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [BED_DB]: {
            Keys: bedsBatch,
          },
        },
      })
    );
    const bedItems = bedRes.Responses[BED_DB];
    if (bedItems.length === 0) return res.status(200).json({});

    const deviceToPatient = {};
    for (const { ID_Dev, ID_Patient } of bedItems) {
      if (ID_Dev && ID_Patient) {
        deviceToPatient[ID_Dev] = ID_Patient;
      }
    }

    // per ogni device, recupera le emrgenze non ancora concluse
    const openRecords = {};
    for (const device of Object.keys(deviceToPatient)) {
      let LastEvaluatedKey;
      do {
        const allRes = await docClient.send(
          new QueryCommand({
            TableName: ALL_DB,
            KeyConditionExpression: "ID = :dev",
            FilterExpression: "end_timestamp = :open",
            ExpressionAttributeValues: {
              ":dev": device,
              ":open": -1,
            },
            ProjectionExpression: "param",
            ExclusiveStartKey: LastEvaluatedKey,
          })
        );

        if (allRes.Items.length) {
          const taxCodePatient = deviceToPatient[device];
          openRecords[taxCodePatient] = allRes.Items.map((item) => item.param);
        }

        LastEvaluatedKey = allRes.LastEvaluatedKey;
      } while (LastEvaluatedKey);
    }

    res.status(200).json(openRecords);
  } catch (error) {
    console.error(error);
    res.status(500).send("Errore nel recupero delle emergenze");
  }
});

app.listen(process.env.SERVER_PORT, () => {
  console.log(`Server running on port ${process.env.SERVER_PORT}`);
});
