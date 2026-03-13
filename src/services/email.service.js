const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
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

// Common Styles for Reuse
const emailLayout = (content) => `
    <div style="background-color: #f4f7f9; padding: 40px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <div style="background-color: #007bff; padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: 1px;">AdjusterAssist</h1>
            </div>
            <div style="padding: 40px; line-height: 1.6; color: #444;">
                ${content}
            </div>
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="margin: 0; font-size: 12px; color: #888;">&copy; 2026 AdjusterAssist Platform. All rights reserved.</p>
                <p style="margin: 5px 0 0; font-size: 12px; color: #888;">This is an automated message, please do not reply.</p>
            </div>
        </div>
    </div>
`;

const sendLoginEmail = async (email) => {
    try {
        const content = `
            <h2 style="color: #333; margin-top: 0;">Welcome Back!</h2>
            <p>Your AdjusterAssist account was just accessed. If this was you, you can safely ignore this email. If you suspect any unauthorized access, please reset your password immediately.</p>
        `;
        const mailOptions = {
            from: `"AdjusterAssist Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Login Notification",
            html: emailLayout(content),
        };
        return await transporter.sendMail(mailOptions);

    } catch (error) {
        console.error("Nodemailer Error:", error.message);
        throw new Error("Failed to send login notification email");
    }
};


const sendResetEmail = async (email, resetLink) => {
    try {
        const content = `
            <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
            <p>Hello,</p>
            <p>We received a request to reset the password for your <strong>AdjusterAssist</strong> account. Click the button below to secure your account:</p>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Set New Password</a>
            </div>
            <p style="font-size: 14px; color: #666;">This link is valid for <strong>1 hour</strong>. If you didn't request this change, you can safely ignore this email.</p>
        `;

        const mailOptions = {
            from: `"AdjusterAssist Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Action Required: Reset Your Password",
            html: emailLayout(content),
        };

        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Nodemailer Error:", error.message);
        throw new Error("Failed to send reset email");
    }
};

const sendSignupEmail = async (email) => {
    try {
        const content = `
            <h2 style="color: #333; margin-top: 0;">Welcome to the Team!</h2>
            <p>Your <strong>AdjusterAssist</strong> account is now active. We are thrilled to help you streamline your claim processing and drafting workflow.</p>
            <p>With AdjusterAssist, you can:</p>
            <ul style="padding-left: 20px; color: #555;">
                <li>Create dedicated <strong>File Workspaces</strong> for every claim.</li>
                <li>Generate AI-powered demand letters and file notes.</li>
                <li>Manage your drafting history securely.</li>
            </ul>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${process.env.FRONTEND_URL || '#'}" style="background-color: #28a745; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Launch Dashboard</a>
            </div>
            <p>If you have any questions, simply visit our help center or contact support.</p>
        `;

        const mailOptions = {
            from: `"AdjusterAssist Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Welcome to AdjusterAssist!",
            html: emailLayout(content),
        };

        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Nodemailer Error:", error.message);
        throw new Error("Failed to send welcome email");
    }
};

const sendSubscriptionUpgradeEmail = async (email, newPlan) => {
    try {
        const content = `
            <h2 style="color: #333; margin-top: 0;">Subscription Upgrade Successful</h2>
            <p>Hello,</p>
            <p>We're excited to let you know that your subscription has been successfully upgraded to the <strong>${newPlan}</strong> plan.</p>
            <p>Thank you for choosing AdjusterAssist!</p>
        `;

        const mailOptions = {
            from: `"AdjusterAssist Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Subscription Upgrade Successful",
            html: emailLayout(content),
        };

        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Nodemailer Error:", error.message);
        throw new Error("Failed to send subscription upgrade email");
    }
};

module.exports = { sendResetEmail, sendLoginEmail, sendSignupEmail, sendSubscriptionUpgradeEmail };