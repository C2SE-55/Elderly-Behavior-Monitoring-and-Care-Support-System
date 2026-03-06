# Backend MVC Architecture Guide

## Project Structure

```
Backend/
├── server.js                 # Main application entry point
├── package.json             # Dependencies
├── .env                     # Environment variables
├── .env.example            # Example environment file
└── src/
    ├── config/             # Configuration files
    │   ├── database.js     # Database connection pool
    │   └── constants.js    # Application constants
    ├── controllers/        # Business logic & request handlers
    │   └── authController.js
    ├── models/             # Database models & queries
    │   └── User.js
    ├── routes/             # API endpoints
    │   ├── index.js        # Main router
    │   └── auth.js         # Auth routes
    ├── middleware/         # Custom middleware
    │   ├── auth.js         # JWT verification
    │   └── errorHandler.js # Error handling
    └── utils/              # Utility functions
        ├── response.js     # Standard response formatter
        └── validators.js   # Input validation
```

## Architecture Overview

### MVC Pattern
- **Model**: Database operations (User.js)
- **View**: JSON API responses
- **Controller**: Business logic (authController.js)

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and update with your database credentials:
```bash
cp .env.example .env
```

### 3. Create Database Tables
Run the SQL file from the data folder:
```bash
mysql -u root < ../data/create_table.sql
```

### 4. Start Development Server
```bash
npm start
```

Or with live reload (nodemon):
```bash
npm run dev
```

## API Endpoints

### Authentication

#### Register User
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@dtu.edu.vn",      # có thể là Gmail hoặc Google Workspace
  "password": "password123",
 "confirmPassword": "securePass123",
  "dateOfBirth": "12/01/2004"      # định dạng hỗ trợ: 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'
  # các trường tùy chọn: "phone", "fullName"
}
{
  "username": "john_doj",
  "email": "tranxuanhieu3@dtu.edu.vn",     
  "password": "password123",
   "confirmPassword": "securePass123",
  "phone": "0905886957",
"fullName": "Tran Hieu",
"dateOfBirth": "12/01/2004"
}
```

- Hệ thống kiểm tra email bằng cách tra MX records của domain để xác định xem hộp thư có được Google (Gmail/Google Workspace) host hay không. Vì vậy cả địa chỉ `@gmail.com` và các email Google Workspace (ví dụ domain do Google quản lý) đều được chấp nhận.
- `dateOfBirth` sẽ được tự động chuyển sang định dạng `YYYY-MM-DD` trước khi lưu vào cơ sở dữ liệu. Hệ thống hỗ trợ các định dạng nhập phổ biến: `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`. Nếu định dạng không hợp lệ, trường sẽ bỏ trống trong DB.
- Người dùng có thể chọn `role` khi đăng ký; giá trị hợp lệ: `family`, `caregiver`. Không được phép chọn `admin`.
- Username và email phải là duy nhất trong cơ sở dữ liệu.
- Sau khi đăng ký, tài khoản sẽ được gán vai trò đã chọn (mặc định `family`) vào bảng `user_roles`.

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "password123"
}
```

- Đăng nhập bằng username + password.

#### Get Profile (Protected)
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

#### Update Profile (Protected)
```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "0987654321",
  "fullName": "John Doe Updated",
  "password" : "dksakd"
}
```

**Yêu cầu:**
- `Authorization` Header (bắt buộc): JWT token
- `phone` (tùy chọn): Số điện thoại (phải đúng 10 chữ số - định dạng Việt Nam)
- `fullName` (tùy chọn): Tên đầy đủ

**Ràng buộc - KHÔNG ĐƯỢC PHÉP chỉnh sửa:**
- ❌ `email` - Email không thể thay đổi
- ❌ `username` - Username không thể thay đổi
- ❌ `dateOfBirth` - Ngày sinh không thể thay đổi

