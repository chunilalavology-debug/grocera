import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendMail = async ({ to, subject, html }) => {
    return await transporter.sendMail({
        from: `"Zippyyy" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};

export default sendMail;
