const User = require("../model/usermodel");
const crypto = require("crypto");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const nodemailer = require("nodemailer");
const axios = require("axios");
const Bottleneck = require("bottleneck");
const verify = require("../model/verifyModel");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");
const { pipeline } = require("stream");

const { v4: uuidv4 } = require("uuid");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const path = require("path");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "noreplyzoctorai@gmail.com",
    pass: "dozt eicc wbih ssqe",
  },
});
const generateAccessAndRefreshTokens = async (user) => {
  try {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error);
    throw new Error("Token generation failed");
  }
};

const RefreshToken = async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies.refreshToken ||
      req.body.refreshToken ||
      req.headers["refresh-token"];

    if (!incomingRefreshToken) {
      return res
        .status(401)
        .json({ status: false, msg: "Refresh token is required" });
    }

    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decoded.user_id);

    if (!user || user.refreshToken !== incomingRefreshToken) {
      return res
        .status(403)
        .json({ status: false, msg: "Invalid refresh token" });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      status: true,
      accessToken,
      msg: "Access token refreshed successfully",
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    return res
      .status(401)
      .json({ status: false, msg: "Invalid or expired refresh token" });
  }
};
const register = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      confirmpassword,
      firstName,
      lastName,
      phoneNumber,
      description,
      preferredContactMethod, // Add this field
      preferredLanguage,
    } = req.body;

    // Validate required fields
    if (
      !username ||
      !email ||
      !password ||
      !confirmpassword ||
      !firstName ||
      !lastName ||
      !phoneNumber ||
      !description ||
      !preferredContactMethod ||
      !preferredLanguage
    ) {
      return res
        .status(400)
        .json({ status: false, msg: "All fields are required" });
    }

    // Check if passwords match
    if (password !== confirmpassword) {
      return res.status(400).json({
        status: false,
        msg: "Password and Confirm Password do not match",
      });
    }

    // Validate `preferredContactMethod` field
    if (
      !Array.isArray(preferredContactMethod) ||
      preferredContactMethod.length === 0
    ) {
      return res.status(400).json({
        status: false,
        msg: "Preferred contact method must be an array with at least one option",
      });
    }

    const validContactMethods = ["email", "phone", "sms"];
    const isValidContactMethods = preferredContactMethod.every((method) =>
      validContactMethods.includes(method)
    );

    if (!isValidContactMethods) {
      return res.status(400).json({
        status: false,
        msg: "Invalid contact method(s) selected",
      });
    }

    // Check if user already exists
    const existingUser = await verify.findOne({
      $or: [{ email }, { username }],
    });
    if (existingUser) {
      return res.status(400).json({
        status: false,
        msg: "User is already registered with this username or email",
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(20).toString("hex");

    // Create and save the user
    const newUser = new verify({
      username,
      email,
      password, // Hash the password
      firstName,
      lastName,
      phoneNumber,
      description,
      preferredLanguage,
      preferredContactMethod, // Save the preferred contact methods

      verificationToken,
    });
    await newUser.save();

    // Construct verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/email-verify?token=${verificationToken}&email=${newUser.email}`;
    console.log(verificationUrl);

    // Send verification email
    await sendVerificationEmail(username, email, verificationUrl);

    return res.status(201).json({
      status: true,
      message: "Verification email sent successfully",
      data: verificationUrl,
    });
  } catch (error) {
    console.error("Error during user registration:", error);
    return res
      .status(500)
      .json({ status: false, msg: "Failed to register user" });
  }
};
const getUser = async (req, res) => {
  try {
    const { userId } = req.params; // Extract UserID from req.params
    if (!userId) {
      return res.status(400).json({ status: false, msg: "Provide UserID" });
    }

    const data = await User.findById(userId).select("-password -refreshToken"); // Exclude password
    if (!data) {
      return res
        .status(404)
        .json({ status: false, msg: "User not found with this UserID" });
    }

    return res
      .status(200)
      .json({ status: true, msg: "User fetched successfully", data });
  } catch (error) {
    console.error("Error fetching user:", error.message);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
      error: error.message,
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    console.log("🔍 Updating user:", userId);
    console.log("📦 Received updates:", updates);

    // Check if email or username is being updated (not allowed)
    if ("email" in updates || "username" in updates) {
      return res.status(400).json({
        status: false,
        msg: "Updating email or username is not allowed",
      });
    }

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("❌ Invalid userId format:", userId);
      return res
        .status(400)
        .json({ status: false, msg: "Invalid userId format" });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      console.error("❌ User not found:", userId);
      return res.status(404).json({ status: false, msg: "User not found" });
    }

    // Update user fields dynamically
    Object.keys(updates).forEach((key) => {
      if (key !== "confirmpassword") {
        user[key] = updates[key];
      }
    });

    // Save user (triggers validation & hashing if needed)
    await user.save();

    // Exclude sensitive fields from response
    const { password, verificationToken, ...safeUser } = user.toObject();

    console.log("✅ User updated successfully:", safeUser);
    return res.status(200).json({
      status: true,
      msg: "User updated successfully",
      data: safeUser,
    });
  } catch (error) {
    console.error("🔥 ERROR UPDATING USER:", error.message, error.stack);
    return res.status(500).json({
      status: false,
      msg: "An error occurred while updating the user",
      error: error.message, // Send detailed error message
    });
  }
};

