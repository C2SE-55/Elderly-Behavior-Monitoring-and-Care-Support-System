const express = require("express");
const authController = require("../controllers/authController");
const { verifyToken, checkRole } = require("../middleware/auth");

const router = express.Router();

// Routes công khai
router.post("/register", authController.register);
router.post("/login", authController.login);

// Routes bảo vệ (cần token)
router.get("/profile", verifyToken, authController.getProfile);
router.put("/profile", verifyToken, authController.updateProfile);

// Routes chỉ dành cho ADMIN
router.get("/admin/users", verifyToken, authController.getAllUsers); // Xem tất cả tài khoản
router.get("/admin/search", verifyToken, authController.searchUsers); // Tìm kiếm tài khoản theo tên
router.get("/admin/users/:id", verifyToken, authController.getUserById); // Xem chi tiết một tài khoản
router.delete("/admin/users/:id", verifyToken, authController.deleteUser); // Xóa tài khoản

module.exports = router;
