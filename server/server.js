import express from "express";
import cors from "cors";
import 'dotenv/config';
import cookieParser from "cookie-parser";

import connectDB from "./config/mongodb.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
import bpRouter from './routes/bpRoutes.js';
import stepRouter from "./routes/stepRoutes.js";
import heartRateRouter from "./routes/heartRateRoutes.js";
import sleepSessionRouter from "./routes/sleepSessionRoutes.js";
import spo2Router from "./routes/spo2Routes.js";
import aiRouter from "./routes/aiRoutes.js";
import exerciseRouter from "./routes/exerciseRoutes.js";

const app = express();
const port = process.env.PORT || 4000
connectDB();

const allowedOrigins = [
    'http://localhost:5173',         // Vite (web) frontend
    'https://som-ni-a.vercel.app',  // Deployed frontend     
    'http://localhost:8001',
    'http://localhost:8081',         // Expo Go default local web (Expo dev tools)
    'http://localhost:8080',         // Expo Go default local web (Expo dev tools)
    'http://localhost:4000',
    'http://localhost:19006',        // Expo web
    'exp://127.0.0.1:19000',         // Expo mobile local dev (iOS/Android)
    'http://192.168.254.142:4000',
    'http://172.20.10.2:4000',
    'https://somnia-17eu.onrender.com',
    'https://somnia-api-iuvq.onrender.com',  // Replace with your LAN IP if using physical device
];


app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie', 'Set-Cookie']
}));

// Other middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

//API Endpoints
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/bp', bpRouter);
app.use('/api/step', stepRouter);
app.use('/api/heartRate', heartRateRouter);
app.use('/api/sleepSession', sleepSessionRouter);
app.use('/api/spo2', spo2Router);
app.use('/api/ai', aiRouter);
app.use('/api/exercise', exerciseRouter);

// Global Error Handler to catch middleware errors (like PayloadTooLargeError from express.json)
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Payload too large. Please reduce the date range for syncing.' });
    }
    console.error('Server error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

app.listen(port, () => console.log(`Server started on PORT:${port}`));
