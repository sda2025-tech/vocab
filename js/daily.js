import { WORDS } from "./data.js";

export const SITE_URL = "https://sda2025-tech.github.io/vocab/";
const STREAK_KEY = "my-vocab-daily";

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function curriculumIndex(d = new Date()) {
  const start = Date.UTC(2026, 0, 1);
  const now = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.floor((now - start) / 86400000);
  return ((days % WORDS.length) + WORDS.length) % WORDS.length;
}

export function wordForDate(d = new Date()) {
  const i = curriculumIndex(d);
  return { n: i + 1, total: WORDS.length, focus: WORDS[i] };
}

export function wordByNumber(n) {
  const i = Number(n) - 1;
  if (Number.isNaN(i) || i < 0 || i >= WORDS.length) return wordForDate();
  return { n: i + 1, total: WORDS.length, focus: WORDS[i] };
}

export function captionFor(daily) {
  const f = daily.focus;
  return [
    `Word ${daily.n} / ${daily.total}`,
    f.word,
    `${f.pos}  ·  ${f.def}`,
    `Ex. ${f.example}`,
    "",
    "Learn it. Find it. Use it. Three rounds, then stop.",
    "",
    "My Vocab",
    `${SITE_URL}#/daily`,
    "",
    "#MyVocab #GREVocab #AcademicEnglish #Vocabulary",
  ].join("\n");
}

export function loadStreak() {
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY) || "{}");
    return {
      lastDate: raw.lastDate || "",
      streak: Number(raw.streak) || 0,
      completed: Array.isArray(raw.completed) ? raw.completed : [],
    };
  } catch {
    return { lastDate: "", streak: 0, completed: [] };
  }
}

function yesterdayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return dateKey(dt);
}

export function recordCompletion(key) {
  const data = loadStreak();
  if (data.completed.includes(key)) return data;
  const streak = data.lastDate === yesterdayKey(key) ? data.streak + 1 : 1;
  const next = {
    lastDate: key,
    streak,
    completed: [...data.completed, key].slice(-180),
  };
  localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  return next;
}

export function makeFindChoices(daily) {
  const focus = daily.focus;
  const others = WORDS.filter((w) => w.id !== focus.id && w.cluster === focus.cluster);
  const extra = WORDS.filter((w) => w.id !== focus.id);
  const pool = others.length >= 3 ? others : extra;
  const pick = [];
  const used = new Set();
  while (pick.length < 3 && used.size < pool.length) {
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (!used.has(item.id)) {
      used.add(item.id);
      pick.push(item);
    }
  }
  return [...pick, focus].sort(() => Math.random() - 0.5);
}

export function makeUseChoices(daily) {
  const focus = daily.focus;
  const others = WORDS.filter((w) => w.id !== focus.id);
  const pick = [];
  const used = new Set();
  while (pick.length < 3 && used.size < others.length) {
    const item = others[Math.floor(Math.random() * others.length)];
    if (!used.has(item.id)) {
      used.add(item.id);
      pick.push(item);
    }
  }
  return [...pick, focus].sort(() => Math.random() - 0.5);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let row = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + row * lineHeight);
      line = w;
      row += 1;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y + row * lineHeight);
    row += 1;
  }
  return row;
}

export async function paintStory(canvas, daily) {
  if (!canvas || !daily) return;
  try {
    await document.fonts.ready;
  } catch {
    /* fallbacks */
  }
  const w = 1080;
  const h = 1920;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#d9cbb0";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#efe6d2";
  ctx.fillRect(36, 36, w - 72, h - 72);
  ctx.fillStyle = "#f7f1e4";
  ctx.fillRect(88, 110, w - 176, h - 220);
  ctx.strokeStyle = "#1e3a5f";
  ctx.lineWidth = 10;
  ctx.strokeRect(88, 110, w - 176, h - 220);
  ctx.strokeStyle = "#b0893a";
  ctx.lineWidth = 2;
  ctx.strokeRect(112, 134, w - 224, h - 268);

  const f = daily.focus;
  ctx.textAlign = "center";
  ctx.fillStyle = "#1e3a5f";
  ctx.font = "72px Fraunces, 'Source Serif 4', Georgia, serif";
  ctx.fillText("My Vocab", w / 2, 280);

  ctx.fillStyle = "#8b1a1a";
  ctx.font = "36px 'Source Sans 3', sans-serif";
  ctx.fillText(`Word  ${daily.n}  /  ${daily.total}`, w / 2, 360);

  ctx.fillStyle = "#1b2430";
  ctx.font = "italic 92px Fraunces, 'Source Serif 4', Georgia, serif";
  const wordSize = f.word.length > 12 ? 78 : 92;
  ctx.font = `italic ${wordSize}px Fraunces, 'Source Serif 4', Georgia, serif`;
  ctx.fillText(f.word, w / 2, 520);

  ctx.fillStyle = "#5a3a28";
  ctx.font = "32px 'Source Sans 3', sans-serif";
  ctx.fillText(f.pos, w / 2, 590);

  ctx.fillStyle = "#1b2430";
  ctx.font = "40px 'Source Serif 4', Georgia, serif";
  wrapText(ctx, f.def, w / 2, 700, 780, 56);

  ctx.fillStyle = "#5a3a28";
  ctx.font = "italic 34px 'Source Serif 4', Georgia, serif";
  wrapText(ctx, f.example, w / 2, 980, 780, 50);

  ctx.fillStyle = "#1e3a5f";
  ctx.font = "34px 'Source Sans 3', sans-serif";
  ctx.fillText("Learn  ·  Find  ·  Use", w / 2, 1480);

  ctx.fillStyle = "#8b1a1a";
  ctx.font = "30px 'Source Sans 3', sans-serif";
  ctx.fillText("sda2025-tech.github.io/vocab", w / 2, 1720);
}

export async function downloadStory(canvas, daily) {
  await paintStory(canvas, daily);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `my-vocab-${daily.n}-${daily.focus.id}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      resolve();
    }, "image/png");
  });
}
