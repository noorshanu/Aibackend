require("dotenv").config({ path: ".env" });
const http = require("http");
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");

const router = require("./router/routes");
const cookieParser = require("cookie-parser");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
const server = http.createServer(app);
app.use(cookieParser());
app.use(express.json());

const allowedOrigins = [
  "http://localhost:5173",
  "https://zoctor-ai.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.options("*", cors());

mongoose
  .connect(process.env.mongoose_uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
  })
  .then(() => {
    console.log("Connected to MongoDB", process.env.mongoose_uri);
  })
  .catch(() => {
    console.log("Error connecting to MongoDB");
  });
app.use("/", router);
server.listen(4000, () => {
  console.log("Server is running at http://localhost:3000");
});
