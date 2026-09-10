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
  collectionGroup,
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
const loadingView = document.getElementById("loading-view");
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const themeToggleBtns = document.querySelectorAll(".theme-toggle-btn");
const notifBellBtns = document.querySelectorAll(".notif-bell-btn");
const notifBellDots = document.querySelectorAll(".notif-bell-dot");
const notifBackdrop = document.getElementById("notif-backdrop");
const notifPanel = document.getElementById("notif-panel");
const notifPanelList = document.getElementById("notif-panel-list");
const notifPanelEmpty = document.getElementById("notif-panel-empty");

// X 백업 / 카카오톡 백업 / SumOne 전환용 우측 사이드바. 평소엔 숨겨져
// 있다가 헤더의 메뉴(☰) 버튼을 누르면 열립니다(아래 "사이드바 열기/닫기" 참고).
const appSidebar = document.getElementById("app-sidebar");
const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
const sidebarXBtn = document.getElementById("sidebar-x-btn");
const sidebarKakaoBtn = document.getElementById("sidebar-kakao-btn");
const sidebarSumoneBtn = document.getElementById("sidebar-sumone-btn");
const sidebarHelpBtn = document.getElementById("sidebar-help-btn");
const appSidebarAdminBadge = document.getElementById("app-sidebar-admin-badge");
const sidebarMenuBtns = document.querySelectorAll(".sidebar-menu-btn");
const kakaoAppView = document.getElementById("kakao-app-view");
const kakaoLogoutBtn = document.getElementById("kakao-logout-btn");
const sumoneAppView = document.getElementById("sumone-app-view");
const sumoneLogoutBtn = document.getElementById("sumone-logout-btn");

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

const tweetCommentPanel = document.getElementById("tweet-comment-panel");
const tweetCommentPanelBackBtn = document.getElementById("tweet-comment-panel-back-btn");
const tweetCommentPanelActionBtn = document.getElementById("tweet-comment-panel-action-btn");
const tweetCommentPanelDeleteBtn = document.getElementById("tweet-comment-panel-delete-btn");
const tweetCommentPanelBody = document.getElementById("tweet-comment-panel-body");

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
// 대화창이 열려 있을 때 휴대폰의 뒤로가기를 누르면 사이트를 나가는 대신 대화창만
// 닫히도록, 열 때 히스토리 항목을 하나 쌓아둡니다 (아래 openDetail/leaveDetailModal 참고).
let detailHistoryPushed = false;
let editingMessages = []; // 새 대화 추가 모달에서 편집 중인 메시지 배열
// index -> { avatarInput, preview }. 프로필 사진을 바꾸면 같은 닉네임을 쓰는
// 아래쪽 메시지들에도 바로 반영해야 하는데, renderEditableRows() 전체를 다시
// 그리면 지금 입력 중인 칸이 포커스를 잃어버려서, 다른 행의 엘리먼트를 직접
// 찾아갈 수 있도록 렌더링할 때마다 참조를 담아둡니다.
let editRowAvatarEls = [];
let editingTags = []; // 새 대화 추가 모달에서 편집 중인 카드 태그 배열
let appendTargetCardId = null; // 설정되어 있으면 "새 카드 생성"이 아니라 이 카드에 이어붙임
let editTargetCardId = null; // 설정되어 있으면 이 카드의 메시지 전체를 편집 내용으로 교체
let loadedCards = []; // 홈 화면에 로드된 카드 목록 (정렬/필터 전환 시 재요청 없이 재사용)
let sortDirection = "desc"; // "desc" = 최신순, "asc" = 오래된순
let filterTag = ""; // 빈 문자열이면 전체 태그
let isAdmin = false;

// ---------- 알림 상태 ----------
let currentUid = null;
let cardSeenMap = new Map(); // "section:cardId" -> 언제까지 확인했는지(ms)
let targetSeenMap = new Map(); // "section:cardId:targetKey:type" -> 언제까지 확인했는지(ms)
let notifEntriesCache = []; // { section, cardId, targetKey, role, type, createdAt }[]
let currentTweetComments = new Map(); // messageKey -> { user?: [{id,type,text}], admin?: [{id,type,text}] } (상세보기 열 때마다 다시 불러옴)
// 코멘트 패널(우측 보기/좌측 작성)의 현재 상태.
// mode: "view"(보기) | "edit"(기존 코멘트 수정) | "compose"(새 코멘트 작성)
let tweetCommentPanelState = null;
// 코멘트 작성/수정 중인 블록 목록. [{type:"text", text} | {type:"image", url}]
// 순서대로 나열되며, 저장 시 이 배열이 그대로 entry.content가 됩니다.
let commentComposeBlocks = [];

// "메시지 키(트윗은 commentKey, 카카오는 msgIndex 문자열)" -> 그 메시지의 원본
// 텍스트. 코멘트 작성/보기 중 왼쪽 스레드에서 드래그로 고른 문구를 강조 표시할 때,
// 이미 강조 표시가 적용된 뒤에도(=텍스트가 여러 span으로 쪼개진 뒤에도) 원본
// 문자열을 기준으로 다시 계산할 수 있도록 따로 들고 있습니다.
let tweetOriginalTextByKey = new Map();
let kakaoOriginalTextByKey = new Map();

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
// 코멘트 이미지 블록의 여러 장 넘겨보기용 화살표.
const CHEVRON_LEFT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;
const CHEVRON_RIGHT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
// 코멘트 편집 중 블록 순서를 드래그로 바꿀 때 잡는 손잡이 아이콘.
const GRIP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;

// ---------- 트윗 코멘트 아이콘 (lucide.dev, MIT 라이선스 아이콘을 참고해 그렸습니다) ----------
// 말풍선 모양 배경(우측 "보기" 버튼의 바탕)으로 씁니다. fill로 채워 넣는 용도라 stroke는 없습니다.
const MESSAGE_CIRCLE_BUBBLE_FILL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" fill="currentColor"/></svg>`;
// 코멘트 종류 3가지 중 하나: message-circle (관리자용 선택지)
const MESSAGE_CIRCLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
// 코멘트 종류 3가지 중 하나: wine (관리자가 아닌 사용자의 코멘트는 항상 이 아이콘으로 저장됩니다)
const WINE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>`;
// 코멘트 종류 3가지 중 하나: coffee (관리자용 선택지)
const COFFEE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/></svg>`;
// 좌측 "코멘트 작성" 버튼 아이콘. 다른 message-circle류 아이콘과 달리 말풍선 꼬리가
// 반대쪽(오른쪽)을 향하도록 전체를 좌우 반전했습니다 (십자가는 대칭이라 모양이 그대로 유지됨).
const MESSAGE_CIRCLE_PLUS_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: scaleX(-1);"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`;
// 프사 좌측 하단 "좋아요" 하트. 기본은 선(테두리)만 있고, 눌러서 찜하면
// CSS(.message-like-btn.liked)가 fill을 채워 꽉 찬 하트로 바꿉니다.
const HEART_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;

// 앱 설명란 토글(접기/펼치기) 블록의 "펼침" 아이콘. "접힘" 쪽은 위에 이미 있는
// CHEVRON_RIGHT_ICON_SVG를 그대로 씁니다.
const CHEVRON_DOWN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;

// ---------- 앱 설명란에 글 중간중간 넣을 수 있는 아이콘들 ----------
// 헤더의 알림/로그아웃 아이콘은 HTML에 바로 박혀 있어서 여기서 따로
// 상수로 둡니다(앱 다른 곳 아이콘과 똑같은 모양을 재사용).
const BELL_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>`;
const LOG_OUT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`;
const INFO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
const HELP_CIRCLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`;
const STAR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>`;
const CHECK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const X_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const ALERT_TRIANGLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
const SMILE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>`;
const THUMBS_UP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>`;

// 아이콘 삽입 팝업에 나열할 목록. 아이콘의 "의미"를 글로 설명하고 싶을 때
// 쓰라고 만든 기능이라, 앱 안에서 이미 쓰이는 아이콘들(말풍선/커피/와인/
// 하트/알림종/로그아웃/토글 화살표)을 우선 넣고, 일반적인 문서 작성용
// 아이콘 몇 개를 추가했습니다.
const APP_INFO_ICON_CHOICES = [
  { id: "message-circle", label: "말풍선", svg: MESSAGE_CIRCLE_ICON_SVG },
  { id: "coffee", label: "커피", svg: COFFEE_ICON_SVG },
  { id: "wine", label: "와인", svg: WINE_ICON_SVG },
  { id: "heart", label: "하트", svg: HEART_ICON_SVG },
  { id: "bell", label: "알림종", svg: BELL_ICON_SVG },
  { id: "log-out", label: "로그아웃", svg: LOG_OUT_ICON_SVG },
  { id: "chevron-right", label: "화살표(접힘)", svg: CHEVRON_RIGHT_ICON_SVG },
  { id: "chevron-down", label: "화살표(펼침)", svg: CHEVRON_DOWN_ICON_SVG },
  { id: "info", label: "정보", svg: INFO_ICON_SVG },
  { id: "help-circle", label: "물음표", svg: HELP_CIRCLE_ICON_SVG },
  { id: "star", label: "별", svg: STAR_ICON_SVG },
  { id: "check", label: "체크", svg: CHECK_ICON_SVG },
  { id: "x", label: "엑스", svg: X_ICON_SVG },
  { id: "alert-triangle", label: "주의", svg: ALERT_TRIANGLE_ICON_SVG },
  { id: "smile", label: "웃음", svg: SMILE_ICON_SVG },
  { id: "thumbs-up", label: "좋아요", svg: THUMBS_UP_ICON_SVG },
];

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

// 트윗 코멘트는 한 트윗에 여러 개가 쌓일 수 있어서, 각 코멘트마다 구분용 id가 필요합니다.
function genCommentId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
// 로그인 여부 확인이 너무 빨리 끝나면 로딩 화면(이미지 애니메이션 등)이
// 한 프레임 반짝이고 사라지는 것처럼 보일 수 있어서, 페이지가 열린 뒤
// 최소 1초는 로딩 화면이 보이도록 보장합니다. 기준 시각(window.__pageLoadStart)은
// index.html의 아무것도 기다리지 않는 스크립트에서 미리 재둔 값입니다.
const MIN_LOADING_MS = 1000;
onAuthStateChanged(auth, (user) => {
  const elapsed = Date.now() - (window.__pageLoadStart || Date.now());
  const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
  setTimeout(() => {
    // 로그인 여부 확인이 끝났으니(로딩 화면이 뜬 목적이 끝남) 로딩 화면을 숨기고,
    // 아래에서 로그인 폼 또는 앱 화면 중 맞는 쪽을 보여줍니다.
    loadingView.hidden = true;
    if (user) {
      loginView.hidden = true;
      appSidebar.hidden = false;
      appSidebar.classList.remove("open"); // 로그인 직후엔 항상 닫힌 채로 시작
      switchSection("x");
      isAdmin = user.email === ADMIN_EMAIL;
      applyAdminUI();
      currentUid = user.uid;
      loadCards();
      loadSeenMaps().then(loadNotifEntries).then(() => {
        // 카드 목록이 이미 그려졌을 수 있어서(위 loadCards가 비동기라 순서가
        // 겹칠 수 있음), 알림 데이터가 준비된 뒤 한 번 더 그려서 새 코멘트
        // 점이 처음부터 제대로 보이게 합니다.
        renderCardGrid();
        if (sumoneCardsLoaded) renderSumoneCardGrid();
        if (kakaoCardsLoaded) renderKakaoCardGrid();
      });
    } else {
      loginView.hidden = false;
      appView.hidden = true;
      kakaoAppView.hidden = true;
      sumoneAppView.hidden = true;
      appSidebar.hidden = true;
      appSidebar.classList.remove("open");
      isAdmin = false;
      currentUid = null;
      cardSeenMap = new Map();
      targetSeenMap = new Map();
      notifEntriesCache = [];
      updateNotifBellDots();
      closeNotifPanel();
    }
  }, remaining);
});

// 관리자만 백업 생성/수정/삭제 가능. 화면에서 버튼을 숨기는 건 UX일 뿐이고,
// 실제 권한 통제는 Firestore 보안 규칙(firestore.rules)이 해요.
function applyAdminUI() {
  appSidebarAdminBadge.hidden = !isAdmin;
  newCardBtn.hidden = !isAdmin;
  detailDeleteBtn.hidden = !isAdmin;
  detailAppendBtn.hidden = !isAdmin;
  detailEditBtn.hidden = !isAdmin;
  kakaoNewCardBtn.hidden = !isAdmin;
  kakaoDetailEditBtn.hidden = !isAdmin;
  kakaoDetailDeleteBtn.hidden = !isAdmin;
  sumoneNewCardBtn.hidden = !isAdmin;
  sumoneDetailEditBtn.hidden = !isAdmin;
  sumoneDetailDeleteBtn.hidden = !isAdmin;
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
kakaoLogoutBtn.addEventListener("click", () => signOut(auth));
sumoneLogoutBtn.addEventListener("click", () => signOut(auth));

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
    const last = (data.messages && data.messages[data.messages.length - 1]) || {};
    // 마지막 트윗 날짜가 첫 트윗과 다를 때만 "시작 - 끝" 범위로 보여주고,
    // 메시지가 하나뿐이거나 같은 날짜에 몰려있으면 날짜 하나만 보여줍니다.
    const dateLabel =
      last.dateDisplay && last.dateDisplay !== first.dateDisplay
        ? `${first.dateDisplay} - ${last.dateDisplay}`
        : first.dateDisplay;
    const metaEl = document.createElement("span");
    metaEl.className = "card-meta";
    // 아이디/날짜를 각각 별도 span으로 나눠서, 모바일에서만 그 사이에 줄바꿈이
    // 되도록 CSS로 조절할 수 있게 합니다(데스크탑은 " · "로 이어진 한 줄 그대로).
    if (first.handle) {
      const handleEl = document.createElement("span");
      handleEl.className = "card-meta-handle";
      handleEl.textContent = first.handle;
      metaEl.appendChild(handleEl);
    }
    if (first.handle && dateLabel) {
      const sepEl = document.createElement("span");
      sepEl.className = "card-meta-sep";
      sepEl.textContent = " · ";
      metaEl.appendChild(sepEl);
    }
    if (dateLabel) {
      const dateEl = document.createElement("span");
      dateEl.className = "card-meta-date";
      dateEl.textContent = dateLabel;
      metaEl.appendChild(dateEl);
    }
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
      thumbImages.forEach((thumbImage, thumbIndex) => {
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
          const thumbKey = id + "|" + thumbIndex;
          const commentBtn = document.createElement("button");
          commentBtn.type = "button";
          commentBtn.className = "image-comment-btn";
          commentBtn.innerHTML = MESSAGE_SQUARE_ICON_SVG;
          commentBtn.setAttribute("aria-label", "이미지 코멘트 보기");
          commentBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            // 코멘트 보기 버튼처럼, 이미 이 이미지의 코멘트 창이 열려 있으면
            // 다시 눌렀을 때 바로 닫히게 합니다.
            const alreadyOpen = !thumbCommentModal.hidden && thumbCommentModalKey === thumbKey;
            if (alreadyOpen) closeThumbCommentModal();
            else openThumbCommentModal(thumbImage.comment, thumbKey);
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

    appendNotifDots(card, "x", id);

    card.addEventListener("click", () => openDetail(id, data));
    cardGrid.appendChild(card);
  });
}

sortToggleBtn.addEventListener("click", () => {
  sortDirection = sortDirection === "desc" ? "asc" : "desc";
  sortToggleBtn.textContent = sortDirection === "desc" ? "최신순 ▾" : "오래된순 ▾";
  renderCardGrid();
});

// 예전 버전엔 역할(user/admin)당 코멘트를 하나만 {type, text} 객체로 저장했습니다.
// 지금은 여러 개를 배열([{id,type,text}, ...])로 저장하는데, 이미 저장되어 있던
// 예전 형식 문서를 만나면 배열로 바꿔줘야 합니다 (안 그러면 .forEach가 배열이 아닌
// 객체에서 호출되어 에러가 나고, 그 트윗부터 이후 메시지 전체가 안 그려집니다).
function normalizeCommentField(field) {
  if (Array.isArray(field)) return field;
  if (field && typeof field === "object" && field.text) {
    return [{ id: genCommentId(), type: field.type || "message-circle", text: field.text }];
  }
  return [];
}

function normalizeCommentDoc(data) {
  return {
    user: normalizeCommentField(data && data.user),
    admin: normalizeCommentField(data && data.admin),
  };
}

// ---------- 상세보기 모달 ----------
async function openDetail(id, data) {
  currentDetailCardId = id;
  currentDetailData = data;
  markCardSeen("x", id);
  detailThread.innerHTML = "";
  // 이미지 크기 계산 시 실제 너비를 읽어야 해서, 먼저 화면에 보이게 한 뒤 내용을 채웁니다.
  detailModal.hidden = false;
  history.pushState({ memoriesDetailOpen: true }, "");
  detailHistoryPushed = true;

  currentTweetComments = new Map();
  try {
    const snap = await getDocs(collection(db, "cards", id, "tweetComments"));
    snap.forEach((d) => currentTweetComments.set(d.id, normalizeCommentDoc(d.data())));
  } catch (e) {
    console.error("트윗 코멘트를 불러오지 못했습니다.", e);
  }

  tweetOriginalTextByKey = new Map();
  (data.messages || []).forEach((msg, index) => {
    const key = getMessageCommentKey(msg, index);
    tweetOriginalTextByKey.set(key, msg.text || "");
    detailThread.appendChild(renderMessageRow(msg, index, key, currentTweetComments.get(key)));
  });
}

function applyTweetThreadHighlights(highlights) {
  applyThreadHighlights(detailThread, ".message-row", ".tweet-text", tweetOriginalTextByKey, highlights);
}

// 이미지 코멘트는 카드 본문(messages[].images[].comment)에 저장되어 있어서, 관리자만
// (firestore.rules상 카드 본문은 관리자 전용 쓰기) 여기서 바로 고쳐 저장할 수 있습니다.
async function saveImageComment(msgIndex, url, newText) {
  const rawImages = Array.isArray(currentDetailData.messages[msgIndex].images)
    ? currentDetailData.messages[msgIndex].images
    : [];
  const updatedRawImages = rawImages.map((img) => {
    const imgUrl = typeof img === "string" ? img : (img && img.url) || "";
    return imgUrl === url ? { url: imgUrl, comment: newText } : img;
  });
  const updatedMessages = currentDetailData.messages.map((m, i) =>
    i === msgIndex ? { ...m, images: updatedRawImages } : m
  );
  await updateDoc(doc(db, "cards", currentDetailCardId), { messages: updatedMessages });
  currentDetailData = { ...currentDetailData, messages: updatedMessages };
  closeCommentModal();
  openDetail(currentDetailCardId, currentDetailData);
}

// 프사 좌측 하단 하트(좋아요)를 켜고 끕니다. 카드 본문(messages)은 관리자만
// 쓸 수 있어서(firestore.rules), 이 토글도 관리자만 누를 수 있습니다 — 유저는
// 관리자가 찜해둔 하트(꽉 찬 상태)만 보고, 직접 누르진 못합니다.
async function toggleMessageLike(msgIndex) {
  if (!isAdmin) return;
  const updatedMessages = currentDetailData.messages.map((m, i) =>
    i === msgIndex ? { ...m, liked: !m.liked } : m
  );
  await updateDoc(doc(db, "cards", currentDetailCardId), { messages: updatedMessages });
  currentDetailData = { ...currentDetailData, messages: updatedMessages };
  openDetail(currentDetailCardId, currentDetailData);
}

