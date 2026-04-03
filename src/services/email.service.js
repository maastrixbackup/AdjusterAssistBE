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


// Common Styles for Modern Mobile-Responsive Layout
export const emailLayout = (content) => `
    <div style="background-color: #f8fafc; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.03); border: 1px solid #edf2f7;">
            <tr>
                <td style="background: linear-gradient(135deg, #0F4C9C 0%, #1e3a8a 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">AdjusterAssist</h1>
                    <p style="color: #bfdbfe; margin: 5px 0 0; font-size: 13px; font-weight: 500;">Professional Claims Documentation</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px; line-height: 1.6; color: #334155;">
                    ${content}
                </td>
            </tr>
            <tr>
                <td style="background-color: #f1f5f9; padding: 25px; text-align: center;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">&copy; 2026 AdjusterAssist Platform</p>
                    <div style="margin-top: 10px;">
                        <a href="#" style="color: #0F4C9C; text-decoration: none; font-size: 11px; margin: 0 10px;">Help Center</a>
                        <a href="#" style="color: #0F4C9C; text-decoration: none; font-size: 11px; margin: 0 10px;">Privacy Policy</a>
                    </div>
                </td>
            </tr>
        </table>
    </div>
`;

/**
 * Sends a security notification when a user logs in
 */
export const sendLoginEmail = async (email) => {
    try {
        const content = `
            <div style="text-align: center;">
                <div style="background-color: #f0fdf4; color: #166534; display: inline-block; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 20px;">SECURITY ALERT</div>
                <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 22px;">New login detected</h2>
                <p style="color: #64748b; font-size: 15px; margin-bottom: 25px;">Your account was recently accessed. If this was you, no action is required.</p>
                
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 25px;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Timestamp</p>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #1e293b; font-weight: 600;">${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} (UTC)</p>
                </div>

                <p style="color: #94a3b8; font-size: 13px;">Not you? Secure your account immediately.</p>
            </div>
        `;

        const mailOptions = {
            from: `"AdjusterAssist Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Security Notification: New Login",
            html: emailLayout(content),
        };

        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Login email failed:", error.message);
        throw new Error("Failed to send login notification");
    }
};

/**
 * Sends a welcome email to new users
 */
export const sendSignupEmail = async (email, name) => {
    try {
        const content = `
            <h2 style="color: #1e293b; margin-top: 0; font-size: 24px;">Welcome, ${name}!</h2>
            <p style="color: #64748b; font-size: 16px;">Ready to transform your claims workflow? AdjusterAssist is now at your fingertips.</p>
            
            <div style="margin: 30px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="padding-bottom: 15px;">
                            <span style="color: #0F4C9C; font-size: 18px; margin-right: 10px;">&bull;</span>
                            <span style="font-size: 15px; color: #334155;"><strong>File Workspaces:</strong> Dedicated claim hubs.</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 15px;">
                            <span style="color: #0F4C9C; font-size: 18px; margin-right: 10px;">&bull;</span>
                            <span style="font-size: 15px; color: #334155;"><strong>AI Drafting:</strong> Professional letters in seconds.</span>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <span style="color: #0F4C9C; font-size: 18px; margin-right: 10px;">&bull;</span>
                            <span style="font-size: 15px; color: #334155;"><strong>Secure History:</strong> Full audit trails.</span>
                        </td>
                    </tr>
                </table>
            </div>

            
        `;

        const mailOptions = {
            from: `"AdjusterAssist Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Welcome to AdjusterAssist!",
            html: emailLayout(content),
        };

        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Signup email failed:", error.message);
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