const emailVerify = async (req, res) => {
  try {
    const { token, email } = req.query; // Get token and email from query params
    console.log("Verification request:", req.query);

    // Find user by token and email
    const verifyDocument = await verify.findOne({
      verificationToken: token,
      email,
    });

    if (!verifyDocument) {
      return res
        .status(404)
        .json({ msg: "Invalid or expired verification token" });
    }

    // Mark user as verified
    const newUser = new User({
      ...verifyDocument.toObject(),
      verified: true,
      verificationToken: undefined,
    });
    await newUser.save();
    await verify.deleteOne({ _id: verifyDocument._id });
    return res.status(200).json({ msg: "Email verified successfully" });
  } catch (error) {
    console.error("Error verifying email:", error);
    return res
      .status(500)
      .json({ msg: "Error verifying email", error: error.message });
  }
};

const sendVerificationEmail = async (username, email, verificationUrl) => {
  const emailData = {
    from: "noreplyzoctorai@gmail.com",
    to: email,
    subject: "Verify your Email! - ",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
      </head>
      <body>
          <p>Hello ${username},</p>
          <p>Thanks for signing up for zoctorai.</p>
          <p>Please click the link below to verify your account:</p>
          <a href="${verificationUrl}">Verify your account</a>
          <p>Cheers,<br/>The zoctorai Team</p>
      </body>
      </html>
    `,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(emailData, (err, info) => {
      if (err) {
        console.error("Error sending verification email:", err);
        reject(err);
      } else {
        console.log("Email sent:", info.response);
        resolve(info);
      }
    });
  });
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ status: false, msg: "User not found" });
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
      return res
        .status(400)
        .json({ status: false, msg: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user
    );
    try {
      user.refreshToken = refreshToken;
      await user.save();
    } catch (updateError) {
      console.log("updateError = ", updateError);
    }
    res.cookie("accessToken", accessToken, { httpOnly: true, secure: true });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // Prevents JavaScript access to cookies
      secure: false, // Allows cookies to be sent over HTTP
      sameSite: "strict", // Prevents cross-site request forgery
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });
    return res.status(200).json({
      status: true,
      msg: "Login successful",
      accessToken,
      userId: user._id,
      firstName: user.firstName,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ status: false, msg: "Internal server error" });
  }
};

const logoutUser = async (req, res) => {
  try {
    // Step 1: Clear cookies to log out the user on the client side
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    // Step 2: Invalidate refresh token in the database
    const user = await User.findById(req.user._id);
    if (user) {
      user.refreshToken = undefined; // Invalidate token
      await user.save(); // Save changes
    }

    // Step 3: Send a success response
    return res.status(200).json({
      success: true,
      message: "User logged out successfully",
      data: {},
    });
  } catch (error) {
    // Step 4: Handle errors gracefully
    return res.status(500).json({
      success: false,
      message: "An error occurred while logging out the user",
      error: error.message,
    });
  }
};

async function sendPasswordResetEmail(to, resetLink) {
  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Reset Password - ZoctorAi</title>
    <style>
        :root {
            color-scheme: light dark;
        }
        .hover-bg-primary:hover {
            background-color: #4338ca !important;
        }
        .hover-shadow:hover {
            box-shadow: 0 8px 16px rgba(0,0,0,0.1) !important;
        }
        @media (max-width: 600px) {
            .sm-w-full { width: 100% !important; }
            .sm-py-8 { padding: 32px 24px !important; }
            .sm-px-6 { padding-left: 24px !important; padding-right: 24px !important; }
            .sm-leading-8 { line-height: 32px !important; }
        }
        @media (prefers-color-scheme: dark) {
            body { background-color: #1a1a1a !important; }
            .dark-mode-bg { background-color: #262626 !important; }
            .dark-mode-text { color: #e5e5e5 !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; word-break: break-word; -webkit-font-smoothing: antialiased; background-color: #f3f4f6;">
    <div role="article" aria-roledescription="email" lang="en">
        <table style="width: 100%; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
                <td align="center" style="padding: 24px 0;">
                    <table class="sm-w-full" style="width: 600px; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);" cellpadding="0" cellspacing="0" role="presentation">
                        <!-- Header -->
                        <tr>
                            <td style="padding: 32px 40px; background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);">
                                <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; text-align: center;">
                                    ZoctorAi
                                </h1>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td class="sm-px-6" style="padding: 40px;">
                                <div style="border-radius: 8px; background-color: #ffffff;">
                                    <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 24px; font-weight: 600;">
                                        Password Reset Request
                                    </h2>
                                    <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 24px;">
                                        Hello,
                                    </p>
                                    <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 24px;">
                                        We received a request to reset your password for your ZoctorAi account. Click the button below to reset it:
                                    </p>
                                    <div style="text-align: center; margin: 32px 0;">
                                        <a href="${resetLink}" 
                                           class="hover-bg-primary hover-shadow" 
                                           style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; transition: all 0.2s ease;">
                                            Reset Password
                                        </a>
                                    </div>
                                    <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 20px;">
                                        If you didn't request this password reset, please ignore this email or contact support if you have concerns.
                                    </p>
                                </div>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 32px 40px; background-color: #f9fafb; text-align: center;">
                                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                    &copy; ${new Date().getFullYear()} ZoctorAi. All rights reserved.
                                </p>
                                <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">
                                    Your Trusted Healthcare AI Assistant
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>`;

  const mailOptions = {
    from: "noreplyzoctorai@gmail.com",
    to,
    subject: "Reset Password - ZoctorAi",
    html: emailHtml,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log("Email inviata con successo:", result);
  } catch (error) {
    console.error("Errore nell'invio dell'email:", error);
  }
}
const forgotpassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send("User not found");
    }

    const token = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);
    // Send email with resetUrl...

    res.status(200).send({
      msg: "Password reset link sent to your email address. Please reset your password!",
      data: resetUrl,
    });
  } catch (error) {
    console.error("Failed to initiate password reset:", error);
    res.status(500).send({ msg: "Failed to initiate password reset" });
  }
};
const resetPasswordtoken = async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    if (!password) {
      return res.status(400).send({ msg: "Please enter a new password" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .send({ msg: "Password must be at least 8 characters long" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send("Invalid or expired token");
    }

    const isSamePassword = await user.isPasswordCorrect(password); // Compare passwords
    if (isSamePassword) {
      return res
        .status(400)
        .send("New password cannot be the same as the old password");
    }

    // If the new password is different, update the password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshToken = undefined;

    await user.save();

    res
      .status(200)
      .send({ status: true, msg: "Password changed successfully!" });
  } catch (error) {
    console.error("Failed to reset password:", error);
    res.status(500).send({ msg: "Failed to reset password" });
  }
};

// const extractTextFromPDF = async (pdfBuffer) => {
//   try {
//     const data = await pdfParse(pdfBuffer);
//     return data.text;
//   } catch (error) {
//     throw new Error("Error extracting text from PDF");
//   }
// };

// const { GoogleGenerativeAI } = require("@google/generative-ai");

// const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY); // Set your API key in environment variables

// const analyzeMedicalReport = async (pdfText) => {
//   try {
//     const model = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
//     const response = await model.generateContent(
//       `A user uploaded a medical report. Analyze it and provide key observations and actionable recommendations in a clear, empathetic tone.\n\nReport Content:\n${pdfText}`
//     );

//     return response.response.text();
//   } catch (error) {
//     console.error("Error analyzing medical report with Gemini:", error.message);
//     throw new Error("Failed to analyze medical report.");
//   }
// };

// // Route handler to process file upload and analyze the medical report
// const uploadFile = async (req, res) => {
//   let pdfBuffer;
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: "No file uploaded" });
//     }

