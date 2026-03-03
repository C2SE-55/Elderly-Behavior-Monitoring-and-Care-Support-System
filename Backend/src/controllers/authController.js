const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRE, HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const { isValidEmail, isValidPassword, isEmptyField, isGmail } = require("../utils/validators");
const User = require("../models/User");
const Role = require("../models/Role");

// Đăng ký người dùng mới
exports.register = async (req, res) => {
  try {
    const { username, email, password, phone, fullName, role } = req.body;

    // Xác thực dữ liệu đầu vào
    if (
      isEmptyField(username) ||
      isEmptyField(email) ||
      isEmptyField(password)
    ) {
      return sendFail(res, "Username, email và mật khẩu là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    if (!isValidEmail(email)) {
      return sendFail(res, "Định dạng email không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }

    // Kiểm tra email được host bởi Google (hỗ trợ cả Gmail cá nhân và Google Workspace)
    if (!(await isGmail(email))) {
      return sendFail(res, "Email phải là hộp thư do Google quản lý (Gmail/Workspace)", HTTP_STATUS.BAD_REQUEST);
    }

    if (!isValidPassword(password)) {
      return sendFail(res, "Mật khẩu phải có ít nhất 6 ký tự", HTTP_STATUS.BAD_REQUEST);
    }

    // Kiểm tra người dùng đã tồn tại (theo username hoặc email)
    const existingByEmail = await User.findByEmail(email);
    if (existingByEmail) {
      return sendError(res, "Email đã được đăng ký", HTTP_STATUS.CONFLICT);
    }
    const existingByUsername = await User.findByUsername(username);
    if (existingByUsername) {
      return sendError(res, "Username đã tồn tại", HTTP_STATUS.CONFLICT);
    }

    // Xác thực role (người dùng có thể chọn role; không cho chọn 'admin')
    const allowedRoles = ["caregiver", "family"];
    let chosenRole = "family"; // mặc định
    if (role) {
      if (role === "admin") {
        return sendFail(res, "Không được phép chọn role 'admin' khi đăng ký", HTTP_STATUS.FORBIDDEN);
      }
      if (!allowedRoles.includes(role)) {
        return sendFail(res, `Role không hợp lệ. Chỉ chấp nhận: ${allowedRoles.join(", ")}`, HTTP_STATUS.BAD_REQUEST);
      }
      chosenRole = role;
    }

    // Chuyển định dạng ngày sinh (nếu có) sang YYYY-MM-DD
    const { parseDateToSQL } = require("../utils/validators");
    const dobSql = parseDateToSQL(req.body.dateOfBirth || req.body.dateOfBirth || null);

    // Tạo người dùng mới
    const result = await User.create({
      username,
      email,
      password,
      phone: phone || null,
      fullName,
      dateOfBirth: dobSql,
    });

    // gán role được chọn
    if (result.insertId) {
      try {
        await Role.assignRole(result.insertId, chosenRole);
      } catch (err) {
        console.error("Không thể gán role cho user:", err);
      }
    }

    return sendSuccess(res, { id: result.insertId, role: chosenRole }, "Đăng ký thành công", HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    return sendError(res, "Đăng ký thất bại", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Đăng nhập người dùng
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Xác thực dữ liệu đầu vào
    if (isEmptyField(username) || isEmptyField(password)) {
      return sendFail(res, "Username và mật khẩu là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    // Tìm người dùng
    const user = await User.findByUsername(username);
    if (!user) {
      return sendError(res, "Người dùng không tồn tại", HTTP_STATUS.NOT_FOUND);
    }

    // So sánh mật khẩu
    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return sendError(res, "Mật khẩu không đúng", HTTP_STATUS.UNAUTHORIZED);
    }

    // Tạo JWT token
    // Lấy role nếu có, mặc định 'family'
    const userRole = user.role || 'family';
    const token = jwt.sign(
      { id: user.id, email: user.email, role: userRole },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name || user.fullName,
          role: userRole,
        },
      },
      "Đăng nhập thành công"
    );
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    return sendError(res, "Đăng nhập thất bại", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Lấy thông tin profile người dùng
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return sendError(res, "Người dùng không tồn tại", HTTP_STATUS.NOT_FOUND);
    }

    const role = user.role || 'family';
    return sendSuccess(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      fullName: user.full_name || user.fullName,
      role,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error("Lỗi lấy profile:", error);
    return sendError(res, "Không thể lấy thông tin profile", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Cập nhật thông tin profile người dùng
exports.updateProfile = async (req, res) => {
  try {
    const { email, phone, fullName } = req.body;

    if (isEmptyField(email) || isEmptyField(fullName)) {
      return sendFail(res, "Email và fullName là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await User.update(req.userId, { email, phone, fullName });
    if (result.affectedRows === 0) {
      return sendError(res, "Người dùng không tồn tại", HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, null, "Cập nhật profile thành công");
  } catch (error) {
    console.error("Lỗi cập nhật profile:", error);
    return sendError(res, "Không thể cập nhật profile", HTTP_STATUS.INTERNAL_ERROR);
  }
};
