const express = require("express");
const { login } = require("../auth");

const router = express.Router();

// POST /api/auth/login  { username, password } -> { token }
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }
  const token = login(username, password);
  if (!token) return res.status(401).json({ error: "invalid credentials" });
  res.json({ token });
});

module.exports = router;
