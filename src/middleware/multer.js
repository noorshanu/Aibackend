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
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Please upload only PDF files.'), false);
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