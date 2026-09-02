// X(트위터) 대화 페이지에서 실행되는 캡처 스크립트.
// bookmarklet.html의 북마클릿이 이 파일을 <script> 태그로 불러와 실행합니다.
// window.__xBackupMode 값("start" | "finish")에 따라 동작이 달라집니다.

(function () {
  const STORE_KEY = "__xBackupStore";
  if (!window[STORE_KEY]) {
    window[STORE_KEY] = new Map();
  }
  const store = window[STORE_KEY];

  function extractDate(timeEl) {
    const datetime = timeEl.getAttribute("datetime");
    if (!datetime) return { dateDisplay: "", dateSort: "" };
    const d = new Date(datetime);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { dateDisplay: `${y}.${m}.${day}`, dateSort: `${y}-${m}-${day}` };
  }

  function extractTweets() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    let added = 0;

    articles.forEach((article) => {
      try {
        const timeEl = article.querySelector("time");
        if (!timeEl) return;

        const link = timeEl.closest("a");
        const href = link ? link.getAttribute("href") : null;
        const idMatch = href ? href.match(/status\/(\d+)/) : null;
        const id = idMatch ? idMatch[1] : href || timeEl.getAttribute("datetime") + Math.random();

        if (store.has(id)) return;

        const avatarImg = article.querySelector('img[src*="profile_images"]');
        const avatar = avatarImg ? avatarImg.src : "";

        const nameContainer = article.querySelector('div[data-testid="User-Name"]');
        let nickname = "";
        let handle = "";
        if (nameContainer) {
          nameContainer.querySelectorAll("span").forEach((span) => {
            const t = span.textContent.trim();
            if (t.startsWith("@") && !handle) handle = t;
          });
          const nameLink = nameContainer.querySelector("a");
          if (nameLink) nickname = nameLink.textContent.trim();
        }

        const textEl = article.querySelector('div[data-testid="tweetText"]');
        const text = textEl ? textEl.innerText : "";

        const { dateDisplay, dateSort } = extractDate(timeEl);

        store.set(id, {
          _order: store.size,
          avatar,
          nickname,
          handle,
          dateDisplay,
          dateSort,
          text,
        });
        added++;
      } catch (err) {
        console.error("[memories backup] 캡처 중 오류", err);
      }
    });

    return added;
  }

  const mode = window.__xBackupMode;

  if (mode === "start") {
    const added = extractTweets();
    if (window.__xBackupObserver) window.__xBackupObserver.disconnect();
    const observer = new MutationObserver(() => extractTweets());
    observer.observe(document.body, { childList: true, subtree: true });
    window.__xBackupObserver = observer;
    alert(
      `캡처를 시작했어요!\n지금까지 ${store.size}개 메시지 인식됨.\n\n이제 천천히 끝까지 스크롤해주세요.\n다 되면 "② 캡처 완료" 북마클릿을 눌러주세요.`
    );
  } else if (mode === "finish") {
    extractTweets();
    if (window.__xBackupObserver) {
      window.__xBackupObserver.disconnect();
      window.__xBackupObserver = null;
    }
    const messages = Array.from(store.values())
      .sort((a, b) => a._order - b._order)
      .map(({ _order, ...rest }) => rest);
    const json = JSON.stringify(messages, null, 2);

    const finish = () => {
      alert(`완료! 총 ${messages.length}개 메시지를 클립보드에 복사했어요.\nmemories 앱의 "새 대화 추가"에 붙여넣어주세요.`);
      store.clear();
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(finish).catch(() => {
        prompt("클립보드 복사에 실패했어요. 아래 내용을 직접 복사하세요:", json);
        store.clear();
      });
    } else {
      prompt("복사된 내용을 붙여넣으세요 (Ctrl/Cmd+C 후 확인):", json);
      store.clear();
    }
  } else {
    console.warn("[memories backup] 알 수 없는 모드:", mode);
  }
})();