function renderMessageRow(msg, msgIndex, commentKey, comments) {
  const row = document.createElement("div");
  row.className = "message-row";
  row.dataset.commentKey = commentKey;

  const addCommentBtn = document.createElement("button");
  addCommentBtn.type = "button";
  addCommentBtn.className = "tweet-comment-add-btn";
  addCommentBtn.innerHTML = MESSAGE_CIRCLE_PLUS_ICON_SVG;
  addCommentBtn.setAttribute("aria-label", "코멘트 작성");
  // 항상 "새" 코멘트 작성 창을 엽니다 (기존 코멘트가 있어도 그대로 두고 하나 더 추가).
  addCommentBtn.addEventListener("click", () => openTweetCommentCompose(commentKey));
  row.appendChild(addCommentBtn);

  // 프사 좌측 하단 하트: 관리자만 누를 수 있고, 유저는 관리자가 찜해둔
  // 꽉 찬 하트만 봅니다(안 찜했으면 유저에게는 아무것도 안 보임).
  if (isAdmin) {
    const likeBtn = document.createElement("button");
    likeBtn.type = "button";
    likeBtn.className = "message-like-btn" + (msg.liked ? " liked" : "");
    likeBtn.innerHTML = HEART_ICON_SVG;
    likeBtn.setAttribute("aria-label", "좋아요");
    likeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMessageLike(msgIndex);
    });
    row.appendChild(likeBtn);
  } else if (msg.liked) {
    const likeIndicator = document.createElement("span");
    likeIndicator.className = "message-like-btn liked";
    likeIndicator.innerHTML = HEART_ICON_SVG;
    row.appendChild(likeIndicator);
  }

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
    // 이미지 원본 크기를 읽어야 배치를 계산할 수 있어서 비동기로 채웁니다.
    renderImageGridInto(grid, msg.images, msgIndex);
  }

  row.append(avatarCol, contentCol);

  // 코멘트는 여러 개 있을 수 있어서(유저 여러 개 + 관리자 여러 개), 작성 시각
  // (createdAt) 순으로 정렬해 위에서부터 아래로 쌓습니다 — 역할(user/admin)과
  // 무관하게 나중에 쓰인 코멘트일수록 아래에 오도록. createdAt이 없는(이전
  // 버전에서 저장된) 코멘트는 가장 오래된 것으로 취급합니다.
  const viewEntries = [];
  (comments && comments.user ? comments.user : []).forEach((entry) => viewEntries.push({ role: "user", entry }));
  (comments && comments.admin ? comments.admin : []).forEach((entry) => viewEntries.push({ role: "admin", entry }));
  viewEntries.sort((a, b) => (a.entry.createdAt || 0) - (b.entry.createdAt || 0));

  if (viewEntries.length > 0) {
    const viewStack = document.createElement("div");
    viewStack.className = "tweet-comment-view-stack";
    viewEntries.forEach(({ role, entry }) =>
      viewStack.appendChild(makeTweetCommentViewBtn(commentKey, role, entry))
    );
    row.appendChild(viewStack);

    // .tweet-comment-view-stack은 position:absolute라서, 트윗 내용(텍스트/이미지)이
    // 짧으면 버튼이 여러 개일 때 .message-row 아래로 넘쳐서 다음 트윗 위에 겹쳐
    // 그려지고(클릭도 다음 트윗 쪽이 가로채 버림), 그 결과 코멘트가 4개 이상일 때부터
    // 아래쪽 버튼을 못 누르는 문제가 있었습니다. 버튼 스택 높이만큼 min-height를
    // 줘서 트윗 한 칸이 절대 그보다 작아지지 않게 막습니다 (CSS 값과 맞춰야 함:
    // 버튼 30px, 버튼 사이 간격 4px, 스택 top 20px, 아래 여백 20px).
    const STACK_BTN = 30;
    const STACK_GAP = 4;
    const STACK_TOP = 20;
    const STACK_BOTTOM = 20;
    const stackHeight = viewEntries.length * STACK_BTN + (viewEntries.length - 1) * STACK_GAP;
    row.style.minHeight = STACK_TOP + stackHeight + STACK_BOTTOM + "px";
  }

  return row;
}

// 코멘트 종류(아이콘)별로 말풍선 모양 배경 위에 해당 아이콘을 겹쳐 그린 "보기" 버튼입니다.
function makeTweetCommentViewBtn(commentKey, role, commentEntry) {
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
  applyNotifViewBtnColor(bubble, "x", currentDetailCardId, commentKey, commentEntry.type, commentEntry.createdAt || 0);
  btn.addEventListener("click", () => {
    // 이미 이 코멘트를 보여주고 있는 패널이 열려 있으면, 뒤로가기 없이 바로 닫습니다.
    const state = tweetCommentPanelState;
    const alreadyOpen =
      !tweetCommentPanel.hidden &&
      state &&
      state.commentKey === commentKey &&
      state.role === role &&
      state.entryId === commentEntry.id;
    if (alreadyOpen) {
      closeTweetCommentPanel();
    } else {
      openTweetCommentView(commentKey, role, commentEntry.id);
      setActiveTweetCommentViewBtn(btn);
      acknowledgeNotifTarget(bubble, "x", currentDetailCardId, commentKey, commentEntry.type);
    }
  });
  return btn;
}

