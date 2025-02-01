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
  AskQuestion,
} = require("../controller/userController"); // Use require() instead of just referencing the path
const { authenticate,authorization } = require("../middleware/mid");

// Define the route for email verification
router.post("/register", register);
router.get("/getUser/:userId", authenticate, authorization, getUser);
router.get("/email-verify", emailVerify);
router.post("/login", loginUser);
router.post("/logout", authenticate, logoutUser);
router.put("/updateUser/:userId", authenticate, updateUser);
router.post("/uploadFile", upload.single("report"), uploadFile);
router.post("/AskQuestion", authenticate, AskQuestion);

// eslint-disable-next-line no-undef
module.exports = router;
