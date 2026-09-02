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

  // X는 이모지를 실제 문자가 아니라 작은 <img alt="😀"> 아이콘으로 그려서, 그냥
  // innerText로 읽으면 이모지가 통째로 사라집니다. 그래서 직접 노드를 순회하면서
  // <img>는 alt(원래 이모지 문자)로, <br>은 줄바꿈으로 치환해 텍스트를 만듭니다.
  function extractText(container) {
    if (!container) return "";
    let text = "";
    container.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === "IMG") {
          text += node.getAttribute("alt") || "";
        } else if (node.tagName === "BR") {
          text += "\n";
        } else {
          text += extractText(node);
        }
      }
    });
    return text;
  }

  function extractTweets() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    let added = 0;

    // X는 같은 사람이 연속으로 올린 스레드나 스크롤 중엔 프사/이름 중 일부만 누락되기도
    // 합니다. 그래서 항목별로 비어있으면 바로 앞에서 인식한 작성자 정보를 이어받습니다.
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

        const avatarImg = article.querySelector('img[src*="profile_images"]');
        const avatarNow = avatarImg ? avatarImg.src : "";

        if (store.has(id)) {
          // 이미 저장된 트윗이라도, 그때는 프사 이미지가 아직 안 뜬 상태였는데
          // 지금은 로드됐을 수 있어서 비어있으면 다시 채워봅니다.
          const existingEntry = store.get(id);
          if (!existingEntry.avatar && avatarNow) {
            existingEntry.avatar = avatarNow;
          }
          return;
        }

        let avatar = avatarNow;

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

        // 프사/닉네임/아이디는 서로 독립적으로 인식이 실패할 수 있어서, 각각 따로
        // 비어있을 때만 직전 값을 이어받습니다 (예: 닉네임은 잡히는데 프사만 안 잡히는 경우 대응).
        if (!avatar) avatar = lastKnown.avatar;
        if (!nickname) nickname = lastKnown.nickname;
        if (!handle) handle = lastKnown.handle;
        lastKnown = {
          avatar: avatar || lastKnown.avatar,
          nickname: nickname || lastKnown.nickname,
          handle: handle || lastKnown.handle,
        };

        const textEl = article.querySelector('div[data-testid="tweetText"]');
        const text = extractText(textEl);

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
    // attributes: true로 프사 <img>의 src가 나중에(비동기로) 채워지는 경우도 감지합니다.
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
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
