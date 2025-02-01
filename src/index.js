require("dotenv").config({ path: ".env" });
const http = require("http");
const cors= require('cors')
const express = require("express");
const mongoose = require("mongoose");

const router = require("./router/routes");
const cookieParser = require("cookie-parser");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
const server = http.createServer(app);
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'options'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    exposedHeaders: [
      'Content-Disposition',
      'X-Auth-Token',
      'Authorization',
      'Set-Cookie',
    ],
  }),
);
app.options('*', cors());


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
