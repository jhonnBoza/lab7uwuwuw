const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "cambiar-en-produccion-minimo-32-caracteres!!";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "Token requerido" });
  try {
    req.user = verifyToken(m[1]);
    next();
  } catch {
    return res.status(401).json({ error: "Token invalido" });
  }
}

module.exports = { signToken, authMiddleware, JWT_SECRET };
