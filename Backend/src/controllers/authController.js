const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRE, HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const { isValidEmail, isValidPassword, isEmptyField, isGmail, isValidVietnamesePhone } = require("../utils/validators");
const User = require("../models/User");
const Role = require("../models/Role");

// Đăng ký người dùng mới
exports.register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword, phone, fullName } = req.body;

    // Xác thực dữ liệu đầu vào
    if (
      isEmptyField(username) ||
      isEmptyField(email) ||
      isEmptyField(password) ||
      isEmptyField(confirmPassword)
    ) {
      return sendFail(res, "Username, email, mật khẩu và nhắc lại mật khẩu là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    // Kiểm tra mật khẩu và mật khẩu nhắc lại khớp nhau
    if (password !== confirmPassword) {
      return sendFail(res, "Mật khẩu và nhắc lại mật khẩu không khớp", HTTP_STATUS.BAD_REQUEST);
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

    // Chuyển định dạng ngày sinh (nếu có) sang YYYY-MM-DD
    const { parseDateToSQL } = require("../utils/validators");
    const dobSql = parseDateToSQL(req.body.dateOfBirth || null);

    // Tạo người dùng mới (mặc định gán role "user")
    const result = await User.create({
      username,
      email,
      password,
      phone: phone || null,
      fullName,
      dateOfBirth: dobSql,
    });

    // Gán role "user" mặc định cho người dùng mới
    if (result.insertId) {
      try {
        await Role.setRole(result.insertId, "user");
      } catch (err) {
        console.error("Không thể gán role cho user:", err);
      }
    }

    return sendSuccess(res, { id: result.insertId, role: "user" }, "Đăng ký thành công", HTTP_STATUS.CREATED);
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
    const userRole = (await Role.getUserRole(user.id)) || user.role || "user";
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

    const role = (await Role.getUserRole(user.id)) || user.role || "user";
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

// Cập nhật thông tin profile người dùng (chỉ có thể update chính mình)
exports.updateProfile = async (req, res) => {
  try {
    const { phone, fullName, oldPassword, newPassword, confirmNewPassword } = req.body;

    // Kiểm tra nếu có cố gắng cập nhật các trường không được phép
    if (req.body.hasOwnProperty('email') || req.body.hasOwnProperty('username') || req.body.hasOwnProperty('dateOfBirth') || req.body.hasOwnProperty('date_of_birth')) {
      return sendFail(res, "Không được phép chỉnh sửa email, username, và ngày sinh", HTTP_STATUS.BAD_REQUEST);
    }

    // Kiểm tra fullName có trống không (nếu được cung cấp)
    if (fullName !== undefined && isEmptyField(fullName)) {
      return sendFail(res, "Tên đầy đủ không được để trống", HTTP_STATUS.BAD_REQUEST);
    }

    // Kiểm tra và validate số điện thoại (nếu có cung cấp)
    if (phone !== undefined) {
      if (isEmptyField(phone)) {
        return sendFail(res, "Số điện thoại không được để trống", HTTP_STATUS.BAD_REQUEST);
      }
      if (!isValidVietnamesePhone(phone)) {
        return sendFail(res, "Số điện thoại phải có đúng 10 chữ số (định dạng Việt Nam)", HTTP_STATUS.BAD_REQUEST);
      }
    }

    const payload = {
      phone,
      fullName,
    };

    const wantsChangePassword =
      oldPassword !== undefined ||
      newPassword !== undefined ||
      confirmNewPassword !== undefined;

    if (wantsChangePassword) {
      if (isEmptyField(oldPassword) || isEmptyField(newPassword) || isEmptyField(confirmNewPassword)) {
        return sendFail(
          res,
          "Đổi mật khẩu cần nhập đủ mật khẩu cũ, mật khẩu mới và xác nhận mật khẩu mới",
          HTTP_STATUS.BAD_REQUEST
        );
      }
      if (!isValidPassword(newPassword)) {
        return sendFail(res, "Mật khẩu mới phải có ít nhất 6 ký tự", HTTP_STATUS.BAD_REQUEST);
      }
      if (newPassword !== confirmNewPassword) {
        return sendFail(res, "Mật khẩu mới và xác nhận mật khẩu mới không khớp", HTTP_STATUS.BAD_REQUEST);
      }

      const currentUser = await User.findById(req.userId);
      if (!currentUser) {
        return sendError(res, "Người dùng không tồn tại", HTTP_STATUS.NOT_FOUND);
      }
      const isOldPasswordValid = await User.comparePassword(String(oldPassword), String(currentUser.password || ""));
      if (!isOldPasswordValid) {
        return sendFail(res, "Mật khẩu cũ không đúng", HTTP_STATUS.UNAUTHORIZED);
      }
      payload.password = newPassword;
    }

    // Cập nhật các trường được phép: fullName, phone và (tuỳ chọn) password
    const result = await User.update(req.userId, payload);

    if (result.affectedRows === 0) {
      return sendError(res, "Không thể cập nhật profile hoặc không có thay đổi", HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, null, "Cập nhật profile thành công");
  } catch (error) {
    console.error("Lỗi cập nhật profile:", error);
    return sendError(res, "Không thể cập nhật profile", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// [ADMIN] Tìm kiếm tài khoản theo tên
exports.searchUsers = async (req, res) => {
  try {
    // Kiểm tra xem người dùng hiện tại có phải admin không
    if (req.userRole !== "admin") {
      return sendError(res, "Chỉ admin có quyền tìm kiếm tài khoản", HTTP_STATUS.FORBIDDEN);
    }

    const { name } = req.query;
    
    // Kiểm tra từ khóa tìm kiếm
    if (!name || isEmptyField(name)) {
      return sendFail(res, "Vui lòng cung cấp từ khóa tìm kiếm", HTTP_STATUS.BAD_REQUEST);
    }

    const users = await User.searchByName(name);
    return sendSuccess(
      res,
      users,
      `Tìm thấy ${users.length} tài khoản phù hợp`
    );
  } catch (error) {
    console.error("Lỗi tìm kiếm tài khoản:", error);
    return sendError(res, "Không thể tìm kiếm tài khoản", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// [ADMIN] Lấy tất cả thông tin tài khoản người dùng
exports.getAllUsers = async (req, res) => {
  try {
    // Kiểm tra xem người dùng hiện tại có phải admin không
    if (req.userRole !== "admin") {
      return sendError(res, "Chỉ admin có quyền xem danh sách tất cả tài khoản", HTTP_STATUS.FORBIDDEN);
    }

    const users = await User.getAll();
    return sendSuccess(
      res,
      users,
      "Lấy danh sách tất cả tài khoản thành công"
    );
  } catch (error) {
    console.error("Lỗi lấy danh sách người dùng:", error);
    return sendError(res, "Không thể lấy danh sách tài khoản", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// [ADMIN] Lấy thông tin chi tiết của một tài khoản
exports.getUserById = async (req, res) => {
  try {
    // Kiểm tra xem người dùng hiện tại có phải admin không
    if (req.userRole !== "admin") {
      return sendError(res, "Chỉ admin có quyền xem thông tin tài khoản", HTTP_STATUS.FORBIDDEN);
    }

    const { id } = req.params;
    if (isEmptyField(id)) {
      return sendFail(res, "ID tài khoản là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const user = await User.findById(id);
    if (!user) {
      return sendError(res, "Tài khoản không tồn tại", HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, user, "Lấy thông tin tài khoản thành công");
  } catch (error) {
    console.error("Lỗi lấy thông tin tài khoản:", error);
    return sendError(res, "Không thể lấy thông tin tài khoản", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// [ADMIN] Xóa tài khoản người dùng
exports.deleteUser = async (req, res) => {
  try {
    // Kiểm tra xem người dùng hiện tại có phải admin không
    if (req.userRole !== "admin") {
      return sendError(res, "Chỉ admin có quyền xóa tài khoản", HTTP_STATUS.FORBIDDEN);
    }

    const { id } = req.params;
    if (isEmptyField(id)) {
      return sendFail(res, "ID tài khoản là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    // Không cho phép xóa admin
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, "Tài khoản không tồn tại", HTTP_STATUS.NOT_FOUND);
    }

    // Kiểm tra role của tài khoản sẽ bị xóa
    // Lấy role từ bảng user_roles
    const connection = require("../config/database").getConnection();
    
    const result = await User.delete(id);
    if (result.affectedRows === 0) {
      return sendError(res, "Không thể xóa tài khoản", HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, null, "Xóa tài khoản thành công");
  } catch (error) {
    console.error("Lỗi xóa tài khoản:", error);
    return sendError(res, "Không thể xóa tài khoản", HTTP_STATUS.INTERNAL_ERROR);
  }
};
