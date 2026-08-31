import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { sendEmail } from '../utils/email.js';

export const submitContactForm = catchAsync(async (req, res, next) => {
    const { name, email, phone, message } = req.body;

    // Validation
    if (!name || !email || !phone || !message) {
        return next(new AppError('All fields are required', 400));
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@school.edu';

    // Send admin notification email
    const adminEmailHtml = `
    <h2>New Contact Form Submission</h2>
    <p><strong>From:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <hr>
    <h3>Message:</h3>
    <p>${message.replace(/\n/g, '<br>')}</p>
    <hr>
    <p><small>Submitted on: ${new Date().toLocaleString()}</small></p>
  `;

    try {
        // Send only to admin email
        const emailResult = await sendEmail({
            to: adminEmail,
            subject: `New Contact Form Submission from ${name}`,
            text: `New contact form submission from ${name}. Phone: ${phone}. Message: ${message}`,
            html: adminEmailHtml,
        });

        res.status(200).json({
            status: 'success',
            message: 'Your message has been sent successfully. We will contact you soon.',
            data: { emailSent: true }
        });
    } catch (error) {
        console.error('Contact form email error:', error.message);
        return next(
            new AppError('Failed to send your message. Please try again later.', 500)
        );
    }
});
