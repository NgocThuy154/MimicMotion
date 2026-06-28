import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NEWS_PATH = join(__dirname, '..', 'public', 'data', 'news.json');

const RECIPIENT = process.env.RECIPIENT_EMAIL || 'nguyenngocthuy154@gmail.com';
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const DASHBOARD_URL = 'https://bctaichinh-c0af0.web.app';

function formatDate() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
}

function buildEmailHTML(newsData) {
  const typeLabels = { catalyst: 'Catalyst', risk: 'Rủi ro', dividend: 'Cổ tức', kqkd: 'KQKD' };
  const typeColors = { catalyst: '#22c55e', risk: '#ef4444', dividend: '#3b82f6', kqkd: '#a855f7' };

  const articles = (newsData.articles || []).slice(0, 15);

  const newsRows = articles.map(a => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #2d3248;color:#4f8cff;font-weight:700;white-space:nowrap">${a.ticker}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #2d3248">
        <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;color:${typeColors[a.type] || '#9ca3c0'};background:${typeColors[a.type]+'20' || '#9ca3c020'}">${typeLabels[a.type] || a.type}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #2d3248;color:#e4e6ef;font-size:13px">
        ${a.link ? `<a href="${a.link}" style="color:#e4e6ef;text-decoration:none">${a.text}</a>` : a.text}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #2d3248;color:#9ca3c0;font-size:12px;white-space:nowrap">${a.date}</td>
    </tr>
  `).join('');

  const tickerSummary = {};
  for (const a of articles) {
    if (!tickerSummary[a.ticker]) tickerSummary[a.ticker] = 0;
    tickerSummary[a.ticker]++;
  }
  const summaryBadges = Object.entries(tickerSummary)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `<span style="display:inline-block;padding:4px 12px;margin:3px;border-radius:16px;background:#242836;color:#4f8cff;font-weight:600;font-size:13px">${t} (${c})</span>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',system-ui,sans-serif">
<div style="max-width:700px;margin:0 auto;padding:20px">

  <div style="background:#1a1d27;border-radius:12px;padding:24px;margin-bottom:16px;border:1px solid #2d3248">
    <h1 style="margin:0 0 8px;color:#4f8cff;font-size:20px">VN Stock Dashboard</h1>
    <p style="margin:0;color:#9ca3c0;font-size:13px">Tin tức thị trường - ${formatDate()}</p>
  </div>

  <div style="background:#1a1d27;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #2d3248">
    <p style="color:#9ca3c0;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">Mã có tin mới</p>
    <div>${summaryBadges || '<span style="color:#9ca3c0">Không có tin mới</span>'}</div>
  </div>

  <div style="background:#1a1d27;border-radius:12px;overflow:hidden;margin-bottom:16px;border:1px solid #2d3248">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#242836">
          <th style="padding:12px;text-align:left;color:#9ca3c0;font-size:12px;font-weight:600">Mã</th>
          <th style="padding:12px;text-align:left;color:#9ca3c0;font-size:12px;font-weight:600">Loại</th>
          <th style="padding:12px;text-align:left;color:#9ca3c0;font-size:12px;font-weight:600">Tiêu đề</th>
          <th style="padding:12px;text-align:left;color:#9ca3c0;font-size:12px;font-weight:600">Ngày</th>
        </tr>
      </thead>
      <tbody>${newsRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#9ca3c0">Không có tin tức mới hôm nay</td></tr>'}</tbody>
    </table>
  </div>

  <div style="text-align:center;margin:24px 0">
    <a href="${DASHBOARD_URL}" style="display:inline-block;padding:14px 32px;background:#4f8cff;color:#fff;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px">Mở Dashboard</a>
  </div>

  <p style="text-align:center;color:#9ca3c0;font-size:11px;margin-top:24px">
    Email tự động từ VN Stock Dashboard · ${formatDate()}<br>
    Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })} (giờ VN)
  </p>
</div>
</body>
</html>`;
}

async function main() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variables');
    process.exit(1);
  }

  let newsData;
  try {
    newsData = JSON.parse(readFileSync(NEWS_PATH, 'utf-8'));
  } catch (err) {
    console.error(`Cannot read news data: ${err.message}`);
    newsData = { articles: [] };
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  const html = buildEmailHTML(newsData);

  const info = await transporter.sendMail({
    from: `"VN Stock Dashboard" <${GMAIL_USER}>`,
    to: RECIPIENT,
    subject: `[VN Stock] Tin tức thị trường - ${formatDate()}`,
    html,
  });

  console.log(`Email sent: ${info.messageId}`);
}

await main();