//     pdfBuffer = fs.readFileSync(req.file.path);

//     // Extract text from the PDF
//     const extractedText = await extractTextFromPDF(pdfBuffer);

//     // Analyze the extracted text using Gemini
//     const analysisResult = await analyzeMedicalReport(extractedText);

//     // Respond with the analysis
//     res.status(200).json({
//       message: "Medical report analysis complete",
//       analysis: analysisResult,
//     });
//   } catch (error) {
//     console.error("Error processing PDF:", error.message);
//     res.status(500).json({ error: error.message });
//   } finally {
//     // Clean up the uploaded file if it exists
//     if (req.file) {
//       fs.unlinkSync(req.file.path);
//     }
//   }
// };

// const extractTextFromPDF = async (pdfBuffer) => {
//   try {
//     const data = await pdfParse(pdfBuffer);
//     return data.text;
//   } catch (error) {
//     throw new Error("Error extracting text from PDF");
//   }
// };

// // Helper function to call Gemini API for medical report analysis
// const analyzeMedicalReport = async (pdfText) => {
//   try {
//     const response = await axios.post(
//       "https://gemini.googleapis.com/v1/chat/completions", // Replace with the actual Gemini endpoint
//       {
//         model: "gemini-1.5-flash", // Update with the correct model name
//         messages: [
//           {
//             role: "user",
//             content: `A user uploaded a medical report. Analyze it and provide key observations and actionable recommendations in a clear, empathetic tone.\n\nReport Content:\n${pdfText}`,
//           },
//         ],
//         max_tokens: 1000, // Adjust as needed
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.GOOGLE_API_KEY}`, // Ensure you have this in your environment variables
//           "Content-Type": "application/json",
//         },
//       }
//     );
//     return response.data.choices[0].message.content; // Adjust if the Gemini response differs
//   } catch (error) {
//     console.error(
//       "Error calling Gemini API:",
//       error.response ? error.response.data : error.message
//     );
//     throw new Error("API call to Gemini failed");
//   }
// };

// // Route handler to process file upload and analyze the medical report
// const uploadFile = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: "No file uploaded" });
//     }

//     const pdfBuffer = fs.readFileSync(req.file.path);

//     // Extract text from the PDF
//     const extractedText = await extractTextFromPDF(pdfBuffer);

//     // Analyze the extracted text using Gemini
//     const analysisResult = await analyzeMedicalReport(extractedText);

//     // Respond with the analysis
//     res.status(200).json({
//       message: "Medical report analysis complete",
//       analysis: analysisResult,
//     });

//     // Clean up the uploaded file
//     fs.unlinkSync(req.file.path);
//   } catch (error) {
//     console.error("Error processing PDF:", error.message);
//     res.status(500).json({ error: error.message });
//   }
// };

// // Route handler to answer user questions based on the analysis
//======================main code ===============================//
const { PDFExtract } = require("pdf.js-extract");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const pdfExtract = new PDFExtract();

// Function to extract text from PDF using pdf.js-extract
const extractTextFromPDF = async (pdfBuffer) => {
  return new Promise((resolve, reject) => {
    pdfExtract.extractBuffer(pdfBuffer, {}, (err, data) => {
      if (err) {
        return reject(
          new Error(`Error extracting text from PDF: ${err.message}`)
        );
      }
      // Combine text from all pages
      const extractedText = data.pages
        .map((page) => page.content.map((item) => item.str).join(" "))
        .join("\n");
      resolve(extractedText);
    });
  });
};

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY); // Set your API key in environment variables

// Analyze medical report using Gemini model
const analyzeMedicalReport = async (pdfText) => {
  try {
    const model = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Refined prompt for clearer output
    // const prompt = `
    //   Analyze the following medical report and provide:
    //   1. A summary of key observations, including specific values and what they indicate.
    //   2. Actionable recommendations for the patient based on these observations.
    //   Ensure the response is clear, concise, and formatted with bullet points for easy reading.

    //   Report Content:
    //   ${pdfText}
    // `;
    //     const prompt = `
    // You are a medical report analyzer. Analyze the following medical report thoroughly and provide a comprehensive response, including:

    // 1. **Key Observations**:
    //    - Highlight critical findings, specific values (e.g., blood pressure, cholesterol levels, glucose levels), and their medical implications.
    //    - Identify any abnormal or noteworthy values and explain their significance.

    // 2. **Summary**:
    //    - Provide a concise summary of the patient's overall health based on the report.
    //    - Mention any patterns or trends observed in the data.

    // 3. **Actionable Recommendations**:
    //    - Suggest specific actions the patient should take, including lifestyle changes, dietary recommendations, and the need for further medical consultation.
    //    - If applicable, recommend additional tests or follow-ups for better assessment.

    // 4. **Additional Notes**:
    //    - Mention anything unusual or areas that require clarification from the patient or healthcare provider.

    // Ensure the response is clear, concise, and formatted using bullet points for easy understanding.

    // **Report Content**:
    // ${pdfText}
    // `;
    const prompt = `
    You are an advanced AI-powered healthcare assistant tasked with generating a comprehensive medical report based on the provided patient data. Follow the structured template below for analysis and recommendations.

    ---

    ### **Patient Medical Report Analysis**
    #### **1. Key Observations:**
    - Extract critical findings from the report, highlighting important values such as blood pressure, cholesterol, glucose levels, BMI, and heart rate.
    - Identify any abnormal or borderline values and explain their significance.
    - Compare current values with normal medical standards.

    #### **2. Executive Health Summary:**
    - Provide a high-level summary of the patient's overall health status.
    - Mention if the patient’s health trends are improving or deteriorating.

    #### **3. Biological Age Analysis:**
    - Chronological Age: (Extract from the report)
    - Estimated Biological Age: (Analyze based on key health metrics)
    - Compare biological vs. chronological age and provide an interpretation.

    #### **4. Health Metrics Overview (Tabular Format):**
    | Metric         | Current Value | Normal Range | Observation & Trend |
    |---------------|--------------|--------------|----------------------|
    | BMI           | [Extract]     | 18.5–24.9    | [Improving/Worsening] |
    | Blood Pressure| [Extract]     | 120/80 mmHg  | [Improving/Worsening] |
    | Blood Sugar   | [Extract]     | 70–99 mg/dL  | [Improving/Worsening] |
    | Cholesterol   | [Extract]     | <200 mg/dL   | [Improving/Worsening] |
    | Heart Rate    | [Extract]     | 60–100 bpm   | [Improving/Worsening] |

    #### **5. Trend Analysis & Long-term Impact:**
    - Identify trends in health metrics based on previous data.
    - Predict possible long-term health risks if the current trends persist.
    - Recommend lifestyle or medical interventions to improve outcomes.

    #### **6. Risk Assessment & Recommendations:**
    List the top 3 health risks with severity levels (High, Medium, Low) and interventions:

    - **Risk 1:** [Condition] - Severity: [High/Medium/Low] - Suggested action: [Lifestyle change, medical treatment, etc.]
    - **Risk 2:** [Condition] - Severity: [High/Medium/Low] - Suggested action: [Lifestyle change, medical treatment, etc.]
    - **Risk 3:** [Condition] - Severity: [High/Medium/Low] - Suggested action: [Lifestyle change, medical treatment, etc.]

    #### **7. Recommended Treatments & Specialist Hospitals:**
    Provide hospitals that specialize in treating identified conditions.

    - **Condition:** [Extract from Report]
    - **Recommended Hospitals:** [Dynamic list from database]

    #### **8. Medication Insights & Interactions:**
    - List any prescribed medications and their effects.
    - Identify potential interactions with other medications.
    - Suggest alternative treatments if necessary.

    #### **9. Nutritional Supplements & Diet Recommendations:**
    - Recommend specific vitamins and supplements based on deficiencies in the report.
    - Provide detailed dosages, timing, and precautions.

    #### **10. Personalized Exercise & Mental Health Recommendations:**
    - Suggest exercises suitable for the patient’s condition.
    - Assess mental health status and provide stress management techniques.

    #### **11. Preventive Screening & Next Steps:**
    - Suggest future screenings based on age and health risks.
    - List actionable steps the patient should take, such as scheduling a doctor’s appointment or adopting new lifestyle habits.

    ---

    ### **Report Content for Analysis:**
    ${pdfText}

    ---

    **Instructions for AI:**
    - Ensure clarity, proper formatting, and bullet points for easy readability.
    - Avoid unnecessary repetition and keep insights concise yet comprehensive.
    - Where applicable, use medical guidelines to justify observations and recommendations.

    ---

    **Now, analyze the report based on this template and generate the output.**
    `;

    const response = await model.generateContent(prompt);
    return response.response.text();
  } catch (error) {
    console.error("Error analyzing medical report with Gemini:", error);
    throw new Error("Failed to analyze medical report.");
  }
};

