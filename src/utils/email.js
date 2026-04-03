
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        // This is the "magic" fix for many TLS errors
        // It tells Node.js to allow the self-signed certs or slight mismatches 
        // that often happen in cloud environments.
        rejectUnauthorized: false 
    }
});

// Verify connection
transporter.verify((error) => {
    if (error) console.error("Transporter Configuration Error:", error);
    else console.log("AdjusterAssist Email Server is Ready");
});

