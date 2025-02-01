// const path = require("path");
// const multer = require("multer");

// // Configure multer storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, path.join(__dirname, ".././uploads")); // Store uploaded files in 'uploads' folder
//   },
//   filename: (req, file, cb) => {
//     const fileExt = path.extname(file.originalname); // Get file extension
//     const uniqueId = Date.now(); // Create unique ID for each file
//     const filename = `${file.originalname}-${uniqueId}${fileExt}`; // Final filename
//     cb(null, filename);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = [
//     "application/pdf", // PDF files
//     "application/zip", // ZIP files
//     "image/jpeg", // JPEG images
//     "image/png", // PNG images
//     "image/gif", // GIF images
//   ];

//   if (!allowedTypes.includes(file.mimetype)) {
//     return cb(
//       new Error("Only images (JPEG, PNG, GIF), PDFs, or ZIP files are allowed"),
//       false
//     );
//   }

//   cb(null, true); // Accept the file
// };

// // File size limit (e.g., 10 MB max)
// const limits = {
//   fileSize: 10 * 1024 * 1024, // 10 MB
// };

// // Multer configuration
// const upload = multer({
//   storage,
//   fileFilter,
//   limits,
// });

// module.exports = { upload };

const path = require("path");
const multer = require("multer");

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, ".././uploads");
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
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only PDF and image files (JPEG, PNG, GIF) are allowed"), false);
  }

  cb(null, true);
};

// File size limit (e.g., 10 MB max)
const limits = {
  fileSize: 10 * 1024 * 1024, // 10 MB
};

// Multer configuration
const upload = multer({ storage, fileFilter, limits });

module.exports = { upload };