// 코멘트 창을 연 "보기" 버튼 하나를 강조 표시(is-open)합니다. 창이 열려있는
// 동안엔 해당 버튼만 테마 색으로 바뀌고, 창을 닫거나 다른 코멘트로 옮겨가면
// 이전 버튼의 강조는 지워집니다.
let activeTweetCommentViewBtn = null;
function setActiveTweetCommentViewBtn(btn) {
  if (activeTweetCommentViewBtn) activeTweetCommentViewBtn.classList.remove("is-open");
  activeTweetCommentViewBtn = btn || null;
  if (activeTweetCommentViewBtn) activeTweetCommentViewBtn.classList.add("is-open");
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
function makeImageLink(image, msgIndex) {
  const link = document.createElement("button");
  link.type = "button";
  link.className = "image-link";
  link.addEventListener("click", () => openImageViewer(image.url));
  const img = document.createElement("img");
  img.src = image.url;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.style.borderRadius = "10px";
  img.style.display = "block";
  link.appendChild(img);

  if (image.comment) {
    const commentKey = msgIndex + "|" + image.url;
    const commentBtn = document.createElement("button");
    commentBtn.type = "button";
    commentBtn.className = "image-comment-btn";
    commentBtn.innerHTML = MESSAGE_SQUARE_ICON_SVG;
    commentBtn.setAttribute("aria-label", "이미지 코멘트 보기");
    commentBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 코멘트 보기 버튼처럼, 이미 이 이미지의 코멘트 창이 열려 있으면
      // 다시 눌렀을 때 바로 닫히게 합니다.
      const alreadyOpen = !commentModal.hidden && commentModalState && commentModalState.key === commentKey;
      if (alreadyOpen) {
        closeCommentModal();
      } else {
        openCommentModal(image.comment, {
          key: commentKey,
          canEdit: isAdmin,
          onSave: isAdmin ? (newText) => saveImageComment(msgIndex, image.url, newText) : null,
        });
      }
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
async function renderImageGridInto(container, images, msgIndex) {
  const normalized = normalizeImages(images);
  if (normalized.length === 0) return;

  const dims = await Promise.all(normalized.map((im) => getImageDimensions(im.url)));
  const containerWidth = container.clientWidth || container.getBoundingClientRect().width || 300;
  const GAP = 5;

  if (normalized.length === 1) {
    const ratio = dims[0].w / dims[0].h;
    const { link, img } = makeImageLink(normalized[0], msgIndex);
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
      const { link, img } = makeImageLink(image, msgIndex);
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

    const { link: leftLink, img: leftImg } = makeImageLink(normalized[0], msgIndex);
    leftLink.style.gridColumn = "1 / 2";
    leftLink.style.gridRow = "1 / 3";
    styleGridCellImg(leftImg);
    container.appendChild(leftLink);

    [1, 2].forEach((i) => {
      const { link, img } = makeImageLink(normalized[i], msgIndex);
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
    const { link, img } = makeImageLink(image, msgIndex);
    styleGridCellImg(img);
    container.appendChild(link);
  });
  normalized.slice(4).forEach((image) => {
    const { link, img } = makeImageLink(image, msgIndex);
    link.style.gridColumn = "1 / 3";
    img.style.width = "100%";
    img.style.height = "auto";
    container.appendChild(link);
  });
}

// 버튼(닫기/삭제/이어서 추가/수정)으로 대화창을 나갈 때는 여기를 거칩니다.
// openDetail에서 쌓아둔 히스토리 항목을 함께 정리해서, 나중에 뒤로가기를 눌렀을 때
// 이미 닫힌 대화창 때문에 한 번 더 눌러야 하는 일이 없게 합니다.
function leaveDetailModal() {
  detailModal.hidden = true;
  // 대화창 옆/아래에 따로 떠 있는 코멘트 관련 패널들도 같이 닫습니다. 특히
  // #comment-modal(이미지 코멘트)은 대화창 바깥의 형제 엘리먼트라 대화창을
  // 닫아도 저절로 사라지지 않고, #tweet-comment-panel(트윗 코멘트)은 대화창
  // 안쪽에 있어 화면에선 같이 사라지지만 hidden 상태가 남아있어서 다음에
  // 대화창을 다시 열면 그대로 열린 채로 다시 나타나는 문제가 있었습니다.
  closeCommentModal();
  closeTweetCommentPanel();
  if (detailHistoryPushed) {
    detailHistoryPushed = false;
    history.back();
  }
}

function closeDetail() {
  leaveDetailModal();
  currentDetailCardId = null;
  renderCardGrid();
}

// 휴대폰의 뒤로가기(브라우저 popstate)를 누르면, 대화창이 열려 있는 동안엔
// 사이트를 나가는 대신 대화창만 닫습니다. 대화창이 닫혀 있는(홈 화면) 상태에서
// 뒤로가기를 누르면 여기서 할 일이 없어서 브라우저 기본 동작(사이트 나가기)이
// 그대로 진행됩니다.
window.addEventListener("popstate", () => {
  if (detailModal.hidden) return;
  // 코멘트를 쓰거나 고치는 중에 폰 뒤로가기를 누르면, 확인 없이 바로
  // 나가는 대신 먼저 물어봅니다. 취소하면 방금 소비된 히스토리 항목을
  // 다시 쌓아서(pushState) 뒤로가기가 없었던 것처럼 되돌립니다.
  if (isEditingTweetComment() && !confirm("정말 뒤로 가시겠어요? 작성 중인 코멘트는 되돌릴 수 없습니다.")) {
    history.pushState({ memoriesDetailOpen: true }, "");
    return;
  }
  detailHistoryPushed = false;
  detailModal.hidden = true;
  closeCommentModal();
  closeTweetCommentPanel();
  currentDetailCardId = null;
  renderCardGrid();
});

detailCloseBtn.addEventListener("click", closeDetail);

// 모달 바깥(어두운 배경) 클릭 시 닫기. 패널 안쪽 클릭은 여기까지 이벤트가
// 버블링되어 오지만, target이 오버레이 자신일 때만 닫아서 안쪽 클릭은 무시합니다.
detailModal.addEventListener("click", (e) => {
  if (e.target !== detailModal) return;
  // 데스크탑에서는 코멘트 패널(.tweet-comment-panel)이 카드 크기만큼만
  // 차지하고 그 바깥은 대화창 자신의 배경(detailModal)이라, "바깥 클릭"이
  // 여기로 잡힙니다. 편집 중이면 다른 이탈 경로와 똑같이 먼저 확인합니다.
  if (isEditingTweetComment() && !confirm("정말 뒤로 가시겠어요? 작성 중인 코멘트는 되돌릴 수 없습니다.")) {
    return;
  }
  closeDetail();
});

// ---------- 이미지 코멘트 보기/수정 (대화 상세 화면 안, 트윗 이미지용) ----------
// 코멘트 패널과 같은 레이아웃(데스크탑: 대화창 옆, 모바일: 바텀시트)을 씁니다.
const commentModal = document.getElementById("comment-modal");
const commentModalBody = document.getElementById("comment-modal-body");
const commentModalCloseBtn = document.getElementById("comment-modal-close-btn");
const commentModalActionBtn = document.getElementById("comment-modal-action-btn");

// options.canEdit가 true면(관리자 + 저장 가능한 컨텍스트일 때) "수정" 버튼이 보이고,
// 누르면 편집 모드로 전환됩니다. 저장은 options.onSave(newText)가 처리합니다.
let commentModalState = null;

function openCommentModal(comment, options = {}) {
  // 트윗 코멘트 작성/보기 창과 겹쳐서 뜨지 않도록, 열려 있으면 먼저 닫습니다.
  closeTweetCommentPanel();
  commentModalState = { text: comment || "", canEdit: !!options.canEdit, onSave: options.onSave || null, mode: "view", key: options.key || null };
  renderCommentModalBody();
  commentModal.hidden = false;
}

function renderCommentModalBody() {
  const state = commentModalState;
  commentModalBody.innerHTML = "";

  if (state.mode === "view") {
    const p = document.createElement("p");
    p.className = "comment-modal-text";
    p.textContent = state.text;
    commentModalBody.appendChild(p);
    commentModalActionBtn.hidden = !state.canEdit;
    commentModalActionBtn.textContent = "수정";
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.id = "comment-modal-textarea";
  textarea.className = "tweet-comment-editor-textarea";
  textarea.rows = 5;
  textarea.value = state.text;
  commentModalBody.appendChild(textarea);
  commentModalActionBtn.hidden = false;
  commentModalActionBtn.textContent = "저장";
}

function closeCommentModal() {
  commentModal.hidden = true;
  commentModalState = null;
}

commentModalCloseBtn.addEventListener("click", closeCommentModal);
commentModal.addEventListener("click", (e) => {
  if (e.target === commentModal) closeCommentModal();
});

commentModalActionBtn.addEventListener("click", async () => {
  const state = commentModalState;
  if (!state) return;
  if (state.mode === "view") {
    state.mode = "edit";
    renderCommentModalBody();
    return;
  }
  const textarea = document.getElementById("comment-modal-textarea");
  const newText = textarea.value.trim();
  if (state.onSave) {
    try {
      await state.onSave(newText);
    } catch (e) {
      alert("이미지 코멘트 저장에 실패했습니다: " + e.message);
    }
  }
});

// ---------- 이미지 코멘트 보기 (홈 화면 카드 썸네일용) ----------
// 옆에 뜰 대화창이 없는 상황이라, 원래 방식(배경을 어둡게 덮고 가운데 뜨는 모달)을 씁니다.
const thumbCommentModal = document.getElementById("thumb-comment-modal");
const thumbCommentModalText = document.getElementById("thumb-comment-modal-text");
const thumbCommentModalCloseBtn = document.getElementById("thumb-comment-modal-close-btn");

let thumbCommentModalKey = null;

function openThumbCommentModal(comment, key) {
  thumbCommentModalText.textContent = comment;
  thumbCommentModalKey = key || null;
  thumbCommentModal.hidden = false;
}

function closeThumbCommentModal() {
  thumbCommentModal.hidden = true;
  thumbCommentModalKey = null;
}

thumbCommentModalCloseBtn.addEventListener("click", closeThumbCommentModal);
thumbCommentModal.addEventListener("click", (e) => {
  if (e.target === thumbCommentModal) closeThumbCommentModal();
});

// ---------- 이미지 원본 크게 보기 (대화 이미지 / 코멘트 이미지 공통) ----------
// 예전엔 이미지를 누르면 새 탭이 열려서 원본 그대로였는데, 화면이 큰 원본을
// 그대로 띄우다 보니 오히려 화질이 낮아 보인다는 문제가 있었습니다. 이제는
// 새 탭 대신 앱 안에서 화면 정중앙에 원래 비율 그대로(뷰포트의 90%까지만
// 줄여서) 보여줍니다.
const imageViewerModal = document.getElementById("image-viewer-modal");
const imageViewerImg = document.getElementById("image-viewer-img");
const imageViewerCloseBtn = document.getElementById("image-viewer-close-btn");

// X(트위터) 이미지 CDN(pbs.twimg.com)은 타임라인에 보여줄 때 보통 축소된
// 미리보기 크기(name=small 등)로 주소를 내려주는데, 북마클릿이 그 <img src>를
// 그대로 캡처하다 보니 저장되는 주소 자체가 이미 축소본입니다(앱이 따로
// 이미지를 리사이즈/압축하는 게 아닙니다). 같은 주소의 name 파라미터를
// orig로 바꾸면 트위터 CDN에서 원본 해상도를 그대로 받아올 수 있어서, 원본
// 크기로 보여줘야 할 때(이미지 뷰어, 코멘트 패널의 큰 이미지)는 이 함수를
// 거쳐서 주소를 바꿔줍니다. 트위터 CDN 주소가 아니면 그대로 둡니다. 이미
// 저장되어 있는 예전 카드들도 그대로 적용되고(저장된 주소 자체를 바꾸는 게
// 아니라 보여줄 때만 바꾸는 방식), 목록의 작은 썸네일은 로딩 속도를 위해
// 그대로 둡니다.
function toOriginalQualityImageUrl(url) {
  try {
    const u = new URL(url, location.href);
    if (u.hostname === "pbs.twimg.com" && u.pathname.startsWith("/media/")) {
      u.searchParams.set("name", "orig");
      return u.toString();
    }
  } catch (e) {}
  return url;
}

function openImageViewer(url) {
  imageViewerImg.src = toOriginalQualityImageUrl(url);
  imageViewerModal.hidden = false;
}

function closeImageViewer() {
  imageViewerModal.hidden = true;
  imageViewerImg.src = "";
}

imageViewerCloseBtn.addEventListener("click", closeImageViewer);
imageViewerModal.addEventListener("click", (e) => {
  if (e.target === imageViewerModal) closeImageViewer();
});

// ---------- 코멘트-문구 강조(트윗/카카오 공용) ----------
// 코멘트를 작성/수정/보기할 때, 왼쪽 스레드에서 관련 있는 문구를 드래그로 여러 개
// 골라둘 수 있습니다(서로 다른 메시지에 걸쳐도 됩니다). 그 코멘트 창이 열려 있는
// 동안엔, 골라둔 문구가 있는 메시지에서 골라둔 부분은 그대로 두고 나머지만 아주
// 옅게 표시해서 "이 코멘트가 뭘 가리키는지" 한눈에 알아볼 수 있게 합니다. 위치
// (몇 번째 글자)가 아니라 "고른 문자열 자체"를 저장해두고, 표시할 때마다 원본
// 텍스트 안에서 다시 찾습니다 — 나중에 메시지 내용이 살짝 바뀌어도 덜 깨집니다.
function computeHighlightSegments(text, phrases) {
  const ranges = [];
  phrases.forEach((phrase) => {
    if (!phrase) return;
    const idx = text.indexOf(phrase);
    if (idx === -1) return; // 원문에서 못 찾으면(내용이 바뀌었거나) 그냥 무시합니다.
    ranges.push([idx, idx + phrase.length]);
  });
  if (ranges.length === 0) return null;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  ranges.forEach(([s, e]) => {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  });
  const segments = [];
  let cursor = 0;
  merged.forEach(([s, e]) => {
    if (s > cursor) segments.push({ text: text.slice(cursor, s), dim: true });
    segments.push({ text: text.slice(s, e), dim: false });
    cursor = e;
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), dim: true });
  return segments;
}

function renderTextWithHighlight(textEl, originalText, phrases) {
  const segments = phrases.length ? computeHighlightSegments(originalText, phrases) : null;
  if (!segments) {
    textEl.textContent = originalText;
    return;
  }
  textEl.innerHTML = "";
  segments.forEach((seg) => {
    if (seg.dim) {
      const span = document.createElement("span");
      span.className = "comment-highlight-dim";
      span.textContent = seg.text;
      textEl.appendChild(span);
    } else {
      textEl.appendChild(document.createTextNode(seg.text));
    }
  });
}

// threadEl 밑의 rowSelector 요소들을 훑어서, dataset.commentKey가 highlights의
// targetKey와 일치하는 메시지엔 부분 강조(고른 부분만 원래 색, 나머지는 흐리게)를
// 적용합니다. 그 코멘트와 무관한(=드래그로 안 고른) 메시지는 대화창에 보이는
// 전체를 흐리게 처리해서, 고른 부분이 한눈에 도드라져 보이게 합니다.
function applyThreadHighlights(threadEl, rowSelector, textSelector, originalTextByKey, highlights) {
  const byTarget = new Map();
  (highlights || []).forEach((h) => {
    if (!h || !h.targetKey || !h.text) return;
    if (!byTarget.has(h.targetKey)) byTarget.set(h.targetKey, []);
    byTarget.get(h.targetKey).push(h.text);
  });

  const rows = Array.from(threadEl.querySelectorAll(rowSelector));

  rows.forEach((row) => {
    const key = row.dataset.commentKey;
    const textEl = row.querySelector(textSelector);
    if (!textEl || key === undefined) return;
    const original = originalTextByKey.get(key);
    if (original === undefined) return;

    if (byTarget.size === 0) {
      textEl.textContent = original;
    } else if (byTarget.has(key)) {
      renderTextWithHighlight(textEl, original, byTarget.get(key));
    } else {
      textEl.innerHTML = "";
      const span = document.createElement("span");
      span.className = "comment-highlight-dim";
      span.textContent = original;
      textEl.appendChild(span);
    }
  });
}

// 스레드 안에서 드래그로 문구를 고르면 onCaptured(targetKey, text)를 불러줍니다.
// 코멘트 작성/수정 중일 때만 동작하도록 isEditingFn으로 켜고 끕니다(보기 중이거나
// 코멘트 창이 아예 안 열려 있으면 아무 일도 하지 않음). 드래그가 두 메시지에 걸쳐
// 있으면(예: 한 트윗 끝~다음 트윗 시작) 어느 쪽 것인지 애매하므로 무시합니다.
function captureThreadSelection(threadEl, rowSelector, isEditingFn, onCaptured) {
  threadEl.addEventListener("mouseup", () => {
    if (!isEditingFn()) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    const anchorEl = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode);
    const focusEl = sel.focusNode && (sel.focusNode.nodeType === 3 ? sel.focusNode.parentElement : sel.focusNode);
    const anchorRow = anchorEl && anchorEl.closest(rowSelector);
    const focusRow = focusEl && focusEl.closest(rowSelector);
    sel.removeAllRanges();
    if (!text || !anchorRow || anchorRow !== focusRow) return;
    const targetKey = anchorRow.dataset.commentKey;
    if (targetKey === undefined) return;
    onCaptured(targetKey, text);
  });
}

// 코멘트 작성/수정 패널 안에, 지금까지 고른 문구들을 칩(chip) 목록으로 보여줍니다.
// x를 누르면 목록에서 빼고 다시 그립니다(패널+스레드 강조 둘 다 rerender가 갱신).
function renderHighlightPicker(container, highlights, rerender) {
  const wrap = document.createElement("div");
  wrap.className = "comment-highlight-picker";
  const hint = document.createElement("p");
  hint.className = "comment-highlight-hint";
  hint.textContent = "왼쪽 대화에서 관련 문구를 드래그하면 이 코멘트에 연결됩니다 (여러 개 가능).";
  wrap.appendChild(hint);
  if (highlights.length > 0) {
    const chipRow = document.createElement("div");
    chipRow.className = "comment-highlight-chip-row";
    highlights.forEach((h, i) => {
      const chip = document.createElement("span");
      chip.className = "comment-highlight-chip";
      const label = document.createElement("span");
      label.className = "comment-highlight-chip-text";
      label.textContent = h.text;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "comment-highlight-chip-remove";
      removeBtn.textContent = "✕";
      removeBtn.setAttribute("aria-label", "선택한 문구 삭제");
      removeBtn.addEventListener("click", () => {
        highlights.splice(i, 1);
        rerender();
      });
      chip.append(label, removeBtn);
      chipRow.appendChild(chip);
    });
    wrap.appendChild(chipRow);
  }
  container.appendChild(wrap);
}

// ---------- 트윗 코멘트 보기/작성/수정 ----------
// 관리자가 아닌 사용자는 항상 "wine" 아이콘으로 저장되고, 관리자는 message-circle/coffee
// 중 하나를 골라 저장합니다. (본인 역할의 코멘트만 쓸 수 있게 firestore.rules에서 막아둡니다.)
// 한 트윗에 코멘트가 여러 개 쌓일 수 있어서, 역할(user/admin)별 배열로 저장합니다.
function findCommentEntry(commentKey, role, entryId) {
  const commentDoc = currentTweetComments.get(commentKey);
  if (!commentDoc || !role || !entryId) return null;
  const arr = commentDoc[role] || [];
  return arr.find((e) => e.id === entryId) || null;
}

// 코멘트 하나를 텍스트/이미지 블록 배열로 정규화합니다. 예전 형식(문자열 text만
// 있고 content가 없는 코멘트)도 텍스트 블록 하나짜리로 자연스럽게 변환됩니다.
function getCommentBlocks(entry) {
  if (entry && Array.isArray(entry.content)) return entry.content;
  return [{ type: "text", text: (entry && entry.text) || "" }];
}

// textarea 높이를 내용물 분량에 맞게 늘립니다(한 줄 고정 대신 자동으로
// 커지는 입력칸을 만들 때 공통으로 씁니다).
function autoResizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// 이미지 블록의 URL 목록을 꺼냅니다. urls(배열, 여러 장)가 없으면 예전
// 한 장짜리 형식(url 문자열 하나)도 자연스럽게 배열로 바꿔줍니다.
function getBlockImageUrls(block) {
  if (Array.isArray(block.urls)) return block.urls.filter(Boolean);
  return block.url ? [block.url] : [];
}

// 이미지 블록 하나를 보여주는 엘리먼트를 만듭니다. 이미지가 여러 장이면
// 화살표 두 개로 넘겨보는 캐러셀이 되고, 우측 하단에 "n / 전체" 배지가 뜹니다.
function createCommentBlockImageView(urls) {
  const wrap = document.createElement("div");
  wrap.className = "comment-block-image-wrap";

  const img = document.createElement("img");
  img.className = "tweet-comment-block-image";
  img.alt = "";
  img.addEventListener("click", () => openImageViewer(urls[current]));
  wrap.appendChild(img);

  let current = 0;
  const counter = document.createElement("span");
  counter.className = "comment-block-image-counter";

  function update() {
    img.src = toOriginalQualityImageUrl(urls[current]);
    counter.textContent = `${current + 1} / ${urls.length}`;
  }

  if (urls.length > 1) {
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "comment-block-carousel-arrow comment-block-carousel-prev";
    prevBtn.innerHTML = CHEVRON_LEFT_ICON_SVG;
    prevBtn.setAttribute("aria-label", "이전 이미지");
    prevBtn.addEventListener("click", () => {
      current = (current - 1 + urls.length) % urls.length;
      update();
    });

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "comment-block-carousel-arrow comment-block-carousel-next";
    nextBtn.innerHTML = CHEVRON_RIGHT_ICON_SVG;
    nextBtn.setAttribute("aria-label", "다음 이미지");
    nextBtn.addEventListener("click", () => {
      current = (current + 1) % urls.length;
      update();
    });

    wrap.append(prevBtn, nextBtn, counter);
  }

  update();
  return wrap;
}

function openTweetCommentView(commentKey, role, entryId) {
  // 이미지 설명 창과 겹쳐서 뜨지 않도록, 열려 있으면 먼저 닫습니다.
  closeCommentModal();
  const entry = findCommentEntry(commentKey, role, entryId);
  tweetCommentPanelState = { commentKey, role, entryId, mode: "view", highlights: (entry && entry.highlights) || [] };
  // hidden을 먼저 풀어야 합니다. renderTweetCommentPanel() 안에서 블록
  // textarea 높이를 scrollHeight로 재는데, 패널이 아직 hidden(=display:none)인
  // 상태면 레이아웃 자체가 없어서 scrollHeight가 0으로 나와 칸이 한 줄도
  // 안 되게 찌그러져 보였습니다(글자를 입력하는 순간 다시 계산되어 정상으로
  // 돌아왔던 것도 이 때문).
  tweetCommentPanel.hidden = false;
  renderTweetCommentPanel();
}

function openTweetCommentCompose(commentKey) {
  closeCommentModal();
  tweetCommentPanelState = {
    commentKey,
    role: null,
    entryId: null,
    mode: "compose",
    adminType: "message-circle",
    highlights: [],
  };
  tweetCommentPanel.hidden = false;
  renderTweetCommentPanel();
  // 코멘트 작성 창은 특정 "보기" 버튼과 무관하니, 다른 코멘트를 보다가 넘어온
  // 거라면 그 버튼의 강조 표시를 지웁니다.
  setActiveTweetCommentViewBtn(null);
}

function closeTweetCommentPanel() {
  tweetCommentPanel.hidden = true;
  tweetCommentPanelState = null;
  setActiveTweetCommentViewBtn(null);
  applyTweetThreadHighlights([]); // 코멘트 창을 닫으면 왼쪽 스레드 강조도 해제합니다.
}

captureThreadSelection(
  detailThread,
  ".message-row",
  () => !!tweetCommentPanelState && (tweetCommentPanelState.mode === "compose" || tweetCommentPanelState.mode === "edit"),
  (targetKey, text) => {
    tweetCommentPanelState.highlights.push({ targetKey, text });
    renderTweetCommentPanel();
  }
);

// 코멘트를 새로 쓰거나 고치는 중(저장 전)인지 확인합니다. 그냥 보기만 하는
// 중이면 잃을 내용이 없으니 확인 없이 바로 나가도 됩니다.
function isEditingTweetComment() {
  return (
    !tweetCommentPanel.hidden &&
    !!tweetCommentPanelState &&
    (tweetCommentPanelState.mode === "edit" || tweetCommentPanelState.mode === "compose")
  );
}

// 코멘트 작성/수정 창을 "나가려는" 시도(뒤로가기 버튼, 바깥 클릭, 폰 뒤로가기)를
// 여기서 공통으로 처리합니다. 편집 중이면 확인창을 띄우고, 취소하면 아무 일도
// 안 일어나게(false 반환) 해서 작성하던 내용이 실수로 사라지지 않게 합니다.
function tryLeaveTweetCommentPanel() {
  if (isEditingTweetComment() && !confirm("정말 뒤로 가시겠어요? 작성 중인 코멘트는 되돌릴 수 없습니다.")) {
    return false;
  }
  closeTweetCommentPanel();
  return true;
}

// 코멘트 블록(텍스트/이미지) 목록을 "보기" 모드로 그려서 container에 붙입니다.
// 트윗 코멘트/카톡 코멘트 둘 다 씁니다.
function renderCommentBlocksView(container, blocks) {
  blocks.forEach((block) => {
    if (block.type === "image") {
      const urls = getBlockImageUrls(block);
      if (!urls.length) return;
      container.appendChild(createCommentBlockImageView(urls));
    } else {
      if (!block.text) return;
      const p = document.createElement("p");
      p.className = "comment-modal-text";
      p.textContent = block.text;
      container.appendChild(p);
    }
  });
}

// 관리자용 코멘트 종류(message-circle/coffee) 선택 UI. state.adminType을 직접
// 바꾸고 rerender()를 호출해 다시 그리게 합니다(트윗/카톡 코멘트 편집 화면 공용).
function renderCommentTypeSelector(container, state, rerender) {
  const typeBox = document.createElement("div");
  typeBox.className = "tweet-comment-type-options";
  [
    ["message-circle", MESSAGE_CIRCLE_ICON_SVG],
    ["coffee", COFFEE_ICON_SVG],
  ].forEach(([type, svg]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tweet-comment-type-btn" + (type === state.adminType ? " selected" : "");
    btn.innerHTML = svg;
    btn.setAttribute("aria-label", type);
    btn.addEventListener("click", () => {
      state.adminType = type;
      rerender();
    });
    typeBox.appendChild(btn);
  });
  container.appendChild(typeBox);
}

// 코멘트 텍스트/이미지 블록 목록을 작성/수정 UI로 그려서 container에 붙입니다.
// blocks 배열을 직접 바꾸고, 바뀔 때마다 rerender()를 호출해 다시 그리게 합니다
// (트윗/카톡 코멘트 편집 화면 공용).
function renderCommentBlockEditor(container, blocks, rerender) {
  const toolbar = document.createElement("div");
  toolbar.className = "comment-block-toolbar";
  const addTextBtn = document.createElement("button");
  addTextBtn.type = "button";
  addTextBtn.className = "btn-secondary";
  addTextBtn.innerHTML = PLUS_ICON_SVG + " 텍스트";
  addTextBtn.addEventListener("click", () => {
    blocks.push({ type: "text", text: "" });
    rerender();
  });
  const addImageBtn = document.createElement("button");
  addImageBtn.type = "button";
  addImageBtn.className = "btn-secondary";
  addImageBtn.innerHTML = PLUS_ICON_SVG + " 이미지";
  addImageBtn.addEventListener("click", () => {
    blocks.push({ type: "image", urls: [] });
    rerender();
  });
  toolbar.append(addTextBtn, addImageBtn);
  container.appendChild(toolbar);

  const blockList = document.createElement("div");
  blockList.className = "comment-block-list";
  const pendingAutoResizeInputs = [];
  blocks.forEach((block, blockIndex) => {
    const row = document.createElement("div");
    row.className = "comment-block-row";

    // 손잡이(grip)를 드래그해서 블록 순서를 바꿉니다. draggable은 손잡이에만
    // 걸어서(입력칸을 드래그로 오해하지 않게) 시작하고, 드래그 중 보이는
    // 유령 이미지는 setDragImage로 손잡이가 아니라 블록 전체(row)가 되도록
    // 합니다. 작성창 위가 아니라 왼쪽 옆에 오도록, row를 가로 방향으로 두고
    // 손잡이와 내용(입력칸+삭제 버튼)을 나란히 놓습니다.
    row.dataset.blockIndex = blockIndex;

    const handle = document.createElement("span");
    handle.className = "comment-block-drag-handle";
    handle.innerHTML = GRIP_ICON_SVG;
    handle.draggable = true;
    handle.setAttribute("aria-label", "드래그해서 순서 바꾸기");
    handle.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(blockIndex));
      e.dataTransfer.setDragImage(row, 16, 16);
      row.classList.add("dragging");
    });
    handle.addEventListener("dragend", () => {
      row.classList.remove("dragging");
    });

    // 모바일 터치는 HTML5 드래그 앤 드롭 이벤트가 안 뜨기 때문에, 손잡이를
    // 손가락으로 누르고 움직이는 동안 그 아래에 있는 블록을 직접 찾아서
    // (elementFromPoint) 같은 방식으로 순서를 바꿉니다.
    let touchFromIndex = null;
    let touchOverRow = null;
    handle.addEventListener("touchstart", () => {
      touchFromIndex = blockIndex;
      touchOverRow = null;
      row.classList.add("dragging");
    }, { passive: true });
    handle.addEventListener("touchmove", (e) => {
      if (touchFromIndex === null) return;
      e.preventDefault(); // 손잡이를 움직이는 동안은 페이지 스크롤 대신 순서 바꾸기로 씁니다.
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetRow = target && target.closest(".comment-block-row");
      if (touchOverRow && touchOverRow !== targetRow) touchOverRow.classList.remove("drag-over");
      if (targetRow && targetRow !== row) {
        targetRow.classList.add("drag-over");
        touchOverRow = targetRow;
      } else {
        touchOverRow = null;
      }
    }, { passive: false });
    handle.addEventListener("touchend", () => {
      const fromIndex = touchFromIndex;
      const overRow = touchOverRow;
      touchFromIndex = null;
      touchOverRow = null;
      row.classList.remove("dragging");
      if (overRow) overRow.classList.remove("drag-over");
      if (fromIndex === null || !overRow) return;
      const toIndex = Number(overRow.dataset.blockIndex);
      if (Number.isNaN(toIndex) || toIndex === fromIndex) return;
      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      rerender();
    });

    row.appendChild(handle);

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over");
    });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      const fromIndex = Number(e.dataTransfer.getData("text/plain"));
      if (Number.isNaN(fromIndex) || fromIndex === blockIndex) return;
      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(blockIndex, 0, moved);
      rerender();
    });

    const content = document.createElement("div");
    content.className = "comment-block-content";

    if (block.type === "image") {
      // 한 줄짜리 input 대신 textarea를 써서, URL을 여러 개(쉼표 구분) 넣어
      // 줄바꿈이 되거나 길어지면 내용물 분량만큼 칸이 늘어나게 합니다.
      const urlInput = document.createElement("textarea");
      urlInput.className = "comment-block-image-input";
      urlInput.rows = 1;
      urlInput.placeholder = "이미지 URL (여러 장은 쉼표로 구분)";
      urlInput.value = (block.urls || []).join(", ");
      urlInput.addEventListener("input", () => {
        block.urls = urlInput.value.split(",").map((u) => u.trim()).filter(Boolean);
        autoResizeTextarea(urlInput);
      });
      content.appendChild(urlInput);
      // scrollHeight는 실제 화면에 붙어야 정확히 계산되니, blockList 전체가
      // 문서에 붙은 다음 한 번 맞춰줍니다(아래 container.appendChild 이후).
      pendingAutoResizeInputs.push(urlInput);
    } else {
      const textarea = document.createElement("textarea");
      textarea.className = "tweet-comment-editor-textarea";
      textarea.rows = 3;
      textarea.placeholder = "이 내용에 대한 코멘트를 입력하세요";
      textarea.value = block.text || "";
      textarea.addEventListener("input", () => {
        block.text = textarea.value;
        autoResizeTextarea(textarea);
      });
      content.appendChild(textarea);
      // 이미지 URL 칸과 마찬가지로, 문서에 실제로 붙은 다음 높이를 맞춥니다.
      pendingAutoResizeInputs.push(textarea);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "edit-row-remove";
    removeBtn.textContent = "이 블록 삭제";
    removeBtn.addEventListener("click", () => {
      blocks.splice(blockIndex, 1);
      rerender();
    });
    content.appendChild(removeBtn);

    row.appendChild(content);
    blockList.appendChild(row);
  });
  container.appendChild(blockList);
  // scrollHeight는 문서에 실제로 붙어 레이아웃이 계산된 뒤에야 정확하니,
  // 위에서 blockList를 붙인 다음 이미지 URL 입력칸들의 높이를 맞춥니다.
  pendingAutoResizeInputs.forEach(autoResizeTextarea);
}

