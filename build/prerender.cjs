/* 싸우쿠다 홈페이지 - 검색용 페이지 만들기 (GitHub Actions에서 자동 실행됩니다)
   1) 페이지를 브라우저로 열어 글·숫자·기록이 모두 채워진 상태로 저장
   2) 선수별 전적 페이지(fighters/이름.html) 만들기
   3) sitemap.xml, robots.txt 만들기 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_site');
const SITE_URL = (process.env.SITE_URL || 'https://warriorzcokr-design.github.io/SSAUKUDA').replace(/\/+$/, '');
const SKIP = new Set(['.git', '.github', 'build', 'node_modules', '_site', 'package.json', 'package-lock.json']);

const PAGES = {
  'index.html': {
    title: '제주 MMA 체육관 싸우쿠다 | MMA·주짓수·킥복싱·레슬링',
    desc: '제주시 중앙로 MMA 체육관 싸우쿠다. 초보부터 프로까지 MMA, 주짓수, 킥복싱, 레슬링 그룹 수업과 1:1 P.T.',
  },
  'coach.html': {
    title: '관장 박석한 코치 소개 | 제주 MMA 싸우쿠다',
    desc: '제주 MMA 체육관 싸우쿠다 관장 박석한. 태권도, 극진 공수도를 거쳐 로드FC 프로 MMA까지 걸어온 길과 전적.',
  },
  'records.html': {
    title: '선수 · 시합 기록 | 제주 MMA 싸우쿠다',
    desc: '제주 MMA 체육관 싸우쿠다 선수들의 시합 기록과 선수별 전적·승률. 로드FC, WARRIORZ, BLACK COMBAT 등.',
  },
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function slug(name) { return String(name).trim().replace(/\s+/g, '-'); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (SKIP.has(name)) continue;
    const a = path.join(src, name), b = path.join(dst, name);
    if (fs.statSync(a).isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.css': 'text/css' };
function serve(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(dir, p);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// 사이트 아이콘(파비콘) - 모든 페이지 공통
const ICONS = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#000000">
`;

function headExtras(file, canonicalPath, extra) {
  const meta = PAGES[file];
  let h = `<link rel="canonical" href="${SITE_URL}/${canonicalPath}">\n`;
  h += `<meta property="og:url" content="${SITE_URL}/${canonicalPath}">\n`;
  h += `<meta property="og:site_name" content="싸우쿠다 트레이닝 센터">\n`;
  h += `<meta property="og:locale" content="ko_KR">\n`;
  h += ICONS;
  if (extra) h += extra;
  return h;
}

function gymJsonLd(home) {
  const g = {
    '@context': 'https://schema.org',
    '@type': 'ExerciseGym',
    name: '싸우쿠다 트레이닝 센터',
    alternateName: ['싸우쿠다', 'SSAUKUDA', '팀 싸우쿠다'],
    description: PAGES['index.html'].desc,
    url: SITE_URL + '/',
    image: SITE_URL + '/images/hero.jpg',
    telephone: '+82-10-9339-4183',
    email: 'ssaukuda@naver.com',
    address: { '@type': 'PostalAddress', streetAddress: '중앙로 321 지층', addressLocality: '제주시', addressRegion: '제주특별자치도', addressCountry: 'KR' },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '19:00', closes: '22:00' }],
    sameAs: ['https://m.blog.naver.com/ssaukuda', 'https://facebook.com/teamssaukuda', 'https://www.youtube.com/channel/UCs-pxltlGRkXaoeCBWs1oXg'],
    founder: { '@type': 'Person', name: '박석한' },
  };
  return `<script type="application/ld+json">${JSON.stringify(g)}</script>\n`;
}

function setTitle(html, title, desc) {
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta content="[^"]*" name="description"\s*\/?>|<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(desc)}">`);
  html = html.replace(/<meta content="[^"]*" property="og:title"\s*\/?>|<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(title)}">`);
  html = html.replace(/<meta content="[^"]*" property="og:description"\s*\/?>|<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(desc)}">`);
  html = html.replace(/content="images\/hero\.jpg"/g, 'content="' + SITE_URL + '/images/hero.jpg"');
  return html;
}

function fighterStats(matches) {
  const by = new Map();
  for (const m of matches) {
    const name = String((m && m.name) || '').trim();
    if (!name || name.startsWith('[')) continue;
    if (!by.has(name)) by.set(name, []);
    by.get(name).push(m);
  }
  const out = [];
  for (const [name, games] of by) {
    let w = 0, l = 0, d = 0, fin = 0;
    const divs = new Map();
    for (const g of games) {
      const res = String(g.result || '').replace(/\s+/g, ' ').trim();
      let k = '';
      if (res.includes('무승부')) { d++; k = 'd'; } else if (/패$/.test(res)) { l++; k = 'l'; } else if (/승$/.test(res)) { w++; k = 'w'; if (!res.includes('판정')) fin++; }
      let dv = String(g.division || '').replace(/\s+/g, '');
      if (!dv) dv = '기타'; else if (dv.startsWith('세미')) dv = '세미프로'; else if (dv.startsWith('아마')) dv = '아마추어'; else if (dv.startsWith('비기')) dv = '비기너'; else if (dv.startsWith('프로')) dv = '프로';
      if (!divs.has(dv)) divs.set(dv, { w: 0, l: 0, d: 0 });
      if (k) divs.get(dv)[k]++;
    }
    out.push({ name, games, w, l, d, fin, divs });
  }
  return out;
}

// 네이버 권장: 제목 40자, 설명 80자 이내
function clip(s, n) { s = String(s); return s.length <= n ? s : s.slice(0, n - 1).replace(/[\s,.·]+$/, '') + '…'; }

function fighterPage(f, transferred) {
  const rec = `${f.games.length}전 ${f.w}승 ${f.l}패${f.d ? ' ' + f.d + '무' : ''}`;
  const events = [...new Set(f.games.map((g) => String(g.event || '').trim()).filter(Boolean))];
  const title = clip(`${f.name} 선수 전적 ${rec} | 제주 MMA 싸우쿠다`, 40);
  const desc = clip(`${transferred ? '전 싸우쿠다 소속' : '제주 MMA 싸우쿠다 소속'} ${f.name} 선수 시합 기록. 통산 ${rec}${f.fin ? ', 피니시 승 ' + f.fin + '회' : ''}. ${events.slice(0, 2).join(', ')} 출전.`, 80);
  const order = ['프로', '세미프로', '아마추어', '비기너', '기타'];
  const divs = [...f.divs.entries()].sort((a, b) => (order.indexOf(a[0]) < 0 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) < 0 ? 99 : order.indexOf(b[0])))
    .map(([k, v]) => `<li style="padding: 6px 12px; border: 1px solid #2A2926; border-radius: 4px; background: #1B1A18"><strong style="color: #2EC45A">${esc(k)}</strong> ${v.w}승 ${v.l}패${v.d ? ' ' + v.d + '무' : ''}</li>`).join('');
  const rows = f.games.map((g) => `<tr><td style="padding: 14px 16px; border-bottom: 1px solid #2A2926; white-space: nowrap">${esc(g.date || '')}</td><td style="padding: 14px 16px; border-bottom: 1px solid #2A2926">${esc(g.event || '')}</td><td style="padding: 14px 16px; border-bottom: 1px solid #2A2926; white-space: nowrap">${esc(g.division || '')}</td><td style="padding: 14px 16px; border-bottom: 1px solid #2A2926; white-space: nowrap">${esc(g.weight || '')}</td><td style="padding: 14px 16px; border-bottom: 1px solid #2A2926">${esc(g.result || '')}</td><td style="padding: 14px 16px; border-bottom: 1px solid #2A2926; color: #A8A39A">${esc(g.opponent || '')}</td></tr>`).join('\n');
  const canon = `fighters/${encodeURIComponent(slug(f.name))}.html`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Person', name: f.name,
    description: desc,
    ...(transferred ? {} : { memberOf: { '@type': 'SportsOrganization', name: '싸우쿠다 트레이닝 센터', url: SITE_URL + '/' } }),
  };
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE_URL}/${canon}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE_URL}/images/hero.jpg">
<meta property="og:locale" content="ko_KR">
${ICONS}<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&amp;family=Noto+Sans+KR:wght@400;500;700;900&amp;display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>body{margin:0;background:#111110;color:#F2EEE6;font-family:'Noto Sans KR',system-ui,sans-serif;line-height:1.7;word-break:keep-all}a{color:#F2EEE6}</style>
</head>
<body>
<header style="border-bottom: 1px solid #2A2926">
<div style="max-width: 1100px; margin: 0 auto; padding: 14px 20px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px">
<a href="../index.html" style="display: flex; align-items: baseline; gap: 10px; text-decoration: none"><span style="font-family: 'Black Han Sans', sans-serif; font-size: 26px">SSAUKUDA</span><span style="font-size: 12px; color: #A8A39A; letter-spacing: 2px">TRAINING CENTER</span></a>
<nav aria-label="주 메뉴" style="display: flex; flex-wrap: wrap; gap: 4px 20px; font-size: 15px"><a href="../index.html#classes" style="text-decoration: none">수업 안내</a><a href="../index.html#price" style="text-decoration: none">수강료</a><a href="../coach.html" style="text-decoration: none">코치 소개</a><a href="../records.html" style="text-decoration: none; color: #2EC45A; font-weight: 700">선수·시합</a></nav>
</div>
</header>
<main style="max-width: 1100px; margin: 0 auto; padding: 56px 20px 72px">
<p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; letter-spacing: 3px; color: #2EC45A">${transferred ? '전 소속 선수' : '싸우쿠다 소속 선수'} · 제주 MMA</p>
<h1 style="margin: 0 0 12px; font-family: 'Black Han Sans', sans-serif; font-weight: 400; font-size: clamp(36px, 6vw, 60px); line-height: 1.15">${esc(f.name)} 선수 전적</h1>
<p style="margin: 0 0 20px; font-size: 22px; font-weight: 700">통산 ${esc(rec)}${f.fin ? ` <span style="font-size: 16px; font-weight: 400; color: #A8A39A">· 피니시 승 ${f.fin}회</span>` : ''}</p>
<ul style="list-style: none; margin: 0 0 32px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; font-size: 15px">${divs}</ul>
<h2 style="margin: 0 0 16px; font-size: 22px">시합 기록</h2>
<div style="border: 1px solid #2A2926; border-radius: 8px; overflow-x: auto">
<table style="width: 100%; min-width: 760px; border-collapse: collapse; font-size: 15px">
<thead><tr style="color: #A8A39A; font-size: 13px; text-align: left"><th style="padding: 12px 16px; border-bottom: 1px solid #2A2926">날짜</th><th style="padding: 12px 16px; border-bottom: 1px solid #2A2926">대회</th><th style="padding: 12px 16px; border-bottom: 1px solid #2A2926">부문</th><th style="padding: 12px 16px; border-bottom: 1px solid #2A2926">체급</th><th style="padding: 12px 16px; border-bottom: 1px solid #2A2926">결과</th><th style="padding: 12px 16px; border-bottom: 1px solid #2A2926">상대</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>
<p style="margin: 32px 0 0; font-size: 16px; color: #C9C4BA">${esc(f.name)} 선수는 제주시 중앙로의 MMA 체육관 <a href="../index.html">싸우쿠다 트레이닝 센터</a>${transferred ? '에서 훈련하며 시합에 출전했습니다.' : '에서 훈련하고 있습니다.'} 다른 선수들의 기록은 <a href="../records.html">선수 · 시합 기록</a>에서 볼 수 있습니다.</p>
</main>
<footer style="border-top: 1px solid #2A2926; background: #181816"><div style="max-width: 1100px; margin: 0 auto; padding: 28px 20px; font-size: 14px; color: #A8A39A">싸우쿠다 트레이닝 센터 · 제주시 중앙로 321, 지층 · <a href="tel:01093394183">010-9339-4183</a></div></footer>
</body>
</html>
`;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(ROOT, OUT);
  const srv = await serve(OUT);
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  for (const file of Object.keys(PAGES)) {
    await page.goto(base + file, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__dcMounted === true, null, { timeout: 15000 });
    await page.waitForTimeout(800);
    const leftover = await page.evaluate(() => /\{\{/.test(document.body.innerText));
    if (leftover) throw new Error(file + ': 빈칸 표시({{ }})가 남아 있습니다.');
    let html = '<!doctype html>\n' + (await page.evaluate(() => document.documentElement.outerHTML));
    html = setTitle(html, PAGES[file].title, PAGES[file].desc);
    const canon = file === 'index.html' ? '' : file;
    html = html.replace('</head>', headExtras(file, canon, file === 'index.html' ? gymJsonLd() : '') + '</head>');
    fs.writeFileSync(path.join(OUT, file), html);
    console.log('미리 만든 페이지:', file, Math.round(html.length / 1024) + 'KB');
  }
  await browser.close();
  srv.close();
  if (errors.length) console.log('페이지 오류:', errors);

  // 선수 페이지
  const matches = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/matches.json'), 'utf8')).matches || [];
  let transferred = [];
  try {
    const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/records.json'), 'utf8'));
    transferred = String((r.settings && r.settings.transferred) || '').split(/[,，\n]/).map((x) => x.trim()).filter(Boolean);
  } catch (e) {}
  const fighters = fighterStats(matches);
  fs.mkdirSync(path.join(OUT, 'fighters'), { recursive: true });
  for (const f of fighters) {
    fs.writeFileSync(path.join(OUT, 'fighters', slug(f.name) + '.html'), fighterPage(f, transferred.includes(f.name)));
  }
  console.log('선수 페이지:', fighters.length + '개');

  // sitemap, robots
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['', 'coach.html', 'records.html'].concat(fighters.map((f) => 'fighters/' + encodeURIComponent(slug(f.name)) + '.html'));
  const sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${SITE_URL}/${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n';
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sm);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  if (process.env.CUSTOM_DOMAIN) fs.writeFileSync(path.join(OUT, 'CNAME'), process.env.CUSTOM_DOMAIN + '\n');
  console.log('완료:', SITE_URL);
})().catch((e) => { console.error(e); process.exit(1); });
