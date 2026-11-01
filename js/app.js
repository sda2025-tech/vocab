import { CHAPTERS, CLUSTERS, WORDS, TEXT_COMPLETION, SENTENCE_EQUIVALENCE } from "./data.js";
import { speak, stopSpeak } from "./speech.js";
import {
  wordForDate,
  wordByNumber,
  dateKey,
  captionFor,
  lessonUrl,
  audioUrl,
  loadStreak,
  recordCompletion,
  makeFindChoices,
  makeUseChoices,
  paintStory,
  downloadStory,
  downloadStoryVideo,
} from "./daily.js";

const app = document.querySelector("#app");
const nav = document.querySelector("#chapter-nav");
const KNOWN_KEY = "my-vocab-known";

function knownSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KNOWN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveKnown(set) {
  localStorage.setItem(KNOWN_KEY, JSON.stringify([...set]));
}
function markKnown(id) {
  const set = knownSet();
  set.add(id);
  saveKnown(set);
  return set;
}

function route() {
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\/?/, "").split("/");
  return { view: parts[0] || "home", param: parts[1] || "", extra: parts[2] || "" };
}

function navHtml(current) {
  return CHAPTERS.map(
    (c) => `<a href="${c.path}" class="${c.id === current ? "active" : ""}">${c.te}</a>`
  ).join("");
}

function pageHead(title, sub, extra = "") {
  return `<div class="page-head">
    <div><h1>${title}</h1><p>${sub}</p></div>
    <div class="toolbar">${extra}</div>
  </div>`;
}

