const Contact = require("../model/contactModel"); // Import Mongoose model

const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASS },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to,
      subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email Sending Error:", error.message);
    return false;
  }
};

// const userContact = async (req, res) => {
//   try {
//     let { Name, Email, subject, phoneNumber, Message } = req.body;

//     // Trim values
//     Name = Name.trim();
//     Email = Email.trim();
//     subject = subject.trim();
//     Message = Message.trim();

//     // Basic Validation
//     if (!Name || !Email || !subject || !phoneNumber || !Message) {
//       return res
//         .status(400)
//         .json({ status: false, msg: "All fields are required" });
//     }

//     // Validate Email Format
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(Email)) {
//       return res
//         .status(400)
//         .json({ status: false, msg: "Invalid Email format" });
//     }

//     // Ensure phoneNumber is numeric
//     if (!/^\d+$/.test(phoneNumber)) {
//       return res
//         .status(400)
//         .json({ status: false, msg: "Phone number must be numeric" });
//     }

//     // Save Contact Request to Database
//     const newContact = new Contact({
//       Name,
//       Email,
//       subject,
//       phoneNumber,
//       Message,
//     });
//     await newContact.save();

//     // Send Email to User Only
//     await sendEmail(
//       Email,
//       "Thank You for Contacting ZoctorAi!",
//       `<h3>Hello ${Name},</h3>
//       <p>Thank you for reaching out to us regarding "<strong>${subject}</strong>".</p>
//       <p>We have received your request and will get back to you as soon as possible.</p>
//       <p>For further inquiries, feel free to reply to this email.</p>
//       <br>
//       <p>Best Regards,</p>
//       <p><strong>ZoctorAi Support Team</strong></p>`
//     );
//     res.status(200).json({
//       status: true,
//       msg: "Contact form submitted successfully. An email has been sent to you for confirmation.",
//     });
//   } catch (error) {
//     console.error("Error in userContact:", error.message);
//     res.status(500).json({ status: false, msg: "Internal Server Error" });
//   }
// };
const userContact = async (req, res) => {
  try {
    let { Name, Email, subject, phoneNumber, Message ,language} = req.body;

    // Trim values
    Name = Name.trim();
    Email = Email.trim();
    subject = subject.trim();
    Message = Message.trim();

    // Basic Validation
    if (!Name || !Email || !subject || !phoneNumber || !Message || !language) {
      return res
        .status(400)
        .json({ status: false, msg: "All fields are required" });
    }

    // Validate Email Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(Email)) {
      return res
        .status(400)
        .json({ status: false, msg: "Invalid Email format" });
    }

    // Ensure phoneNumber is numeric
    if (!/^\d+$/.test(phoneNumber)) {
      return res
        .status(400)
        .json({ status: false, msg: "Phone number must be numeric" });
    }

    // Save Contact Request to Database
    const newContact = new Contact({
      Name,
      Email,
      subject,
      phoneNumber,
      Message,
      language
    });
    await newContact.save();

    // Send Email to User
    await sendEmail(
      Email,
      "Thank You for Contacting ZoctorAi!",
      `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; background: #ffffff; margin: auto; padding: 20px; border-radius: 8px; box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1);">
          
          <!-- Logo -->
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #005dff;">
            <img src="https://zoctor-ai.vercel.app/images/logo.png" alt="ZoctorAi Logo" style="max-width: 150px;">
            <h2 style="color: #333; margin-top: 10px;">Thank You for Contacting Us!</h2>
          </div>
    
          <!-- Content -->
          <div style="padding: 20px;">
            <h3 style="color: #333;">Hello ${Name},</h3>
            <p>Thank you for reaching out to us regarding "<strong>${subject}</strong>".</p>
            <p>We have received your request and will get back to you as soon as possible.</p>
            <p>For further inquiries, feel free to reply to this email.</p>
          </div>
    
          <!-- Footer -->
          <div style="text-align: center; font-size: 12px; color: #666; padding-top: 10px; border-top: 1px solid #ddd;">
            <p>Best Regards,</p>
            <p><strong>ZoctorAi Support Team</strong></p>
            <p>© ${new Date().getFullYear()} ZoctorAi. All rights reserved.</p>
          </div>
    
        </div>
      </div>
      `
    );

    // Send Email to Admin
    const adminEmail = "noreplyzoctorai@gmail.com"; // Replace with actual admin email
    await sendEmail(
      adminEmail,
      `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; background: #ffffff; margin: auto; padding: 20px; border-radius: 8px; box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1);">
          
          <!-- Logo -->
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #005dff;">
            <img src="https://zoctor-ai.vercel.app/images/logo.png" alt="ZoctorAi Logo" style="max-width: 150px;">
            <h2 style="color: #333; margin-top: 10px;">New Contact Request</h2>
          </div>
    
          <!-- Content -->
          <div style="padding: 20px;">
            <h3 style="color: #333; text-align: center;">Customer Details</h3>
            <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin-top: 10px;">
              <p><strong style="color: #005dff;">Name:</strong> ${Name}</p>
              <p><strong style="color: #005dff;">Email:</strong> ${Email}</p>
              <p><strong style="color: #005dff;">Subject:</strong> ${subject}</p>
              <p><strong style="color: #005dff;">Phone Number:</strong> ${phoneNumber}</p>
              <p><strong style="color: #005dff;">Message:</strong> ${Message}</p>
              <p><strong style="color: #005dff;">Language:</strong> ${language}</p>
            </div>
    
            <p style="text-align: center; font-size: 14px; margin-top: 20px; color: #666;">
              Please review the customer's query.
            </p>
          </div>
    
          <!-- Footer -->
          <div style="text-align: center; font-size: 12px; color: #666; padding-top: 10px; border-top: 1px solid #ddd;">
            <p>© ${new Date().getFullYear()} ZoctorAi. All rights reserved.</p>
          </div>
    
        </div>
      </div>
      `
    );

    res.status(200).json({
      status: true,
      msg: "Contact form submitted successfully. An email has been sent to you for confirmation.",
    });
  } catch (error) {
    console.error("Error in userContact:", error.message);
    res.status(500).json({ status: false, msg: "Internal Server Error" });
  }
};

module.exports = { userContact };
