import { parseStringPromise } from 'xml2js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'public', 'data', 'news.json');

const TICKERS = ['CII','GMD','LPB','DGC','GEX','VIC','CMG','DCM','PAN'];

const TICKER_KEYWORDS = {
  CII: ['CII', 'Ha Tang KT', 'Thu Thiem'],
  GMD: ['GMD', 'Gemadept', 'cang bien'],
  LPB: ['LPB', 'LienVietPostBank', 'LienViet'],
  DGC: ['DGC', 'Duc Giang', 'hoa chat'],
  GEX: ['GEX', 'GELEX', 'Gelex'],
  VIC: ['VIC', 'Vingroup', 'VinFast', 'Vinhomes'],
  CMG: ['CMG', 'CMC', 'cong nghe CMC'],
  DCM: ['DCM', 'Phan Bon Ca Mau', 'PVCFC', 'phan bon'],
  PAN: ['PAN', 'Tap doan PAN', 'nong nghiep PAN'],
};

const RSS_FEEDS = [
  'https://cafef.vn/rss/thi-truong-chung-khoan.rss',
  'https://cafef.vn/rss/doanh-nghiep.rss',
  'https://cafef.vn/rss/tai-chinh-ngan-hang.rss',
];

function classifyType(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('co tuc') || text.includes('cổ tức') || text.includes('chia co') || text.includes('quyen'))
    return 'dividend';
  if (text.includes('doanh thu') || text.includes('loi nhuan') || text.includes('lợi nhuận') || text.includes('bctc') || text.includes('ket qua') || text.includes('kết quả'))
    return 'kqkd';
  if (text.includes('rui ro') || text.includes('rủi ro') || text.includes('giam') || text.includes('giảm') || text.includes('canh bao') || text.includes('khoi to'))
    return 'risk';
  return 'catalyst';
}

function matchTicker(title, description) {
  const text = `${title} ${description}`;
  for (const [ticker, keywords] of Object.entries(TICKER_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return ticker;
    }
  }
  return null;
}

async function fetchRSS(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VNStockBot/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = await parseStringPromise(xml, { trim: true });
    const items = parsed?.rss?.channel?.[0]?.item || [];
    return items.map(item => ({
      title: item.title?.[0] || '',
      description: (item.description?.[0] || '').replace(/<[^>]*>/g, ''),
      link: item.link?.[0] || '',
      pubDate: item.pubDate?.[0] || '',
    }));
  } catch (err) {
    console.error(`Failed to fetch ${url}: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('Crawling news from CafeF RSS...');

  const allItems = [];
  for (const feedUrl of RSS_FEEDS) {
    const items = await fetchRSS(feedUrl);
    console.log(`  ${feedUrl}: ${items.length} items`);
    allItems.push(...items);
  }

  const articles = [];
  const seen = new Set();

  for (const item of allItems) {
    const ticker = matchTicker(item.title, item.description);
    if (!ticker) continue;

    const key = `${ticker}-${item.title.substring(0, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
    const dateStr = `${String(pubDate.getDate()).padStart(2,'0')}/${String(pubDate.getMonth()+1).padStart(2,'0')}/${pubDate.getFullYear()}`;

    articles.push({
      ticker,
      type: classifyType(item.title, item.description),
      text: item.title,
      description: item.description.substring(0, 200),
      link: item.link,
      date: dateStr,
      timestamp: pubDate.toISOString(),
    });
  }

  articles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const top50 = articles.slice(0, 50);

  let existing = { articles: [] };
  if (existsSync(OUTPUT_PATH)) {
    try {
      existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
    } catch {}
  }

  const merged = [...top50];
  for (const old of existing.articles || []) {
    const isDup = merged.some(n => n.ticker === old.ticker && n.text === old.text);
    if (!isDup) merged.push(old);
  }
  const finalArticles = merged.slice(0, 100);

  const output = {
    lastUpdated: new Date().toISOString(),
    tickersTracked: TICKERS,
    totalArticles: finalArticles.length,
    articles: finalArticles,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`Done! ${finalArticles.length} articles written to ${OUTPUT_PATH}`);
  return finalArticles;
}

const articles = await main();
export { articles };