function clusterName(id) {
  return CLUSTERS.find((c) => c.id === id)?.en || id;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStem(stem, fills = []) {
  let i = 0;
  const html = escapeHtml(stem).replace(/\{\{(\d+)\}\}/g, () => {
    const fill = fills[i];
    i += 1;
    return fill ? `<span class="blank">${escapeHtml(fill)}</span>` : `<span class="blank">&nbsp;</span>`;
  });
  return `<p class="stem">${html}</p>`;
}

function wordOverlay(w) {
  return `<div class="overlay" data-close="1">
    <div class="overlay-card">
      <button class="close-x" data-close="1" type="button" aria-label="Close">×</button>
      <p class="pos">${w.pos} · ${clusterName(w.cluster)}</p>
      <p class="w">${w.word}</p>
      <p>${w.def}</p>
      <p><em>${w.example}</em></p>
      <p class="note" style="margin-bottom:0">syn. ${w.syn.join(", ")} · ant. ${w.ant.join(", ")}</p>
      <div class="cover-actions" style="margin-top:1rem">
        <button class="btn" data-speak="${w.word}" type="button">Hear</button>
        <button class="btn ghost" data-known="${w.id}" type="button">Mark known</button>
      </div>
    </div>
  </div>`;
}

function renderHome() {
  const daily = wordForDate();
  const known = knownSet();
  const pct = Math.round((known.size / WORDS.length) * 100);
  const cards = CHAPTERS.filter((c) => c.id !== "home")
    .map(
      (c) => `<a class="chapter-card" href="${c.path}">
        <h3>${c.te}</h3>
        <p>${c.en}</p>
      </a>`
    )
    .join("");
  return `<div class="wrap">
    <div class="cover">
      <div class="ornament">✦</div>
      <p class="kicker">High-level academic English</p>
      <h1>My Vocab</h1>
      <p class="subtitle">Word lists, flashcards, text completion, sentence equivalence</p>
      <p class="lead">One hard word a day. Then GRE-style blanks. The Instagram card is today’s word — not a second curriculum.</p>
      <div class="cover-actions">
        <a class="btn" href="#/daily">Today’s word</a>
        <a class="btn ghost" href="#/tc">Text completion</a>
      </div>
    </div>
    <div class="progress" title="${known.size}/${WORDS.length} marked known"><span style="width:${pct}%"></span></div>
    <p style="text-align:center;color:var(--ink-soft)">Today
      <a class="btn small ghost" href="#/daily">${daily.focus.word}</a>
    </p>
    <h2 style="font-family:var(--display);font-style:italic;font-weight:500;margin:1.6rem 0 .8rem">Practice</h2>
    <div class="chapter-grid">${cards}</div>
    <div class="note">
      <strong>How to use.</strong>
      Start with <a href="#/daily">Today</a>: learn, find, use — then stop. Flashcards and the lexicon are for review. Text completion and sentence equivalence are the exam forms. Post the generated card; do not invent a different word for the feed.
    </div>
  </div>`;
}

let dailyState = { n: null, round: "intro", findChoices: null, useChoices: null, locked: false, autoSpeak: false };

function resolveDaily() {
  const { param } = route();
  if (param && /^\d+$/.test(param)) return wordByNumber(param);
  return wordForDate();
}

function syncDaily(d) {
  if (dailyState.n !== d.n) {
    dailyState = { n: d.n, round: "intro", findChoices: null, useChoices: null, locked: false, autoSpeak: false };
  }
}

function pips(current) {
  const order = ["learn", "find", "use"];
  const labels = ["Learn", "Find", "Use"];
  return `<ol class="round-pips">${order
    .map((id, i) => {
      const past = order.indexOf(current) > i || current === "done";
      return `<li class="${current === id ? "current" : past ? "past" : ""}">${labels[i]}</li>`;
    })
    .join("")}</ol>`;
}

function storyBlock(d) {
  return `<div class="story-block">
    <canvas id="story-canvas" class="story-preview" width="1080" height="1920" aria-label="Instagram story card"></canvas>
    <p class="story-hint">A still cannot play Learn / Find / Use, play sound, or hold a tap target. Instagram only allows voice on video, and a click through a Stories link sticker.</p>
    <ol class="story-steps">
      <li>Download the <strong>video with voice</strong> and upload it as a Story or Reel. Chrome often saves WebM; if Instagram on iPhone rejects it, post the still instead — voice stays on the lesson page.</li>
      <li>Copy the lesson link. In Stories, add a <strong>Link</strong> sticker and paste it.</li>
      <li>Paste the caption. Feed URLs are not tappable — the sticker is the click.</li>
    </ol>
    <textarea class="caption-box" readonly>${escapeHtml(captionFor(d))}</textarea>
    <div class="cover-actions">
      <button class="btn" data-daily="video" type="button">Download video with voice</button>
      <button class="btn ghost" data-daily="download" type="button">Download still</button>
      <button class="btn ghost" data-daily="copy-link" type="button">Copy lesson link</button>
      <button class="btn ghost" data-daily="copy" type="button">Copy caption</button>
      <button class="btn ghost" data-daily="hear" type="button">Play pronunciation</button>
    </div>
    <p class="story-status" id="story-status" hidden></p>
  </div>`;
}

function renderDaily() {
  const d = resolveDaily();
  syncDaily(d);
  const f = d.focus;
  const streak = loadStreak();
  const todayKey = dateKey();
  const isToday = d.n === wordForDate().n;
  const doneToday = isToday && streak.completed.includes(todayKey);
  const { param } = route();
  const share = param === "share";

  if (share || dailyState.round === "intro") {
    return `<div class="wrap">
      ${pageHead(
        "Today’s word",
        `Word ${d.n} / ${d.total} · ${clusterName(f.cluster)}. Three rounds, then stop.`,
        `<a class="btn small ghost" href="#/daily/share">Instagram card</a>`
      )}
      <div class="patha-hero">
        <p class="streak">streak <strong>${streak.streak}</strong>${doneToday ? " · done today" : ""}</p>
        <p class="pos">${f.pos}</p>
        <p class="w">${f.word}</p>
        <p>${f.def}</p>
        <div class="cover-actions">
          <button class="btn" data-daily="start" type="button">${doneToday ? "Play again" : "Start three rounds"}</button>
          <button class="btn ghost" data-speak="${f.word}" type="button">Hear</button>
        </div>
      </div>
      ${share ? storyBlock(d) : `<p style="text-align:center;margin:1.2rem 0 0"><a href="#/daily/share">Post this same word to Instagram →</a></p>`}
    </div>`;
  }

  if (dailyState.round === "learn") {
    return `<div class="wrap">
      ${pageHead("1 · Learn", "Read the definition, hear the word, sit with the example.")}
      ${pips("learn")}
      <div class="patha-board">
        <p class="pos">${f.pos}</p>
        <p class="w">${f.word}</p>
        <p>${f.def}</p>
        <p><em>${f.example}</em></p>
        <p class="note">syn. ${f.syn.join(", ")} · ant. ${f.ant.join(", ")}</p>
        <div class="cover-actions">
          <button class="btn ghost" data-speak="${f.word}" type="button">Hear again</button>
          <button class="btn" data-daily="to-find" type="button">Find →</button>
        </div>
      </div>
    </div>`;
  }

  if (dailyState.round === "find") {
    const choices = (dailyState.findChoices || [])
      .map((c) => `<button type="button" class="patha-choice" data-find="${c.id}">${c.word}</button>`)
      .join("");
    return `<div class="wrap">
      ${pageHead("2 · Find", "Which word matches this definition?")}
      ${pips("find")}
      <div class="patha-board">
        <p class="stem" style="text-align:center">${f.def}</p>
        <div class="patha-choices">${choices}</div>
      </div>
    </div>`;
  }

  if (dailyState.round === "use") {
    const blanked = f.example.replace(new RegExp(f.word, "i"), "_____");
    const choices = (dailyState.useChoices || [])
      .map((c) => `<button type="button" class="patha-choice" data-use="${c.id}">${c.word}</button>`)
      .join("");
    return `<div class="wrap">
      ${pageHead("3 · Use", "Put today’s word back in its sentence.")}
      ${pips("use")}
      <div class="patha-board">
        <p class="stem">${blanked}</p>
        <div class="patha-choices">${choices}</div>
      </div>
    </div>`;
  }

  return `<div class="wrap">
    ${pageHead("Enough for today", `Word ${d.n} is done.`)}
    ${pips("done")}
    <div class="patha-board">
      <p class="streak">streak <strong>${loadStreak().streak}</strong></p>
      <p class="w">${f.word}</p>
      <p>${f.def}</p>
      <div class="cover-actions">
        <a class="btn" href="#/daily/share">Post this word</a>
        <a class="btn ghost" href="#/">Cover</a>
      </div>
    </div>
  </div>`;
}

function afterDailyRender() {
  const canvas = document.querySelector("#story-canvas");
  const d = resolveDaily();
  if (canvas) paintStory(canvas, d);
  if (dailyState.autoSpeak) {
    dailyState.autoSpeak = false;
    speak(d.focus.word);
  }
}

let listFilter = "all";
let listQuery = "";

function renderList() {
  const q = listQuery.trim().toLowerCase();
  const rows = WORDS.filter((w) => {
    if (listFilter !== "all" && w.cluster !== listFilter) return false;
    if (!q) return true;
    return `${w.word} ${w.def} ${w.syn.join(" ")}`.toLowerCase().includes(q);
  });
  const filters = [`<button type="button" data-filter="all" class="${listFilter === "all" ? "active" : ""}">All</button>`]
    .concat(
      CLUSTERS.map(
        (c) =>
          `<button type="button" data-filter="${c.id}" class="${listFilter === c.id ? "active" : ""}">${c.en}</button>`
      )
    )
    .join("");
  const cards = rows
    .map(
      (w) => `<button class="word-card" type="button" data-open="${w.id}">
        <p class="pos">${w.pos} · ${clusterName(w.cluster)}</p>
        <p class="w">${w.word}</p>
        <p class="def">${w.def}</p>
      </button>`
    )
    .join("");
  return `<div class="wrap">
    ${pageHead("Lexicon", `${WORDS.length} high-register words, grouped the way GRE lists actually behave: tone, argument, character, not alphabet drills.`)}
    <input class="search" type="search" placeholder="Search word, meaning, synonym" value="${escapeHtml(listQuery)}" data-search="1" />
    <div class="filters">${filters}</div>
    <div class="word-grid">${cards || "<p>No matches.</p>"}</div>
  </div>`;
}

let cardIndex = 0;
let cardFlipped = false;

function renderCards() {
  const known = knownSet();
  const deck = WORDS.filter((w) => !known.has(w.id));
  const pool = deck.length ? deck : WORDS;
  if (cardIndex >= pool.length) cardIndex = 0;
  const w = pool[cardIndex];
  const face = cardFlipped
    ? `<p class="pos">${w.pos}</p><p class="def">${w.def}</p><p><em>${w.example}</em></p><p class="note">syn. ${w.syn.join(", ")}</p>`
    : `<p class="pos">${w.pos} · ${clusterName(w.cluster)}</p><p class="w">${w.word}</p><p style="color:var(--ink-soft)">Tap to flip</p>`;
  return `<div class="wrap">
    ${pageHead("Flashcards", `${known.size} marked known · ${WORDS.length - known.size} still in the deck.`)}
    <div class="flip">
      <button class="flip-inner" type="button" data-flip="1">${face}</button>
    </div>
    <div class="cover-actions" style="margin-top:1rem">
      <button class="btn ghost" data-card="prev" type="button">← Prev</button>
      <button class="btn" data-speak="${w.word}" type="button">Hear</button>
      <button class="btn ghost" data-known="${w.id}" type="button">Known</button>
      <button class="btn ghost" data-card="next" type="button">Next →</button>
    </div>
  </div>`;
}

let tcIndex = 0;
let tcPicks = [];
let tcLocked = false;
let tcRevealed = false;

function renderTC() {
  const q = TEXT_COMPLETION[tcIndex];
  const fills = tcPicks.map((id, bi) => q.choices[bi].find((c) => c.id === id)?.word);
  const groups = q.choices
    .map((opts, bi) => {
      const buttons = opts
        .map((c) => {
          let cls = "blank-choice";
          if (tcPicks[bi] === c.id) cls += " picked";
          if (tcRevealed && c.ok) cls += " correct";
          if (tcRevealed && tcPicks[bi] === c.id && !c.ok) cls += " wrong";
          return `<button type="button" class="${cls}" data-tc-blank="${bi}" data-tc-id="${c.id}" ${tcLocked ? "disabled" : ""}>${c.word}</button>`;
        })
        .join("");
      const label = q.blanks === 1 ? "Choose one" : `Blank ${bi + 1}`;
      return `<div class="blank-group"><h3>${label}</h3><div class="blank-row">${buttons}</div></div>`;
    })
    .join("");
  const ready = tcPicks.filter(Boolean).length === q.blanks;
  return `<div class="wrap">
    ${pageHead(
      "Text completion",
      `Question ${tcIndex + 1} / ${TEXT_COMPLETION.length}. One, two, or three blanks. Every blank must be right.`
    )}
    <div class="prompt-card" style="text-align:left">
      ${renderStem(q.stem, fills)}
      ${groups}
      ${tcRevealed ? `<p class="note">${q.explain}</p>` : ""}
      <div class="cover-actions">
        ${
          tcRevealed
            ? `<button class="btn" data-tc="next" type="button">Next</button>`
            : `<button class="btn" data-tc="check" type="button" ${ready ? "" : "disabled"}>Check</button>`
        }
      </div>
    </div>
  </div>`;
}

let seIndex = 0;
let sePicks = [];
let seLocked = false;
let seRevealed = false;

function renderSE() {
  const q = SENTENCE_EQUIVALENCE[seIndex];
  const fills = sePicks.length === 2 ? [sePicks.map((id) => q.choices.find((c) => c.id === id)?.word).filter(Boolean).join(" / ")] : [];
  const buttons = q.choices
    .map((c) => {
      let cls = "";
      if (sePicks.includes(c.id)) cls += " picked";
      if (seRevealed && c.ok) cls += " correct";
      if (seRevealed && sePicks.includes(c.id) && !c.ok) cls += " wrong";
      return `<button type="button" class="${cls}" data-se="${c.id}">${c.word}</button>`;
    })
    .join("");
  return `<div class="wrap">
    ${pageHead(
      "Sentence equivalence",
      `Question ${seIndex + 1} / ${SENTENCE_EQUIVALENCE.length}. Select two words that both fit and mean the same thing.`
    )}
    <div class="prompt-card" style="text-align:left">
      ${renderStem(q.stem, fills)}
      <p style="color:var(--ink-soft);font-size:.9rem">${sePicks.length} of 2 selected</p>
      <div class="se-choices">${buttons}</div>
      ${seRevealed ? `<p class="note">${q.explain}</p>` : ""}
      <div class="cover-actions">
        ${
          seRevealed
            ? `<button class="btn" data-se-act="next" type="button">Next</button>`
            : `<button class="btn" data-se-act="check" type="button" ${sePicks.length === 2 ? "" : "disabled"}>Check</button>`
        }
      </div>
    </div>
  </div>`;
}

function render() {
  stopSpeak();
  const { view } = route();
  const current = CHAPTERS.find((c) => c.id === view) ? view : "home";
  nav.innerHTML = navHtml(current);
  let html = "";
  if (view === "daily") html = renderDaily();
  else if (view === "list") html = renderList();
  else if (view === "cards") html = renderCards();
  else if (view === "tc") html = renderTC();
  else if (view === "se") html = renderSE();
  else html = renderHome();
  app.innerHTML = html;
  if (view === "daily") afterDailyRender();
  const search = app.querySelector("[data-search]");
  if (search) {
    search.focus();
    search.selectionStart = search.value.length;
  }
  window.scrollTo(0, 0);
}

app.addEventListener("click", (e) => {
  const t = e.target.closest(
    "[data-speak],[data-close],[data-open],[data-known],[data-daily],[data-find],[data-use],[data-filter],[data-flip],[data-card],[data-tc],[data-tc-blank],[data-se],[data-se-act]"
  );
  if (!t) return;
  if (t.dataset.close) {
    document.querySelector(".overlay")?.remove();
    return;
  }
  if (t.dataset.speak) {
    speak(t.dataset.speak);
    return;
  }
  if (t.dataset.open) {
    const w = WORDS.find((x) => x.id === t.dataset.open);
    if (w) {
      app.insertAdjacentHTML("beforeend", wordOverlay(w));
      speak(w.word);
    }
    return;
  }
  if (t.dataset.known) {
    markKnown(t.dataset.known);
    t.textContent = "Known";
    if (route().view === "cards") {
      cardFlipped = false;
      cardIndex += 1;
      render();
    }
    return;
  }
  if (t.dataset.filter) {
    listFilter = t.dataset.filter;
    render();
    return;
  }
  if (t.dataset.flip) {
    cardFlipped = !cardFlipped;
    render();
    return;
  }
  if (t.dataset.card === "next") {
    cardFlipped = false;
    cardIndex += 1;
    render();
    return;
  }
  if (t.dataset.card === "prev") {
    cardFlipped = false;
    cardIndex = Math.max(0, cardIndex - 1);
    render();
    return;
  }
  if (t.dataset.daily === "start") {
    const d = resolveDaily();
    dailyState.findChoices = makeFindChoices(d);
    dailyState.useChoices = makeUseChoices(d);
    dailyState.locked = false;
    dailyState.round = "learn";
    dailyState.autoSpeak = true;
    if (location.hash !== "#/daily" && !/^#\/daily\/\d+$/.test(location.hash)) {
      location.hash = "#/daily";
      return;
    }
    render();
    return;
  }
  if (t.dataset.daily === "to-find") {
    dailyState.round = "find";
    render();
    return;
  }
  if (t.dataset.daily === "download") {
    downloadStory(document.querySelector("#story-canvas"), resolveDaily());
    return;
  }
  if (t.dataset.daily === "video") {
    const status = document.querySelector("#story-status");
    t.disabled = true;
    if (status) {
      status.hidden = false;
      status.textContent = "Recording voice + card… keep this tab open.";
    }
    downloadStoryVideo(document.querySelector("#story-canvas"), resolveDaily())
      .then(() => {
        if (status) status.textContent = "Saved. Upload that file to a Story or Reel, then add a Link sticker.";
      })
      .catch((err) => {
        if (status) status.textContent = err.message || "Could not record video in this browser.";
      })
      .finally(() => {
        t.disabled = false;
      });
    return;
  }
  if (t.dataset.daily === "copy-link") {
    navigator.clipboard?.writeText(lessonUrl(resolveDaily())).then(() => {
      t.textContent = "Link copied";
    });
    return;
  }
  if (t.dataset.daily === "hear") {
    stopSpeak();
    const clip = new Audio(audioUrl(resolveDaily()));
    clip.play();
    return;
  }
  if (t.dataset.daily === "copy") {
    navigator.clipboard?.writeText(captionFor(resolveDaily())).then(() => {
      t.textContent = "Copied";
    });
    return;
  }
  if (t.dataset.find) {
    if (dailyState.locked) return;
    dailyState.locked = true;
    const d = resolveDaily();
    const ok = t.dataset.find === d.focus.id;
    t.classList.add(ok ? "correct" : "wrong");
    if (!ok) {
      const right = t.parentElement.querySelector(`[data-find="${d.focus.id}"]`);
      if (right) right.classList.add("correct");
    }
    speak(ok ? d.focus.word : d.focus.word);
    setTimeout(() => {
      dailyState.locked = false;
      if (ok) {
        dailyState.round = "use";
        render();
      } else t.classList.remove("wrong");
    }, 800);
    return;
  }
  if (t.dataset.use) {
    if (dailyState.locked) return;
    dailyState.locked = true;
    const d = resolveDaily();
    const ok = t.dataset.use === d.focus.id;
    t.classList.add(ok ? "correct" : "wrong");
    if (!ok) {
      const right = t.parentElement.querySelector(`[data-use="${d.focus.id}"]`);
      if (right) right.classList.add("correct");
    }
    setTimeout(() => {
      dailyState.locked = false;
      if (ok) {
        if (d.n === wordForDate().n) recordCompletion(dateKey());
        markKnown(d.focus.id);
        dailyState.round = "done";
        render();
      } else t.classList.remove("wrong");
    }, 800);
    return;
  }
  if (t.dataset.tcBlank) {
    if (tcLocked) return;
    const bi = Number(t.dataset.tcBlank);
    tcPicks[bi] = t.dataset.tcId;
    render();
    return;
  }
  if (t.dataset.tc === "check") {
    const q = TEXT_COMPLETION[tcIndex];
    tcLocked = true;
    tcRevealed = true;
    const ok = q.choices.every((opts, i) => opts.find((c) => c.id === tcPicks[i])?.ok);
    render();
    speak(ok ? "Correct" : "Not quite");
    return;
  }
  if (t.dataset.tc === "next") {
    tcIndex = (tcIndex + 1) % TEXT_COMPLETION.length;
    tcPicks = [];
    tcLocked = false;
    tcRevealed = false;
    render();
    return;
  }
  if (t.dataset.se) {
    if (seLocked) return;
    const id = t.dataset.se;
    if (sePicks.includes(id)) sePicks = sePicks.filter((x) => x !== id);
    else if (sePicks.length < 2) sePicks = [...sePicks, id];
    render();
    return;
  }
  if (t.dataset.seAct === "check") {
    const q = SENTENCE_EQUIVALENCE[seIndex];
    seLocked = true;
    seRevealed = true;
    const correct = q.choices.filter((c) => c.ok).map((c) => c.id).sort().join();
    const picked = [...sePicks].sort().join();
    render();
    speak(correct === picked ? "Correct" : "Not quite");
    return;
  }
  if (t.dataset.seAct === "next") {
    seIndex = (seIndex + 1) % SENTENCE_EQUIVALENCE.length;
    sePicks = [];
    seLocked = false;
    seRevealed = false;
    render();
    return;
  }
});

app.addEventListener("input", (e) => {
  if (e.target.dataset.search) {
    listQuery = e.target.value;
    const { view } = route();
    if (view === "list") {
      const html = renderList();
      app.innerHTML = html;
      const search = app.querySelector("[data-search]");
      if (search) {
        search.focus();
        search.selectionStart = search.value.length;
      }
    }
  }
});

window.addEventListener("hashchange", render);
render();