**Ghi chú:**
- Số điện thoại phải là 10 chữ số (định dạng Việt Nam), ví dụ: `0912345678`
- Chỉ có thể cập nhật profile của chính mình
- Nếu cố gắng cập nhật các trường bị cấm sẽ nhận lỗi retval
- Ít nhất một trường (phone hoặc fullName) phải được cung cấp

**Response Success:**
```json
{
  "status": "success",
  "message": "Cập nhật profile thành công",
  "data": null
}
```

**Response Error Examples:**
```json
// Số điện thoại không hợp lệ
{
  "status": "fail",
  "message": "Số điện thoại phải có đúng 10 chữ số (định dạng Việt Nam)"
}

// Cố gắng cập nhật email hoặc username
{
  "status": "fail",
  "message": "Không được phép chỉnh sửa email, username, và ngày sinh"
}

// Token không hợp lệ
{
  "status": "error",
  "message": "Token không hợp lệ"
}
```

### Admin Endpoints (Chỉ Admin)

Tất cả các endpoint admin đều yêu cầu token của một admin. Nếu user không phải admin sẽ nhận lỗi 403 Forbidden.

#### Get All Users
```http
GET /api/auth/admin/users
Authorization: Bearer <admin_token>
```

**Yêu cầu:**
- `Authorization` Header (bắt buộc): JWT token của admin

**Ghi chú:**
- Chỉ admin có quyền xem danh sách tất cả tài khoản

**Response Success:**
```json
{
  "status": "success",
  "message": "Lấy danh sách tất cả tài khoản thành công",
  "data": [
    {
      "id": 1,
      "username": "john_doe",
      "email": "john@gmail.com",
      "phone": "0912345678",
      "fullName": "John Doe",
      "dateOfBirth": "2004-01-12",
      "createdAt": "2024-03-05T10:30:00.000Z",
      "role": "user"
    },
    {
      "id": 2,
      "username": "jane_smith",
      "email": "jane@gmail.com",
      "phone": "0987654321",
      "fullName": "Jane Smith",
      "dateOfBirth": "2005-05-20",
      "createdAt": "2024-03-05T11:45:00.000Z",
      "role": "caregiver"
    }
  ]
}
```

**Response Error:**
```json
{
  "status": "error",
  "message": "Chỉ admin có quyền xem danh sách tất cả tài khoản"
}
```

#### Get User By ID
```http
GET /api/auth/admin/users/:id
Authorization: Bearer <admin_token>
```

**Yêu cầu:**
- `Authorization` Header (bắt buộc): JWT token của admin
- `id` (URL parameter, bắt buộc): ID của tài khoản cần xem

**Ghi chú:**
- Chỉ admin có quyền xem thông tin chi tiết của một tài khoản

**Response Success:**
```json
{
  "status": "success",
  "message": "Lấy thông tin tài khoản thành công",
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@gmail.com",
    "phone": "0912345678",
    "full_name": "John Doe",
    "date_of_birth": "2004-01-12",
    "role": "user",
    "created_at": "2024-03-05T10:30:00.000Z"
  }
}
```

**Response Error:**
```json
{
  "status": "error",
  "message": "Tài khoản không tồn tại"
}
```

#### Delete User
```http
DELETE /api/auth/admin/users/:id
Authorization: Bearer <admin_token>
```

**Yêu cầu:**
- `Authorization` Header (bắt buộc): JWT token của admin
- `id` (URL parameter, bắt buộc): ID của tài khoản cần xóa

**Ghi chú:**
- Chỉ admin có quyền xóa tài khoản
- Khi xóa một tài khoản, tất cả dữ liệu liên quan (user_roles, health_profiles, v.v.) sẽ được xóa tự động
- Hành động này không thể hoàn tác

**Response Success:**
```json
{
  "status": "success",
  "message": "Xóa tài khoản thành công",
  "data": null
}
```

**Response Error:**
```json
{
  "status": "error",
  "message": "Tài khoản không tồn tại"
}
```