// Route handler to process file upload and analyze the medical report
// const uploadFile = async (req, res) => {
//   let pdfBuffer;
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: "No file uploaded" });
//     }

//     pdfBuffer = fs.readFileSync(req.file.path);

//     // Extract text from the PDF
//     const extractedText = await extractTextFromPDF(pdfBuffer);

//     // Analyze the extracted text using Gemini
//     const analysisResult = await analyzeMedicalReport(extractedText);

//     // Respond with the analysis
//     res.status(200).json({
//       message: "Medical report analysis complete",
//       analysis: analysisResult,
//     });
//   } catch (error) {
//     console.error("Error processing PDF:", error.message);
//     res.status(500).json({ error: error.message });
// } finally {
//   // Clean up the uploaded file if it exists
//   if (req.file) {
//     fs.unlinkSync(req.file.path);
//   }
//   }
// };

const pdfModel = require("../model/pdfModel");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const cleanUploadsFolder = () => {
  const uploadDir = path.join(__dirname, "../uploads");

  if (!fs.existsSync(uploadDir)) return;

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error("⚠️ Error reading uploads folder:", err);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(uploadDir, file);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`⚠️ Error deleting file: ${filePath}`, err);
        } else {
          console.log(`✅ Deleted file: ${filePath}`);
        }
      });
    });
  });
};
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Unauthorized user" });

    // Ensure upload directory exists
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `${Date.now()}_${req.file.originalname}`;
    const filePath = path.join(uploadDir, fileName);

    // **Save file locally using buffer**
    fs.writeFileSync(filePath, req.file.buffer);
    console.log("✅ File saved locally:", filePath);

    // **Extract text if PDF**
    let summary = null;
    if (req.file.mimetype === "application/pdf") {
      try {
        const extractedText = await extractTextFromPDF(req.file.buffer);
        summary = await analyzeMedicalReport(extractedText);
      } catch (pdfError) {
        console.error("⚠️ PDF Processing Error:", pdfError.message);
      }
    }

    // **Upload file to AWS S3**
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer, // Use buffer instead of readStream
      ContentType: req.file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));

    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    console.log("✅ File uploaded to AWS:", fileUrl);

    // **Delete only files inside uploads folder**
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("✅ Local file deleted:", filePath);
    } else {
      console.warn("⚠️ Skipping deletion (file not found):", filePath);
    }

    // **Save details in MongoDB**
    await pdfModel.create({
      userId,
      fileName,
      fileUrl,
      summary,
    });

    console.log("✅ File details saved in MongoDB.");

    res.status(200).json({
      message: "File uploaded successfully",
      fileUrl,
      summary,
    });
  } catch (error) {
    console.error("❌ Upload Error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    cleanUploadsFolder();
  }
};

