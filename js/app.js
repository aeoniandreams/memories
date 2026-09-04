import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ⬇️ 관리자 이메일 입력란: 백업 생성/수정/삭제 권한을 가진 계정의 이메일입니다.
// 나중에 이메일이 바뀌면 이 값만 바꾸면 되는데, Firestore 콘솔의 규칙(firestore.rules)에
// 있는 같은 이름의 "관리자 이메일 입력란" 값도 반드시 똑같이 바꿔야 합니다 — 이 값은
// 화면에 버튼을 보여줄지만 결정하고, 실제 쓰기 권한 통제는 규칙 쪽이 하기 때문입니다.
const ADMIN_EMAIL = "ae0niandreams@gmail.com"; // 관리자 이메일 입력란

// ⬇️ 필터용 태그 입력란: 여기 적은 이름들이 태그 버튼으로 나타납니다.
// 순서를 바꾸거나 문자열을 추가/삭제하면 그대로 반영돼요 (배포만 다시 하면 됩니다).
const TAG_OPTIONS = ["퍼블트", "츄야윤", "츄앤명"];
const PUBLT_TAG = "퍼블트"; // 이 태그가 붙은 카드에만 우측 상단에 "P" 뱃지를 표시합니다.

const NO_TAG_FILTER_VALUE = "__no_tag__"; // 필터에서 "태그 없음"을 고르면 쓰이는 값

// ---------- 엘리먼트 참조 ----------
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const themeToggleBtns = document.querySelectorAll(".theme-toggle-btn");

const sortToggleBtn = document.getElementById("sort-toggle-btn");
const tagFilterSelect = document.getElementById("tag-filter-select");
const cardGrid = document.getElementById("card-grid");
const emptyState = document.getElementById("empty-state");

const detailModal = document.getElementById("detail-modal");
const detailThread = document.getElementById("detail-thread");
const detailCloseBtn = document.getElementById("detail-close-btn");
const detailDeleteBtn = document.getElementById("detail-delete-btn");
const detailAppendBtn = document.getElementById("detail-append-btn");
const detailEditBtn = document.getElementById("detail-edit-btn");

const tweetCommentEditorModal = document.getElementById("tweet-comment-editor-modal");
const tweetCommentEditorCloseBtn = document.getElementById("tweet-comment-editor-close-btn");
const tweetCommentEditorSaveBtn = document.getElementById("tweet-comment-editor-save-btn");
const tweetCommentEditorTextarea = document.getElementById("tweet-comment-editor-textarea");
const tweetCommentTypeOptions = document.getElementById("tweet-comment-type-options");

const newCardBtn = document.getElementById("new-card-btn");
const newCardModal = document.getElementById("new-card-modal");
const newCardCloseBtn = document.getElementById("new-card-close-btn");
const newCardSaveBtn = document.getElementById("new-card-save-btn");
const appendModeLabel = document.getElementById("append-mode-label");
const tagOptionsContainer = document.getElementById("tag-options");
const importTextarea = document.getElementById("import-textarea");
const importParseBtn = document.getElementById("import-parse-btn");
const importError = document.getElementById("import-error");
const addEmptyMessageBtn = document.getElementById("add-empty-message-btn");
const editableRows = document.getElementById("editable-rows");

let currentDetailCardId = null;
let currentDetailData = null;
let editingMessages = []; // 새 대화 추가 모달에서 편집 중인 메시지 배열
let editingTags = []; // 새 대화 추가 모달에서 편집 중인 카드 태그 배열
let appendTargetCardId = null; // 설정되어 있으면 "새 카드 생성"이 아니라 이 카드에 이어붙임
let editTargetCardId = null; // 설정되어 있으면 이 카드의 메시지 전체를 편집 내용으로 교체
let loadedCards = []; // 홈 화면에 로드된 카드 목록 (정렬/필터 전환 시 재요청 없이 재사용)
let sortDirection = "desc"; // "desc" = 최신순, "asc" = 오래된순
let filterTag = ""; // 빈 문자열이면 전체 태그
let isAdmin = false;
let currentTweetComments = new Map(); // messageKey -> { user?: {type, text}, admin?: {type, text} } (상세보기 열 때마다 다시 불러옴)
let editingCommentKey = null; // 코멘트 작성 창에서 지금 편집 중인 메시지의 key
let editingCommentAdminType = "message-circle"; // 관리자가 코멘트 작성 시 고른 아이콘 종류

// ---------- 야간 모드 ----------
// Lucide(lucide.dev, MIT 라이선스) 아이콘의 SVG를 그대로 가져다 씁니다.
// stroke="currentColor"라 버튼의 글자색(테마에 따라 자동으로 바뀜)을 그대로 따라갑니다.
const SUN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const MOON_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
const PIN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`;
const PENCIL_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.986L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`;
// 버튼 배경 자체가 반투명하게 채워져 있어(css의 --comment-btn-bg) 아이콘은 단순한
// currentColor 아웃라인 하나로 충분합니다 (색은 .image-comment-btn의 color: var(--bg)를 따릅니다).
const MESSAGE_SQUARE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const PLUS_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;

