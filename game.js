const $ = (id) => document.getElementById(id);

const promptTextEl = $("promptText");
const promptImageEl = $("promptImage");
const guessForm = $("guessForm");
const guessInput = $("guessInput");
const guessesEl = $("guesses");

const revealEl = $("reveal");
const revealTitleEl = $("revealTitle");
const revealTextEl = $("revealText");
const nextBtn = $("nextBtn");
const puzzleMetaEl = $("puzzleMeta");

let puzzles = [];
let puzzleIndex = 0;
let solved = false;

let blurPx = 18; // starting blur for each puzzle
const blurMin = 0; // fully clear

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[c]));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function editDistance(a, b) {
  a = normalize(a);
  b = normalize(b);

  const m = a.length;
  const n = b.length;

  if (!m) return n;
  if (!n) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function typoScore(guess, tag) {
  const g = normalize(guess);
  const t = normalize(tag);
  if (!g || !t) return 0;

  const dist = editDistance(g, t);
  const maxLen = Math.max(g.length, t.length);
  const similarity = 1 - dist / maxLen;

  if (similarity >= 0.92) return 65;
  if (similarity >= 0.85) return 45;
  if (similarity >= 0.75) return 25;
  return 0;
}

function computeScore(guessRaw, tags) {
  const guess = normalize(guessRaw);
  if (!guess) return 0;

  let best = 0;

  for (const { t, w } of tags) {
    const tag = normalize(t);
    let s = 0;

    if (guess === tag) {
      s = w;
    } else if (guess.includes(tag) || tag.includes(guess)) {
      s = Math.min(80, w);
    } else {
      s = typoScore(guess, tag);
    }

    if (s > best) best = s;
  }

  return best;
}

function scoreToEmoji(score, acceptScore) {
  if (score >= acceptScore) return { emoji: "❤️", note: "Solved" };
  if (score >= 75) return { emoji: "🔥", note: "Very close" };
  if (score >= 50) return { emoji: "🟠", note: "Close" };
  if (score >= 25) return { emoji: "🟡", note: "Warm" };
  return { emoji: "❄️", note: "Far" };
}

function addGuessRow(text, emoji, note) {
  const row = document.createElement("div");
  row.className = "guessRow";

  row.innerHTML = `
    <div class="guessLeft">
      <div class="guessText">${escapeHtml(text)}</div>
      <div class="guessNote">${escapeHtml(note)}</div>
    </div>
    <div class="guessEmoji">${emoji}</div>
  `;

  guessesEl.prepend(row);
}

function showPuzzle(p) {
  solved = false;
  guessesEl.innerHTML = "";
  revealEl.classList.add("hidden");
  nextBtn.disabled = false;

  promptTextEl.textContent = p.prompt || "";

  blurPx = typeof p.startBlur === "number" ? p.startBlur : 18;
  promptImageEl.style.setProperty("--blur", `${blurPx}px`);

  if (p.image) {
    promptImageEl.src = p.image;
    promptImageEl.style.display = "block";
    promptImageEl.alt = p.title || "Memory photo";
  } else {
    promptImageEl.style.display = "none";
    promptImageEl.removeAttribute("src");
    promptImageEl.alt = "";
  }

  puzzleMetaEl.textContent = `Puzzle: ${p.title || p.id || ""}`;

  guessInput.value = "";
  guessInput.focus();
}

function revealPuzzle(p) {
  revealTitleEl.textContent = p.revealTitle || "You got it ❤️";
  revealTextEl.textContent = p.revealText || "";
  revealEl.classList.remove("hidden");
}

function nextPuzzle() {
  if (!puzzles.length) return;
  puzzleIndex = (puzzleIndex + 1) % puzzles.length;
  showPuzzle(puzzles[puzzleIndex]);
}

function applyUnblur(emoji) {
  const step = 1.5; // reveal amount per guess, tweak this number
  if (emoji === "❤️") blurPx = blurMin;
  else blurPx = Math.max(blurMin, blurPx - step);

  promptImageEl.style.setProperty("--blur", `${blurPx}px`);
}

async function init() {
  const res = await fetch("puzzles.json", { cache: "no-store" });
  puzzles = await res.json();

  if (!Array.isArray(puzzles) || puzzles.length === 0) {
    promptTextEl.textContent = "No puzzles found. Add puzzles to puzzles.json.";
    return;
  }

  shuffle(puzzles);

  showPuzzle(puzzles[puzzleIndex]);
}

guessForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (solved) return;

  const p = puzzles[puzzleIndex];
  const guess = guessInput.value.trim();
  if (!guess) return;

  const score = computeScore(guess, p.tags || []);
  const accept = typeof p.acceptScore === "number" ? p.acceptScore : 90;
  const { emoji, note } = scoreToEmoji(score, accept);

  addGuessRow(guess, emoji, note);
  applyUnblur(emoji);

  guessInput.value = "";
  guessInput.focus();

  if (emoji === "❤️") {
    solved = true;
    revealPuzzle(p);
  }
});

nextBtn.addEventListener("click", () => nextPuzzle());

init();
