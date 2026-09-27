const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const USERNAME = process.env.SAR_USERNAME || "rescueteam";
const PASSWORD = process.env.SAR_PASSWORD || "changeme123";
const TOKEN_TTL = "12h";

function login(username, password) {
  if (username === USERNAME && password === PASSWORD) {
    const token = jwt.sign({ role: "rescue-team", user: username }, SECRET, {
      expiresIn: TOKEN_TTL,
    });
    return token;
  }
  return null;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

// Express middleware - expects `Authorization: Bearer <token>`
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: "unauthorized" });
  req.user = payload;
  next();
}

module.exports = { login, verifyToken, requireAuth };