function renderTweetCommentPanel() {
  const state = tweetCommentPanelState;
  applyTweetThreadHighlights(state.highlights || []);
  tweetCommentPanelBody.innerHTML = "";

  if (state.mode === "view") {
    const entry = findCommentEntry(state.commentKey, state.role, state.entryId);
    renderCommentBlocksView(tweetCommentPanelBody, getCommentBlocks(entry));

    const canEdit = !!entry && ((isAdmin && state.role === "admin") || (!isAdmin && state.role === "user"));
    tweetCommentPanelActionBtn.hidden = !canEdit;
    tweetCommentPanelActionBtn.textContent = "수정";
    tweetCommentPanelDeleteBtn.hidden = !canEdit;
    return;
  }

  // edit(기존 코멘트 수정) / compose(새 코멘트 작성)
  const entry = state.mode === "edit" ? findCommentEntry(state.commentKey, state.role, state.entryId) : null;
  if (!state.blocksInitialized) {
    // 블록 배열은 여기서 한 번만 초기화합니다. 관리자 타입 선택 등 다른 조작으로
    // 같은 편집 세션 안에서 다시 렌더링될 때 입력하던 내용이 지워지면 안 되니까요.
    // 이미지 블록은 예전 한 장짜리(url) 형식이어도 여러 장(urls 배열) 형식으로
    // 통일해서 들고 있습니다 — 편집 중엔 항상 urls 배열만 다루면 되도록.
    commentComposeBlocks = getCommentBlocks(entry).map((b) =>
      b.type === "image" ? { type: "image", urls: getBlockImageUrls(b) } : { ...b }
    );
    state.blocksInitialized = true;
  }

  renderHighlightPicker(tweetCommentPanelBody, state.highlights, renderTweetCommentPanel);

  if (isAdmin) {
    if (!state.adminType) state.adminType = (entry && entry.type) || "message-circle";
    renderCommentTypeSelector(tweetCommentPanelBody, state, renderTweetCommentPanel);
  }

  renderCommentBlockEditor(tweetCommentPanelBody, commentComposeBlocks, renderTweetCommentPanel);

  tweetCommentPanelActionBtn.hidden = false;
  tweetCommentPanelActionBtn.textContent = "저장";
  tweetCommentPanelDeleteBtn.hidden = true; // 수정/작성 중에는 삭제 버튼을 숨깁니다.
}

tweetCommentPanelBackBtn.addEventListener("click", tryLeaveTweetCommentPanel);
tweetCommentPanel.addEventListener("click", (e) => {
  if (e.target === tweetCommentPanel) tryLeaveTweetCommentPanel();
});

tweetCommentPanelActionBtn.addEventListener("click", async () => {
  const state = tweetCommentPanelState;
  if (!state || !currentDetailCardId) return;

  if (state.mode === "view") {
    state.mode = "edit";
    renderTweetCommentPanel();
    return;
  }

  // 빈 텍스트 블록/URL 없는 이미지 블록은 저장하지 않고 걸러냅니다.
  const content = commentComposeBlocks
    .map((b) =>
      b.type === "image"
        ? { type: "image", urls: (b.urls || []).map((u) => u.trim()).filter(Boolean) }
        : { type: "text", text: (b.text || "").trim() }
    )
    .filter((b) => (b.type === "image" ? b.urls.length > 0 : !!b.text));

  const role = state.mode === "edit" ? state.role : isAdmin ? "admin" : "user";
  const type = isAdmin ? state.adminType : "wine";

  const commentDoc = currentTweetComments.get(state.commentKey) || {};
  const arr = Array.isArray(commentDoc[role]) ? commentDoc[role].slice() : [];

  if (state.mode === "edit") {
    const idx = arr.findIndex((e) => e.id === state.entryId);
    if (idx !== -1) {
      if (content.length) {
        // 예전 형식의 text 필드가 남아있으면 Firestore가 undefined 값을 거부하니
        // 새 객체를 만들 때 아예 제외합니다(구조 분해로 빼고 나머지만 사용).
        const { text, ...rest } = arr[idx];
        arr[idx] = { ...rest, type, content, highlights: state.highlights || [] };
      } else {
        arr.splice(idx, 1); // 내용을 비우고 저장하면 코멘트를 삭제합니다.
      }
    }
  } else {
    if (!content.length) return; // 새 코멘트는 빈 채로 저장하지 않습니다.
    arr.push({ id: genCommentId(), type, content, createdAt: Date.now(), highlights: state.highlights || [] });
  }

  await persistCommentRoleArray(
    doc(db, "cards", currentDetailCardId, "tweetComments", state.commentKey),
    role,
    arr,
    "코멘트 저장에 실패했습니다: ",
    () => {
      // 방금 내가 쓴 코멘트가 알림/뱃지에 "새 코멘트"로 뜨지 않도록 바로 확인 처리합니다.
      markTargetSeen("x", currentDetailCardId, state.commentKey, type);
      closeTweetCommentPanel();
      // 우측 "보기" 버튼에 바로 반영되도록 상세 화면을 다시 불러옵니다.
      openDetail(currentDetailCardId, currentDetailData);
    }
  );
});

tweetCommentPanelDeleteBtn.addEventListener("click", async () => {
  const state = tweetCommentPanelState;
  if (!state || state.mode !== "view" || !currentDetailCardId) return;
  if (!confirm("이 코멘트를 삭제할까요? 되돌릴 수 없어요.")) return;

  const commentDoc = currentTweetComments.get(state.commentKey) || {};
  const arr = (Array.isArray(commentDoc[state.role]) ? commentDoc[state.role] : []).filter(
    (e) => e.id !== state.entryId
  );

  await persistCommentRoleArray(
    doc(db, "cards", currentDetailCardId, "tweetComments", state.commentKey),
    state.role,
    arr,
    "코멘트 삭제에 실패했습니다: ",
    () => {
      closeTweetCommentPanel();
      openDetail(currentDetailCardId, currentDetailData);
    }
  );
});

// 코멘트 배열을 저장하고, 성공하면 onSaved()를 불러 화면에 반영합니다. 트윗
// 코멘트(cards/.../tweetComments)와 카카오 코멘트(kakaoCards/.../kakaoComments)가
// 저장 위치만 다르고 나머지 로직은 완전히 같아서 문서 참조를 받아 공용으로 씁니다.
async function persistCommentRoleArray(commentDocRef, role, arr, errorPrefix, onSaved) {
  try {
    await setDoc(commentDocRef, { [role]: arr, updatedAt: serverTimestamp() }, { merge: true });
    onSaved();
  } catch (e) {
    alert(errorPrefix + e.message);
  }
}

detailDeleteBtn.addEventListener("click", async () => {
  if (!currentDetailCardId) return;
  if (!confirm("이 대화 백업을 삭제할까요? 되돌릴 수 없어요.")) return;
  await deleteDoc(doc(db, "cards", currentDetailCardId));
  leaveDetailModal();
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
  leaveDetailModal();
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
  leaveDetailModal();
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
  editRowAvatarEls = [];
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
  editRowAvatarEls[index] = { avatarInput, preview };
  avatarInput.addEventListener("input", () => {
    editingMessages[index].avatar = avatarInput.value;
    preview.src = safeImgSrc(avatarInput.value) || fallbackAvatarDataUri();

    // 같은 닉네임을 쓰는 아래쪽 메시지들의 프로필 사진도 같이 바꿔줍니다
    // (예: 도중에 프로필 사진이 바뀐 사람의 예전 사진들을 한 번에 맞출 때).
    // renderEditableRows() 전체를 다시 그리면 지금 입력 중인 칸이 포커스를
    // 잃어버리니, 해당 행의 입력값/미리보기만 직접 갱신합니다.
    const nickname = editingMessages[index].nickname;
    for (let i = index + 1; i < editingMessages.length; i++) {
      if (editingMessages[i].nickname !== nickname) continue;
      editingMessages[i].avatar = avatarInput.value;
      const els = editRowAvatarEls[i];
      if (els) {
        els.avatarInput.value = avatarInput.value;
        els.preview.src = safeImgSrc(avatarInput.value) || fallbackAvatarDataUri();
      }
    }
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

// ===================================================================
// ---------- 카카오톡 백업 ----------
// X 백업(cards)과 완전히 분리된 kakaoCards 컬렉션을 씁니다. 카카오톡 앱
// 자체의 "채팅방 설정 > 대화 내용 내보내기"로 만든 텍스트를 붙여넣어
// 파싱합니다(사진은 실제 이미지가 아니라 "사진"이라는 텍스트로만 남아요).
// ===================================================================

const kakaoNewCardBtn = document.getElementById("kakao-new-card-btn");
const kakaoCardGrid = document.getElementById("kakao-card-grid");
const kakaoEmptyState = document.getElementById("kakao-empty-state");

const kakaoNewCardModal = document.getElementById("kakao-new-card-modal");
const kakaoNewCardCloseBtn = document.getElementById("kakao-new-card-close-btn");
const kakaoNewCardSaveBtn = document.getElementById("kakao-new-card-save-btn");
const kakaoImportTextarea = document.getElementById("kakao-import-textarea");
const kakaoImportParseBtn = document.getElementById("kakao-import-parse-btn");
const kakaoImportError = document.getElementById("kakao-import-error");
const kakaoFileInput = document.getElementById("kakao-file-input");
const kakaoPreviewSection = document.getElementById("kakao-preview-section");
const kakaoSenderOptions = document.getElementById("kakao-sender-options");
const kakaoPreviewThread = document.getElementById("kakao-preview-thread");

const kakaoDetailModal = document.getElementById("kakao-detail-modal");
const kakaoDetailCloseBtn = document.getElementById("kakao-detail-close-btn");
const kakaoDetailEditBtn = document.getElementById("kakao-detail-edit-btn");
const kakaoDetailDeleteBtn = document.getElementById("kakao-detail-delete-btn");
const kakaoDetailThread = document.getElementById("kakao-detail-thread");

const kakaoEditModal = document.getElementById("kakao-edit-modal");
const kakaoEditCloseBtn = document.getElementById("kakao-edit-close-btn");
const kakaoEditSaveBtn = document.getElementById("kakao-edit-save-btn");
const kakaoEditRows = document.getElementById("kakao-edit-rows");

const sumoneNewCardBtn = document.getElementById("sumone-new-card-btn");
const sumoneCardGrid = document.getElementById("sumone-card-grid");
const sumoneEmptyState = document.getElementById("sumone-empty-state");

const sumoneFormModal = document.getElementById("sumone-form-modal");
const sumoneFormCloseBtn = document.getElementById("sumone-form-close-btn");
const sumoneFormSaveBtn = document.getElementById("sumone-form-save-btn");
const sumoneTitleInput = document.getElementById("sumone-title-input");
const sumoneDateInput = document.getElementById("sumone-date-input");
const sumoneImageInput = document.getElementById("sumone-image-input");
const sumoneContentInput = document.getElementById("sumone-content-input");

const sumoneDetailModal = document.getElementById("sumone-detail-modal");
const sumoneDetailCloseBtn = document.getElementById("sumone-detail-close-btn");
const sumoneDetailEditBtn = document.getElementById("sumone-detail-edit-btn");
const sumoneDetailDeleteBtn = document.getElementById("sumone-detail-delete-btn");
const sumoneDetailImage = document.getElementById("sumone-detail-image");
const sumoneDetailContent = document.getElementById("sumone-detail-content");
const sumoneCommentArea = document.getElementById("sumone-comment-area");

let currentSection = "x"; // "x" | "kakao" | "sumone"
let kakaoCardsLoaded = false;
let loadedKakaoCards = []; // [{id, data}]
let kakaoParsedRoomName = "";
let kakaoParsedMessages = []; // [{sender, dateDisplay, dateSort, timeDisplay, timeSort, text}]
let kakaoSelectedMeSender = "";
let currentKakaoDetailId = null;
let currentKakaoDetailData = null; // openKakaoDetail에서 채워둠(코멘트 저장 시 필요)
let currentKakaoComments = new Map(); // "메시지 인덱스(문자열)" -> { user?: [...], admin?: [...] } (상세보기 열 때마다 다시 불러옴)

let sumoneCardsLoaded = false;
let loadedSumoneCards = []; // [{id, data}]
let sumoneEditTargetId = null; // null = 새로 만드는 중, 아니면 그 id의 카드를 수정하는 중
let currentSumoneDetailId = null;
let currentSumoneDetailData = null;
let currentSumoneComments = { user: [], admin: [] }; // 카드 하나당 코멘트 대상이 하나뿐이라 Map이 필요 없음

function switchSection(section) {
  currentSection = section;
  appView.hidden = section !== "x";
  kakaoAppView.hidden = section !== "kakao";
  sumoneAppView.hidden = section !== "sumone";
  sidebarXBtn.classList.toggle("selected", section === "x");
  sidebarKakaoBtn.classList.toggle("selected", section === "kakao");
  sidebarSumoneBtn.classList.toggle("selected", section === "sumone");
  if (section === "kakao" && !kakaoCardsLoaded) {
    kakaoCardsLoaded = true;
    loadKakaoCards();
  }
  if (section === "sumone" && !sumoneCardsLoaded) {
    sumoneCardsLoaded = true;
    loadSumoneCards();
  }
}
sidebarXBtn.addEventListener("click", () => {
  switchSection("x");
  closeSidebar();
});
sidebarKakaoBtn.addEventListener("click", () => {
  switchSection("kakao");
  closeSidebar();
});
sidebarSumoneBtn.addEventListener("click", () => {
  switchSection("sumone");
  closeSidebar();
});
sidebarCloseBtn.addEventListener("click", closeSidebar);

// ---------- 사이드바 열기/닫기 ----------
// 평소엔 숨겨져 있다가 헤더의 메뉴(☰) 버튼을 누르면 열립니다. 다시 그
// 버튼을 누르거나, 사이드바 바깥 아무 곳이나 클릭하면 닫힙니다.
function openSidebar() {
  appSidebar.classList.add("open");
}
function closeSidebar() {
  appSidebar.classList.remove("open");
}
sidebarMenuBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    appSidebar.classList.toggle("open");
  });
});
// 캡처 단계(capture: true)에서 가로채서 stopPropagation을 걸어야, 그 클릭이
// 카드 같은 아래쪽 요소까지 도달하기 전에 막을 수 있습니다(버블 단계에서
// 막으면 이미 늦어서 카드가 열리는 것까지 같이 일어났었습니다). 사이드바
// 안쪽 클릭은 그대로 통과시킵니다.
document.addEventListener(
  "click",
  (e) => {
    if (!appSidebar.classList.contains("open")) return;
    if (appSidebar.contains(e.target)) return;
    e.stopPropagation();
    closeSidebar();
  },
  true
);

// ---------- 앱 설명 (사이드바 하단 물음표 아이콘) ----------
// 로그인한 사람은 누구나 볼 수 있고, 관리자만 고칠 수 있습니다. 문서
// 하나(appInfo/main)만 씁니다.
const appInfoModal = document.getElementById("app-info-modal");
const appInfoCloseBtn = document.getElementById("app-info-close-btn");
const appInfoEditBtn = document.getElementById("app-info-edit-btn");
const appInfoSaveBtn = document.getElementById("app-info-save-btn");
const appInfoText = document.getElementById("app-info-text");
const appInfoToolbar = document.getElementById("app-info-toolbar");
const appInfoEditor = document.getElementById("app-info-editor");

// 관리자가 쓴 내용만 여기 들어올 수 있어서(firestore.rules로 강제) innerHTML로
// 그대로 그려도 안전합니다 — 굵게/기울임/취소선/글씨색 서식이 HTML 그대로
// 저장되기 때문입니다.
let appInfoLoadedContent = "";

async function openAppInfo() {
  appInfoModal.hidden = false;
  appInfoEditBtn.hidden = !isAdmin;
  appInfoSaveBtn.hidden = true;
  appInfoToolbar.hidden = true;
  appInfoEditor.hidden = true;
  appInfoText.hidden = false;
  appInfoText.textContent = "불러오는 중...";
  try {
    const snap = await getDoc(doc(db, "appInfo", "main"));
    appInfoLoadedContent = snap.exists() ? snap.data().content || "" : "";
    appInfoText.innerHTML = appInfoLoadedContent;
  } catch (e) {
    appInfoText.textContent = "설명을 불러오지 못했습니다.";
    console.error("앱 설명을 불러오지 못했습니다.", e);
  }
}
function closeAppInfo() {
  appInfoModal.hidden = true;
}
// 수정 중(편집칸이 보이는 상태)에 저장하지 않은 내용이 있는 채로 뒤로가기
// 버튼이나 바깥 공간을 눌러서 닫으려 하면 확인창을 띄워서 실수로 잃어버리지
// 않게 합니다. 아무것도 안 고쳤으면(불러온 내용과 그대로 같으면) 그냥 닫습니다.
function hasUnsavedAppInfoChanges() {
  return !appInfoEditor.hidden && appInfoEditor.innerHTML.trim() !== appInfoLoadedContent;
}
function tryCloseAppInfo() {
  if (hasUnsavedAppInfoChanges() && !confirm("저장하지 않은 내용이 있습니다. 닫으시겠습니까?")) return;
  closeAppInfo();
}
sidebarHelpBtn.addEventListener("click", () => {
  openAppInfo();
  closeSidebar();
});
appInfoCloseBtn.addEventListener("click", tryCloseAppInfo);
appInfoModal.addEventListener("click", (e) => {
  if (e.target === appInfoModal) tryCloseAppInfo();
});

appInfoEditBtn.addEventListener("click", () => {
  appInfoEditor.innerHTML = appInfoLoadedContent;
  appInfoText.hidden = true;
  appInfoToolbar.hidden = false;
  appInfoEditor.hidden = false;
  appInfoEditBtn.hidden = true;
  appInfoSaveBtn.hidden = false;
});

