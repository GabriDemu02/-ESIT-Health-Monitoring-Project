import React, { useEffect, useState } from "react";
import "./ParameterDashboard.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { faEdit } from "@fortawesome/free-solid-svg-icons";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import styled from "styled-components";
import io from "socket.io-client";
import axios from "axios";

const socket = io(process.env.REACT_APP_SOCKET_URL);

function Measurement({ label, value, children }) {
  return (
    <div className="parameter-dashboard-measurement">
      <div>
        <div
          className="flex h-center v-center"
          style={{
            width: "20px",
            height: "20px",
          }}
        >
          {children}
        </div>
        {label && <div>{label}</div>}
      </div>
      <div>{value}</div>
    </div>
  );
}

function TrendLine({ value, color, size, min, max }) {
  const limit = 40;
  const width = size;
  const height = size;

  const [linePoints, setLinePoints] = useState(Array(limit).fill(0));

  useEffect(() => {
    const interval = setInterval(() => {
      setLinePoints((prevState) => [...prevState.slice(1), value]);
    }, 20);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <div style={{ display: "flex", width: size, height: size }}>
      <svg width={width} height={height}>
        {[0.25, 0.5, 0.75].map((y) => (
          <line
            key={y}
            x1={0}
            x2={width}
            y1={y * height}
            y2={y * height}
            style={{
              fill: "none",
              stroke: "var(--font-color-x-transparent)",
              strokeWidth: 1,
            }}
          />
        ))}

        <polyline
          style={{
            fill: "none",
            stroke: color,
            strokeWidth: 2,
            strokeLinejoin: "round",
          }}
          points={linePoints.map(
            (linePoint, i) =>
              `${i * (width / (limit - 1))},${
                height - ((linePoint - min) / (max - min)) * height
              } `
          )}
        />
      </svg>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, data }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: "#fff",
          padding: "4px 8px",
          borderRadius: "4px",
          boxShadow: "0 4px 6px #1229420f",
        }}
      >
        <b>
          <span style={{ fontSize: "18px" }}>{payload[0].value}</span>
          <span style={{ fontSize: "10px" }}>{data.unit}</span>
        </b>
        <span style={{ fontSize: "12px", opacity: 0.4, marginLeft: "8px" }}>
          {label}
        </span>
      </div>
    );
  }
  return null;
};

const generateTimeTicks = () => {
  const ticks = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      const hour = h.toString().padStart(2, "0");
      const minute = m.toString().padStart(2, "0");
      ticks.push(`${hour}:${minute}`);
    }
  }
  return ticks;
};

const ticks = generateTimeTicks();

const ThresholdsSlider = styled(Slider)`
  width: 16px;

  .rc-slider-track {
    background-color: var(--blue-color);
    width: 8px;
    border-radius: 0;
    left: 4px;
  }

  .rc-slider-rail {
    background-color: var(--font-color-xx-transparent);
    width: 8px;
    left: 4px;
  }

  .rc-slider-handle {
    width: 8px;
    height: 8px;
    background: ${(props) => props.handlesColor};
    outline: ${(props) =>
      props.active ? "4px solid var(--blue-color)" : "none"};
    border: none;
    opacity: 1;
    margin-left: -1px;
  }
`;

