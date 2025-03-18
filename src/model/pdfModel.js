const mongoose = require("mongoose");

const pdfSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Link PDF to a User
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  summary: { type: String },
  uploadedAt: { type: Date, default: Date.now },
});

const PdfModel = mongoose.model("Pdf", pdfSchema);
module.exports = PdfModel;
