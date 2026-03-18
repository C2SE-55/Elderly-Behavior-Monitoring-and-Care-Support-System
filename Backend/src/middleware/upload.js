const multer = require("multer");
const path = require("path");
const fs = require("fs");

const faceDir = path.join(__dirname, "..", "..", "uploads", "face");
const fallDir = path.join(__dirname, "..", "..", "uploads", "fall");
if (!fs.existsSync(faceDir)) fs.mkdirSync(faceDir, { recursive: true });
if (!fs.existsSync(fallDir)) fs.mkdirSync(fallDir, { recursive: true });

const faceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, faceDir),
  filename: (req, file, cb) => {
    const profileId = req.params.profileId || "user";
    const ext = (file.originalname && path.extname(file.originalname)) || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png"].includes(ext.toLowerCase()) ? ext : ".jpg";
    cb(null, `${profileId}_${Date.now()}${safeExt}`);
  },
});

const fallStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, fallDir),
  filename: (_req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png"].includes(ext.toLowerCase()) ? ext : ".jpg";
    cb(null, `fall_${Date.now()}${safeExt}`);
  },
});

const imageFilter = (_req, file, cb) => {
  const byName = file.originalname && /\.(jpe?g|png)$/i.test(file.originalname);
  const byMime = file.mimetype && /^image\/(jpe?g|png)$/i.test(file.mimetype);
  if (byName || byMime) cb(null, true);
  else cb(new Error("Chỉ chấp nhận ảnh JPG hoặc PNG"), false);
};

const uploadFaceImage = multer({
  storage: faceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single("image");

const uploadFallImage = multer({
  storage: fallStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single("image");

module.exports = { uploadFaceImage, uploadFallImage };
