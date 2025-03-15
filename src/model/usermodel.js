const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { jwtExpiresIn } = require("../constant");

const userSchema = new mongoose.Schema({
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
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String },
  },
  verificationToken: { type: String },
  IsthisWhatsappPhoneNumber: { type: Boolean },
  willingForInternationalTreatment: { type: Boolean }, // New field required: true
  willingForMedicalTourism: { type: Boolean }, // New field
  wantZoctorAICallback: { type: Boolean }, // New field
  dateOfBirth: { type: Date }, // ✅ New field: Date of Birth
  gender: { type: String, enum: ["Male", "Female", "Other"] }, // ✅ New field: Gender
  bloodType: {
    type: String,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  }, // ✅ New field: Blood Type
  profilePicture: { type: String }, // ✅ New field: Profile Picture (URL or file path)

  subscribeNewsletter: { type: Boolean, default: false },
  consentToTerms: { type: Boolean }, //required: true },
  consentToPrivacyPolicy: { type: Boolean },
  Smoking: { type: Boolean },
  alchohal: { type: Boolean },

  createdAt: { type: Date, default: Date.now },
});
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    return next(error);
  }
});
userSchema.methods.isPasswordCorrect = async function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign({ user_id: this._id }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ user_id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};

const User = mongoose.model("User", userSchema);
module.exports = User;
