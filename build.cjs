/**
 * Sarvestan Feed Auto-Builder
 * این اسکریپت تمام فایل‌های مارک‌داون موجود در پوشه posts/ را می‌خواند
 * فرانت‌متر و متن آن‌ها را پارس کرده و فایل feed.json را خودکار تولید می‌کند.
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'posts');
const OUTPUT_FILE = path.join(__dirname, 'feed.json');

const CHANNELS = [
  {
    id: 'announcements',
    name: 'اطلاعیه‌ها',
    slug: 'announcements',
    badge: 'رسمی و آموزشی',
    description: 'اطلاعیه‌های رسمی، تقویم آموزشی، امور دانشجویی، هشدارهای حذف و اضافه و اطلاعیه‌های سیستم',
    color: 'warn',
    defaultSubscribed: true,
  },
  {
    id: 'sarvnameh',
    name: 'سرونامه',
    slug: 'sarvnameh',
    badge: 'مجله آزاد',
    description: 'گاهنامه آزاد دانشجویی، تجربیات زیسته، مقالات، یادداشت‌های آزاد، ستون دانشجویان و تحلیل‌ها',
    color: 'primary',
    defaultSubscribed: true,
  },
  {
    id: 'shernameh',
    name: 'شعرنامه',
    slug: 'shernameh',
    badge: 'ادبیات و شعر',
    description: 'گزیده اشعار کهن و معاصر، ابیات ناب، دلنوشته‌های شبانه و آرامش ادبی در روزهای شلوغ دانشگاه',
    color: 'secondary',
    defaultSubscribed: true,
  },
];

function parseFrontmatter(rawContent, filename) {
  const lines = rawContent.split(/\r?\n/);
  const meta = {};
  let bodyStartIndex = 0;

  if (lines[0] && lines[0].trim() === '---') {
    let closingIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        closingIndex = i;
        break;
      }
      const line = lines[i];
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim();
        // Remove surrounding quotes if any
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        meta[key] = val;
      }
    }
    if (closingIndex !== -1) {
      bodyStartIndex = closingIndex + 1;
    }
  }

  const body = lines.slice(bodyStartIndex).join('\n').trim();

  // اگر تیتر در فرانت‌متر نبود، از اولین هدر مارک‌داون استخراج می‌کنیم
  let title = meta.title;
  if (!title) {
    const headingMatch = body.match(/^#+\s*(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    } else {
      title = path.basename(filename, path.extname(filename));
    }
  }

  // اگر چکیده نبود، از پاراگراف اول استفاده می‌کنیم
  let summary = meta.summary;
  if (!summary) {
    const firstParagraph = body
      .split(/\n\s*\n/)
      .map((p) => p.replace(/^[#>\-\*\d\.\s]+/gm, '').trim())
      .filter(Boolean)[0];
    summary = firstParagraph ? firstParagraph.slice(0, 160) : '';
  }

  const channelId = meta.channelId || meta.channel || 'sarvnameh';
  const channelDef = CHANNELS.find((c) => c.id === channelId) || CHANNELS[1];

  return {
    id: meta.id || path.basename(filename, path.extname(filename)),
    channelId,
    title,
    date: meta.date || '۲۴ مهر ۱۴۰۵',
    timestamp: meta.timestamp ? Number(meta.timestamp) : Date.now(),
    badge: meta.badge || channelDef.badge,
    color: meta.color || channelDef.color,
    summary,
    content: body,
    actionText: meta.actionText || (channelId === 'shernameh' ? 'کانال تلگرام @s4rvest4n' : 'عضویت در کانال'),
    actionUrl: meta.actionUrl || 'https://t.me/s4rvest4n',
  };
}

function build() {
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }

  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  console.log(`Found ${files.length} markdown post(s) in posts/`);

  const posts = files.map((file) => {
    const fullPath = path.join(POSTS_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    return parseFrontmatter(content, file);
  });

  // خواندن نسخه قبلی feed.json جهت حفظ بنر و اطلاعات کلی
  let existing = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    } catch (_) {}
  }

  const result = {
    $schema: './schema.json',
    version: '1.2',
    lastUpdated: new Date().toISOString(),
    app: existing.app || {
      name: 'سروستان',
      latestVersion: '1.2.0',
      latestVersionCode: 12,
      codename: 'پاسارگاد',
      telegramChannel: 'https://t.me/s4rvest4n',
    },
    channels: CHANNELS,
    banner: existing.banner || {
      enabled: true,
      id: 'banner-v120',
      type: 'info',
      title: 'نسخه ۱.۲ (پاسارگاد) هم‌اکنون در دسترس است',
      message: 'ویجت‌های تعاملی، چارت درسی هوشمند و پوسته پاییزی چغندر به سروستان اضافه شد.',
      actionText: 'عضویت در کانال تلگرام',
      actionUrl: 'https://t.me/s4rvest4n',
    },
    posts,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
  console.log(`Successfully generated ${OUTPUT_FILE} with ${posts.length} posts and 3 channels.`);
}

build();
