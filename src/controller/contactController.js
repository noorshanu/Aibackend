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
    let { Name, Email, subject, phoneNumber, Message } = req.body;

    // Trim values
    Name = Name.trim();
    Email = Email.trim();
    subject = subject.trim();
    Message = Message.trim();

    // Basic Validation
    if (!Name || !Email || !subject || !phoneNumber || !Message) {
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
    });
    await newContact.save();

    // Send Email to User
    await sendEmail(
      Email,
      "Thank You for Contacting ZoctorAi!",
      `<h3>Hello ${Name},</h3>
      <p>Thank you for reaching out to us regarding "<strong>${subject}</strong>".</p>
      <p>We have received your request and will get back to you as soon as possible.</p>
      <p>For further inquiries, feel free to reply to this email.</p>
      <br>
      <p>Best Regards,</p>
      <p><strong>ZoctorAi Support Team</strong></p>`
    );

    // Send Email to Admin
    const adminEmail = "noreplyzoctorai@gmail.com"; // Replace with actual admin email
    await sendEmail(
      adminEmail,
      "New Contact Request - ZoctorAi",
      `<h3>New Contact Request Received</h3>
      <p><strong>Name:</strong> ${Name}</p>
      <p><strong>Email:</strong> ${Email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Phone Number:</strong> ${phoneNumber}</p>
      <p><strong>Message:</strong> ${Message}</p>
      <br>
      <p>Check your admin panel for more details.</p>`
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