const getAllUserReports = async (req, res) => {
  try {
    const userId = req.user?.user_id; // Logged-in user ID
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    // **Find all reports belonging to the user**
    const userReports = await pdfModel.find({ userId });

    if (userReports.length === 0) {
      return res
        .status(404)
        .json({ message: "No reports found for this user" });
    }

    res.status(200).json({
      message: "Reports retrieved successfully",
      reports: userReports,
    });
  } catch (error) {
    console.error(" Error fetching reports:", error.message);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};

const downloadUserReport = async (req, res) => {
  try {
    const userId = req.user?.user_id; // Logged-in user ID
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    const { fileName } = req.params;

    // **Find the file in MongoDB and verify ownership**
    const fileRecord = await pdfModel.find({ fileName, userId });

    if (!fileRecord) {
      return res
        .status(403)
        .json({ error: "Access denied: File not found or unauthorized" });
    }

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
    };

    const command = new GetObjectCommand(params);
    const { Body, ContentType } = await s3.send(command);

    res.setHeader("Content-Type", ContentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // **Stream file from S3 to response**
    pipeline(Body, res, (err) => {
      if (err) {
        console.error("❌ Stream error:", err);
        res.status(500).json({ error: "File streaming failed" });
      }
    });
  } catch (error) {
    console.error("❌ Download Error:", error.message);
    res.status(500).json({ error: "File download failed" });
  }
};

const AskQuestion = async (req, res) => {
  try {
    const { question, context } = req.body;

    if (!question || !context) {
      return res.status(400).json({
        success: false,
        message: "Both question and context are required.",
      });
    }

    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/chat/completions", // Correct endpoint
      {
        model: "gemini-1.5-flash", // Ensure this model name is correct
        messages: [
          {
            role: "user",
            content: `A user received the following medical report analysis:\n${context}\n\nThe user asks: "${question}". Provide a clear and helpful answer.`,
          },
        ],
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GOOGLE_API_KEY}`, // Correctly set in headers
          "Content-Type": "application/json",
        },
      }
    );

    // Adjust response handling based on actual API response structure
    const answer = response.data.choices[0].message.content; // Ensure this matches the API's response format

    res.status(200).json({
      success: true,
      message: "Question answered successfully.",
      answer,
    });
  } catch (error) {
    console.error("Error answering question:", error.message);
    res.status(500).json({
      success: false,
      message: error.response
        ? error.response.data
        : "Error answering question.",
    });
  }
};
// const path = require("path");

// const { PDFExtract } = require("pdf.js-extract");
// const Tesseract = require("tesseract.js");
// const { GoogleGenerativeAI } = require("@google/generative-ai");

// const pdfExtract = new PDFExtract();
// const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY); // Set your API key in environment variables

// // Function to extract text from PDF using pdf.js-extract
// const extractTextFromPDF = async (pdfBuffer) => {
//   return new Promise((resolve, reject) => {
//     pdfExtract.extractBuffer(pdfBuffer, {}, (err, data) => {
//       if (err) {
//         return reject(new Error(`Error extracting text from PDF: ${err.message}`));
//       }

//       // Combine text from all pages
//       const extractedText = data.pages
//         .map((page) => page.content.map((item) => item.str).join(" "))
//         .join("\n");
//       resolve(extractedText);
//     });
//   });
// };

// // Function to perform OCR on images using Tesseract.js
// const performOCR = async (imagePath) => {
//   try {
//     const { data } = await Tesseract.recognize(imagePath, "eng", {
//       logger: (info) => console.log(info), // Log progress
//     });
//     return data.text.trim();
//   } catch (error) {
//     throw new Error(`Error performing OCR: ${error.message}`);
//   }
// };

// // Function to analyze medical report using AI model
// const analyzeMedicalReport = async (pdfText) => {
//   try {
//     if (!pdfText || pdfText.trim() === "") {
//       throw new Error("Extracted text is empty. Please provide a valid medical report.");
//     }

//     const prompt = `You are a medical report analyzer. Analyze the following medical report thoroughly and provide:
// 1. A concise summary of key observations limited to 60 words.
// 2. A detailed analysis of the patient's overall health based on the report.

// **Report Content**:
// ${pdfText}
// `;

//     const model = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
//     const response = await model.generateContent(prompt);

//     // Validate the AI response structure
//     if (!response || !response.response || typeof response.response.text !== "string") {
//       throw new Error("Invalid response from AI model. Ensure the API key is valid and the model is accessible.");
//     }

//     const fullResponseText = response.response.text.trim();

//     // Handle the AI's response structure
//     let conciseSummary = "Summary not found.";
//     let detailedAnalysis = "Detailed analysis not found.";

//     if (fullResponseText.includes("\n\n")) {
//       const [summary, ...analysisParts] = fullResponseText.split("\n\n");
//       conciseSummary = summary.split(" ").slice(0, 60).join(" "); // Limit to 60 words
//       detailedAnalysis = analysisParts.join("\n\n").trim();
//     } else {
//       // If no clear separation, assume the whole response is the analysis
//       conciseSummary = fullResponseText.split(" ").slice(0, 60).join(" ");
//       detailedAnalysis = fullResponseText;
//     }

//     return { conciseSummary, detailedAnalysis };
//   } catch (error) {
//     console.error("Error analyzing medical report with Gemini:", error.message);
//     throw new Error("Failed to analyze medical report.");
//   }
// };

// // Route handler to process file upload and analyze the medical report
// const uploadFile = async (req, res) => {
//   let filePath;
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: "No file uploaded" });
//     }

//     filePath = req.file.path;

//     const fileType = path.extname(filePath).toLowerCase();

//     let extractedText;

//     // Check if the uploaded file is a PDF or an image
//     if (fileType === ".pdf") {
//       const pdfBuffer = fs.readFileSync(filePath);
//       extractedText = await extractTextFromPDF(pdfBuffer);
//     } else if ([".png", ".jpg", ".jpeg"].includes(fileType)) {
//       // Perform OCR directly on the uploaded image
//       extractedText = await performOCR(filePath);
//     } else {
//       return res.status(400).json({ message: "Unsupported file type. Please upload a PDF or image file." });
//     }

//     console.log("Extracted Text:", extractedText);

//     // Analyze the extracted text using Gemini AI
//     const { conciseSummary, detailedAnalysis } = await analyzeMedicalReport(extractedText);

//     // Respond with both analyses
//     res.status(200).json({
//       message: "Medical report analysis complete",
//       conciseSummary,
//       detailedAnalysis,
//     });
//   } catch (error) {
//     console.error("Error processing file:", error.message);
//     res.status(500).json({ error: error.message });
//   } finally {
//     // Clean up the uploaded file if it exists
//     if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
//   }
// };

const profile = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateFields = req.body;

    // Restricted fields
    // const restrictedFields = ["email", "username", "password", "verified", "verificationToken"];
    // restrictedFields.forEach(field => delete updateFields[field]);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select("-password -refreshToken -verificationToken");

    if (!updatedUser) {
      return res.status(404).json({ status: false, msg: "User not found" });
    }

    res.status(200).json({
      status: true,
      msg: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ status: false, msg: "Failed to update profile" });
  }
};

