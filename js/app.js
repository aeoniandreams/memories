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

// ---------- 엘리먼트 참조 ----------
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

const sortToggleBtn = document.getElementById("sort-toggle-btn");
const cardGrid = document.getElementById("card-grid");
const emptyState = document.getElementById("empty-state");

const detailModal = document.getElementById("detail-modal");
const detailThread = document.getElementById("detail-thread");
const detailCloseBtn = document.getElementById("detail-close-btn");
const detailCloseBottomBtn = document.getElementById("detail-close-bottom-btn");
const detailDeleteBtn = document.getElementById("detail-delete-btn");
const detailAppendBtn = document.getElementById("detail-append-btn");

const newCardBtn = document.getElementById("new-card-btn");
const newCardModal = document.getElementById("new-card-modal");
const newCardCloseBtn = document.getElementById("new-card-close-btn");
const newCardSaveBtn = document.getElementById("new-card-save-btn");
const appendModeLabel = document.getElementById("append-mode-label");
const importTextarea = document.getElementById("import-textarea");
const importParseBtn = document.getElementById("import-parse-btn");
const importError = document.getElementById("import-error");
const addEmptyMessageBtn = document.getElementById("add-empty-message-btn");
const editableRows = document.getElementById("editable-rows");

let currentDetailCardId = null;
let editingMessages = []; // 새 대화 추가 모달에서 편집 중인 메시지 배열
let appendTargetCardId = null; // 설정되어 있으면 "새 카드 생성"이 아니라 이 카드에 이어붙임
let loadedCards = []; // 홈 화면에 로드된 카드 목록 (정렬 전환 시 재요청 없이 재사용)
let sortDirection = "desc"; // "desc" = 최신순, "asc" = 오래된순
let isAdmin = false;

// ---------- 유틸 ----------
function safeImgSrc(url) {
  if (typeof url === "string" && /^https?:\/\//.test(url.trim())) {
    return url.trim();
  }
  return "";
}

function parseImageUrls(text) {
  return String(text || "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// "이어서 추가" 시 이미 있는 트윗과 겹치는지 판단합니다.
// id가 둘 다 있으면 id로 비교(북마클릿이 넣어준 트윗 고유 ID라 가장 정확함),
// 하나라도 id가 없으면(수동 추가 등) 아이디/날짜/본문이 같은지로 대신 판단합니다.
function isDuplicateMessage(a, b) {
  if (a.id && b.id) return a.id === b.id;
  return a.handle === b.handle && a.dateDisplay === b.dateDisplay && a.text === b.text;
}

function toDateSort(display) {
  const m = String(display || "").trim().match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
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

function renderCardGrid() {
  cardGrid.innerHTML = "";

  if (loadedCards.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  const sorted = [...loadedCards].sort((a, b) => {
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
function openDetail(id, data) {
  currentDetailCardId = id;
  detailThread.innerHTML = "";
  (data.messages || []).forEach((msg) => {
    detailThread.appendChild(renderMessageRow(msg));
  });
  detailModal.hidden = false;
}

function renderMessageRow(msg) {
  const row = document.createElement("div");
  row.className = "message-row";

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
    contentCol.appendChild(renderImageGrid(msg.images));
  }

  row.append(avatarCol, contentCol);
  return row;
}

function renderImageGrid(images) {
  const grid = document.createElement("div");
  grid.className = "tweet-images";
  images.forEach((url) => {
    const src = safeImgSrc(url);
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const img = document.createElement("img");
    img.src = src;
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    link.appendChild(img);
    grid.appendChild(link);
  });
  return grid;
}

function closeDetail() {
  detailModal.hidden = true;
  currentDetailCardId = null;
}

detailCloseBtn.addEventListener("click", closeDetail);
detailCloseBottomBtn.addEventListener("click", closeDetail);

// 모달 바깥(어두운 배경) 클릭 시 닫기. 패널 안쪽 클릭은 여기까지 이벤트가
// 버블링되어 오지만, target이 오버레이 자신일 때만 닫아서 안쪽 클릭은 무시합니다.
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) closeDetail();
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
  editingMessages = [];
  importTextarea.value = "";
  importError.hidden = true;
  appendModeLabel.hidden = false;
  renderEditableRows();
  detailModal.hidden = true;
  newCardModal.hidden = false;
});

// ---------- 새 대화 추가 모달 ----------
newCardBtn.addEventListener("click", () => {
  appendTargetCardId = null;
  editingMessages = [];
  importTextarea.value = "";
  importError.hidden = true;
  appendModeLabel.hidden = true;
  renderEditableRows();
  newCardModal.hidden = false;
});

newCardCloseBtn.addEventListener("click", () => {
  newCardModal.hidden = true;
  appendTargetCardId = null;
  appendModeLabel.hidden = true;
});

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
  editingMessages = parsed.map((m) => ({
    id: m.id || "", // 북마클릿이 넣어준 트윗 고유 ID (있으면 "이어서 추가" 시 중복 판단에 씀)
    avatar: m.avatar || "",
    nickname: m.nickname || "",
    handle: m.handle || "",
    dateDisplay: m.dateDisplay || "",
    text: m.text || "",
    images: Array.isArray(m.images) ? m.images.filter(Boolean) : [],
  }));
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

  const dateInput = makeInput("0000.00.00", msg.dateDisplay);
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

  const imagesArea = document.createElement("textarea");
  imagesArea.placeholder = "첨부 이미지 URL (여러 개면 줄바꿈이나 쉼표로 구분)";
  imagesArea.rows = 2;
  imagesArea.value = (msg.images || []).join("\n");
  imagesArea.addEventListener("input", () => {
    editingMessages[index].images = parseImageUrls(imagesArea.value);
  });

  row.append(top, textArea, imagesArea, removeBtn);
  return row;
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
    images: Array.isArray(m.images) ? m.images.filter(Boolean) : [],
  }));

  newCardSaveBtn.disabled = true;
  newCardSaveBtn.textContent = "저장 중...";
  try {
    if (appendTargetCardId) {
      const targetRef = doc(db, "cards", appendTargetCardId);
      const targetSnap = await getDoc(targetRef);
      const existingMessages = (targetSnap.data() && targetSnap.data().messages) || [];
      const newOnes = messages.filter(
        (m) => !existingMessages.some((e) => isDuplicateMessage(m, e))
      );
      const skipped = messages.length - newOnes.length;
      await updateDoc(targetRef, {
        messages: [...existingMessages, ...newOnes],
      });
      if (skipped > 0) {
        alert(skipped + "개는 이미 저장되어 있는 트윗이라 제외하고 추가했어요.");
      }
    } else {
      await addDoc(collection(db, "cards"), {
        messages,
        firstDateSort: messages[0].dateSort || "",
        createdAt: serverTimestamp(),
      });
    }
    newCardModal.hidden = true;
    appendTargetCardId = null;
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
