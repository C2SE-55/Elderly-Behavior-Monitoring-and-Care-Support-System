const express = require("express");
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Routes công khai
router.post("/register", authController.register);
router.post("/login", authController.login);

// Routes bảo vệ (cần token)
router.get("/profile", verifyToken, authController.getProfile);
router.put("/profile", verifyToken, authController.updateProfile);

module.exports = router;
