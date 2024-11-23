const express = require("express");
const routes = require("./routes");

const app = express();
app.use(express.json());

// Rutas
app.use("/api", routes);

module.exports = app;
