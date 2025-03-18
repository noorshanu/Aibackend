const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Ensure upload directory exists
const uploadPath = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true }); // Create directory
}

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type! Only images and PDFs are allowed."), false);
  }
};

// File size limit (e.g., 10 MB max)
const limits = { fileSize: 10 * 1024 * 1024 }; // 10 MB

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

module.exports = { upload };

// const fs = require("fs");
// const path = require("path");
// const multer = require("multer");

// // Ensure the upload directory exists
// const uploadPath = path.join(__dirname, "../uploads");
// if (!fs.existsSync(uploadPath)) {
//   fs.mkdirSync(uploadPath, { recursive: true });
// }

// // Configure multer for both memory and disk storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadPath); // Save to /uploads folder
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
//     cb(null, uniqueSuffix + path.extname(file.originalname));
//   },
// });

// // File filter for images & PDFs
// const fileFilter = (req, file, cb) => {
//   if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
//     cb(null, true);
//   } else {
//     cb(new Error("Invalid file type! Only images and PDFs are allowed."), false);
//   }
// };

// // File size limit (10MB)
// const limits = { fileSize: 10 * 1024 * 1024 };

// const upload = multer({
//   storage,
//   fileFilter,
//   limits,
// });

// module.exports = { upload, uploadPath };