// Helper function to upload to Cloudinary via stream
const bufferToStream = (buffer) => {
  const readable = new Readable({
    read() {
      this.push(buffer);
      this.push(null);
    },
  });
  return readable;
};

// Upload profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: false,
        msg: "Please upload an image",
      });
    }

    const userId = req.params.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: false,
        msg: "User not found",
      });
    }

    // If user already has a profile picture, delete it from Cloudinary
    if (user.profilePicture && user.profilePicture.public_id) {
      await cloudinary.uploader.destroy(user.profilePicture.public_id);
    }

    // Upload new image to Cloudinary
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "profile-pictures",
        resource_type: "auto",
      },
      async (error, result) => {
        if (error) {
          console.error("Upload to Cloudinary failed:", error);
          return res.status(500).json({
            status: false,
            msg: "Error uploading image",
          });
        }

        // Update user profile with new image URL
        user.profilePicture = {
          public_id: result.public_id,
          url: result.secure_url,
        };
        await user.save();

        res.status(200).json({
          status: true,
          msg: "Profile picture updated successfully",
          data: {
            profilePicture: user.profilePicture,
          },
        });
      }
    );

    // Convert buffer to stream and pipe to Cloudinary
    bufferToStream(req.file.buffer).pipe(stream);
  } catch (error) {
    console.error("Error in uploadProfilePicture:", error);
    res.status(500).json({
      status: false,
      msg: "Failed to upload profile picture",
      error: error.message,
    });
  }
};

