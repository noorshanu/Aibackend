const mongoose = require("mongoose");
const { JsonWebTokenError } = require("jsonwebtoken");

const User = require("../model/usermodel");
const jwt = require("jsonwebtoken");

const authenticate = async (req, res, next) => {
  try {
    const authHeader =
      req.headers.authorization?.split(" ")[1] || req.cookies.accessToken;

    if (!authHeader) {
      return res.status(401).json({ status: "false", msg: "Invalid token" });
    }

    const _token = authHeader.replace("Bearer ", "");

    try {
      const decodedToken = jwt.verify(_token, process.env.ACCESS_TOKEN_SECRET);

      if (!decodedToken) {
        return res
          .status(401)
          .json({ status: false, msg: "Decoded token not matched" });
      }

      const user = await User.findById(decodedToken.user_id);

      if (!user) {
        return res
          .status(400)
          .json({ status: false, msg: "Invalid access token" });
      }

      req.user = user;
      next();
    } catch (verifyError) {
      console.error("JWT Verification Error:", verifyError.message);
      return res.status(401).json({ status: false, msg: "Invalid token" });
    }
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ status: false, msg: "Server error", error });
  }
};

const authorization = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const decodedToken = req.user._id;
    if (!decodedToken) {
      return res
        .status(401)
        .json({ status: false, msg: "decoded token not found" });
    }
    if (!userId) {
      return res
        .status(401)
        .json({ status: false, msg: "userId is required in params" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(401)
        .json({ status: false, msg: "can not find user  with this userID" });
    }
    if (decodedToken.toString() !== user._id.toString()) {
      return res
        .status(403)
        .json({ status: false, msg: "you are not authorized " });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ status: false, msg: "server error", error });
  }
};

module.exports = { authenticate, authorization };