function ParameterDashboard({
  patients,
  selectedPatient,
  parameter,
  parameterID,
  unit,
  color,
  icon,
  value,
  avg,
  minThreshold,
  maxThreshold,
}) {
  const [thresholds, setThresholds] = useState();
  const [history, setHistory] = useState([]);

  const [editThresholds, setEditThresholds] = useState(false);
  const [newThresholds, setNewThresholds] = useState([]);
  const nChartReferenceLine = 10;

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    axios
      .get(
        `${process.env.REACT_APP_SERVER_API_URL}/patient/${selectedPatient}/thresholds/${parameterID}`
      )
      .then((res) => {
        setThresholds(res.data);
        setNewThresholds(res.data);
      })
      .catch((error) => console.log(error));
  }, [selectedPatient]);

  useEffect(() => {
    axios
      .get(
        `${process.env.REACT_APP_SERVER_API_URL}/device/${patients[selectedPatient].device}/param/${parameterID}/history/${selectedDate}`
      )
      .then((res) => {
        console.log(res.data);
        let historyData = [];
        for (let h = 0; h < 24; h++) {
          for (let m = 0; m < 60; m += 5) {
            const hour = h.toString().padStart(2, "0");
            const minute = m.toString().padStart(2, "0");
            const timestamp = `${hour}:${minute}`;
            historyData.push({
              timestamp: timestamp,
              value: res.data[timestamp] || null,
            });
          }
        }
        setHistory(historyData);
      })
      .catch((error) => console.log(error));

    socket.on(
      `/device/${patients[selectedPatient].device}/param/${parameterID}/history/updates`,
      (data) => {
        setHistory((prev) =>
          prev.map((e) => {
            return e.timestamp === data.timestamp ? data : e;
          })
        );
      }
    );

    return () =>
      socket.off(
        `/device/${patients[selectedPatient].device}/param/${parameterID}/history/updates`
      );
  }, [selectedPatient, selectedDate]);

  return (
    <div className="parameter-dashboard-layout">
      <div>
        <div className="flex v-center bold">
          <div>
            <span style={{ marginRight: "4px" }}>{parameter}</span>
            <span className="thin font-xsm">{unit}</span>
          </div>
        </div>
        <div>
          <Measurement label="Valore" value={value}>
            <span style={{ color: color }}>
              <FontAwesomeIcon icon={icon} />
            </span>
          </Measurement>
          <Measurement label="Media" value={avg}>
            <TrendLine
              value={value}
              color={color}
              size={12}
              min={minThreshold}
              max={maxThreshold}
            />
          </Measurement>
        </div>
      </div>
      <div>
        <div className="flex v-center space-btw bold">
          <div>Andamento Giornaliero</div>
          <input
            className="parameter-dashboard-day-button"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
            }}
          />
        </div>
        <div style={{ padding: "8px 0" }}>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart
              data={history}
              margin={{ top: 0, left: 0, right: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id={`${unit}-areachart-background`}
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="timestamp"
                type="category"
                ticks={ticks}
                interval={0}
                hide
              />
              <YAxis hide={true} domain={[minThreshold, maxThreshold]} />
              <Tooltip content={<CustomTooltip data={{ unit: unit }} />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                dot={false}
                fill={`url(#${unit}-areachart-background)`}
              />
              {Array.from(
                { length: nChartReferenceLine - 1 },
                (_, i) =>
                  ((maxThreshold - minThreshold) / nChartReferenceLine) *
                  (i + 1)
              ).map((value) => (
                <ReferenceLine
                  key={parameterID + "Line" + value}
                  y={value}
                  stroke="var(--font-color-x-transparent)"
                />
              ))}
              <ReferenceArea
                y1={newThresholds[0]}
                y2={newThresholds[1]}
                strokeOpacity={0}
                fill="var(--blue-color-m-transparent)"
              />
              {editThresholds &&
                thresholds.map((threshold) => (
                  <ReferenceLine
                    key={threshold}
                    y={threshold}
                    stroke="var(--font-color)"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                  />
                ))}
              {newThresholds.map((threshold) => (
                <ReferenceLine
                  key={threshold}
                  y={threshold}
                  stroke="var(--blue-color)"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <div className="flex v-center space-btw bold">
          {editThresholds ? (
            <>
              <div
                className="parameter-dashboard-edit-button"
                onClick={() => {
                  setNewThresholds(thresholds);
                  setEditThresholds(false);
                }}
              >
                Annulla
              </div>
              <div
                className="parameter-dashboard-edit-button confirm"
                onClick={() => {
                  axios
                    .post(
                      `${process.env.REACT_APP_SERVER_API_URL}/patient/${selectedPatient}/thresholds/${parameterID}`,
                      {
                        minThreshold: newThresholds[0],
                        maxThreshold: newThresholds[1],
                      },
                      { headers: { "Content-Type": "application/json" } }
                    )
                    .then((_) => {
                      setThresholds(newThresholds);
                      setEditThresholds(false);
                    })
                    .catch((error) => console.log(error));
                }}
              >
                Conferma
              </div>
            </>
          ) : (
            <>
              <div>Modifica Soglie</div>
              <div
                className="parameter-dashboard-thresholds-button"
                onClick={() => setEditThresholds(true)}
              >
                <FontAwesomeIcon icon={faEdit} />
              </div>
            </>
          )}
        </div>
        <div className="patient-dashboard-thresholds">
          <div style={{ padding: "8px 0" }}>
            <ThresholdsSlider
              range
              min={minThreshold}
              max={maxThreshold}
              value={newThresholds}
              onChange={(range) => setNewThresholds(range)}
              allowCross={false}
              vertical={true}
              style={{
                pointerEvents: editThresholds ? "auto" : "none",
              }}
              handlesColor={editThresholds ? "#fff" : "var(--blue-color)"}
              active={editThresholds}
            />
          </div>
          <div>
            <Measurement value={newThresholds[1]}>
              <span className="font-xsm">Max</span>
            </Measurement>
            <Measurement value={newThresholds[0]}>
              <span className="font-xsm">Min</span>
            </Measurement>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ParameterDashboard;
