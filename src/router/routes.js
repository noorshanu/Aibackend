const express = require("express");
const router = express.Router();
const { upload } = require("../middleware/multer");

const {
  emailVerify,
  register,
  getUser,
  loginUser,
  logoutUser,
  updateUser,
  uploadFile,
  getAllUserReports,
  AskQuestion,
  profile,
  resetPasswordtoken,
  forgotpassword,
  RefreshToken,
  uploadProfilePicture,
  removeProfilePicture,
  downloadUserReport,
  deleteUserReport
} = require("../controller/userController"); // Use require() instead of just referencing the path
const { authenticate, authorization,AWSauthorization,authenticateUser } = require("../middleware/mid");
const { userContact } = require("../controller/contactController");

// Define the route for email verification
router.post("/register", register);
router.get("/getUser/:userId", authenticate, authorization, getUser);
router.get("/email-verify", emailVerify);
router.post("/login", loginUser);
router.post("/logout", authenticate, logoutUser);
router.put("/updateUser/:userId", authenticate, updateUser);
router.post("/uploadFile/:userId", authenticate, AWSauthorization,upload.single("file"), uploadFile);
router.get("/reports", authenticateUser, getAllUserReports)
router.get("/DawnloadReports/:fileName", authenticateUser, downloadUserReport)
router.delete("/deleteUserReport/:reportId", authenticateUser, deleteUserReport)
router.post("/AskQuestion", authenticate, AskQuestion);
router.post("/userContact", userContact);
router.post("/profile/:userId", authenticate, authorization, profile);
router.post("/forgot-password", forgotpassword);
router.post("/reset-password/:token", resetPasswordtoken);
router.post("/refresh-token", RefreshToken);
router.post(
  "/users/:userId/profile-picture",
  authenticate,
  upload.single("image"),
  uploadProfilePicture
);
router.delete(
  "/users/:userId/profile-picture",
  authenticate,
  removeProfilePicture
);
// eslint-disable-next-line no-undef
module.exports = router;
