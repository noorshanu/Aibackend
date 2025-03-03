const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Ensure upload directory exists
const uploadPath = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true }); // Create directory
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    const uniqueId = Date.now();
    const filename = `${path.basename(file.originalname, fileExt)}-${uniqueId}${fileExt}`;
    cb(null, filename);
  },
});

// File type filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif"];

  console.log(`Checking file type: ${file.mimetype}`); // Debug log

  if (!allowedTypes.includes(file.mimetype)) {
    console.log(`Rejected file: ${file.originalname}`);
    return cb(new Error("Only PDF and image files (JPEG, PNG, GIF) are allowed"), false);
  }

  cb(null, true);
};

// File size limit (e.g., 10 MB max)
const limits = { fileSize: 10 * 1024 * 1024 }; // 10 MB

// Multer configuration
const upload = multer({ storage, fileFilter, limits });

module.exports = { upload };