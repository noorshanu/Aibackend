const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const verifySchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phoneNumber: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^\+?[1-9]\d{1,14}$/.test(v);
      },
      message: "Invalid phone number format",
    },
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: "Invalid email format",
    },
  },
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  refreshToken: { type: String },
  description: { type: String },
  verified: { type: Boolean, default: false },
  preferredLanguage: {
    type: String,
    enum: [
      "English",
      "Arabic",
      "French",
      "Spanish",
      "German",
      "Italian",
      "Portuguese",
      "Russian",
      "Chinese",
      "Japanese",
      "Hindi",
      "Bengali",
      "Korean",
      "Turkish",
      "Vietnamese",
      "Dutch",
      "Polish",
      "Thai",
      "Indonesian",
      "Ukrainian",
      // Add all 100 languages here...
    ],
    required: true, // Ensures that the user selects a language
    default: "English", // Default to English if no language is selected
  },
  preferredContactMethod: { type: [String], required: true },
  preferredAppointmentTime: { type: String },
  dateOfBirth: { type: Date },
  pdf: [
    {
      url: { type: String },
    },
  ],
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String },
  },
  verificationToken: { type: String },

  subscribeNewsletter: { type: Boolean, default: false },
  consentToTerms: { type: Boolean }, //required: true },
  consentToPrivacyPolicy: { type: Boolean },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('verify',verifySchema);