// 굵게/기울임/취소선/색: 선택한 부분에 execCommand로 바로 적용합니다.
// 버튼(<button>)을 누르면 브라우저가 mouseup 시점에 포커스를 그 버튼으로
// 옮기는데(mousedown이 아니라 mouseup에서 일어남), 그 순간 편집칸이
// 포커스를 잃으면서 execCommand가 안 먹히는 문제가 있었습니다. mousedown
// 시점(아직 포커스가 편집칸에 있을 때)에 선택 범위를 미리 복사해두고,
// mousedown/mouseup 모두 기본 동작(포커스 이동)을 막은 뒤, click 시점에
// 편집칸에 다시 포커스를 주고 그 범위를 복원하고 나서 명령을 실행합니다.
let savedAppInfoRange = null;
function captureAppInfoSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0 && appInfoEditor.contains(sel.anchorNode)) {
    savedAppInfoRange = sel.getRangeAt(0).cloneRange();
  }
}
function preventAppInfoFocusSteal(e) {
  e.preventDefault();
}
function restoreAppInfoSelection() {
  appInfoEditor.focus();
  if (savedAppInfoRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedAppInfoRange);
  }
}
document.querySelectorAll(".app-info-format-btn, .app-info-color-btn").forEach((btn) => {
  btn.addEventListener("mousedown", (e) => {
    captureAppInfoSelection();
    preventAppInfoFocusSteal(e);
  });
  btn.addEventListener("mouseup", preventAppInfoFocusSteal);
});
document.querySelectorAll(".app-info-format-btn").forEach((btn) => {
  if (!btn.dataset.cmd) return;
  btn.addEventListener("click", () => {
    restoreAppInfoSelection();
    document.execCommand(btn.dataset.cmd, false, null);
  });
});
// 글씨 색: 회색(--muted)과 테마 색 2종(--accent 파란색, --danger 빨간색)만
// 고를 수 있습니다. 지금 테마에서 실제 적용되는 색상 값을 읽어서 적용합니다.
// 이미 그 색이 적용된 상태에서 같은 버튼을 한 번 더 누르면 기본 글씨색(--text)으로
// 되돌립니다(토글). 색 값 형식이 서로 달라도(#hex vs rgb(...)) 비교할 수 있게
// 임시 엘리먼트에 색을 입혀서 항상 브라우저가 계산한 rgb(...) 형태로 바꿔 비교합니다.
function toRgbColorString(colorValue) {
  const el = document.createElement("span");
  el.style.color = colorValue;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);
  return rgb;
}
document.querySelectorAll(".app-info-color-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    restoreAppInfoSelection();
    const color = getComputedStyle(document.documentElement).getPropertyValue(btn.dataset.colorVar).trim();
    const currentColor = document.queryCommandValue("foreColor");
    const isSameColor = currentColor && toRgbColorString(currentColor) === toRgbColorString(color);
    if (isSameColor) {
      const defaultColor = getComputedStyle(document.documentElement).getPropertyValue("--text").trim();
      document.execCommand("foreColor", false, defaultColor);
    } else {
      document.execCommand("foreColor", false, color);
    }
  });
});

// 토글(접기/펼치기) 블록 삽입. 제목 줄(라벨)과 내용칸 모두 편집칸 안이라
// 그대로 타이핑해서 고칠 수 있고, 저장되는 HTML에 열림/닫힘 상태(data-open)가
// 그대로 남아서 다음에 볼 때도 마지막으로 남겨둔 모양 그대로 보입니다.
function buildAppInfoToggleHtml() {
  return (
    `<div class="app-info-toggle" data-open="true">` +
    `<div class="app-info-toggle-head"><button type="button" class="app-info-toggle-btn" contenteditable="false" aria-label="펼치기/접기">${CHEVRON_DOWN_ICON_SVG}</button>` +
    `<span class="app-info-toggle-label">토글 항목</span></div>` +
    `<div class="app-info-toggle-body">내용을 입력하세요.</div></div>`
  );
}
// execCommand("insertHTML")는 중첩된 div/버튼처럼 서식 태그가 아닌 구조를
// 넣으면 브라우저가 자기 나름대로 "정리"하면서 구조를 흐트러뜨리는 경우가
// 있어서(Chrome에서 확인됨), 토글 블록/아이콘처럼 직접 만든 노드는 모두
// Range API로 직접 넣습니다. 커서가 편집칸 밖에 있거나 아직 없으면(예:
// 편집칸을 열자마자 바로 버튼을 누른 경우) 편집칸 맨 끝에 넣습니다.
function insertNodeAtAppInfoCursor(node) {
  appInfoEditor.focus();
  const sel = window.getSelection();
  if (savedAppInfoRange && appInfoEditor.contains(savedAppInfoRange.startContainer)) {
    sel.removeAllRanges();
    sel.addRange(savedAppInfoRange);
  }
  if (sel.rangeCount === 0 || !appInfoEditor.contains(sel.getRangeAt(0).startContainer)) {
    const fallback = document.createRange();
    fallback.selectNodeContents(appInfoEditor);
    fallback.collapse(false);
    sel.removeAllRanges();
    sel.addRange(fallback);
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
document.querySelector(".app-info-toggle-insert-btn").addEventListener("click", () => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildAppInfoToggleHtml();
  insertNodeAtAppInfoCursor(wrapper.firstElementChild);
});

// 이미지 삽입: URL만 입력받아 <img>로 넣습니다. 토글 블록 안에서 커서를 두고
// 눌러도 그 자리에 들어갑니다.
document.querySelector(".app-info-image-insert-btn").addEventListener("click", () => {
  const url = window.prompt("이미지 URL을 입력하세요.");
  if (!url) return;
  restoreAppInfoSelection();
  document.execCommand("insertImage", false, url);
});

// 아이콘 삽입: 글 중간에 lucide류 아이콘을 넣고 바로 옆에 설명을 적을 수
// 있게 합니다. 버튼을 누르면 아이콘 목록 팝업이 뜨고, 하나를 고르면 그
// 자리에 들어갑니다.
const appInfoIconInsertBtn = document.querySelector(".app-info-icon-insert-btn");
const appInfoIconPicker = document.getElementById("app-info-icon-picker");
APP_INFO_ICON_CHOICES.forEach((choice, i) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "app-info-icon-picker-btn";
  btn.innerHTML = choice.svg;
  btn.setAttribute("aria-label", choice.label);
  btn.title = choice.label;
  // 이 버튼을 눌러도 편집칸의 커서 위치(선택 범위)가 안 풀리도록, 위의
  // 서식 버튼들과 같은 방식으로 mousedown 기본 동작을 막습니다.
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => {
    const wrapper = document.createElement("span");
    wrapper.innerHTML = `<span class="app-info-inline-icon" contenteditable="false">${choice.svg}</span>`;
    insertNodeAtAppInfoCursor(wrapper.firstElementChild);
    appInfoIconPicker.hidden = true;
  });
  appInfoIconPicker.appendChild(btn);
});
appInfoIconInsertBtn.addEventListener("click", () => {
  if (!appInfoIconPicker.hidden) {
    appInfoIconPicker.hidden = true;
    return;
  }
  appInfoIconPicker.style.left = appInfoIconInsertBtn.offsetLeft + "px";
  appInfoIconPicker.style.top = appInfoIconInsertBtn.offsetHeight + 6 + "px";
  appInfoIconPicker.hidden = false;
});
document.addEventListener("click", (e) => {
  if (appInfoIconPicker.hidden) return;
  if (appInfoIconPicker.contains(e.target) || appInfoIconInsertBtn.contains(e.target)) return;
  appInfoIconPicker.hidden = true;
});

// 토글 블록의 화살표 버튼을 누르면 열림/닫힘을 바꿉니다. 보기 화면(app-info-text)과
// 편집 화면(app-info-editor) 양쪽에서 다 동작해야 해서 이벤트 위임으로 둘 다 처리합니다.
function handleAppInfoToggleClick(e) {
  const btn = e.target.closest(".app-info-toggle-btn");
  if (!btn) return;
  const block = btn.closest(".app-info-toggle");
  if (!block) return;
  const wasOpen = block.dataset.open !== "false";
  block.dataset.open = wasOpen ? "false" : "true";
  btn.innerHTML = wasOpen ? CHEVRON_RIGHT_ICON_SVG : CHEVRON_DOWN_ICON_SVG;
}
appInfoText.addEventListener("click", handleAppInfoToggleClick);
appInfoEditor.addEventListener("click", handleAppInfoToggleClick);

appInfoSaveBtn.addEventListener("click", async () => {
  const content = appInfoEditor.innerHTML.trim();
  try {
    await setDoc(doc(db, "appInfo", "main"), { content, updatedAt: serverTimestamp() }, { merge: true });
    appInfoLoadedContent = content;
    appInfoText.innerHTML = content;
    appInfoText.hidden = false;
    appInfoToolbar.hidden = true;
    appInfoEditor.hidden = true;
    appInfoSaveBtn.hidden = true;
    appInfoEditBtn.hidden = !isAdmin;
  } catch (e) {
    alert("저장에 실패했습니다: " + e.message);
  }
});

// ---------- .eml(이메일) 파일에서 본문 텍스트 꺼내기 ----------
// 카카오톡 "대화 내용 내보내기"를 이메일로 보내면 .eml 파일이 됩니다. .eml은
// 헤더 + 본문으로 된 이메일 원문 형식(RFC 822/MIME)이라, 그 안에서 실제
// 대화 내용이 담긴 본문 텍스트만 뽑아냅니다. 첨부파일 라이브러리 없이
// 직접 파싱하다 보니 아주 특이한 메일 형식까지 완벽히 대응하진 못하지만,
// 일반적인 단순 텍스트 메일과 멀티파트(본문 여러 개로 나뉜) 메일 모두
// 처리합니다.
function decodeQuotedPrintable(str) {
  const joined = str.replace(/=\r?\n/g, ""); // 소프트 라인브레이크(줄 끝 =) 제거
  const bytes = [];
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(joined.charCodeAt(i));
    }
  }
  return new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
}

function decodeEmlPart(partBody, partHeaders) {
  const encodingMatch = partHeaders.match(/^Content-Transfer-Encoding:\s*([^\n]+)/im);
  const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : "7bit";
  if (encoding === "base64") {
    try {
      const binary = atob(partBody.replace(/\s+/g, ""));
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
      return partBody;
    }
  }
  if (encoding === "quoted-printable") return decodeQuotedPrintable(partBody);
  return partBody;
}

function stripHtmlToText(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
}

function extractTextFromEml(rawText) {
  const normalized = rawText.replace(/\r\n/g, "\n");
  const headerEnd = normalized.indexOf("\n\n");
  if (headerEnd === -1) return normalized;
  const headerBlock = normalized.slice(0, headerEnd);
  const body = normalized.slice(headerEnd + 2);

  // 여러 줄로 접힌(맨 앞에 공백/탭이 있는 줄은 이어지는 값) Content-Type 헤더를 한 줄로 폅니다.
  const contentTypeMatch = headerBlock.match(/^Content-Type:\s*([^\n]+(?:\n[ \t][^\n]*)*)/im);
  const contentType = contentTypeMatch ? contentTypeMatch[1].replace(/\n[ \t]/g, " ") : "";

  if (/multipart\//i.test(contentType)) {
    const boundaryMatch = contentType.match(/boundary="?([^";\n]+)"?/i);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = body.split("--" + boundary).slice(1, -1);
      let plainPart = null;
      let htmlPart = null;
      parts.forEach((part) => {
        const partHeaderEnd = part.indexOf("\n\n");
        if (partHeaderEnd === -1) return;
        const partHeaders = part.slice(0, partHeaderEnd);
        const partBody = part.slice(partHeaderEnd + 2);
        const partType = (partHeaders.match(/^Content-Type:\s*([^\n;]+)/im) || [])[1] || "";
        const decoded = decodeEmlPart(partBody, partHeaders);
        if (/text\/plain/i.test(partType) && !plainPart) plainPart = decoded;
        else if (/text\/html/i.test(partType) && !htmlPart) htmlPart = decoded;
      });
      if (plainPart) return plainPart;
      if (htmlPart) return stripHtmlToText(htmlPart);
    }
  }

  // 멀티파트가 아니면(단순 텍스트 메일) 본문 전체를 그대로 디코딩합니다.
  return decodeEmlPart(body, headerBlock);
}

kakaoFileInput.addEventListener("change", async () => {
  const file = kakaoFileInput.files[0];
  kakaoFileInput.value = ""; // 같은 파일을 다시 선택해도 change 이벤트가 뜨도록 초기화
  if (!file) return;
  try {
    const rawText = await file.text();
    const isEml =
      /\.eml$/i.test(file.name) || /^(From|Subject|Content-Type|MIME-Version):/im.test(rawText.slice(0, 1000));
    kakaoImportTextarea.value = isEml ? extractTextFromEml(rawText) : rawText;
    kakaoImportError.hidden = true;
  } catch (err) {
    console.error("[memories] 파일을 읽지 못했어요.", err);
    kakaoImportError.textContent = "파일을 읽는 데 실패했어요.";
    kakaoImportError.hidden = false;
  }
});

// ---------- 카카오톡 내보내기 텍스트 파서 ----------
// 각 메시지 줄: "2026년 9월 6일 오후 8:49, 이름 : 내용" 형태입니다. 그 외
// 줄(날짜만 있는 구분선, "OO님이 들어왔습니다" 같은 시스템 알림, 첫 두 줄의
// 방 제목/저장 날짜 안내)은 걸러내고, 위 형태와 안 맞는 줄은 바로 앞
// 메시지가 여러 줄로 이어지는 것으로 보고 그 메시지에 줄바꿈으로 붙입니다
// (내보내기 텍스트는 메시지 앱 알림 등도 섞여 있어서 100% 완벽하진 않지만,
// 실제 대화 내용은 이 규칙으로 안정적으로 뽑힙니다).
const KAKAO_HEADER_RE = /^(.+?)\s*님과의?\s*카카오톡\s*대화/;
const KAKAO_MESSAGE_RE = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s*([\s\S]*)$/;
const KAKAO_BARE_DATE_RE = /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*(오전|오후)\s*\d{1,2}:\d{2}$/;
const KAKAO_JOIN_LEAVE_RE = /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*(오전|오후)\s*\d{1,2}:\d{2},\s*.+님이\s*(들어왔습니다|나갔습니다)\.$/;

function parseKakaoExport(rawText) {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());
  let roomName = "";
  const firstNonEmpty = lines.find((l) => l);
  if (firstNonEmpty) {
    const hm = firstNonEmpty.match(KAKAO_HEADER_RE);
    if (hm) roomName = hm[1].trim();
  }

  const messages = [];
  lines.forEach((line) => {
    if (!line) return;
    if (KAKAO_HEADER_RE.test(line)) return;
    if (/^저장한 날짜\s*:/.test(line)) return;
    if (KAKAO_BARE_DATE_RE.test(line)) return;
    if (KAKAO_JOIN_LEAVE_RE.test(line)) return;

    const m = line.match(KAKAO_MESSAGE_RE);
    if (m) {
      const [, y, mo, d, ampm, h, min, sender, text] = m;
      let hour = parseInt(h, 10) % 12;
      if (ampm === "오후") hour += 12;
      const pad2 = (n) => String(n).padStart(2, "0");
      messages.push({
        sender: sender.trim(),
        dateDisplay: `${y}.${pad2(mo)}.${pad2(d)}.`,
        dateSort: `${y}-${pad2(mo)}-${pad2(d)}`,
        timeSort: `${pad2(hour)}:${min}`,
        timeDisplay: `${ampm} ${h}:${min}`,
        text: text.trim(),
      });
    } else if (messages.length > 0) {
      // 날짜 접두어 없는 줄 -> 바로 앞 메시지의 줄바꿈이 이어지는 내용으로 취급합니다.
      messages[messages.length - 1].text += "\n" + line;
    }
  });

  return { roomName, messages };
}

// ---------- 채팅 말풍선 렌더링 (미리보기/상세보기 공통) ----------
// 연속된 같은 발신자의 메시지는 하나의 묶음으로 보여주고(이름은 묶음당 한 번만),
// 날짜가 바뀌면 그 사이에 구분선을 넣습니다. options.editable이 true면(저장
// 전 미리보기 화면) 말풍선 사이사이에 "+ 이미지 추가" 버튼을 넣어서, 원하는
// 위치에 이미지를 수동으로 끼워 넣을 수 있게 합니다 — 카카오톡 내보내기
// 텍스트에는 사진이 "사진"이라는 글자로만 남기 때문입니다.
// options.cardId가 있으면(=저장된 카드의 상세보기) 메시지마다 코멘트
// 추가/보기 버튼을 같이 그립니다. 미리보기(저장 전)에는 카드 id가 아직
// 없어서 이 버튼들이 뜨지 않습니다.
function renderKakaoThread(container, messages, meSender, options = {}) {
  const editable = !!options.editable;
  const cardId = options.cardId || null;
  container.innerHTML = "";
  kakaoOriginalTextByKey = new Map();
  let lastDate = null;
  let currentGroup = null;
  let currentGroupCol = null;
  let currentGroupSender = null;

  function makeInsertImageBtn(insertIndex) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kakao-insert-image-btn";
    btn.textContent = "+ 이미지 추가";
    btn.addEventListener("click", () => {
      const url = window.prompt("이미지 URL을 입력하세요:");
      if (!url || !url.trim()) return;
      const neighbor = kakaoParsedMessages[insertIndex] || kakaoParsedMessages[insertIndex - 1];
      kakaoParsedMessages.splice(insertIndex, 0, {
        type: "image",
        sender: neighbor ? neighbor.sender : kakaoSelectedMeSender || "",
        dateDisplay: neighbor ? neighbor.dateDisplay : "",
        dateSort: neighbor ? neighbor.dateSort : "",
        timeDisplay: "",
        timeSort: "",
        url: url.trim(),
      });
      renderKakaoSenderOptions();
      renderKakaoThread(kakaoPreviewThread, kakaoParsedMessages, kakaoSelectedMeSender, { editable: true });
    });
    return btn;
  }

  // 코멘트 작성 버튼: 말풍선의 "상대를 향한" 세로변(=화면 가운데 쪽 변,
  // 시간 표시와 같은 쪽) 옆에 붙습니다. 아이콘의 말풍선 꼬리는 항상 자기
  // 말풍선 쪽을 향하게 상대/나에 따라 좌우로 뒤집습니다. 트위터 코멘트와
  // 마찬가지로 로그인한 사람 누구나 새 코멘트를 추가할 수 있습니다(관리자
  // 여부는 저장되는 코멘트 종류만 다르게 만듭니다 — 관리자는 message-circle/
  // coffee 중 고르고, 비관리자는 항상 wine 아이콘으로 저장됨).
  function makeKakaoCommentAddBtn(msgIndex, isMe) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kakao-comment-add-btn";
    btn.innerHTML = MESSAGE_CIRCLE_PLUS_ICON_SVG;
    const svg = btn.querySelector("svg");
    if (svg) svg.style.transform = isMe ? "scaleX(-1)" : "none";
    btn.setAttribute("aria-label", "코멘트 작성");
    btn.addEventListener("click", () => openKakaoCommentCompose(msgIndex));
    return btn;
  }

  // 코멘트 보기 버튼: 트윗 코멘트 보기 버튼과 완전히 같은 모양(말풍선 배경 +
  // 종류별 아이콘)이고 동작도 같습니다 — 열려 있는 버튼을 다시 누르면 패널이
  // 닫히고, 지금 보고 있는 버튼만 강조 표시됩니다.
  function makeKakaoCommentViewBtn(msgIndex, role, commentEntry) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tweet-comment-view-btn";
    btn.setAttribute("aria-label", "코멘트 보기");
    const bubbleShape = document.createElement("span");
    bubbleShape.className = "bubble-shape";
    bubbleShape.innerHTML = MESSAGE_CIRCLE_BUBBLE_FILL_SVG;
    const icon = document.createElement("span");
    icon.className = "bubble-icon";
    icon.innerHTML = COMMENT_TYPE_ICONS[commentEntry.type] || MESSAGE_CIRCLE_ICON_SVG;
    btn.append(bubbleShape, icon);
    applyNotifViewBtnColor(
      bubbleShape,
      "kakao",
      currentKakaoDetailId,
      String(msgIndex),
      commentEntry.type,
      commentEntry.createdAt || 0
    );
    btn.addEventListener("click", () => {
      const state = kakaoCommentPanelState;
      const alreadyOpen =
        !kakaoCommentPanel.hidden &&
        state &&
        state.msgIndex === msgIndex &&
        state.role === role &&
        state.entryId === commentEntry.id;
      if (alreadyOpen) {
        closeKakaoCommentPanel();
      } else {
        openKakaoCommentView(msgIndex, role, commentEntry.id);
        setActiveKakaoCommentViewBtn(btn);
        acknowledgeNotifTarget(bubbleShape, "kakao", currentKakaoDetailId, String(msgIndex), commentEntry.type);
      }
    });
    return btn;
  }

  if (editable) container.appendChild(makeInsertImageBtn(0));

  messages.forEach((msg, index) => {
    if (msg.dateDisplay && msg.dateDisplay !== lastDate) {
      const divider = document.createElement("div");
      divider.className = "kakao-date-divider";
      divider.textContent = msg.dateDisplay;
      container.appendChild(divider);
      lastDate = msg.dateDisplay;
      currentGroup = null; // 날짜가 바뀌면 새 묶음부터 시작합니다.
    }

    const isMe = !!meSender && msg.sender === meSender;
    if (!currentGroup || currentGroupSender !== msg.sender) {
      currentGroup = document.createElement("div");
      currentGroup.className = "kakao-message-group " + (isMe ? "me" : "other");
      if (!isMe) {
        const avatar = document.createElement("div");
        avatar.className = "kakao-avatar";
        currentGroup.appendChild(avatar);
      }
      currentGroupCol = document.createElement("div");
      currentGroupCol.className = "kakao-message-col";
      if (!isMe) {
        const nameEl = document.createElement("div");
        nameEl.className = "kakao-sender-name";
        nameEl.textContent = msg.sender;
        currentGroupCol.appendChild(nameEl);
      }
      currentGroup.appendChild(currentGroupCol);
      container.appendChild(currentGroup);
      currentGroupSender = msg.sender;
    }

    const row = document.createElement("div");
    row.className = "kakao-bubble-row";
    row.dataset.commentKey = String(index);

    if (msg.type === "image") {
      const img = document.createElement("img");
      img.className = "kakao-bubble-image";
      img.src = msg.url;
      img.alt = "";
      row.appendChild(img);
      if (editable) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "kakao-bubble-remove";
        removeBtn.textContent = "삭제";
        removeBtn.addEventListener("click", () => {
          kakaoParsedMessages.splice(index, 1);
          renderKakaoSenderOptions();
          renderKakaoThread(kakaoPreviewThread, kakaoParsedMessages, kakaoSelectedMeSender, { editable: true });
        });
        row.appendChild(removeBtn);
      }
    } else {
      const bubble = document.createElement("div");
      bubble.className = "kakao-bubble";
      bubble.textContent = msg.text;
      kakaoOriginalTextByKey.set(String(index), msg.text || "");
      const time = document.createElement("span");
      time.className = "kakao-time";
      time.textContent = msg.timeDisplay;
      row.append(bubble, time);
    }

    if (cardId) row.appendChild(makeKakaoCommentAddBtn(index, isMe));
    currentGroupCol.appendChild(row);

    if (cardId) {
      // 코멘트는 여러 개 있을 수 있어서(유저 여러 개 + 관리자 여러 개), 작성
      // 시각(createdAt) 순으로 정렬해 왼쪽(또는 오른쪽)부터 쌓습니다.
      const commentDoc = currentKakaoComments.get(String(index));
      const viewEntries = [];
      (commentDoc && commentDoc.user ? commentDoc.user : []).forEach((entry) => viewEntries.push({ role: "user", entry }));
      (commentDoc && commentDoc.admin ? commentDoc.admin : []).forEach((entry) => viewEntries.push({ role: "admin", entry }));
      viewEntries.sort((a, b) => (a.entry.createdAt || 0) - (b.entry.createdAt || 0));

      if (viewEntries.length > 0) {
        const viewStack = document.createElement("div");
        viewStack.className = "kakao-comment-view-stack";
        viewEntries.forEach(({ role, entry }) => viewStack.appendChild(makeKakaoCommentViewBtn(index, role, entry)));
        currentGroupCol.appendChild(viewStack);
      }
    }

    if (editable) container.appendChild(makeInsertImageBtn(index + 1));
  });
}

