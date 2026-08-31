import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

console.log('Testing Email Configuration...');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS.substring(0, 5) + '***');
console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
console.log('');

const testEmail = async () => {
    try {
        console.log('Verifying SMTP connection...');
        await transporter.verify();
        console.log('✓ SMTP connection verified successfully!');

        console.log('\nSending test email...');
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: process.env.ADMIN_EMAIL,
            subject: 'Test Email - Contact Form',
            text: 'This is a test email from the Student Management System contact form.',
            html: `
                <h2>Test Email</h2>
                <p>This is a test email from the Student Management System.</p>
                <p>If you received this email, the contact form is working correctly!</p>
                <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            `,
        });

        console.log('✓ Email sent successfully!');
        console.log('Message ID:', info.messageId);
        process.exit(0);
    } catch (error) {
        console.error('✗ Email test failed:');
        console.error('Error:', error.message);
        console.error('Code:', error.code);
        process.exit(1);
    }
};

testEmail();
