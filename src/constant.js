const refreshTokenOption = {
  httpOnly: true,
  secure: true,
  msxage: 604800000, // 7 * 24 * 60 * 60 * 1000 (e.g., 1 week)
};

const jwtExpiresIn = {
  refreshToken: "7d",
  accesstoken: "1h",
};
module.exports={
    refreshTokenOption,jwtExpiresIn
}