function applyKakaoThreadHighlights(highlights) {
  applyThreadHighlights(kakaoDetailThread, ".kakao-bubble-row", ".kakao-bubble", kakaoOriginalTextByKey, highlights);
}

// ---------- 새 카카오톡 대화 추가 ----------
function resetKakaoImportModal() {
  kakaoImportTextarea.value = "";
  kakaoImportError.hidden = true;
  kakaoPreviewSection.hidden = true;
  kakaoNewCardSaveBtn.hidden = true;
  kakaoParsedRoomName = "";
  kakaoParsedMessages = [];
  kakaoSelectedMeSender = "";
}

kakaoNewCardBtn.addEventListener("click", () => {
  resetKakaoImportModal();
  kakaoNewCardModal.hidden = false;
});
kakaoNewCardCloseBtn.addEventListener("click", () => {
  kakaoNewCardModal.hidden = true;
});
kakaoNewCardModal.addEventListener("click", (e) => {
  if (e.target === kakaoNewCardModal) kakaoNewCardModal.hidden = true;
});

function renderKakaoSenderOptions() {
  kakaoSenderOptions.innerHTML = "";
  const senders = Array.from(new Set(kakaoParsedMessages.map((m) => m.sender)));
  senders.forEach((sender) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kakao-sender-option" + (sender === kakaoSelectedMeSender ? " selected" : "");
    btn.textContent = sender;
    btn.addEventListener("click", () => {
      kakaoSelectedMeSender = sender;
      renderKakaoSenderOptions();
      renderKakaoThread(kakaoPreviewThread, kakaoParsedMessages, kakaoSelectedMeSender, { editable: true });
    });
    kakaoSenderOptions.appendChild(btn);
  });
}

kakaoImportParseBtn.addEventListener("click", () => {
  kakaoImportError.hidden = true;
  const text = kakaoImportTextarea.value.trim();
  if (!text) {
    kakaoImportError.textContent = "붙여넣은 내용이 없어요.";
    kakaoImportError.hidden = false;
    return;
  }

  const { roomName, messages } = parseKakaoExport(text);
  if (messages.length === 0) {
    kakaoImportError.textContent =
      "메시지를 하나도 찾지 못했어요. 카카오톡 채팅방에서 \"대화 내용 내보내기\"로 만든 텍스트를 그대로 붙여넣었는지 확인해주세요.";
    kakaoImportError.hidden = false;
    return;
  }

  kakaoParsedRoomName = roomName;
  kakaoParsedMessages = messages;
  // 방 제목("OO 님과 카카오톡 대화")에 나온 상대방이 아닌 첫 발신자를
  // "나"로 기본 선택합니다(1:1 대화에서는 이게 거의 항상 맞습니다).
  const senders = Array.from(new Set(messages.map((m) => m.sender)));
  kakaoSelectedMeSender = senders.find((s) => s !== roomName) || senders[0] || "";

  renderKakaoSenderOptions();
  renderKakaoThread(kakaoPreviewThread, kakaoParsedMessages, kakaoSelectedMeSender, { editable: true });
  kakaoPreviewSection.hidden = false;
  kakaoNewCardSaveBtn.hidden = false;
});

kakaoNewCardSaveBtn.addEventListener("click", async () => {
  if (kakaoParsedMessages.length === 0) return;
  kakaoNewCardSaveBtn.disabled = true;
  kakaoNewCardSaveBtn.textContent = "저장 중...";
  try {
    const messages = kakaoParsedMessages.map((m) => ({
      ...m,
      isMe: m.sender === kakaoSelectedMeSender,
    }));
    await addDoc(collection(db, "kakaoCards"), {
      roomName: kakaoParsedRoomName || messages.find((m) => !m.isMe)?.sender || "이름 없음",
      messages,
      firstDateSort: messages[0].dateSort || "",
      createdAt: serverTimestamp(),
    });
    kakaoNewCardModal.hidden = true;
    loadKakaoCards();
  } catch (err) {
    console.error("[memories] 카카오톡 백업 저장 실패", err);
    kakaoImportError.textContent = "저장에 실패했어요 (" + (err.code || err.message) + ").";
    kakaoImportError.hidden = false;
  } finally {
    kakaoNewCardSaveBtn.disabled = false;
    kakaoNewCardSaveBtn.textContent = "저장";
  }
});

// ---------- 카카오톡 카드 목록(홈 화면) ----------
async function loadKakaoCards() {
  try {
    const q = query(collection(db, "kakaoCards"), orderBy("firstDateSort", "desc"));
    const snap = await getDocs(q);
    loadedKakaoCards = [];
    snap.forEach((d) => loadedKakaoCards.push({ id: d.id, data: d.data() }));
    renderKakaoCardGrid();
  } catch (err) {
    console.error("[memories] 카카오톡 백업 목록을 불러오지 못했어요.", err);
  }
}

function renderKakaoCardGrid() {
  kakaoCardGrid.innerHTML = "";
  if (loadedKakaoCards.length === 0) {
    kakaoEmptyState.hidden = false;
    return;
  }
  kakaoEmptyState.hidden = true;

  loadedKakaoCards.forEach(({ id, data }) => {
    const messages = data.messages || [];
    const first = messages[0] || {};
    const last = messages[messages.length - 1] || {};
    const dateLabel =
      last.dateDisplay && last.dateDisplay !== first.dateDisplay
        ? `${first.dateDisplay} - ${last.dateDisplay}`
        : first.dateDisplay || "";

    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.addEventListener("click", () => openKakaoDetail(id, data));

    const head = document.createElement("div");
    head.className = "card-head";
    const avatar = document.createElement("div");
    avatar.className = "kakao-card-avatar";
    avatar.textContent = (data.roomName || "?").trim().charAt(0);
    head.appendChild(avatar);

    const headText = document.createElement("div");
    headText.className = "card-head-text";
    const nickEl = document.createElement("span");
    nickEl.className = "card-nickname";
    nickEl.textContent = data.roomName || "(이름 없음)";
    const metaEl = document.createElement("span");
    metaEl.className = "card-meta";
    metaEl.textContent = dateLabel;
    headText.append(nickEl, metaEl);
    head.appendChild(headText);

    const textEl = document.createElement("p");
    textEl.className = "card-text";
    textEl.textContent = (last.text || "").split("\n")[0];

    card.append(head, textEl);
    appendNotifDots(card, "kakao", id);
    kakaoCardGrid.appendChild(card);
  });
}

async function openKakaoDetail(id, data) {
  currentKakaoDetailId = id;
  currentKakaoDetailData = data;
  markCardSeen("kakao", id);
  kakaoDetailThread.innerHTML = "";
  kakaoDetailModal.hidden = false;

  currentKakaoComments = new Map();
  try {
    const snap = await getDocs(collection(db, "kakaoCards", id, "kakaoComments"));
    snap.forEach((d) => currentKakaoComments.set(d.id, normalizeCommentDoc(d.data())));
  } catch (e) {
    console.error("카카오 코멘트를 불러오지 못했습니다.", e);
  }

  // 상세보기에서는 "나"를 매번 물어보지 않고 저장 당시 고른 값을 그대로 씁니다.
  const meSet = new Set((data.messages || []).filter((m) => m.isMe).map((m) => m.sender));
  const meSender = meSet.size ? Array.from(meSet)[0] : null;
  renderKakaoThread(kakaoDetailThread, data.messages || [], meSender, { cardId: id });
}

function closeKakaoDetail() {
  kakaoDetailModal.hidden = true;
  currentKakaoDetailId = null;
  currentKakaoDetailData = null;
  closeKakaoCommentPanel();
  closeKakaoEdit();
  renderKakaoCardGrid();
}

kakaoDetailCloseBtn.addEventListener("click", closeKakaoDetail);
kakaoDetailModal.addEventListener("click", (e) => {
  if (e.target === kakaoDetailModal) closeKakaoDetail();
});

// 카카오 메시지별 코멘트 보기/작성 패널. 트위터 코멘트와 완전히 같은 구조
// (역할별 여러 개 배열, message-circle/coffee/wine 타입, 텍스트+이미지 블록
// 에디터)를 쓰고, 저장 위치만 kakaoCards/{cardId}/kakaoComments/{메시지 인덱스}로
// 다릅니다.
const kakaoCommentPanel = document.getElementById("kakao-comment-panel");
const kakaoCommentPanelBackBtn = document.getElementById("kakao-comment-panel-back-btn");
const kakaoCommentPanelActionBtn = document.getElementById("kakao-comment-panel-action-btn");
const kakaoCommentPanelDeleteBtn = document.getElementById("kakao-comment-panel-delete-btn");
const kakaoCommentPanelBody = document.getElementById("kakao-comment-panel-body");

let kakaoCommentPanelState = null; // { msgIndex, role, entryId, mode: "view"|"edit"|"compose", adminType?, blocksInitialized? }
let kakaoCommentComposeBlocks = []; // 작성/수정 중인 텍스트/이미지 블록들 (트윗 코멘트의 commentComposeBlocks와 같은 역할)

function findKakaoCommentEntry(msgIndex, role, entryId) {
  const commentDoc = currentKakaoComments.get(String(msgIndex));
  if (!commentDoc || !role || !entryId) return null;
  const arr = commentDoc[role] || [];
  return arr.find((e) => e.id === entryId) || null;
}

function openKakaoCommentView(msgIndex, role, entryId) {
  const entry = findKakaoCommentEntry(msgIndex, role, entryId);
  kakaoCommentPanelState = { msgIndex, role, entryId, mode: "view", highlights: (entry && entry.highlights) || [] };
  kakaoCommentPanel.hidden = false;
  renderKakaoCommentPanel();
}

function openKakaoCommentCompose(msgIndex) {
  // 항상 "새" 코멘트 작성 창을 엽니다 (기존 코멘트가 있어도 그대로 두고 하나 더 추가).
  kakaoCommentPanelState = {
    msgIndex,
    role: null,
    entryId: null,
    mode: "compose",
    adminType: "message-circle",
    highlights: [],
  };
  kakaoCommentPanel.hidden = false;
  renderKakaoCommentPanel();
  setActiveKakaoCommentViewBtn(null);
}

function closeKakaoCommentPanel() {
  kakaoCommentPanel.hidden = true;
  kakaoCommentPanelState = null;
  setActiveKakaoCommentViewBtn(null);
  applyKakaoThreadHighlights([]); // 코멘트 창을 닫으면 왼쪽 스레드 강조도 해제합니다.
}

captureThreadSelection(
  kakaoDetailThread,
  ".kakao-bubble-row",
  () => !!kakaoCommentPanelState && (kakaoCommentPanelState.mode === "compose" || kakaoCommentPanelState.mode === "edit"),
  (targetKey, text) => {
    kakaoCommentPanelState.highlights.push({ targetKey, text });
    renderKakaoCommentPanel();
  }
);

// 코멘트 창을 연 "보기" 버튼 하나를 강조 표시(is-open)합니다. 트윗 코멘트와
// 마찬가지로, 창이 열려 있는 동안엔 해당 버튼만 강조되고 창을 닫거나 다른
// 코멘트로 옮겨가면 이전 버튼의 강조는 지워집니다.
let activeKakaoCommentViewBtn = null;
function setActiveKakaoCommentViewBtn(btn) {
  if (activeKakaoCommentViewBtn) activeKakaoCommentViewBtn.classList.remove("is-open");
  activeKakaoCommentViewBtn = btn || null;
  if (activeKakaoCommentViewBtn) activeKakaoCommentViewBtn.classList.add("is-open");
}

function renderKakaoCommentPanel() {
  const state = kakaoCommentPanelState;
  if (!state) return;
  applyKakaoThreadHighlights(state.highlights || []);
  kakaoCommentPanelBody.innerHTML = "";

  if (state.mode === "view") {
    const entry = findKakaoCommentEntry(state.msgIndex, state.role, state.entryId);
    renderCommentBlocksView(kakaoCommentPanelBody, getCommentBlocks(entry));

    const canEdit = !!entry && ((isAdmin && state.role === "admin") || (!isAdmin && state.role === "user"));
    kakaoCommentPanelActionBtn.hidden = !canEdit;
    kakaoCommentPanelActionBtn.textContent = "수정";
    kakaoCommentPanelDeleteBtn.hidden = !canEdit;
    return;
  }

  // edit(기존 코멘트 수정) / compose(새 코멘트 작성)
  const entry = state.mode === "edit" ? findKakaoCommentEntry(state.msgIndex, state.role, state.entryId) : null;
  if (!state.blocksInitialized) {
    kakaoCommentComposeBlocks = getCommentBlocks(entry).map((b) =>
      b.type === "image" ? { type: "image", urls: getBlockImageUrls(b) } : { ...b }
    );
    state.blocksInitialized = true;
  }

  renderHighlightPicker(kakaoCommentPanelBody, state.highlights, renderKakaoCommentPanel);

  if (isAdmin) {
    if (!state.adminType) state.adminType = (entry && entry.type) || "message-circle";
    renderCommentTypeSelector(kakaoCommentPanelBody, state, renderKakaoCommentPanel);
  }

  renderCommentBlockEditor(kakaoCommentPanelBody, kakaoCommentComposeBlocks, renderKakaoCommentPanel);

  kakaoCommentPanelActionBtn.hidden = false;
  kakaoCommentPanelActionBtn.textContent = "저장";
  kakaoCommentPanelDeleteBtn.hidden = true; // 수정/작성 중에는 삭제 버튼을 숨깁니다.
}

kakaoCommentPanelBackBtn.addEventListener("click", closeKakaoCommentPanel);
kakaoCommentPanel.addEventListener("click", (e) => {
  if (e.target === kakaoCommentPanel) closeKakaoCommentPanel();
});

kakaoCommentPanelActionBtn.addEventListener("click", async () => {
  const state = kakaoCommentPanelState;
  if (!state || !currentKakaoDetailId) return;

  if (state.mode === "view") {
    state.mode = "edit";
    renderKakaoCommentPanel();
    return;
  }

  // 빈 텍스트 블록/URL 없는 이미지 블록은 저장하지 않고 걸러냅니다.
  const content = kakaoCommentComposeBlocks
    .map((b) =>
      b.type === "image"
        ? { type: "image", urls: (b.urls || []).map((u) => u.trim()).filter(Boolean) }
        : { type: "text", text: (b.text || "").trim() }
    )
    .filter((b) => (b.type === "image" ? b.urls.length > 0 : !!b.text));

  const role = state.mode === "edit" ? state.role : isAdmin ? "admin" : "user";
  const type = isAdmin ? state.adminType : "wine";

  const commentDoc = currentKakaoComments.get(String(state.msgIndex)) || {};
  const arr = Array.isArray(commentDoc[role]) ? commentDoc[role].slice() : [];

  if (state.mode === "edit") {
    const idx = arr.findIndex((e) => e.id === state.entryId);
    if (idx !== -1) {
      if (content.length) {
        const { text, ...rest } = arr[idx];
        arr[idx] = { ...rest, type, content, highlights: state.highlights || [] };
      } else {
        arr.splice(idx, 1); // 내용을 비우고 저장하면 코멘트를 삭제합니다.
      }
    }
  } else {
    if (!content.length) return; // 새 코멘트는 빈 채로 저장하지 않습니다.
    arr.push({ id: genCommentId(), type, content, createdAt: Date.now(), highlights: state.highlights || [] });
  }

  await persistCommentRoleArray(
    doc(db, "kakaoCards", currentKakaoDetailId, "kakaoComments", String(state.msgIndex)),
    role,
    arr,
    "코멘트 저장에 실패했습니다: ",
    () => {
      // 방금 내가 쓴 코멘트가 알림/뱃지에 "새 코멘트"로 뜨지 않도록 바로 확인 처리합니다.
      markTargetSeen("kakao", currentKakaoDetailId, String(state.msgIndex), type);
      closeKakaoCommentPanel();
      // "보기" 버튼에 바로 반영되도록 상세 화면을 다시 불러옵니다.
      openKakaoDetail(currentKakaoDetailId, currentKakaoDetailData);
    }
  );
});

