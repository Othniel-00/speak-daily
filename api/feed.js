// GET /api/feed  — today's reading: Liberia, Africa tech, world tech, business news + "On this day".
// News comes from Google News RSS (free, no key). Cached at the edge for 30 minutes;
// the app also keeps the last copy on the phone for offline reading.

const FEEDS = {
  liberia: 'https://news.google.com/rss/search?q=Liberia&hl=en-US&gl=US&ceid=US:en',
  africaTech: 'https://news.google.com/rss/search?q=%22Africa%22+technology+OR+startup+OR+fintech+when:3d&hl=en-US&gl=US&ceid=US:en',
  tech: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en',
  business: 'https://news.google.com/rss/search?q=Liberia+OR+%22West+Africa%22+business+OR+economy+when:7d&hl=en-US&gl=US&ceid=US:en',
  world: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en',
};

const decode = (s = '') => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]).trim() : ''; };

async function rss(url, limit = 8) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 SpeakDaily/1.0' } });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = xml.split('<item>').slice(1).map((chunk) => {
      const raw = tag(chunk, 'title');
      const source = tag(chunk, 'source');
      const title = source && raw.endsWith(` - ${source}`) ? raw.slice(0, -(source.length + 3)) : raw;
      return { title, source, link: tag(chunk, 'link'), date: tag(chunk, 'pubDate') };
    }).filter((i) => i.title && i.link);
    const seen = new Set();
    return items.filter((i) => { const k = i.title.toLowerCase().slice(0, 50); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, limit);
  } catch { return []; } finally { clearTimeout(timer); }
}

async function onThisDay() {
  try {
    const d = new Date();
    const r = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`, { headers: { 'user-agent': 'SpeakDaily/1.0 (student app)' } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.selected || []).slice(0, 4).map((e) => ({
      year: e.year, text: e.text,
      link: e.pages?.[0]?.content_urls?.mobile?.page || null,
    }));
  } catch { return []; }
}

export default async function handler(req, res) {
  const [liberia, africaTech, tech, business, world, history] = await Promise.all([
    rss(FEEDS.liberia), rss(FEEDS.africaTech, 6), rss(FEEDS.tech, 6), rss(FEEDS.business, 6), rss(FEEDS.world, 5), onThisDay(),
  ]);
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  res.status(200).json({
    fetchedAt: new Date().toISOString(),
    sections: [
      { id: 'liberia', title: 'Liberia', items: liberia },
      { id: 'africaTech', title: 'Tech in Africa', items: africaTech },
      { id: 'tech', title: 'World tech', items: tech },
      { id: 'business', title: 'Business and economy', items: [...business, ...world].slice(0, 8) },
    ],
    history,
  });
}
