import nodemailer from "nodemailer"

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


// Common Styles for Reuse
export const emailLayout = (content) => `
    <div style="background-color: #f4f7f9; padding: 40px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <div style="background-color: #0F4C9C; padding: 30px; text-align: center;">
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

export const sendLoginEmail = async (email) => {
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

export const sendSignupEmail = async (email) => {
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

export const sendResetEmail = async (email, otp) => {
    try {
        const content = `
            <div style="background-color: #f9fafb; padding: 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 450px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
                    <tr>
                        <td style="padding: 30px 30px 10px 30px; text-align: center;">
                            <h1 style="color: #0F4C9C; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">AdjusterAssist</h1>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding: 0 30px 20px 30px; text-align: center;">
                            <h2 style="color: #111827; font-size: 18px; margin: 10px 0;">Verify your identity</h2>
                            <p style="color: #4b5563; font-size: 15px; line-height: 24px; margin: 0;">
                                To reset your password, please use the 6-digit verification code below.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 0 30px 30px 30px;">
                            <div style="background-color: #f3f4f6; border-radius: 12px; padding: 25px; text-align: center;">
                                <div style="font-size: 38px; font-weight: 800; color: #0F4C9C; letter-spacing: 10px; font-family: monospace;">
                                    ${otp}
                                </div>
                                <div style="color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-top: 8px; letter-spacing: 1px;">
                                    Valid for 10 minutes
                                </div>
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 0 30px 30px 30px; text-align: center;">
                            <p style="color: #9ca3af; font-size: 13px; line-height: 20px; margin: 0;">
                                If you didn't request this, you can safely ignore this email. Your account security is our priority.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                                &copy; 2026 AdjusterAssist Inc. <br>
                                Automated Security Message
                            </p>
                        </td>
                    </tr>
                </table>
            </div>
        `;

        const mailOptions = {
            from: `"AdjusterAssist Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `${otp} is your verification code`,
            html: emailLayout ? emailLayout(content) : content, // Handles if layout wrapper exists
        };

        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Nodemailer Error:", error.message);
        throw new Error("Failed to send reset email");
    }
};

export const sendSubscriptionUpgradeEmail = async (email, newPlan) => {
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

