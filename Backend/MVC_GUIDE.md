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
  "role": "family",                # tùy chọn: 'family' hoặc 'caregiver' (không được chọn 'admin')
  "dateOfBirth": "12/01/2004"      # định dạng hỗ trợ: 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'
  # các trường tùy chọn: "phone", "fullName"
}
{
  "username": "john_doj",
  "email": "tranxuanhieu3@dtu.edu.vn",     
  "password": "password123",
  "phone": "0905886957",
"fullName": "Tran Hieu",
"dateOfBirth": "12/01/2004",
  "role": "family"  
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
  "email": "john@example.com",
  "phone": "0987654321",
  "fullName": "John Doe Updated"
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