kakaoCommentPanelDeleteBtn.addEventListener("click", async () => {
  const state = kakaoCommentPanelState;
  if (!state || state.mode !== "view" || !currentKakaoDetailId) return;
  if (!confirm("이 코멘트를 삭제할까요? 되돌릴 수 없어요.")) return;

  const commentDoc = currentKakaoComments.get(String(state.msgIndex)) || {};
  const arr = (Array.isArray(commentDoc[state.role]) ? commentDoc[state.role] : []).filter(
    (e) => e.id !== state.entryId
  );

  await persistCommentRoleArray(
    doc(db, "kakaoCards", currentKakaoDetailId, "kakaoComments", String(state.msgIndex)),
    state.role,
    arr,
    "코멘트 삭제에 실패했습니다: ",
    () => {
      closeKakaoCommentPanel();
      openKakaoDetail(currentKakaoDetailId, currentKakaoDetailData);
    }
  );
});

kakaoDetailDeleteBtn.addEventListener("click", async () => {
  if (!currentKakaoDetailId) return;
  if (!confirm("이 카카오톡 백업을 삭제할까요? 되돌릴 수 없어요.")) return;
  await deleteDoc(doc(db, "kakaoCards", currentKakaoDetailId));
  closeKakaoDetail();
  loadKakaoCards();
});

// ---------- 카카오톡 대화 내용 수정 ----------
// 보낸 사람/시간/순서는 그대로 두고 메시지 내용(텍스트 또는 이미지 URL)만
// 고칩니다. 메시지를 추가/삭제하거나 순서를 바꾸는 기능은 일부러 넣지
// 않았습니다 — 코멘트(kakaoComments)가 메시지 배열의 인덱스로 연결되어
// 있어서, 순서가 하나라도 바뀌면 기존 코멘트가 엉뚱한 메시지에 달린 것처럼
// 보이게 됩니다.
let kakaoEditingMessages = [];

// 텍스트 메시지/이미지 메시지를 따로 구분한 입력칸을 두지 않고, 칸 하나에
// 뭘 넣었는지로 종류를 판단합니다: 전체 내용이 그냥 http(s) URL 하나뿐이면
// 이미지로, 아니면 텍스트로 저장합니다(다른 곳의 이미지 URL 판단 방식과
// 동일). 그래서 이미지 메시지를 텍스트로, 텍스트 메시지를 이미지로 바꿔
// 저장하는 것도 자연스럽게 가능합니다.
function looksLikeBareImageUrl(value) {
  return /^https?:\/\/\S+$/.test(value.trim());
}

function renderKakaoEditRows() {
  kakaoEditRows.innerHTML = "";
  kakaoEditingMessages.forEach((msg) => {
    const row = document.createElement("div");
    row.className = "kakao-edit-row";

    const meta = document.createElement("div");
    meta.className = "kakao-edit-row-meta";
    meta.textContent = [msg.sender, msg.dateDisplay, msg.timeDisplay].filter(Boolean).join(" · ");
    row.appendChild(meta);

    const textarea = document.createElement("textarea");
    textarea.className = "kakao-edit-row-textarea";
    textarea.rows = 2;
    textarea.value = msg.type === "image" ? msg.url || "" : msg.text || "";
    textarea.addEventListener("input", () => autoResizeTextarea(textarea));
    row.appendChild(textarea);

    kakaoEditRows.appendChild(row);
  });
  // scrollHeight는 실제 화면에 붙어야 정확히 계산되니, 다 붙인 다음 높이를 맞춥니다.
  kakaoEditRows.querySelectorAll(".kakao-edit-row-textarea").forEach(autoResizeTextarea);
}

function openKakaoEdit() {
  if (!currentKakaoDetailData) return;
  kakaoEditingMessages = (currentKakaoDetailData.messages || []).map((m) => ({ ...m }));
  // hidden을 먼저 풀어야 합니다. renderKakaoEditRows() 안에서 textarea 높이를
  // scrollHeight로 재는데, 모달이 아직 hidden(=display:none)인 상태면 레이아웃
  // 자체가 없어서 scrollHeight가 0으로 나와 칸이 내용에 안 맞고 한 줄도 안 되게
  // 찌그러져 보였습니다(트윗 코멘트 패널에서 겪었던 것과 같은 문제).
  kakaoEditModal.hidden = false;
  renderKakaoEditRows();
}

function closeKakaoEdit() {
  kakaoEditModal.hidden = true;
}

kakaoDetailEditBtn.addEventListener("click", openKakaoEdit);
kakaoEditCloseBtn.addEventListener("click", closeKakaoEdit);
kakaoEditModal.addEventListener("click", (e) => {
  if (e.target === kakaoEditModal) closeKakaoEdit();
});

kakaoEditSaveBtn.addEventListener("click", async () => {
  if (!currentKakaoDetailId) return;
  const textareas = kakaoEditRows.querySelectorAll(".kakao-edit-row-textarea");
  const messages = kakaoEditingMessages.map((m, i) => {
    const value = (textareas[i].value || "").trim();
    const { type, url, text, ...rest } = m; // 이전 종류(text/url) 필드는 새로 판단해서 다시 채우니 제외
    return looksLikeBareImageUrl(value) ? { ...rest, type: "image", url: value } : { ...rest, text: value };
  });
  await updateDoc(doc(db, "kakaoCards", currentKakaoDetailId), { messages });
  currentKakaoDetailData.messages = messages;
  closeKakaoEdit();
  openKakaoDetail(currentKakaoDetailId, currentKakaoDetailData);
});

// ---------- SumOne ----------
// 카드 하나가 제목(홈 화면 카드에 썸네일 대신 표시) + 이미지 한 장 + 내용
// 한 덩어리 + 코멘트로 구성됩니다(X/카카오톡처럼 메시지가 여러 개 쌓이는
// 구조가 아니라, 카드 하나당 콘텐츠가 하나뿐입니다).
async function loadSumoneCards() {
  // 입력한 날짜(dateSort) 기준 최신순. 날짜를 안 넣은 카드는 dateSort가
  // 빈 문자열이라 맨 뒤로 갑니다.
  const q = query(collection(db, "sumoneCards"), orderBy("dateSort", "desc"));
  const snapshot = await getDocs(q);
  loadedSumoneCards = snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
  renderSumoneCardGrid();
}

function renderSumoneCardGrid() {
  sumoneCardGrid.innerHTML = "";
  if (loadedSumoneCards.length === 0) {
    sumoneEmptyState.hidden = false;
    return;
  }
  sumoneEmptyState.hidden = true;

  loadedSumoneCards.forEach(({ id, data }) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.addEventListener("click", () => openSumoneDetail(id, data));

    const titleEl = document.createElement("p");
    titleEl.className = "sumone-card-title";
    titleEl.textContent = data.title || "(제목 없음)";
    card.appendChild(titleEl);
    appendNotifDots(card, "sumone", id);

    sumoneCardGrid.appendChild(card);
  });
}

// ---------- SumOne 카드 새로 만들기/수정 ----------
function openSumoneForm(id, data) {
  sumoneEditTargetId = id || null;
  sumoneTitleInput.value = data ? data.title || "" : "";
  sumoneDateInput.value = data ? data.dateDisplay || "" : "";
  sumoneImageInput.value = data ? data.imageUrl || "" : "";
  sumoneContentInput.value = data ? data.content || "" : "";
  sumoneFormModal.hidden = false;
}
function closeSumoneForm() {
  sumoneFormModal.hidden = true;
  sumoneEditTargetId = null;
}
sumoneNewCardBtn.addEventListener("click", () => openSumoneForm(null, null));
sumoneFormCloseBtn.addEventListener("click", closeSumoneForm);
sumoneFormModal.addEventListener("click", (e) => {
  if (e.target === sumoneFormModal) closeSumoneForm();
});

sumoneFormSaveBtn.addEventListener("click", async () => {
  const title = sumoneTitleInput.value.trim();
  if (!title) {
    alert("제목을 입력해주세요.");
    return;
  }
  const dateDisplay = sumoneDateInput.value.trim();
  const payload = {
    title,
    dateDisplay,
    dateSort: toDateSort(dateDisplay), // Firestore가 이 필드로 정렬하니 항상 채워둡니다(없으면 목록 정렬에서 아예 빠짐).
    imageUrl: sumoneImageInput.value.trim(),
    content: sumoneContentInput.value.trim(),
  };

  if (sumoneEditTargetId) {
    await updateDoc(doc(db, "sumoneCards", sumoneEditTargetId), payload);
    if (currentSumoneDetailId === sumoneEditTargetId) {
      currentSumoneDetailData = { ...currentSumoneDetailData, ...payload };
      renderSumoneDetail();
    }
  } else {
    await addDoc(collection(db, "sumoneCards"), { ...payload, createdAt: serverTimestamp() });
  }
  closeSumoneForm();
  loadSumoneCards();
});

// ---------- SumOne 카드 상세 보기 ----------
async function openSumoneDetail(id, data) {
  currentSumoneDetailId = id;
  currentSumoneDetailData = data;
  markCardSeen("sumone", id);
  sumoneDetailModal.hidden = false;

  currentSumoneComments = { user: [], admin: [] };
  try {
    const snap = await getDoc(doc(db, "sumoneCards", id, "sumoneComments", "main"));
    if (snap.exists()) currentSumoneComments = normalizeCommentDoc(snap.data());
  } catch (e) {
    console.error("SumOne 코멘트를 불러오지 못했습니다.", e);
  }

  renderSumoneDetail();
}

function renderSumoneDetail() {
  const data = currentSumoneDetailData;
  const imgSrc = safeImgSrc(data.imageUrl);
  sumoneDetailImage.src = imgSrc || "";
  sumoneDetailImage.hidden = !imgSrc;
  // 트위터 백업과 같은 이미지 원본 보기 창으로 엽니다.
  sumoneDetailImage.onclick = imgSrc ? () => openImageViewer(imgSrc) : null;
  sumoneDetailContent.textContent = data.content || "";
  renderSumoneCommentStack();
}

function closeSumoneDetail() {
  sumoneDetailModal.hidden = true;
  currentSumoneDetailId = null;
  currentSumoneDetailData = null;
  closeSumoneCommentPanel();
  renderSumoneCardGrid();
}

sumoneDetailCloseBtn.addEventListener("click", closeSumoneDetail);
sumoneDetailModal.addEventListener("click", (e) => {
  if (e.target === sumoneDetailModal) closeSumoneDetail();
});
sumoneDetailEditBtn.addEventListener("click", () => openSumoneForm(currentSumoneDetailId, currentSumoneDetailData));
sumoneDetailDeleteBtn.addEventListener("click", async () => {
  if (!currentSumoneDetailId) return;
  if (!confirm("이 SumOne 카드를 삭제할까요? 되돌릴 수 없어요.")) return;
  await deleteDoc(doc(db, "sumoneCards", currentSumoneDetailId));
  closeSumoneDetail();
  loadSumoneCards();
});

// ---------- SumOne 코멘트 보기/작성 ----------
// 트위터 코멘트와 완전히 같은 구조(관리자/비관리자 역할 구분, 역할당 여러
// 개 저장, message-circle/coffee/wine 타입, 텍스트+이미지 블록 에디터)를
// 쓰지만, 카드 하나당 코멘트 대상이 하나뿐이라 메시지 인덱스 같은 키가
// 필요 없습니다.
const sumoneCommentPanel = document.getElementById("sumone-comment-panel");
const sumoneCommentPanelBackBtn = document.getElementById("sumone-comment-panel-back-btn");
const sumoneCommentPanelActionBtn = document.getElementById("sumone-comment-panel-action-btn");
const sumoneCommentPanelDeleteBtn = document.getElementById("sumone-comment-panel-delete-btn");
const sumoneCommentPanelBody = document.getElementById("sumone-comment-panel-body");

let sumoneCommentPanelState = null; // { role, entryId, mode: "view"|"edit"|"compose", adminType?, blocksInitialized? }
let sumoneCommentComposeBlocks = [];
let activeSumoneCommentViewBtn = null;

function setActiveSumoneCommentViewBtn(btn) {
  if (activeSumoneCommentViewBtn) activeSumoneCommentViewBtn.classList.remove("is-open");
  activeSumoneCommentViewBtn = btn || null;
  if (activeSumoneCommentViewBtn) activeSumoneCommentViewBtn.classList.add("is-open");
}

function findSumoneCommentEntry(role, entryId) {
  if (!currentSumoneComments || !role || !entryId) return null;
  const arr = currentSumoneComments[role] || [];
  return arr.find((e) => e.id === entryId) || null;
}

// 코멘트 작성 버튼과(있으면) 보기 버튼들을 한 줄에 나란히 그립니다
// (이미지 아래, 내용 위). sumoneCommentArea 자체가 flex row라 별도
// 묶음 없이 바로 자식으로 넣습니다.
function renderSumoneCommentStack() {
  sumoneCommentArea.innerHTML = "";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "sumone-comment-add-btn";
  addBtn.innerHTML = MESSAGE_CIRCLE_PLUS_ICON_SVG;
  // 이 아이콘은 기본적으로(다른 곳에서 왼쪽에 놓일 걸 기준으로) 좌우
  // 반전되어 있는데, 여기서는 그 반대 방향이 자연스러워서 원래대로
  // 되돌립니다.
  const addBtnSvg = addBtn.querySelector("svg");
  if (addBtnSvg) addBtnSvg.style.transform = "none";
  addBtn.setAttribute("aria-label", "코멘트 작성");
  addBtn.addEventListener("click", () => openSumoneCommentCompose());
  sumoneCommentArea.appendChild(addBtn);

  const viewEntries = [];
  (currentSumoneComments.user || []).forEach((entry) => viewEntries.push({ role: "user", entry }));
  (currentSumoneComments.admin || []).forEach((entry) => viewEntries.push({ role: "admin", entry }));
  viewEntries.sort((a, b) => (a.entry.createdAt || 0) - (b.entry.createdAt || 0));
  viewEntries.forEach(({ role, entry }) => sumoneCommentArea.appendChild(makeSumoneCommentViewBtn(role, entry)));
}

function makeSumoneCommentViewBtn(role, commentEntry) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tweet-comment-view-btn";
  btn.setAttribute("aria-label", "코멘트 보기");
  const bubbleShape = document.createElement("span");
  bubbleShape.className = "bubble-shape";
  bubbleShape.innerHTML = MESSAGE_CIRCLE_BUBBLE_FILL_SVG;
  const icon = document.createElement("span");
  icon.className = "bubble-icon";
  icon.innerHTML = COMMENT_TYPE_ICONS[commentEntry.type] || MESSAGE_CIRCLE_ICON_SVG;
  btn.append(bubbleShape, icon);
  applyNotifViewBtnColor(
    bubbleShape,
    "sumone",
    currentSumoneDetailId,
    "main",
    commentEntry.type,
    commentEntry.createdAt || 0
  );
  btn.addEventListener("click", () => {
    const state = sumoneCommentPanelState;
    const alreadyOpen =
      !sumoneCommentPanel.hidden && state && state.role === role && state.entryId === commentEntry.id;
    if (alreadyOpen) {
      closeSumoneCommentPanel();
    } else {
      openSumoneCommentView(role, commentEntry.id);
      setActiveSumoneCommentViewBtn(btn);
      acknowledgeNotifTarget(bubbleShape, "sumone", currentSumoneDetailId, "main", commentEntry.type);
    }
  });
  return btn;
}

function openSumoneCommentView(role, entryId) {
  sumoneCommentPanelState = { role, entryId, mode: "view" };
  sumoneCommentPanel.hidden = false;
  renderSumoneCommentPanel();
}
function openSumoneCommentCompose() {
  sumoneCommentPanelState = { role: null, entryId: null, mode: "compose", adminType: "message-circle" };
  sumoneCommentPanel.hidden = false;
  renderSumoneCommentPanel();
  setActiveSumoneCommentViewBtn(null);
}
function closeSumoneCommentPanel() {
  sumoneCommentPanel.hidden = true;
  sumoneCommentPanelState = null;
  setActiveSumoneCommentViewBtn(null);
}

function renderSumoneCommentPanel() {
  const state = sumoneCommentPanelState;
  if (!state) return;
  sumoneCommentPanelBody.innerHTML = "";

  if (state.mode === "view") {
    const entry = findSumoneCommentEntry(state.role, state.entryId);
    renderCommentBlocksView(sumoneCommentPanelBody, getCommentBlocks(entry));
    const canEdit = !!entry && ((isAdmin && state.role === "admin") || (!isAdmin && state.role === "user"));
    sumoneCommentPanelActionBtn.hidden = !canEdit;
    sumoneCommentPanelActionBtn.textContent = "수정";
    sumoneCommentPanelDeleteBtn.hidden = !canEdit;
    return;
  }

  const entry = state.mode === "edit" ? findSumoneCommentEntry(state.role, state.entryId) : null;
  if (!state.blocksInitialized) {
    sumoneCommentComposeBlocks = getCommentBlocks(entry).map((b) =>
      b.type === "image" ? { type: "image", urls: getBlockImageUrls(b) } : { ...b }
    );
    state.blocksInitialized = true;
  }

  if (isAdmin) {
    if (!state.adminType) state.adminType = (entry && entry.type) || "message-circle";
    renderCommentTypeSelector(sumoneCommentPanelBody, state, renderSumoneCommentPanel);
  }

  renderCommentBlockEditor(sumoneCommentPanelBody, sumoneCommentComposeBlocks, renderSumoneCommentPanel);

  sumoneCommentPanelActionBtn.hidden = false;
  sumoneCommentPanelActionBtn.textContent = "저장";
  sumoneCommentPanelDeleteBtn.hidden = true;
}

sumoneCommentPanelBackBtn.addEventListener("click", closeSumoneCommentPanel);
sumoneCommentPanel.addEventListener("click", (e) => {
  if (e.target === sumoneCommentPanel) closeSumoneCommentPanel();
});

sumoneCommentPanelActionBtn.addEventListener("click", async () => {
  const state = sumoneCommentPanelState;
  if (!state || !currentSumoneDetailId) return;

  if (state.mode === "view") {
    state.mode = "edit";
    renderSumoneCommentPanel();
    return;
  }

  const content = sumoneCommentComposeBlocks
    .map((b) =>
      b.type === "image"
        ? { type: "image", urls: (b.urls || []).map((u) => u.trim()).filter(Boolean) }
        : { type: "text", text: (b.text || "").trim() }
    )
    .filter((b) => (b.type === "image" ? b.urls.length > 0 : !!b.text));

  const role = state.mode === "edit" ? state.role : isAdmin ? "admin" : "user";
  const type = isAdmin ? state.adminType : "wine";

  const arr = Array.isArray(currentSumoneComments[role]) ? currentSumoneComments[role].slice() : [];
  if (state.mode === "edit") {
    const idx = arr.findIndex((e) => e.id === state.entryId);
    if (idx !== -1) {
      if (content.length) {
        const { text, ...rest } = arr[idx];
        arr[idx] = { ...rest, type, content };
      } else {
        arr.splice(idx, 1);
      }
    }
  } else {
    if (!content.length) return;
    arr.push({ id: genCommentId(), type, content, createdAt: Date.now() });
  }

  await persistCommentRoleArray(
    doc(db, "sumoneCards", currentSumoneDetailId, "sumoneComments", "main"),
    role,
    arr,
    "코멘트 저장에 실패했습니다: ",
    () => {
      // 방금 내가 쓴 코멘트가 알림/뱃지에 "새 코멘트"로 뜨지 않도록 바로 확인 처리합니다.
      markTargetSeen("sumone", currentSumoneDetailId, "main", type);
      closeSumoneCommentPanel();
      openSumoneDetail(currentSumoneDetailId, currentSumoneDetailData);
    }
  );
});

