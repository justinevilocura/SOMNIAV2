import express from 'express';
import jwt from 'jsonwebtoken';
import { register, login, logout, sendVerifyOtp, verifyEmail, isAuthenticated, sendResetOtp, resetPassword, googleLogin } from '../controllers/authController.js';
import userAuth from '../middleware/userAuth.js';

const authRouter = express.Router();

// Middleware that accepts JWT (via cookie or Bearer header) OR an email address for verification
const verifyAuth = async (req, res, next) => {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const candidate = req.headers.authorization.split(' ')[1];
        if (candidate && candidate !== 'undefined' && candidate !== 'null') {
            token = candidate;
        }
    }

    if (token) {
        try {
            const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
            if (tokenDecode && tokenDecode.id) {
                req.body = req.body || {};
                req.body.userId = tokenDecode.id;
                req.user = { id: tokenDecode.id };
                return next();
            }
        } catch (_) {}
    }

    // Fallback: If request provides an email in body
    if (req.body && req.body.email) {
        return next();
    }

    return res.status(401).json({
        success: false,
        message: "Please provide valid authentication or email address."
    });
};

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.post('/send-verify-otp', verifyAuth, sendVerifyOtp);
authRouter.post('/verify-account', verifyAuth, verifyEmail);
authRouter.get('/is-auth', userAuth, isAuthenticated);
authRouter.post('/send-reset-otp', sendResetOtp);
authRouter.post('/reset-password', resetPassword);
authRouter.post('/google', googleLogin);

export default authRouter;
