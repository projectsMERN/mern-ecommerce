const express = require('express');
const passport = require('passport');
const { createUser, loginUser, checkAuth, logout, resetPasswordRequest, resetPassword, otpVerification } = require('../controller/Auth');


const router = express.Router();
//  /auth is already added in base path
router.post('/signup', createUser)
.post('/login', passport.authenticate('local'), loginUser)
.get('/check',passport.authenticate('jwt'), checkAuth)
.get('/logout', logout)
.post('/reset-password-request', resetPasswordRequest)
.post('/reset-password', resetPassword)
.get('/otp-verification', otpVerification)

exports.router = router;
