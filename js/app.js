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
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- 엘리먼트 참조 ----------
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

const cardGrid = document.getElementById("card-grid");
const emptyState = document.getElementById("empty-state");

const detailModal = document.getElementById("detail-modal");
const detailThread = document.getElementById("detail-thread");
const detailCloseBtn = document.getElementById("detail-close-btn");
const detailDeleteBtn = document.getElementById("detail-delete-btn");

const newCardBtn = document.getElementById("new-card-btn");
const newCardModal = document.getElementById("new-card-modal");
const newCardCloseBtn = document.getElementById("new-card-close-btn");
const newCardSaveBtn = document.getElementById("new-card-save-btn");
const importTextarea = document.getElementById("import-textarea");
const importParseBtn = document.getElementById("import-parse-btn");
const importError = document.getElementById("import-error");
const addEmptyMessageBtn = document.getElementById("add-empty-message-btn");
const editableRows = document.getElementById("editable-rows");

let currentDetailCardId = null;
let editingMessages = []; // 새 대화 추가 모달에서 편집 중인 메시지 배열

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
    loadCards();
  } else {
    loginView.hidden = false;
    appView.hidden = true;
  }
});

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
  cardGrid.innerHTML = "";
  const q = query(collection(db, "cards"), orderBy("firstDateSort", "desc"));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
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
    card.addEventListener("click", () => openDetail(docSnap.id, data));
    cardGrid.appendChild(card);
  });
}

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

detailCloseBtn.addEventListener("click", () => {
  detailModal.hidden = true;
  currentDetailCardId = null;
});

detailDeleteBtn.addEventListener("click", async () => {
  if (!currentDetailCardId) return;
  if (!confirm("이 대화 백업을 삭제할까요? 되돌릴 수 없어요.")) return;
  await deleteDoc(doc(db, "cards", currentDetailCardId));
  detailModal.hidden = true;
  currentDetailCardId = null;
  loadCards();
});

// ---------- 새 대화 추가 모달 ----------
newCardBtn.addEventListener("click", () => {
  editingMessages = [];
  importTextarea.value = "";
  importError.hidden = true;
  renderEditableRows();
  newCardModal.hidden = false;
});

newCardCloseBtn.addEventListener("click", () => {
  newCardModal.hidden = true;
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
  editingMessages.push({ avatar: "", nickname: "", handle: "", dateDisplay: "", text: "", images: [] });
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
    await addDoc(collection(db, "cards"), {
      messages,
      firstDateSort: messages[0].dateSort || "",
      createdAt: serverTimestamp(),
    });
    newCardModal.hidden = true;
    loadCards();
  } catch (err) {
    console.error("[memories] 저장 실패", err);
    importError.textContent = "저장에 실패했어요 (" + (err.code || err.message) + "). Firestore 보안 규칙이 게시됐는지 확인해주세요.";
    importError.hidden = false;
  } finally {
    newCardSaveBtn.disabled = false;
    newCardSaveBtn.textContent = "저장";
  }
});