// Remove profile picture
const removeProfilePicture = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: false,
        msg: "User not found",
      });
    }

    if (!user.profilePicture || !user.profilePicture.public_id) {
      return res.status(400).json({
        status: false,
        msg: "No profile picture to remove",
      });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(user.profilePicture.public_id);

    // Remove profile picture from user document
    user.profilePicture = undefined;
    await user.save();

    res.status(200).json({
      status: true,
      msg: "Profile picture removed successfully",
    });
  } catch (error) {
    console.error("Error in removeProfilePicture:", error);
    res.status(500).json({
      status: false,
      msg: "Failed to remove profile picture",
      error: error.message,
    });
  }
};

const deleteUserReport = async (req, res) => {
  try {
    const userIdFromToken = req.user?.user_id; // Extract user ID from token
    const { reportId } = req.params; // Get report ID from request params

    if (!userIdFromToken) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    // Find the report in MongoDB
    const report = await pdfModel.findOne({
      _id: reportId,
      userId: userIdFromToken,
    });
    if (!report) {
      return res
        .status(404)
        .json({ error: "Report not found or unauthorized" });
    }

    const fileKey = report.fileName; // Extract file name (AWS S3 key)

    // **Step 1: Delete file from AWS S3**
    const deleteParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
    };

    await s3.send(new DeleteObjectCommand(deleteParams));
    console.log("✅ File deleted from AWS:", fileKey);

    // **Step 2: Delete report from MongoDB**
    await pdfModel.deleteOne({ _id: reportId });

    console.log("✅ Report deleted from MongoDB.");

    res.status(200).json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("❌ Delete Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  emailVerify,
  register,
  loginUser,
  logoutUser,
  updateUser,
  AskQuestion,
  uploadFile,
  getUser,
  profile,
  forgotpassword,
  RefreshToken,
  resetPasswordtoken,
  uploadProfilePicture,
  removeProfilePicture,
  downloadUserReport,
  getAllUserReports,
  deleteUserReport,
};