sumoneCommentPanelDeleteBtn.addEventListener("click", async () => {
  const state = sumoneCommentPanelState;
  if (!state || state.mode !== "view" || !currentSumoneDetailId) return;
  if (!confirm("이 코멘트를 삭제할까요? 되돌릴 수 없어요.")) return;

  const arr = (Array.isArray(currentSumoneComments[state.role]) ? currentSumoneComments[state.role] : []).filter(
    (e) => e.id !== state.entryId
  );

  await persistCommentRoleArray(
    doc(db, "sumoneCards", currentSumoneDetailId, "sumoneComments", "main"),
    state.role,
    arr,
    "코멘트 삭제에 실패했습니다: ",
    () => {
      closeSumoneCommentPanel();
      openSumoneDetail(currentSumoneDetailId, currentSumoneDetailData);
    }
  );
});

// ---------- 알림 ----------
// "확인 표시"는 두 단계로 따로 저장됩니다:
// - cardMarks: 홈 화면 카드 우측 상단의 새 코멘트 점이 사라지는 기준.
//   카드(대화/카드) 상세를 "열기만" 해도 그 카드 전체가 확인된 것으로 칩니다.
// - targetMarks: 코멘트 하나(트윗/카톡 메시지/SumOne 카드)의 보기 버튼
//   강조색과 알림창 목록 항목이 사라지는 기준. 그 코멘트를 실제로 열어봐야
//   확인된 것으로 칩니다 — 카드만 열어본 것으로는 안 지워집니다.
// 관리자는 모든 코멘트 알림을 보고, 비관리자는 관리자가 단 코멘트
// (message-circle/coffee)만 알림으로 봅니다(자기 자신의 wine 코멘트나
// 다른 사람의 wine 코멘트는 알림 대상이 아님).
function notifCardKey(section, cardId) {
  return section + ":" + cardId;
}
function notifTargetKey(section, cardId, targetKey, type) {
  return section + ":" + cardId + ":" + targetKey + ":" + type;
}

async function loadSeenMaps() {
  cardSeenMap = new Map();
  targetSeenMap = new Map();
  if (!currentUid) return;
  try {
    const cardSnap = await getDocs(collection(db, "notifSeen", currentUid, "cardMarks"));
    cardSnap.forEach((d) => cardSeenMap.set(d.id, d.data().seenAt || 0));
    const targetSnap = await getDocs(collection(db, "notifSeen", currentUid, "targetMarks"));
    targetSnap.forEach((d) => targetSeenMap.set(d.id, d.data().seenAt || 0));
  } catch (e) {
    console.error("알림 확인 기록을 불러오지 못했습니다.", e);
  }
}

// 세 카테고리의 모든 코멘트를 한 번에 훑어옵니다. 카드마다 따로 불러오는
// 대신 collectionGroup으로 "tweetComments"라는 이름의 서브컬렉션 전체를
// 한 번에 조회합니다 — 어느 카드 밑에 있는지는 문서 참조의 부모의 부모
// (.ref.parent.parent.id)로 알 수 있습니다.
async function loadNotifEntries() {
  const entries = [];

  async function collectFrom(subcollectionName, section, fixedTargetKey) {
    try {
      const snap = await getDocs(collectionGroup(db, subcollectionName));
      snap.forEach((docSnap) => {
        const cardId = docSnap.ref.parent.parent.id;
        const targetKey = fixedTargetKey || docSnap.id;
        const data = normalizeCommentDoc(docSnap.data());
        ["admin", "user"].forEach((role) => {
          (data[role] || []).forEach((entry) => {
            entries.push({
              section,
              cardId,
              targetKey,
              role,
              type: entry.type,
              createdAt: entry.createdAt || 0,
            });
          });
        });
      });
    } catch (e) {
      console.error(subcollectionName + " 알림을 불러오지 못했습니다.", e);
    }
  }

  await collectFrom("tweetComments", "x", null);
  await collectFrom("kakaoComments", "kakao", null);
  await collectFrom("sumoneComments", "sumone", "main");

  notifEntriesCache = entries;
  updateNotifBellDots();
}

// 알림은 "상대가 쓴 코멘트"만 보이게 합니다: 관리자(message-circle/coffee
// 작성자)는 상대인 유저가 쓴 wine 알림만 보고, 유저는 관리자가 쓴
// message-circle/coffee 알림만 봅니다.
function isNotifEntryVisible(entry) {
  if (isAdmin) return entry.type === "wine";
  return entry.type === "message-circle" || entry.type === "coffee";
}

async function markCardSeen(section, cardId) {
  if (!currentUid) return;
  const key = notifCardKey(section, cardId);
  const now = Date.now();
  cardSeenMap.set(key, now);
  try {
    await setDoc(doc(db, "notifSeen", currentUid, "cardMarks", key), { seenAt: now });
  } catch (e) {
    console.error("카드 확인 표시 저장에 실패했습니다.", e);
  }
}

async function markTargetSeen(section, cardId, targetKey, type) {
  if (!currentUid) return;
  const key = notifTargetKey(section, cardId, targetKey, type);
  const now = Date.now();
  targetSeenMap.set(key, now);
  updateNotifBellDots();
  try {
    await setDoc(doc(db, "notifSeen", currentUid, "targetMarks", key), { seenAt: now });
  } catch (e) {
    console.error("코멘트 확인 표시 저장에 실패했습니다.", e);
  }
}

// 벨 아이콘 우측 상단 점은 "알림창을 마지막으로 연 뒤로 뭔가 새로 생겼는지"만
// 봅니다. 알림창 목록(패널 안 줄들)은 커피/와인처럼 코멘트를 직접 열어야
// 없어지는 것과 별개로, 벨 점은 알림창을 여는 것 자체로 확인 처리됩니다.
function notifBellSeenKey() {
  return notifTargetKey("_bell_", "_all_", "_all_", "_all_");
}
async function markBellSeen() {
  if (!currentUid) return;
  const key = notifBellSeenKey();
  const now = Date.now();
  targetSeenMap.set(key, now);
  try {
    await setDoc(doc(db, "notifSeen", currentUid, "targetMarks", key), { seenAt: now });
  } catch (e) {
    console.error("알림 확인 표시 저장에 실패했습니다.", e);
  }
}
function updateNotifBellDots() {
  const seenAt = targetSeenMap.get(notifBellSeenKey()) || 0;
  const hasUnseen = notifEntriesCache.filter(isNotifEntryVisible).some((e) => e.createdAt > seenAt);
  notifBellDots.forEach((dot) => {
    dot.hidden = !hasUnseen;
  });
}

function isTargetTypeUnseen(section, cardId, targetKey, type, createdAt) {
  const seenAt = targetSeenMap.get(notifTargetKey(section, cardId, targetKey, type)) || 0;
  return createdAt > seenAt;
}

// 카드 우측 상단에 찍을 점의 색(코멘트 종류별). 말풍선은 테마 색을 그대로 씁니다.
const NOTIF_DOT_COLOR = {
  "message-circle": "var(--accent)",
  coffee: "#B8E2DC",
  wine: "#7E212A",
};

// 이 카드에서 아직 안 본 코멘트 종류들을 돌려줍니다(최대 3개: message-circle/coffee/wine).
function getUnseenTypesForCard(section, cardId) {
  const seenAt = cardSeenMap.get(notifCardKey(section, cardId)) || 0;
  const types = new Set();
  notifEntriesCache.forEach((e) => {
    if (e.section !== section || e.cardId !== cardId) return;
    if (!isNotifEntryVisible(e)) return;
    if (e.createdAt > seenAt) types.add(e.type);
  });
  return Array.from(types);
}

// 홈 화면 카드(.card, position:relative)의 좌측 상단 꼭짓점에 새 코멘트 점을
// 붙입니다. 여러 개면 왼쪽 점이 오른쪽 점을 절반 정도 덮도록, 먼저 만든
// 점일수록 z-index를 높게 줍니다.
function appendNotifDots(cardEl, section, cardId) {
  const types = getUnseenTypesForCard(section, cardId);
  if (types.length === 0) return;
  // 새 코멘트가 있는 카드는 테두리도 테마 컬러로 강조합니다. 카드를 열어
  // 확인하면(markCardSeen) 목록이 다시 그려지면서 이 클래스도 자연히 빠집니다.
  cardEl.classList.add("has-new-comment");
  const row = document.createElement("div");
  row.className = "notif-dot-row";
  types.forEach((type, i) => {
    const dot = document.createElement("span");
    dot.className = "notif-dot";
    dot.style.background = NOTIF_DOT_COLOR[type] || "var(--accent)";
    dot.style.zIndex = String(types.length - i);
    row.appendChild(dot);
  });
  cardEl.appendChild(row);
}

// 와인/커피/말풍선 코멘트가 새로 달렸을 때 보기 버튼의 말풍선 배경색을 그
// 종류의 색으로 바꿉니다(말풍선 SVG가 fill="currentColor"라 bubble-shape의
// color를 바꾸면 됩니다). 확인하면(그 버튼을 눌러서 보기/닫기) 원래
// 색으로 돌아옵니다.
const NOTIF_VIEW_BTN_COLOR = {
  coffee: "#B8E2DC",
  wine: "#7E212A",
  "message-circle": "var(--accent)",
};
// 배경이 어둡거나 진한 색(와인/말풍선)일 땐 그 위 아이콘도 흰색으로 바꿔야
// 잘 보입니다. 커피는 배경이 밝은 파스텔이라 원래 아이콘 색이 더 잘 보여서
// 그대로 둡니다.
const NOTIF_VIEW_BTN_WHITE_ICON_TYPES = new Set(["wine", "message-circle"]);
function applyNotifViewBtnColor(bubbleShapeEl, section, cardId, targetKey, type, createdAt) {
  if (!NOTIF_VIEW_BTN_COLOR[type]) return;
  if (isTargetTypeUnseen(section, cardId, targetKey, type, createdAt)) {
    bubbleShapeEl.style.color = NOTIF_VIEW_BTN_COLOR[type];
    if (NOTIF_VIEW_BTN_WHITE_ICON_TYPES.has(type)) {
      const iconEl = bubbleShapeEl.nextElementSibling;
      if (iconEl) iconEl.style.color = "#fff";
    }
  }
}
// 보기 버튼을 눌러 코멘트를 확인한 순간 바로 원래 색으로 되돌리고, 서버에도 기록합니다.
function acknowledgeNotifTarget(bubbleShapeEl, section, cardId, targetKey, type) {
  if (bubbleShapeEl) {
    bubbleShapeEl.style.color = "";
    const iconEl = bubbleShapeEl.nextElementSibling;
    if (iconEl) iconEl.style.color = "";
  }
  markTargetSeen(section, cardId, targetKey, type);
}

// n분/시간/일 전. 알림창의 코멘트 문구 바로 아래 회색 작은 글씨로 씁니다.
function formatRelativeTime(ms) {
  const diff = Math.max(0, Date.now() - ms);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "방금 전";
  if (diff < hour) return Math.floor(diff / minute) + "분 전";
  if (diff < day) return Math.floor(diff / hour) + "시간 전";
  return Math.floor(diff / day) + "일 전";
}

const NOTIF_TEXT_BY_TYPE = {
  "message-circle": "새 코멘트가 달렸어요",
  coffee: "윤 양이 새 코멘트를 달았어요",
  wine: "츄야 군이 새 코멘트를 달았어요",
};

// 말풍선(message-circle) 코멘트 전용: 같은 화면(X/카카오/SumOne) 안에서는
// 어느 카드·트윗에 달렸든, 첫 코멘트가 달린 뒤 7일 안에 추가로 여러 개가
// 달려도 알림창엔 한 줄로만 뜨고, 표시 시각(과 컨텍스트로 보여줄 카드)은
// 그 묶음의 가장 마지막 코멘트 기준입니다. 첫 코멘트로부터 7일이 지난 뒤
// 또 달리면 별개의 새 묶음(=새 줄)으로 칩니다.
//
// (예전엔 "묶음 안 코멘트를 하나하나 다 확인해야 줄이 없어진다"는 방식이었는데,
// 예전에 확인 안 하고 잊어버린 말풍선 코멘트가 하나라도 남아있으면 방금 새로
// 확인한 것까지 포함해서 줄 전체가 계속 떠 있는 문제가 있었습니다. 그래서
// 알림창의 모든 줄(말풍선/커피/와인)은 이제 "확인했는지"와 무관하게 "생긴 지
// 20일이 지났는지"로만 없어집니다 — 말풍선 묶음은 그 안 가장 최근 코멘트
// 기준 20일. 보기 버튼의 강조색(개별 코멘트 확인 표시)은 이 변경과 별개로
// 그대로 유지됩니다.)
const NOTIF_MC_COALESCE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const NOTIF_EXPIRE_MS = 20 * 24 * 60 * 60 * 1000;
function coalesceMessageCircleEntries(entriesSortedAsc) {
  const groups = [];
  let current = null;
  entriesSortedAsc.forEach((e) => {
    if (!current || e.createdAt - current.firstAt > NOTIF_MC_COALESCE_WINDOW_MS) {
      current = { firstAt: e.createdAt, lastAt: e.createdAt, entries: [e] };
      groups.push(current);
    } else {
      current.lastAt = e.createdAt;
      current.entries.push(e);
    }
  });
  return groups;
}

// 알림창 한 줄이 어느 카드/대화에서 온 건지 보여주는 짧은 문구. 이미
// 메모리에 있는 카드 목록(loadedCards 등)에서 바로 찾아 쓰기 때문에
// Firestore를 추가로 읽지 않습니다.
const NOTIF_SECTION_LABEL = {
  x: "X(Twitter)",
  kakao: "KakaoTalk",
  sumone: "SumOne",
};
function getNotifContextLabel(section) {
  return NOTIF_SECTION_LABEL[section] || "";
}

// 알림창엔 확인(보기 버튼 클릭) 여부와 상관없이, 각 알림이 생긴 지 20일이
// 지나면 그때 사라지고, 말풍선/커피/와인을 다 합쳐서 최신 15개만 남기고
// 나머지(오래된 것)는 버립니다 — 확인 표시(점, 보기 버튼 강조색)는 이것과
// 별개로 그대로 유지됩니다.
const NOTIF_MAX_ROWS = 15;

function buildNotifRows() {
  const visible = notifEntriesCache.filter(isNotifEntryVisible);
  const rows = []; // { type, time, section, cardId }
  const now = Date.now();

  // 커피/와인: 코멘트 하나하나가 각자 한 줄, 생긴 지 20일 안 됐으면 계속 뜸.
  visible
    .filter((e) => e.type === "coffee" || e.type === "wine")
    .forEach((e) => {
      if (now - e.createdAt >= NOTIF_EXPIRE_MS) return;
      rows.push({ type: e.type, time: e.createdAt, section: e.section, cardId: e.cardId });
    });

  // 말풍선: 화면(섹션) 단위로 묶어서, 그 화면 안 어느 카드/트윗에 달렸든
  // 7일 이내 묶음은 한 줄로. 그 줄이 사라지는 시점은 묶음 안 가장 최근
  // 코멘트를 기준으로 20일입니다.
  const bySection = new Map();
  visible
    .filter((e) => e.type === "message-circle")
    .forEach((e) => {
      if (!bySection.has(e.section)) bySection.set(e.section, []);
      bySection.get(e.section).push(e);
    });
  bySection.forEach((list, section) => {
    list.sort((a, b) => a.createdAt - b.createdAt);
    const groups = coalesceMessageCircleEntries(list);
    groups.forEach((g) => {
      if (now - g.lastAt >= NOTIF_EXPIRE_MS) return;
      const lastEntry = g.entries[g.entries.length - 1];
      rows.push({ type: "message-circle", time: g.lastAt, section, cardId: lastEntry.cardId });
    });
  });

  rows.sort((a, b) => b.time - a.time);
  return rows.slice(0, NOTIF_MAX_ROWS);
}

function renderNotifPanel() {
  const rows = buildNotifRows();
  notifPanelList.innerHTML = "";
  notifPanelEmpty.hidden = rows.length > 0;
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "notif-item";

    const body = document.createElement("div");
    body.className = "notif-item-body";
    const contextLabel = getNotifContextLabel(row.section);
    if (contextLabel) {
      const context = document.createElement("p");
      context.className = "notif-item-context";
      context.textContent = contextLabel;
      body.appendChild(context);
    }
    const text = document.createElement("p");
    text.className = "notif-item-text";
    text.textContent = NOTIF_TEXT_BY_TYPE[row.type] || NOTIF_TEXT_BY_TYPE["message-circle"];
    const time = document.createElement("p");
    time.className = "notif-item-time";
    time.textContent = formatRelativeTime(row.time);
    body.append(text, time);

    const icon = document.createElement("span");
    icon.className = "notif-item-icon";
    icon.innerHTML = COMMENT_TYPE_ICONS[row.type] || MESSAGE_CIRCLE_ICON_SVG;

    item.append(icon, body);
    notifPanelList.appendChild(item);
  });
}

async function openNotifPanel(anchorBtn) {
  await loadNotifEntries(); // 열 때마다 최신 상태로 다시 불러옵니다.
  renderNotifPanel();
  notifPanel.hidden = false;
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  if (isDesktop) {
    const rect = anchorBtn.getBoundingClientRect();
    notifPanel.classList.add("desktop-anchored");
    notifPanel.style.top = rect.bottom + 8 + "px";
    notifPanel.style.right = window.innerWidth - rect.right + "px";
    notifBackdrop.hidden = true;
  } else {
    notifPanel.classList.remove("desktop-anchored");
    notifPanel.style.top = "";
    notifPanel.style.right = "";
    notifBackdrop.hidden = false;
  }
  // 벨 아이콘 점은 알림창(목록)과 별개로, "알림창을 열어봤는지"만 봅니다.
  // 목록 안의 줄(커피/와인/말풍선 전부)은 그 코멘트를 직접 열어야 없어지지만,
  // 벨 점 자체는 알림창을 여는 순간 사라집니다.
  markBellSeen();
  updateNotifBellDots();
}
function closeNotifPanel() {
  notifPanel.hidden = true;
  notifBackdrop.hidden = true;
}

notifBellBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!notifPanel.hidden) {
      closeNotifPanel();
      return;
    }
    openNotifPanel(btn);
  });
});
notifBackdrop.addEventListener("click", closeNotifPanel);
document.addEventListener("click", (e) => {
  if (notifPanel.hidden) return;
  if (notifPanel.contains(e.target)) return;
  if (Array.from(notifBellBtns).some((b) => b.contains(e.target))) return;
  closeNotifPanel();
});