#### Search Users By Name
```http
GET /api/auth/admin/search?name=john
Authorization: Bearer <admin_token>
```

**Yêu cầu:**
- `Authorization` Header (bắt buộc): JWT token của admin
- `name` (Query parameter, bắt buộc): Từ khóa tìm kiếm (tìm theo username hoặc full_name)

**Ghi chú:**
- Chỉ admin có quyền tìm kiếm tài khoản
- Tìm kiếm không phân biệt hoa thường
- Kết quả được sắp xếp theo full_name tăng dần
- Hỗ trợ tìm kiếm một phần (partial match)

**Response Success:**
```json
{
  "status": "success",
  "message": "Tìm thấy 2 tài khoản phù hợp",
  "data": [
    {
      "id": 1,
      "username": "john_doe",
      "email": "john@gmail.com",
      "phone": "0912345678",
      "fullName": "John Doe",
      "dateOfBirth": "2004-01-12",
      "createdAt": "2024-03-05T10:30:00.000Z",
      "role": "user"
    },
    {
      "id": 5,
      "username": "johnson_smith",
      "email": "johnson@gmail.com",
      "phone": "0978654321",
      "fullName": "Johnson Smith",
      "dateOfBirth": "2003-06-15",
      "createdAt": "2024-03-06T14:20:00.000Z",
      "role": "caregiver"
    }
  ]
}
```

**Response Error:**
```json
// Không cung cấp từ khóa tìm kiếm
{
  "status": "fail",
  "message": "Vui lòng cung cấp từ khóa tìm kiếm"
}

// User không phải admin
{
  "status": "error",
  "message": "Chỉ admin có quyền tìm kiếm tài khoản"
}
```

### Health Check
```http
GET /health
```

## Response Format

### Success Response (200)
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "fullName": "John Doe",
      "role": "user"
    }
  }
}
```

### Error Response (400-500)
```json
{
  "status": "error",
  "message": "Invalid email format",
  "error": null
}
```

### Validation Error Response (400)
```json
{
  "status": "fail",
  "message": "Validation failed",
  "errors": null
}
```

## File Descriptions

### Core Files

**server.js**
- Express app initialization
- Middleware setup
- Routes registration
- Error handler

**src/config/database.js**
- MySQL connection pool
- Database configuration using environment variables

**src/config/constants.js**
- HTTP status codes
- API response status types
- JWT configuration

### Controllers

**src/controllers/authController.js**
- User registration logic
- User login logic
- Profile retrieval
- Profile updates

### Models

**src/models/User.js**
- Database query methods
- User CRUD operations
- Password hashing/comparison

### Middleware

**src/middleware/auth.js**
- JWT token verification
- Role-based access control

**src/middleware/errorHandler.js**
- Centralized error handling

### Utilities

**src/utils/response.js**
- Standard response formatting
- Success, error, and fail responses

**src/utils/validators.js**
- Email validation
- Password validation
- Phone validation
- Empty field checks

## Adding New Features

### Add New Model
1. Create file in `src/models/YourModel.js`
2. Define database queries using pool connection

### Add New Controller
1. Create file in `src/controllers/yourController.js`
2. Export functions that handle requests
3. Use utility functions for responses

### Add New Routes
1. Create file in `src/routes/your.js`
2. Define endpoints with validation
3. Import in `src/routes/index.js`

### Add Middleware
1. Create file in `src/middleware/yourMiddleware.js`
2. Use in routes or globally in server.js

## Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| DB_HOST | Database host | localhost |
| DB_USER | Database user | root |
| DB_PASSWORD | Database password | empty |
| DB_NAME | Database name | elderly_care |
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| JWT_SECRET | JWT secret key | your_jwt_secret_key |
| JWT_EXPIRE | Token expiration | 7d |

## Next Steps

1. Create additional models for your domain entities
2. Add more controllers for business logic
3. Implement database schema with proper relationships
4. Add input validation middleware
5. Implement logging system
6. Add database migrations
7. Write unit tests