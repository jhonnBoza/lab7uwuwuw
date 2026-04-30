const express = require("express");

const app = express();
const PORT = Number(process.env.PORT || 8081);
const NAME = process.env.NAME || "backend-x";
const HOST = process.env.HOST || "0.0.0.0";

app.get("/", (req, res) => {
  res.send(`Respuesta desde ${NAME} en puerto ${PORT}\n`);
});

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.listen(PORT, HOST, () => {
  console.log(`${NAME} escuchando en http://${HOST}:${PORT}`);
});