// ---------- 트윗 코멘트 아이콘 (lucide.dev, MIT 라이선스 아이콘을 참고해 그렸습니다) ----------
// 말풍선 모양 배경(우측 "보기" 버튼의 바탕)으로 씁니다. fill로 채워 넣는 용도라 stroke는 없습니다.
const MESSAGE_CIRCLE_BUBBLE_FILL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" fill="currentColor"/></svg>`;
// 코멘트 종류 3가지 중 하나: message-circle (관리자용 선택지)
const MESSAGE_CIRCLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
// 코멘트 종류 3가지 중 하나: wine (관리자가 아닌 사용자의 코멘트는 항상 이 아이콘으로 저장됩니다)
const WINE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>`;
// 코멘트 종류 3가지 중 하나: coffee (관리자용 선택지)
const COFFEE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/></svg>`;
// 좌측 "코멘트 작성" 버튼 아이콘
const MESSAGE_CIRCLE_PLUS_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`;

// 코멘트에 저장된 type 문자열로 어떤 아이콘을 보여줄지 결정합니다.
const COMMENT_TYPE_ICONS = {
  "message-circle": MESSAGE_CIRCLE_ICON_SVG,
  wine: WINE_ICON_SVG,
  coffee: COFFEE_ICON_SVG,
};

function getEffectiveTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeIcon() {
  // 어두운 상태일 땐 "누르면 밝아짐"을 뜻하는 해 아이콘을, 밝은 상태일 땐 달 아이콘을 보여줍니다.
  const svg = getEffectiveTheme() === "dark" ? SUN_ICON_SVG : MOON_ICON_SVG;
  themeToggleBtns.forEach((btn) => { btn.innerHTML = svg; });
}

themeToggleBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const next = getEffectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("memories-theme", next);
    } catch (e) {
      // 저장 실패해도(사생활 보호 모드 등) 이번 방문 동안은 계속 적용됩니다.
    }
    applyThemeIcon();
  });
});

applyThemeIcon();

// ---------- 유틸 ----------
function safeImgSrc(url) {
  if (typeof url === "string" && /^https?:\/\//.test(url.trim())) {
    return url.trim();
  }
  return "";
}

// 트윗의 images 필드를 항상 {url, comment} 형태로 맞춰줍니다.
// 북마클릿이 캡처한 값이나 예전에 저장된 카드는 문자열 배열(["url", ...])이라
// 그런 경우엔 comment를 빈 문자열로 채워서 통일합니다.
function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => {
      if (typeof img === "string") return { url: img, comment: "" };
      if (img && typeof img === "object") return { url: img.url || "", comment: img.comment || "" };
      return { url: "", comment: "" };
    })
    .filter((img) => img.url);
}

// 트윗 코멘트는 messages 배열과 분리된 하위 컬렉션(tweetComments)에 저장되는데,
// 그 문서 ID로 쓸 "이 트윗을 가리키는 안정적인 값"이 필요합니다. 북마클릿으로
// 가져온 트윗은 고유 id가 있어 그대로 씁니다. id가 없는(직접 입력한) 트윗은
// 아이디/날짜/본문/순서로 만든 해시를 대신 씁니다 — 나중에 그 트윗의 본문을
// 고치면 해시가 바뀌어 코멘트 연결이 끊길 수 있다는 점은 감안해주세요.
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function getMessageCommentKey(msg, index) {
  if (msg.id) return msg.id;
  return "gen_" + simpleHash(`${msg.handle}|${msg.dateDisplay}|${msg.text}|${index}`);
}

// "이어서 추가" 시 이미 있는 트윗과 겹치는지 판단합니다.
// id가 둘 다 있으면 id로 비교(북마클릿이 넣어준 트윗 고유 ID라 가장 정확함),
// 하나라도 id가 없으면(수동 추가 등) 아이디/날짜/본문이 같은지로 대신 판단합니다.
function isDuplicateMessage(a, b) {
  if (a.id && b.id) return a.id === b.id;
  return a.handle === b.handle && a.dateDisplay === b.dateDisplay && a.text === b.text;
}

function toDateSort(display) {
  // 끝의 온점(0000.00.00.)은 있어도 없어도 인식합니다.
  const m = String(display || "").trim().match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\.?$/);
  if (!m) return "";
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function escapeForAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}

function avatarImg(src, alt, className) {
  const img = document.createElement("img");
  img.className = className || "avatar";
  img.alt = alt || "";
  img.referrerPolicy = "no-referrer";
  img.src = safeImgSrc(src) || fallbackAvatarDataUri();
  img.onerror = () => { img.src = fallbackAvatarDataUri(); };
  return img;
}

function fallbackAvatarDataUri() {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="24" fill="%23cbd2d9"/></svg>'
        .replaceAll("%23", "#")
    )
  );
}

// ---------- 인증 ----------
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginView.hidden = true;
    appView.hidden = false;
    isAdmin = user.email === ADMIN_EMAIL;
    applyAdminUI();
    loadCards();
  } else {
    loginView.hidden = false;
    appView.hidden = true;
    isAdmin = false;
  }
});

// 관리자만 백업 생성/수정/삭제 가능. 화면에서 버튼을 숨기는 건 UX일 뿐이고,
// 실제 권한 통제는 Firestore 보안 규칙(firestore.rules)이 해요.
function applyAdminUI() {
  newCardBtn.hidden = !isAdmin;
  detailDeleteBtn.hidden = !isAdmin;
  detailAppendBtn.hidden = !isAdmin;
  detailEditBtn.hidden = !isAdmin;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
  } catch (err) {
    loginError.textContent = "이메일 또는 비밀번호가 올바르지 않아요.";
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

// ---------- 홈: 카드 목록 ----------
async function loadCards() {
  const q = query(collection(db, "cards"), orderBy("firstDateSort", "desc"));
  const snapshot = await getDocs(q);
  loadedCards = snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
  renderCardGrid();
}

// 필터 드롭다운은 TAG_OPTIONS 고정 목록을 그대로 보여줍니다. 페이지 로드 시 한 번만 채우면 됩니다.
function renderTagFilterOptions() {
  tagFilterSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "전체 태그";
  tagFilterSelect.appendChild(allOpt);
  TAG_OPTIONS.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    tagFilterSelect.appendChild(opt);
  });
  const noTagOpt = document.createElement("option");
  noTagOpt.value = NO_TAG_FILTER_VALUE;
  noTagOpt.textContent = "태그 없음";
  tagFilterSelect.appendChild(noTagOpt);
  tagFilterSelect.value = filterTag;
}
renderTagFilterOptions();

tagFilterSelect.addEventListener("change", () => {
  filterTag = tagFilterSelect.value;
  renderCardGrid();
});

function renderCardGrid() {
  cardGrid.innerHTML = "";

  const filtered = loadedCards.filter(({ data }) => {
    const tags = Array.isArray(data.tags) ? data.tags : [];
    if (filterTag === "") return true;
    if (filterTag === NO_TAG_FILTER_VALUE) return tags.length === 0;
    return tags.includes(filterTag);
  });

  if (filtered.length === 0) {
    emptyState.textContent = filterTag
      ? "이 태그가 붙은 대화가 없어요."
      : '아직 백업된 대화가 없어요. "새 대화 추가"로 첫 대화를 백업해보세요.';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  const sorted = [...filtered].sort((a, b) => {
    const aSort = (a.data.firstDateSort || "");
    const bSort = (b.data.firstDateSort || "");
    return sortDirection === "asc" ? aSort.localeCompare(bSort) : bSort.localeCompare(aSort);
  });

  sorted.forEach(({ id, data }) => {
    const first = (data.messages && data.messages[0]) || {};
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";

    const head = document.createElement("div");
    head.className = "card-head";
    head.appendChild(avatarImg(first.avatar, first.nickname));

    const headText = document.createElement("div");
    headText.className = "card-head-text";
    const nickEl = document.createElement("span");
    nickEl.className = "card-nickname";
    nickEl.textContent = first.nickname || "(이름 없음)";
    const metaEl = document.createElement("span");
    metaEl.className = "card-meta";
    metaEl.textContent = [first.handle, first.dateDisplay].filter(Boolean).join(" · ");
    headText.append(nickEl, metaEl);
    head.appendChild(headText);

    const textEl = document.createElement("p");
    textEl.className = "card-text";
    textEl.textContent = first.text || "";

    card.append(head, textEl);

    const thumbImages = normalizeImages(first.images)
      .filter((img) => safeImgSrc(img.url))
      .slice(0, 2);
    if (thumbImages.length > 0) {
      const thumbRow = document.createElement("div");
      thumbRow.className = "card-thumbs";
      thumbImages.forEach((thumbImage) => {
        const thumbWrap = document.createElement("div");
        thumbWrap.className = "card-thumb-wrap";
        const thumb = document.createElement("img");
        thumb.className = "card-thumb";
        thumb.src = thumbImage.url;
        thumb.loading = "lazy";
        thumb.referrerPolicy = "no-referrer";
        thumb.alt = "";
        thumbWrap.appendChild(thumb);

        if (thumbImage.comment) {
          const commentBtn = document.createElement("button");
          commentBtn.type = "button";
          commentBtn.className = "image-comment-btn";
          commentBtn.innerHTML = MESSAGE_SQUARE_ICON_SVG;
          commentBtn.setAttribute("aria-label", "이미지 코멘트 보기");
          commentBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openCommentModal(thumbImage.comment);
          });
          thumbWrap.appendChild(commentBtn);
        }

        thumbRow.appendChild(thumbWrap);
      });
      card.appendChild(thumbRow);
    }

    if (Array.isArray(data.tags) && data.tags.includes(PUBLT_TAG)) {
      const badge = document.createElement("span");
      badge.className = "card-tag-badge";
      badge.textContent = "P";
      badge.title = PUBLT_TAG;
      card.appendChild(badge);
    }

    card.addEventListener("click", () => openDetail(id, data));
    cardGrid.appendChild(card);
  });
}

sortToggleBtn.addEventListener("click", () => {
  sortDirection = sortDirection === "desc" ? "asc" : "desc";
  sortToggleBtn.textContent = sortDirection === "desc" ? "최신순 ▾" : "오래된순 ▾";
  renderCardGrid();
});

// ---------- 상세보기 모달 ----------
async function openDetail(id, data) {
  currentDetailCardId = id;
  currentDetailData = data;
  detailThread.innerHTML = "";
  // 이미지 크기 계산 시 실제 너비를 읽어야 해서, 먼저 화면에 보이게 한 뒤 내용을 채웁니다.
  detailModal.hidden = false;

  currentTweetComments = new Map();
  try {
    const snap = await getDocs(collection(db, "cards", id, "tweetComments"));
    snap.forEach((d) => currentTweetComments.set(d.id, d.data()));
  } catch (e) {
    console.error("트윗 코멘트를 불러오지 못했습니다.", e);
  }

  (data.messages || []).forEach((msg, index) => {
    const key = getMessageCommentKey(msg, index);
    detailThread.appendChild(renderMessageRow(msg, key, currentTweetComments.get(key)));
  });
}

function renderMessageRow(msg, commentKey, comments) {
  const row = document.createElement("div");
  row.className = "message-row";

  const addCommentBtn = document.createElement("button");
  addCommentBtn.type = "button";
  addCommentBtn.className = "tweet-comment-add-btn";
  addCommentBtn.innerHTML = MESSAGE_CIRCLE_PLUS_ICON_SVG;
  addCommentBtn.setAttribute("aria-label", "코멘트 작성");
  addCommentBtn.addEventListener("click", () => openTweetCommentEditor(commentKey, comments));
  row.appendChild(addCommentBtn);

  const avatarCol = document.createElement("div");
  avatarCol.className = "avatar-col";
  avatarCol.appendChild(avatarImg(msg.avatar, msg.nickname));

  const contentCol = document.createElement("div");
  contentCol.className = "content-col";

  const header = document.createElement("div");
  header.className = "content-header";
  const nick = document.createElement("span");
  nick.className = "nickname";
  nick.textContent = msg.nickname || "(이름 없음)";
  const handle = document.createElement("span");
  handle.className = "handle";
  handle.textContent = msg.handle || "";
  const date = document.createElement("span");
  date.className = "date";
  date.textContent = msg.dateDisplay || "";
  header.append(nick, handle, date);

  const text = document.createElement("p");
  text.className = "tweet-text";
  text.textContent = msg.text || "";

  contentCol.append(header, text);

  if (Array.isArray(msg.images) && msg.images.length > 0) {
    const grid = document.createElement("div");
    grid.className = "tweet-images";
    contentCol.appendChild(grid);
    // 이미지 원본 크기를 읽어와야 배치를 계산할 수 있어서 비동기로 채웁니다.
    renderImageGridInto(grid, msg.images);
  }

  row.append(avatarCol, contentCol);

  const viewEntries = [comments && comments.user, comments && comments.admin].filter(Boolean);
  if (viewEntries.length > 0) {
    const viewStack = document.createElement("div");
    viewStack.className = "tweet-comment-view-stack";
    viewEntries.forEach((entry) => viewStack.appendChild(makeTweetCommentViewBtn(entry)));
    row.appendChild(viewStack);
  }

  return row;
}

// 코멘트 종류(아이콘)별로 말풍선 모양 배경 위에 해당 아이콘을 겹쳐 그린 "보기" 버튼입니다.
function makeTweetCommentViewBtn(commentEntry) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tweet-comment-view-btn";
  btn.setAttribute("aria-label", "코멘트 보기");

  const bubble = document.createElement("span");
  bubble.className = "bubble-shape";
  bubble.innerHTML = MESSAGE_CIRCLE_BUBBLE_FILL_SVG;

  const icon = document.createElement("span");
  icon.className = "bubble-icon";
  icon.innerHTML = COMMENT_TYPE_ICONS[commentEntry.type] || MESSAGE_CIRCLE_ICON_SVG;

  btn.append(bubble, icon);
  btn.addEventListener("click", () => openCommentModal(commentEntry.text));
  return btn;
}

// 이미지 URL마다 원본 가로/세로 크기를 한 번만 읽어와 재사용합니다.
const imageDimCache = new Map();
function getImageDimensions(url) {
  if (imageDimCache.has(url)) return Promise.resolve(imageDimCache.get(url));
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => {
      const dim = { w: probe.naturalWidth || 1, h: probe.naturalHeight || 1 };
      imageDimCache.set(url, dim);
      resolve(dim);
    };
    probe.onerror = () => {
      const dim = { w: 1, h: 1 };
      imageDimCache.set(url, dim);
      resolve(dim);
    };
    probe.src = url;
  });
}

// 코멘트가 있는 이미지에만 우측 하단에 동그란 버튼을 붙입니다. 클릭하면 코멘트 창이 열려요.
function makeImageLink(image) {
  const link = document.createElement("a");
  link.className = "image-link";
  link.href = image.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const img = document.createElement("img");
  img.src = image.url;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.style.borderRadius = "10px";
  img.style.display = "block";
  link.appendChild(img);

  if (image.comment) {
    const commentBtn = document.createElement("button");
    commentBtn.type = "button";
    commentBtn.className = "image-comment-btn";
    commentBtn.innerHTML = MESSAGE_SQUARE_ICON_SVG;
    commentBtn.setAttribute("aria-label", "이미지 코멘트 보기");
    commentBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCommentModal(image.comment);
    });
    link.appendChild(commentBtn);
  }

  return { link, img };
}

function styleGridCellImg(img) {
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
}

// X 트윗의 사진 배치를 재현합니다: 1장은 긴 변이 대화창 너비의 70%,
// 2장은 각자 비율을 지킨 채 같은 높이로 나란히 폭을 꽉 채움,
// 3장은 왼쪽 큰 사진 + 오른쪽 위아래 2장, 4장은 2x2. (크롭이 필요하면 object-fit: cover로 처리)
async function renderImageGridInto(container, images) {
  const normalized = normalizeImages(images);
  if (normalized.length === 0) return;

  const dims = await Promise.all(normalized.map((im) => getImageDimensions(im.url)));
  const containerWidth = container.clientWidth || container.getBoundingClientRect().width || 300;
  const GAP = 5;

  if (normalized.length === 1) {
    const ratio = dims[0].w / dims[0].h;
    const { link, img } = makeImageLink(normalized[0]);
    const longSide = containerWidth * 0.7;
    if (ratio >= 1) {
      img.style.width = longSide + "px";
      img.style.height = "auto";
    } else {
      img.style.height = longSide + "px";
      img.style.width = "auto";
    }
    container.style.display = "block";
    container.appendChild(link);
    return;
  }

  if (normalized.length === 2) {
    const r0 = dims[0].w / dims[0].h;
    const r1 = dims[1].w / dims[1].h;
    const rowHeight = (containerWidth - GAP) / (r0 + r1);
    container.style.display = "flex";
    container.style.gap = GAP + "px";
    normalized.forEach((image, i) => {
      const ratio = dims[i].w / dims[i].h;
      const { link, img } = makeImageLink(image);
      img.style.height = rowHeight + "px";
      img.style.width = rowHeight * ratio + "px";
      container.appendChild(link);
    });
    return;
  }

  if (normalized.length === 3) {
    container.style.display = "grid";
    container.style.gridTemplateColumns = "1fr 1fr";
    container.style.gridTemplateRows = "1fr 1fr";
    container.style.gap = GAP + "px";
    container.style.aspectRatio = "1.7 / 1";

    const { link: leftLink, img: leftImg } = makeImageLink(normalized[0]);
    leftLink.style.gridColumn = "1 / 2";
    leftLink.style.gridRow = "1 / 3";
    styleGridCellImg(leftImg);
    container.appendChild(leftLink);

    [1, 2].forEach((i) => {
      const { link, img } = makeImageLink(normalized[i]);
      link.style.gridColumn = "2 / 3";
      link.style.gridRow = i === 1 ? "1 / 2" : "2 / 3";
      styleGridCellImg(img);
      container.appendChild(link);
    });
    return;
  }

  // 4장(그 이상이면 앞 4장을 2x2로, 나머지는 그 아래 한 줄씩 자연스럽게 이어붙입니다)
  container.style.display = "grid";
  container.style.gridTemplateColumns = "1fr 1fr";
  container.style.gap = GAP + "px";
  if (normalized.length === 4) container.style.aspectRatio = "1 / 1";

  normalized.slice(0, 4).forEach((image) => {
    const { link, img } = makeImageLink(image);
    styleGridCellImg(img);
    container.appendChild(link);
  });
  normalized.slice(4).forEach((image) => {
    const { link, img } = makeImageLink(image);
    link.style.gridColumn = "1 / 3";
    img.style.width = "100%";
    img.style.height = "auto";
    container.appendChild(link);
  });
}

function closeDetail() {
  detailModal.hidden = true;
  currentDetailCardId = null;
}

detailCloseBtn.addEventListener("click", closeDetail);

// 모달 바깥(어두운 배경) 클릭 시 닫기. 패널 안쪽 클릭은 여기까지 이벤트가
// 버블링되어 오지만, target이 오버레이 자신일 때만 닫아서 안쪽 클릭은 무시합니다.
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) closeDetail();
});

// ---------- 이미지 코멘트 보기 ----------
const commentModal = document.getElementById("comment-modal");
const commentModalText = document.getElementById("comment-modal-text");
const commentModalCloseBtn = document.getElementById("comment-modal-close-btn");

function openCommentModal(comment) {
  commentModalText.textContent = comment;
  commentModal.hidden = false;
}

function closeCommentModal() {
  commentModal.hidden = true;
}

commentModalCloseBtn.addEventListener("click", closeCommentModal);
commentModal.addEventListener("click", (e) => {
  if (e.target === commentModal) closeCommentModal();
});

// ---------- 트윗 코멘트 작성/수정 ----------
// 관리자가 아닌 사용자는 항상 "wine" 아이콘으로 저장되고, 관리자는 message-circle/coffee
// 중 하나를 골라 저장합니다. (본인 역할의 코멘트만 쓸 수 있게 firestore.rules에서 막아둡니다.)
function openTweetCommentEditor(commentKey, existingComments) {
  editingCommentKey = commentKey;
  const mine = isAdmin ? existingComments && existingComments.admin : existingComments && existingComments.user;
  tweetCommentEditorTextarea.value = (mine && mine.text) || "";
  editingCommentAdminType = (mine && mine.type) || "message-circle";

  tweetCommentTypeOptions.hidden = !isAdmin;
  if (isAdmin) renderCommentTypeOptions();

  tweetCommentEditorModal.hidden = false;
}

function renderCommentTypeOptions() {
  tweetCommentTypeOptions.innerHTML = "";
  [
    ["message-circle", MESSAGE_CIRCLE_ICON_SVG],
    ["coffee", COFFEE_ICON_SVG],
  ].forEach(([type, svg]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tweet-comment-type-btn" + (type === editingCommentAdminType ? " selected" : "");
    btn.innerHTML = svg;
    btn.setAttribute("aria-label", type);
    btn.addEventListener("click", () => {
      editingCommentAdminType = type;
      renderCommentTypeOptions();
    });
    tweetCommentTypeOptions.appendChild(btn);
  });
}

function closeTweetCommentEditor() {
  tweetCommentEditorModal.hidden = true;
  editingCommentKey = null;
}

tweetCommentEditorCloseBtn.addEventListener("click", closeTweetCommentEditor);
tweetCommentEditorModal.addEventListener("click", (e) => {
  if (e.target === tweetCommentEditorModal) closeTweetCommentEditor();
});

tweetCommentEditorSaveBtn.addEventListener("click", async () => {
  if (!editingCommentKey || !currentDetailCardId) return;
  const text = tweetCommentEditorTextarea.value.trim();
  const role = isAdmin ? "admin" : "user";
  const payload = {
    [role]: text ? { type: isAdmin ? editingCommentAdminType : "wine", text } : null,
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, "cards", currentDetailCardId, "tweetComments", editingCommentKey), payload, { merge: true });
    closeTweetCommentEditor();
    // 우측 "보기" 버튼에 바로 반영되도록 상세 화면을 다시 불러옵니다.
    openDetail(currentDetailCardId, currentDetailData);
  } catch (e) {
    alert("코멘트 저장에 실패했습니다: " + e.message);
  }
});

detailDeleteBtn.addEventListener("click", async () => {
  if (!currentDetailCardId) return;
  if (!confirm("이 대화 백업을 삭제할까요? 되돌릴 수 없어요.")) return;
  await deleteDoc(doc(db, "cards", currentDetailCardId));
  detailModal.hidden = true;
  currentDetailCardId = null;
  loadCards();
});

detailAppendBtn.addEventListener("click", () => {
  if (!currentDetailCardId) return;
  appendTargetCardId = currentDetailCardId;
  editTargetCardId = null;
  editingMessages = [];
  editingTags = [...(currentDetailData.tags || [])];
  importTextarea.value = "";
  importError.hidden = true;
  appendModeLabel.hidden = false;
  appendModeLabel.innerHTML = PIN_ICON_SVG + " 기존 대화 아래로 이어서 추가하는 중이에요.";
  renderEditableRows();
  renderTagOptions();
  detailModal.hidden = true;
  newCardModal.hidden = false;
});

detailEditBtn.addEventListener("click", () => {
  if (!currentDetailCardId) return;
  editTargetCardId = currentDetailCardId;
  appendTargetCardId = null;
  editingMessages = (currentDetailData.messages || []).map((m) => ({ ...m, images: normalizeImages(m.images) }));
  editingTags = [...(currentDetailData.tags || [])];
  importTextarea.value = "";
  importError.hidden = true;
  appendModeLabel.hidden = false;
  appendModeLabel.innerHTML = PENCIL_ICON_SVG + " 기존 대화를 수정하는 중이에요. 메시지를 고치거나 지울 수 있고, 필요하면 붙여넣기로 더 추가할 수도 있어요.";
  renderEditableRows();
  renderTagOptions();
  detailModal.hidden = true;
  newCardModal.hidden = false;
});

// ---------- 새 대화 추가 모달 ----------
newCardBtn.addEventListener("click", () => {
  appendTargetCardId = null;
  editTargetCardId = null;
  editingMessages = [];
  editingTags = [];
  importTextarea.value = "";
  importError.hidden = true;
  appendModeLabel.hidden = true;
  renderEditableRows();
  renderTagOptions();
  newCardModal.hidden = false;
});

newCardCloseBtn.addEventListener("click", () => {
  newCardModal.hidden = true;
  appendTargetCardId = null;
  editTargetCardId = null;
  appendModeLabel.hidden = true;
});

// ---------- 태그 편집 (미리 정해둔 TAG_OPTIONS 중에서 골라서 켜고 끔) ----------
function renderTagOptions() {
  tagOptionsContainer.innerHTML = "";
  TAG_OPTIONS.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-option" + (editingTags.includes(tag) ? " selected" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      const i = editingTags.indexOf(tag);
      if (i === -1) editingTags.push(tag);
      else editingTags.splice(i, 1);
      renderTagOptions();
    });
    tagOptionsContainer.appendChild(btn);
  });
}

importParseBtn.addEventListener("click", () => {
  importError.hidden = true;
  let parsed;
  try {
    parsed = JSON.parse(importTextarea.value);
  } catch (err) {
    importError.textContent = "JSON 형식을 읽을 수 없어요. 북마클릿으로 복사한 내용 그대로 붙여넣었는지 확인해주세요.";
    importError.hidden = false;
    return;
  }
  if (!Array.isArray(parsed)) {
    importError.textContent = "목록(배열) 형태의 데이터가 아니에요.";
    importError.hidden = false;
    return;
  }
  // 기존 편집 중인 메시지(이어서 추가/수정 모드에서 이미 불러온 것) 뒤에 이어붙입니다.
  editingMessages = editingMessages.concat(
    parsed.map((m) => ({
      id: m.id || "", // 북마클릿이 넣어준 트윗 고유 ID (있으면 "이어서 추가" 시 중복 판단에 씀)
      avatar: m.avatar || "",
      nickname: m.nickname || "",
      handle: m.handle || "",
      dateDisplay: m.dateDisplay || "",
      text: m.text || "",
      images: normalizeImages(m.images),
    }))
  );
  importTextarea.value = "";
  renderEditableRows();
});

addEmptyMessageBtn.addEventListener("click", () => {
  editingMessages.push({ id: "", avatar: "", nickname: "", handle: "", dateDisplay: "", text: "", images: [] });
  renderEditableRows();
});

function renderEditableRows() {
  editableRows.innerHTML = "";
  editingMessages.forEach((msg, index) => {
    editableRows.appendChild(renderEditRow(msg, index));
  });
}

function renderEditRow(msg, index) {
  const row = document.createElement("div");
  row.className = "edit-row";

  const top = document.createElement("div");
  top.className = "edit-row-top";
  const preview = avatarImg(msg.avatar, msg.nickname, "avatar");
  top.appendChild(preview);

  const fields = document.createElement("div");
  fields.className = "edit-row-fields";

  const avatarInput = makeInput("프로필 사진 URL", msg.avatar, "avatar-url");
  avatarInput.addEventListener("input", () => {
    editingMessages[index].avatar = avatarInput.value;
    preview.src = safeImgSrc(avatarInput.value) || fallbackAvatarDataUri();
  });

  const nicknameInput = makeInput("닉네임", msg.nickname);
  nicknameInput.addEventListener("input", () => { editingMessages[index].nickname = nicknameInput.value; });

  const handleInput = makeInput("@아이디", msg.handle);
  handleInput.addEventListener("input", () => { editingMessages[index].handle = handleInput.value; });

  const dateInput = makeInput("0000.00.00.", msg.dateDisplay);
  dateInput.addEventListener("input", () => { editingMessages[index].dateDisplay = dateInput.value; });

  fields.append(avatarInput, nicknameInput, handleInput, dateInput);
  top.appendChild(fields);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "edit-row-remove";
  removeBtn.textContent = "이 메시지 삭제";
  removeBtn.addEventListener("click", () => {
    editingMessages.splice(index, 1);
    renderEditableRows();
  });

  const textArea = document.createElement("textarea");
  textArea.placeholder = "대화 내용";
  textArea.value = msg.text;
  textArea.addEventListener("input", () => { editingMessages[index].text = textArea.value; });

  const imagesEditor = renderImagesEditor(index);

  row.append(top, textArea, imagesEditor, removeBtn);
  return row;
}

// 메시지 하나(index번째)의 첨부 이미지들을 URL + 코멘트 쌍으로 편집하는 영역을 만듭니다.
function renderImagesEditor(index) {
  const wrap = document.createElement("div");
  wrap.className = "images-editor";

  function rerender() {
    wrap.innerHTML = "";
    const images = editingMessages[index].images || [];

    images.forEach((image, imgIndex) => {
      const imgRow = document.createElement("div");
      imgRow.className = "image-edit-row";

      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.placeholder = "이미지 URL";
      urlInput.value = image.url || "";
      urlInput.addEventListener("input", () => {
        editingMessages[index].images[imgIndex].url = urlInput.value;
      });

      const commentInput = document.createElement("textarea");
      commentInput.className = "image-comment-textarea";
      commentInput.placeholder = "이 이미지에 대한 코멘트 (선택, 붙여넣기 가능)";
      commentInput.rows = 2;
      commentInput.value = image.comment || "";
      commentInput.addEventListener("input", () => {
        editingMessages[index].images[imgIndex].comment = commentInput.value;
      });

      const removeImgBtn = document.createElement("button");
      removeImgBtn.type = "button";
      removeImgBtn.className = "edit-row-remove";
      removeImgBtn.textContent = "이 이미지 삭제";
      removeImgBtn.addEventListener("click", () => {
        editingMessages[index].images.splice(imgIndex, 1);
        rerender();
      });

      imgRow.append(urlInput, commentInput, removeImgBtn);
      wrap.appendChild(imgRow);
    });

    const addImageBtn = document.createElement("button");
    addImageBtn.type = "button";
    addImageBtn.className = "btn-secondary";
    addImageBtn.innerHTML = PLUS_ICON_SVG + " 이미지 추가";
    addImageBtn.addEventListener("click", () => {
      if (!editingMessages[index].images) editingMessages[index].images = [];
      editingMessages[index].images.push({ url: "", comment: "" });
      rerender();
    });
    wrap.appendChild(addImageBtn);
  }

  rerender();
  return wrap;
}

function makeInput(placeholder, value, extraClass) {
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  input.value = value || "";
  if (extraClass) input.className = extraClass;
  return input;
}

newCardSaveBtn.addEventListener("click", async () => {
  if (editingMessages.length === 0) {
    importError.textContent = "저장할 메시지가 없어요. 먼저 불러오기를 하거나 메시지를 추가해주세요.";
    importError.hidden = false;
    return;
  }
  const messages = editingMessages.map((m) => ({
    id: m.id || "",
    avatar: m.avatar || "",
    nickname: m.nickname || "",
    handle: m.handle || "",
    dateDisplay: m.dateDisplay || "",
    dateSort: toDateSort(m.dateDisplay),
    text: m.text || "",
    images: (Array.isArray(m.images) ? m.images : [])
      .filter((img) => img && img.url && img.url.trim())
      .map((img) => ({ url: img.url.trim(), comment: (img.comment || "").trim() })),
  }));

  newCardSaveBtn.disabled = true;
  newCardSaveBtn.textContent = "저장 중...";
  try {
    if (editTargetCardId) {
      const targetRef = doc(db, "cards", editTargetCardId);
      await updateDoc(targetRef, {
        messages,
        firstDateSort: messages[0].dateSort || "",
        tags: editingTags,
      });
    } else if (appendTargetCardId) {
      const targetRef = doc(db, "cards", appendTargetCardId);
      const targetSnap = await getDoc(targetRef);
      const existingMessages = (targetSnap.data() && targetSnap.data().messages) || [];
      const newOnes = messages.filter(
        (m) => !existingMessages.some((e) => isDuplicateMessage(m, e))
      );
      const skipped = messages.length - newOnes.length;
      await updateDoc(targetRef, {
        messages: [...existingMessages, ...newOnes],
        tags: editingTags,
      });
      if (skipped > 0) {
        alert(skipped + "개는 이미 저장되어 있는 트윗이라 제외하고 추가했어요.");
      }
    } else {
      await addDoc(collection(db, "cards"), {
        messages,
        firstDateSort: messages[0].dateSort || "",
        tags: editingTags,
        createdAt: serverTimestamp(),
      });
    }
    newCardModal.hidden = true;
    appendTargetCardId = null;
    editTargetCardId = null;
    appendModeLabel.hidden = true;
    loadCards();
  } catch (err) {
    console.error("[memories] 저장 실패", err);
    const who = auth.currentUser
      ? "로그인 상태: " + (auth.currentUser.email || auth.currentUser.uid)
      : "로그인 상태: 로그인 안 되어 있음";
    importError.textContent =
      "저장에 실패했어요 (" + (err.code || err.message) + "). [" + who + "]";
    importError.hidden = false;
  } finally {
    newCardSaveBtn.disabled = false;
    newCardSaveBtn.textContent = "저장";
  }
});
