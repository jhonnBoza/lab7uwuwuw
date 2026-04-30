const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const { getPool, initDb } = require("./db");
const { signToken, authMiddleware } = require("./auth");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const INSTANCE = process.env.INSTANCE_NAME || process.env.NAME || "ec2-node");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.get("/api/meta", async (req, res) => {
  let dbOk = false;
  try {
    if (process.env.DB_HOST) {
      const p = getPool();
      await p.query("SELECT 1");
      dbOk = true;
    }
  } catch {
    dbOk = false;
  }
  res.json({ instance: INSTANCE, dbOk });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "usuario y contrasena requeridos" });
    }
    if (username.length > 64 || password.length < 4) {
      return res.status(400).json({ error: "usuario o contrasena invalidos" });
    }
    const hash = await bcrypt.hash(password, 10);
    const pool = getPool();
    const [r] = await pool.query("INSERT INTO users (username, password_hash) VALUES (?, ?)", [
      username,
      hash,
    ]);
    const token = signToken({ sub: r.insertId, username });
    res.status(201).json({ token });
  } catch (e) {
    if (String(e.message).includes("Duplicate")) {
      return res.status(409).json({ error: "usuario ya existe" });
    }
    console.error(e);
    res.status(500).json({ error: "error servidor" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "usuario y contrasena requeridos" });
    }
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1",
      [username]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "credenciales invalidas" });
    }
    const token = signToken({ sub: user.id, username: user.username });
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "error servidor" });
  }
});

app.get("/api/tasks", authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT id, title, done FROM tasks WHERE user_id = ? ORDER BY id DESC",
      [req.user.sub]
    );
    res.json(rows.map((r) => ({ ...r, done: !!r.done })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "error servidor" });
  }
});

app.post("/api/tasks", authMiddleware, async (req, res) => {
  try {
    const title = (req.body && String(req.body.title || "").trim()) || "";
    if (!title) return res.status(400).json({ error: "titulo requerido" });
    const pool = getPool();
    const [r] = await pool.query("INSERT INTO tasks (user_id, title) VALUES (?, ?)", [
      req.user.sub,
      title.slice(0, 255),
    ]);
    res.status(201).json({ id: r.insertId, title, done: false });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "error servidor" });
  }
});

app.patch("/api/tasks/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const done = req.body && typeof req.body.done === "boolean" ? (req.body.done ? 1 : 0) : null;
    if (!Number.isFinite(id) || done === null) {
      return res.status(400).json({ error: "payload invalido" });
    }
    const pool = getPool();
    const [r] = await pool.query("UPDATE tasks SET done = ? WHERE id = ? AND user_id = ?", [
      done,
      id,
      req.user.sub,
    ]);
    if (r.affectedRows === 0) return res.status(404).json({ error: "no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "error servidor" });
  }
});

app.delete("/api/tasks/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = getPool();
    const [r] = await pool.query("DELETE FROM tasks WHERE id = ? AND user_id = ?", [
      id,
      req.user.sub,
    ]);
    if (r.affectedRows === 0) return res.status(404).json({ error: "no encontrado" });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "error servidor" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function main() {
  if (!process.env.DB_HOST) {
    console.warn("ADVERTENCIA: sin DB_HOST la API fallara salvo /health. Configura RDS (README-parteC.md).");
  } else {
    await initDb();
    console.log("Base de datos inicializada (tablas listas).");
  }
  app.listen(PORT, HOST, () => {
    console.log(`${INSTANCE} en http://${HOST}:${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
