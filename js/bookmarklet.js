// X(트위터) 대화 페이지에서 실행되는 캡처 로직.
//
// 이 파일 자체는 하나의 익명 함수 표현식입니다: (mode) => "start" | "finish" 를 받아 동작합니다.
// bookmarklet.html이 이 파일의 텍스트를 그대로 읽어서 북마클릿 링크(javascript: URI) 안에
// 통째로 박아 넣습니다.
//
// 왜 이렇게 하냐면: X는 페이지 안에서 외부 도메인 스크립트를 <script src="...">로 불러오는 걸
// 보안 정책(CSP)으로 막고 있습니다. 그래서 "외부 스크립트를 불러와서 실행"하는 방식은 X에서
// 동작하지 않고, 코드 전체를 북마클릿 안에 직접 담아야 실제로 실행됩니다.

(function (mode) {
  const STORE_KEY = "__memoriesXBackupStore";
  const OBSERVER_KEY = "__memoriesXBackupObserver";
  if (!window[STORE_KEY]) window[STORE_KEY] = new Map();
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

  function extractImages(article) {
    const imgs = article.querySelectorAll('img[src*="pbs.twimg.com/media"]');
    const urls = [];
    imgs.forEach((img) => {
      if (img.src && urls.indexOf(img.src) === -1) urls.push(img.src);
    });
    return urls;
  }

  function extractTweets() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    let added = 0;

    // X는 같은 사람이 연속으로 올린 스레드에서 첫 트윗에만 프사/이름을 보여주고
    // 뒤이은 트윗은 내용만 보여줍니다(연결선만 있음). 그래서 이 셋이 전부 비어있으면
    // 바로 앞에서 인식한 작성자 정보를 그대로 이어받습니다.
    const existing = Array.from(store.values());
    let lastKnown = existing.length
      ? {
          avatar: existing[existing.length - 1].avatar,
          nickname: existing[existing.length - 1].nickname,
          handle: existing[existing.length - 1].handle,
        }
      : { avatar: "", nickname: "", handle: "" };

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
        let avatar = avatarImg ? avatarImg.src : "";

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

        if (!avatar && !nickname && !handle) {
          avatar = lastKnown.avatar;
          nickname = lastKnown.nickname;
          handle = lastKnown.handle;
        } else {
          lastKnown = { avatar, nickname, handle };
        }

        const textEl = article.querySelector('div[data-testid="tweetText"]');
        const text = textEl ? textEl.innerText : "";

        const { dateDisplay, dateSort } = extractDate(timeEl);
        const images = extractImages(article);

        store.set(id, {
          _order: store.size,
          avatar,
          nickname,
          handle,
          dateDisplay,
          dateSort,
          text,
          images,
        });
        added++;
      } catch (err) {
        console.error("[memories backup] 캡처 중 오류", err);
      }
    });

    return { added, total: articles.length };
  }

  if (mode === "start") {
    if (window[OBSERVER_KEY]) window[OBSERVER_KEY].disconnect();
    const result = extractTweets();
    const observer = new MutationObserver(() => extractTweets());
    observer.observe(document.body, { childList: true, subtree: true });
    window[OBSERVER_KEY] = observer;

    if (result.total === 0) {
      alert(
        "⚠️ 캡처를 시작했지만 이 화면에서 트윗을 하나도 찾지 못했어요.\n" +
          "X의 대화(스레드/DM) 화면이 맞는지 확인 후 다시 눌러주세요."
      );
    } else {
      alert(
        "✅ 캡처를 시작했어요!\n지금까지 " + store.size + "개 메시지 인식됨.\n\n" +
          "이제 천천히 끝까지 스크롤해주세요.\n다 되면 \"② 캡처 완료\"를 눌러주세요."
      );
    }
  } else if (mode === "finish") {
    extractTweets();
    if (window[OBSERVER_KEY]) {
      window[OBSERVER_KEY].disconnect();
      window[OBSERVER_KEY] = null;
    }

    if (store.size === 0) {
      alert(
        "⚠️ 저장된 메시지가 없어요.\n" +
          "먼저 \"① 캡처 시작\"을 누르고 대화 화면에서 스크롤한 다음 다시 시도해주세요."
      );
      return;
    }

    const messages = Array.from(store.values())
      .sort((a, b) => a._order - b._order)
      .map(({ _order, ...rest }) => rest);
    const json = JSON.stringify(messages, null, 2);

    const done = () => {
      alert(
        "✅ 캡처 완료! 총 " + messages.length + "개 메시지를 클립보드에 복사했어요.\n" +
          "memories 앱의 \"새 대화 추가\"에 붙여넣어주세요."
      );
      store.clear();
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(done).catch(() => {
        window.prompt(
          "⚠️ 클립보드 복사에 실패했어요. 아래 내용을 전체 선택(Ctrl/Cmd+A) 후 복사(Ctrl/Cmd+C)하세요:",
          json
        );
        store.clear();
      });
    } else {
      window.prompt(
        "복사된 내용을 전체 선택(Ctrl/Cmd+A) 후 복사(Ctrl/Cmd+C)하세요:",
        json
      );
      store.clear();
    }
  } else {
    alert("알 수 없는 모드입니다: " + mode);
  }
})
