const User = require("../model/usermodel");
const crypto = require("crypto");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const nodemailer = require("nodemailer");
const axios = require("axios");
const Bottleneck = require("bottleneck");

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
    const existingUser = await User.findOne({
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
    const newUser = new User({
      username,
      email,
      password, // Hash the password
      firstName,
      lastName,
      phoneNumber,
      description,
      preferredLanguage,
      preferredContactMethod, // Save the preferred contact methods
      verified: false,
      verificationToken,
    });
    await newUser.save();

    // Construct verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/email-verify?token=${verificationToken}&email=${email}`;
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
    return res
      .status(500)
      .json({
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

    // Fields not allowed to be updated
    if ("email" in updates || "username" in updates) {
      return res.status(400).json({
        status: false,
        msg: "Updating email or username is not allowed",
      });
    }

    // Validate password and confirm password
    if (updates.password) {
      if (
        !updates.confirmpassword ||
        updates.password !== updates.confirmpassword
      ) {
        return res.status(400).json({
          status: false,
          msg: "Password and Confirm Password do not match",
        });
      }
    }

    // Find and update user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, msg: "User not found" });
    }

    // Update fields dynamically
    Object.keys(updates).forEach((key) => {
      if (key !== "confirmpassword") {
        user[key] = updates[key];
      }
    });

    // Save user (triggers `pre('save')` for password hashing if password is updated)
    await user.save();

    // Exclude sensitive fields from the response
    const { password, verificationToken, ...safeUser } = user.toObject();

    return res.status(200).json({
      status: true,
      msg: "User updated successfully",
      data: safeUser,
    });
  } catch (error) {
    console.error("Error during user update:", error);
    return res.status(500).json({
      status: false,
      msg: "An error occurred while updating the user",
    });
  }
};

const emailVerify = async (req, res) => {
  try {
    const { token, email } = req.query; // Get token and email from query params
    console.log("Verification request:", req.query);

    // Find user by token and email
    const user = await User.findOne({
      verificationToken: token,
      email,
    });

    if (!user) {
      return res
        .status(404)
        .json({ msg: "Invalid or expired verification token" });
    }

    // Mark user as verified
    user.verified = true;
    user.verificationToken = undefined; // Clear the token
    await user.save();

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
          <p>Thanks for signing up for Deelance.</p>
          <p>Please click the link below to verify your account:</p>
          <a href="${verificationUrl}">Verify your account</a>
          <p>Cheers,<br/>The Deelance Team</p>
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
    const prompt = `
You are a medical report analyzer. Analyze the following medical report thoroughly and provide a comprehensive response, including:

1. **Key Observations**:
   - Highlight critical findings, specific values (e.g., blood pressure, cholesterol levels, glucose levels), and their medical implications.
   - Identify any abnormal or noteworthy values and explain their significance.

2. **Summary**:
   - Provide a concise summary of the patient's overall health based on the report.
   - Mention any patterns or trends observed in the data.

3. **Actionable Recommendations**:
   - Suggest specific actions the patient should take, including lifestyle changes, dietary recommendations, and the need for further medical consultation.
   - If applicable, recommend additional tests or follow-ups for better assessment.

4. **Additional Notes**:
   - Mention anything unusual or areas that require clarification from the patient or healthcare provider.

Ensure the response is clear, concise, and formatted using bullet points for easy understanding.

**Report Content**:
${pdfText}
`;


    const response = await model.generateContent(prompt);

    // Return the text of the response
    return response.response.text();
  } catch (error) {
    console.error("Error analyzing medical report with Gemini:", error.message);
    throw new Error("Failed to analyze medical report.");
  }
};

// Route handler to process file upload and analyze the medical report
const uploadFile = async (req, res) => {
  let pdfBuffer;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    pdfBuffer = fs.readFileSync(req.file.path);

    // Extract text from the PDF
    const extractedText = await extractTextFromPDF(pdfBuffer);

    // Analyze the extracted text using Gemini
    const analysisResult = await analyzeMedicalReport(extractedText);

    // Respond with the analysis
    res.status(200).json({
      message: "Medical report analysis complete",
      analysis: analysisResult,
    });
  } catch (error) {
    console.error("Error processing PDF:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    // Clean up the uploaded file if it exists
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
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

module.exports = {
  emailVerify,
  register,
  loginUser,
  logoutUser,
  updateUser,
  AskQuestion,
  uploadFile,
  getUser,
};
