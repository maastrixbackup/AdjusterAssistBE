const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verify connection configuration on startup
transporter.verify(function (error, success) {
    if (error) {
        console.error("Transporter Configuration Error:", error);
    } else {
        console.log("Email Server is ready to take our messages");
    }
});

const sendResetEmail = async (email, resetLink) => {
    try {
        const mailOptions = {
            from: `"AdjusterAssist Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Reset Your AdjusterAssist Password",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p>We received a request to reset the password for your AdjusterAssist account.</p>
                    <p>This link is valid for <b>1 hour</b>. Click the button below to proceed:</p>
                    <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
                    <p style="margin-top: 20px; font-size: 12px; color: #777;">If you did not request this, please ignore this email.</p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully: " + info.response);
        return info;
    } catch (error) {
        console.error("Detailed Nodemailer Error:", error.message);
        throw new Error("Failed to send email");
    }
};

const sendSignupEmail = async (email, name) => {
    try {
        const mailOptions = {
            from: `"AdjusterAssist Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Welcome to AdjusterAssist!",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
                    <h2 style="color: #333;">Welcome to AdjusterAssist, ${name}!</h2>
                    <p>Thank you for signing up for AdjusterAssist. We're excited to have you on board!</p>
                    <p>Get started by exploring our features and let us know if you have any questions.</p>
                    <p style="margin-top: 20px; font-size: 12px; color: #777;">We're here to help you make the most of AdjusterAssist.</p>
                </div>
            `,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully: " + info.response);
        return info;
    } catch (error) {
        console.error("Detailed Nodemailer Error:", error.message);
        throw new Error("Failed to send email");
    }
};


module.exports = { sendResetEmail, sendSignupEmail };