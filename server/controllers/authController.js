import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import transporter from '../config/nodemailer.js';

// ─── Brevo REST API Email Sender ─────────────────────────────────────────────
// Bypasses Railway's firewall which blocks outbound SMTP ports 465/587.
export const sendBrevoEmail = async ({ to, subject, textContent, htmlContent }) => {
    const apiKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
    const senderEmail = process.env.SENDER_EMAIL || 'somniav2@gmail.com';

    if (!apiKey) {
        console.warn('Neither BREVO_API_KEY nor SMTP_PASS is configured; skipping email dispatch.');
        return false;
    }

    const emailData = {
        sender: { name: 'SOMNiA', email: senderEmail },
        to: [{ email: to }],
        subject,
        textContent,
    };
    if (htmlContent) {
        emailData.htmlContent = htmlContent;
    }

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify(emailData)
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Brevo API Error:', response.status, errorData);
            return false;
        }

        const data = await response.json();
        console.log('Brevo email sent successfully:', data);
        return true;
    } catch (err) {
        console.error('sendBrevoEmail network error:', err.message);
        return false;
    }
};

export const register = async (req, res) => {
    const { name, email, password, birthdate, gender  } = req.body;

    if (!name || !email || !password || !birthdate || !gender) {
        return res.status(400).json({ success: false, message: 'Missing required details' });
    }

    // Validate gender value
    const allowedGenders = ["Male", "Female", "Prefer not to say", "Other"];
    if (!allowedGenders.includes(gender)) {
        return res.status(400).json({
            success: false,
            message: "Invalid gender value",
        });
    }

    try {
        const existingUser = await userModel.findOne({ email });

        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new userModel({
            name,
            email,
            password: hashedPassword,
            birthdate: new Date(birthdate),
            gender
        });
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
       
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Generate and store verification OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        user.verifyOtp = otp;
        user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;
        await user.save();

        // Dispatch verification email via Brevo REST API (HTTPS port 443)
        sendBrevoEmail({
            to: email,
            subject: 'SOMNiA - Verify Your Email',
            textContent: `Welcome to SOMNiA! Your verification code is: ${otp}\n\nPlease enter this 6-digit code in the app to verify your email. This code expires in 24 hours.`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background-color: #0d1322; color: #ffffff; border-radius: 12px;">
                    <h2 style="color: #4da3ff; text-align: center; margin-bottom: 8px;">Welcome to SOMNiA</h2>
                    <p style="font-size: 15px; color: #d0d7de; text-align: center; margin-bottom: 24px;">Your verification code is:</p>
                    <div style="text-align: center; margin: 24px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ffffff; background: #1c2638; padding: 12px 24px; border-radius: 8px; border: 1px solid #30405c;">${otp}</span>
                    </div>
                    <p style="font-size: 13px; color: #8b949e; text-align: center;">This code will expire in 24 hours. If you did not create an account, please ignore this email.</p>
                </div>
            `
        }).catch(e => console.error('Register email send failed:', e));

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            user_id: user._id,
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Required details missing' });
    }

    try {
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid password' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        /*
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        */

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        
        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user_id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            age: user.age,
            gender: user.gender,
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const logout = async (req, res) => {
    try {
        // Clear the token cookie with all necessary options
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
            path: '/',
            expires: new Date(0)
        });

        // Force clear session
        req.session = null;
        
        return res.status(200).json({ success: true, message: 'Logged Out!' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const sendVerifyOtp = async (req, res) => {
    try {
        const { userId, email } = req.body;
        let user;
        if (userId) {
            user = await userModel.findById(userId);
        } else if (email) {
            user = await userModel.findOne({ email });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.isAccountVerified) {
            return res.json({ success: false, message: "Account Already Verified" });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        user.verifyOtp = otp;
        user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;  
        await user.save();

        await sendBrevoEmail({
            to: user.email,
            subject: 'SOMNiA - Account Verification OTP',
            textContent: `Your SOMNiA verification code is: ${otp}\n\nUse this code to verify your account. It expires in 24 hours.`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background-color: #0d1322; color: #ffffff; border-radius: 12px;">
                    <h2 style="color: #4da3ff; text-align: center; margin-bottom: 8px;">SOMNiA Verification</h2>
                    <p style="font-size: 15px; color: #d0d7de; text-align: center; margin-bottom: 24px;">Your verification code is:</p>
                    <div style="text-align: center; margin: 24px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ffffff; background: #1c2638; padding: 12px 24px; border-radius: 8px; border: 1px solid #30405c;">${otp}</span>
                    </div>
                    <p style="font-size: 13px; color: #8b949e; text-align: center;">This code will expire in 24 hours.</p>
                </div>
            `
        });

        return res.json({ success: true, message: "Verification OTP sent to email" });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const verifyEmail = async(req,res) =>{
    const {userId, email, otp} = req.body;

    if(!otp){
        return res.json({success:false, message: "Missing OTP code"});
    }

    try {
        let user;
        if (userId) {
            user = await userModel.findById(userId);
        } else if (email) {
            user = await userModel.findOne({ email });
        }

        if(!user){
            return res.json({success:false, message: "User not found."});
        }

        if(user.verifyOtp === '' || user.verifyOtp !== otp){
            return res.json({success:false, message: "Invalid OTP."});
        }

        if(user.verifyOtpExpireAt < Date.now()){
            return res.json({success: false, message: 'OTP Expired'});
        }

        user.isAccountVerified = true;
        user.verifyOtp = '';
        user.verifyOtpExpireAt = 0;

        await user.save();
        return res.json({success: true, message: "Email verified successfully"});
    } catch (error) {
        return res.json({success:false, message:  error.message});
    }
}

export const isAuthenticated = async(req,res)=>{
    try {
        res.json({ success: true });

    } catch (error) {
        res.json({ success: false, message: error.message });

    }
}

export const sendResetOtp = async(req,res)=>{
    const {email} = req.body;

    if(!email){
        return res.json({success:false, message: "Email is required"});
    }

    try {
        const user = await userModel.findOne({email});
        
        if(!user){
            return res.json({success: false, message: "User not found!"});
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        user.resetOtp = otp;
        user.resetOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;  
        await user.save();

        await sendBrevoEmail({
            to: user.email,
            subject: 'Password Reset OTP.',
            textContent: `Your OTP for resetting your password is ${otp} \nUse this OTP to proceed with resetting your password.`
        });

        return res.json({ success: true, message: "Otp sent to your email" });
    } catch (error) {
        console.error('sendResetOtp error:', error.message, error.code || '');
        return res.json({ success: false, message: error.message });
    }
}

export const resetPassword = async (req,res) =>{
    const {email, otp, newPassword} = req.body;

    if(!email || !otp || !newPassword){
        return res.json({success:false,message:'Email, OTP, and new password are required'})
    }

    try {
        const user = await userModel.findOne({email});
        if(!user){
            return res.json({success:false, message: "User not found."});
        }

        if(user.resetOtp === "" || user.resetOtp !== otp){
            return res.json({sucess:false, message: "Invalid OTP"});
        }

        if(user.resetOtpExpireAt < Date.now()){
            return res.json({sucess:false, message: "OTP Expired"});
        }

        const hashPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashPassword;
        user.resetOtp = '';
        user.resetOtpExpireAt = 0;

        await user.save();

        return res.json({success:true, message: "Password has been reset successfully"});
    } catch (error) {
        return res.json({success: false, message: error.message});
    }
}

// ─── Google OAuth Login ─────────────────────────────────────────────────────
export const googleLogin = async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken) {
        return res.json({ success: false, message: 'Google access token is required' });
    }

    try {
        // Verify token with Google and get user info
        const googleRes = await fetch(
            `https://www.googleapis.com/oauth2/v3/userinfo`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!googleRes.ok) {
            return res.json({ success: false, message: 'Invalid Google token' });
        }

        const googleUser = await googleRes.json();
        const { email, name, sub: googleId } = googleUser;

        if (!email) {
            return res.json({ success: false, message: 'Could not retrieve email from Google' });
        }

        // Find existing user or create new one
        let user = await userModel.findOne({ email });

        if (!user) {
            // Create new user from Google data
            const randomPassword = await bcrypt.hash(googleId + process.env.JWT_SECRET, 10);
            user = new userModel({
                name: name || email.split('@')[0],
                email,
                password: randomPassword,
                birthdate: new Date(),
                gender: 'Prefer not to say',
                isAccountVerified: true, // Google already verified the email
            });
            await user.save();
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.json({
            success: true,
            token,
            user_id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            age: user.age,
            gender: user.gender,
            message: 'Google login successful'
        });

    } catch (error) {
        console.error('googleLogin error:', error.message);
        return res.json({ success: false, message: error.message });
    }
}