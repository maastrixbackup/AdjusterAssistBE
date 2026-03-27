
import nodemailer from "nodemailer"
import dns from "dns"

export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verify connection
transporter.verify((error) => {
    if (error) console.error("Transporter Configuration Error:", error);
    else console.log("AdjusterAssist Email Server is Ready");
});

