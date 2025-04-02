const mongoose = require("mongoose");

const pdfSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Link PDFs to a User
  pdfs: [
    {
      fileName: { type: String, required: true }, // File name of the uploaded PDF
      fileUrl: { type: String, required: true },  // URL of the uploaded PDF on AWS S3
    },
  ],
  summary: { type: String },                     // Collective summary of all the PDFs
  uploadedAt: { type: Date, default: Date.now }, // Date of uploading
});

const PdfModel = mongoose.model("Pdf", pdfSchema);
module.exports = PdfModel;
