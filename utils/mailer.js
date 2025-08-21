// utils/mailer.js
const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,              // e.g. "ESL Support <myungdae.cho@gmail.com>"
  MAIL_FROM_NAME,         // optional, fallback display name
} = process.env;

// secure/port 처리
const port = Number(SMTP_PORT || 587);
const secure = (String(SMTP_SECURE || '').toLowerCase() === 'true') || port === 465;

// 발신자(from) 결정: SMTP_FROM > MAIL_FROM_NAME + SMTP_USER > SMTP_USER
const DEFAULT_FROM =
  SMTP_FROM ||
  (MAIL_FROM_NAME && SMTP_USER ? `${MAIL_FROM_NAME} <${SMTP_USER}>` : SMTP_USER || 'no-reply@example.com');

// 트랜스포터 (풀 사용: 안정적 전송)
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure,
  pool: true,
  maxConnections: 5,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// 연결 확인(앱 시작 시 한번)
async function verify() {
  try {
    await transporter.verify();
    console.log('✅ SMTP: transporter verified');
  } catch (err) {
    console.error(`❌ SMTP verify failed: ${err.message}`);
  }
}

/**
 * 공용 메일 발송
 * @param {Object} opts
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.text]
 * @param {string} [opts.html]
 * @param {string} [opts.replyTo]
 * @param {string} [opts.from]  // override
 */
async function send(opts = {}) {
  const {
    to,
    subject,
    text,
    html,
    replyTo,
    from = DEFAULT_FROM,
  } = opts;

  if (!to || !subject) {
    throw new Error('Mailer: "to" and "subject" are required');
  }

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    replyTo,
  });
}

module.exports = { verify, send, DEFAULT_FROM };
