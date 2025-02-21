const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    Name: { type: String, required: true }, 
    subject: { type: String, required: true },
    Email: { type: String, required: true },
    Message: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    language: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);
