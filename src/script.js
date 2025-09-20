// Real Man Markdown JavaScript

// 압축 감지 및 해제 함수
function decompressData(data) {
  if (!data) return "";

  // 입력 데이터 길이 제한 (메모리 공격 방지)
  if (data.length > 100000) {
    console.warn("입력 데이터가 너무 큽니다.");
    return "";
  }

  try {
    // 먼저 LZ-String 압축 해제 시도
    const decompressed = LZString.decompressFromEncodedURIComponent(data);
    if (decompressed !== null && decompressed !== "") {
      // 해제된 내용 크기 제한
      if (decompressed.length > 1000000) {
        console.warn("해제된 데이터가 너무 큽니다.");
        return "";
      }
      return decompressed;
    }
  } catch (e) {
    // LZ-String 해제 실패시 무시
    console.warn("LZ-String 해제 실패:", e.message);
  }

  try {
    // URL 디코딩 시도
    const urlDecoded = decodeURIComponent(data);

    // 해제된 내용 크기 제한
    if (urlDecoded.length > 1000000) {
      console.warn("URL 디코딩된 데이터가 너무 큽니다.");
      return "";
    }

    // URL 디코딩 성공시 유효성 체크
    // 영문자, 숫자, 한글이 포함되어 있거나 마크다운 문법이 있으면 유효한 것으로 판단
    if (/[a-zA-Z0-9가-힣#*_`\[\](){}>\-+\n]/.test(urlDecoded)) {
      return urlDecoded;
    }
  } catch (e) {
    // URL 디코딩 실패시 무시
    console.warn("URL 디코딩 실패:", e.message);
  }

  // 너무 짧고 의미없는 문자열은 빈 문자열 반환
  return "";
}

// 최적 압축 방법 선택 함수
function getOptimalEncoding(text) {
  if (!text) return { data: "", method: "none" };

  // 입력 텍스트 크기 제한 (1MB)
  if (text.length > 1000000) {
    throw new Error("입력 텍스트가 너무 큽니다. 1MB 이하로 제한됩니다.");
  }

  // LZ-String 압축 시도
  const compressed = LZString.compressToEncodedURIComponent(text);

  // URL 인코딩 시도
  const urlEncoded = encodeURIComponent(text);

  // 더 짧은 것을 선택
  if (compressed.length <= urlEncoded.length) {
    return { data: compressed, method: "lz" };
  } else {
    return { data: urlEncoded, method: "url" };
  }
}

// 마크다운 렌더링 공통 함수
function renderMarkdown() {
  const fragment = window.location.hash;
  const data = fragment.substring(1);

  if (fragment && data) {
    const markdownText = decompressData(data);

    // 유효하지 않은 해시값인 경우 편집 모드로 전환
    if (!markdownText) {
      document.getElementById("textarea").style.display = "block";
      document.getElementById("markdown").style.display = "none";
      // 해시를 제거하여 깨끗한 상태로 만듦
      window.history.replaceState(null, null, window.location.pathname);
      // 편집 모드로 전환 시 버튼 토글
      document.getElementById("edit").style.display = "none";
      document.getElementById("done").style.display = "inline-block";
      return;
    }

    // Marked 최신 버전(v15+) 설정
    // Extension API를 사용한 렌더링 처리
    marked.use({
      extensions: [
        {
          name: "mermaid",
          level: "block",
          start(src) {
            return src.match(/^```mermaid/)?.index;
          },
          tokenizer(src) {
            const match = src.match(/^```mermaid\n([\s\S]*?)\n```/);
            if (match) {
              const [whole, content] = match;
              return {
                type: "mermaid",
                raw: whole,
                content: content.trim(),
                tokens: [],
              };
            }
            return undefined;
          },
          renderer(token) {
            // mermaid 코드 검증 및 정리
            const cleanCode = token.content.trim().replace(/^\s+/gm, "");

            // 위험한 키워드 필터링 (XSS 방지)
            const dangerousPatterns = [
              /<script[^>]*>[\s\S]*?<\/script>/gi,
              /javascript:/gi,
              /onclick/gi,
              /onload/gi,
              /onerror/gi,
              /eval\s*\(/gi,
              /function\s*\(/gi,
            ];

            let safeCode = cleanCode;
            dangerousPatterns.forEach((pattern) => {
              safeCode = safeCode.replace(pattern, "");
            });

            // 안전한 mermaid 코드만 허용
            if (safeCode !== cleanCode) {
              console.warn("위험한 mermaid 코드가 감지되어 제거되었습니다.");
            }

            return `<div class="mermaid">${safeCode}</div>`;
          },
        },
      ],
    });

    // mermaid 초기화 - 보안 강화 및 로깅 완전 억제
    mermaid.initialize({
      startOnLoad: false, // 수동으로 실행할 것이므로 false로 설정
      theme: "default",
      securityLevel: "strict", // 보안 레벨을 strict로 강화
      fontFamily: "Arial, sans-serif",
      logLevel: 0, // 0: 에러, 1: 경고, 2: 정보, 3: 디버그
      silent: true, // 대부분의 로그 출력을 억제
      // 추가 보안 설정
      htmlLabels: false, // HTML 라벨 비활성화
      maxTextSize: 50000, // 텍스트 크기 제한
    });

    // 마크다운을 HTML로 변환 (최신 버전 방식으로 수정)
    const html = marked.parse(markdownText);

    // DOMPurify를 사용하여 XSS 공격 방지
    const sanitizedHtml = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "br",
        "strong",
        "em",
        "del",
        "s",
        "a",
        "img",
        "code",
        "pre",
        "blockquote",
        "ul",
        "ol",
        "li",
        "hr",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "div",
        "span",
        "sub",
        "sup",
        "mark",
        "small",
        "b",
        "i",
        "u",
      ],
      ALLOWED_ATTR: [
        "href",
        "src",
        "alt",
        "title",
        "width",
        "height",
        "class",
        "id",
        "align",
        "style",
        "data-lang",
        "data-language",
      ],
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_TRUSTED_TYPE: false,
    });

    document.getElementById("markdown").innerHTML = sanitizedHtml;
    document.getElementById("markdown").style.display = "block";
    document.getElementById("textarea").style.display = "none";

    // 마크다운 보기 모드로 UI 업데이트
    document.getElementById("edit").style.display = "inline-block";
    document.getElementById("done").style.display = "none";

    // mermaid 다이어그램 렌더링
    setTimeout(() => {
      try {
        console.log("Mermaid 요소 검색 및 실행...");
        const diagrams = document.querySelectorAll(".mermaid");
        console.log(`발견된 Mermaid 다이어그램 수: ${diagrams.length}`);

        if (diagrams.length > 0) {
          mermaid.run();
        }
      } catch (e) {
        console.error("Mermaid 렌더링 에러:", e);
      }

      // Prism.js 코드 하이라이팅 적용
      try {
        if (typeof Prism !== "undefined") {
          Prism.highlightAll();
          console.log("Prism.js 코드 하이라이팅 완료");
        }
      } catch (e) {
        console.error("Prism.js 하이라이팅 에러:", e);
      }
    }, 200); // 시간을 좀 더 늘려줍니다
  } else {
    document.getElementById("textarea").style.display = "block";
    document.getElementById("markdown").style.display = "none";

    // 편집 모드에서는 Edit/Done 버튼 토글
    document.getElementById("edit").style.display = "none";
    document.getElementById("done").style.display = "inline-block";
  }
}

// 초기 페이지 로드시 실행
document.addEventListener("DOMContentLoaded", function () {
  // 마크다운 렌더링
  renderMarkdown();

  // Edit 버튼 - 마크다운 편집 모드로 전환
  document.getElementById("edit").addEventListener("click", function () {
    // 편집 모드로 전환
    const currentMarkdown =
      decompressData(window.location.hash.substring(1)) || "";
    document.getElementById("textarea").value = currentMarkdown;

    // UI 업데이트
    document.getElementById("markdown").style.display = "none";
    document.getElementById("textarea").style.display = "block";
    document.getElementById("edit").style.display = "none";
    document.getElementById("done").style.display = "inline-block";
  });

  // Done 버튼 - 마크다운 저장 및 링크 생성
  document.getElementById("done").addEventListener("click", function () {
    // 마크다운 저장 및 링크 생성
    const markdown = document.getElementById("textarea").value;
    if (!markdown.trim()) {
      alert("마크다운 내용을 입력해주세요.");
      return;
    }

    try {
      // 최적 압축 방법 선택 및 URL 해시로 저장
      const { data: compressed } = getOptimalEncoding(markdown);
      window.location.hash = compressed;

      // 링크 복사
      navigator.clipboard.writeText(location.href).then(
        function () {
          alert("링크가 복사되었습니다.");
        },
        function (err) {
          console.error("링크 복사 실패:", err);
          alert("링크 복사에 실패했습니다. URL을 수동으로 복사해주세요.");
        }
      );

      // 페이지 리로드하여 마크다운 렌더링
      window.location.reload();
    } catch (error) {
      console.error("압축 처리 에러:", error);
      alert("텍스트 처리 중 오류가 발생했습니다: " + error.message);
    }
  });

  // Make Link & Copy 버튼 제거됨

  // Download 버튼 - 마크다운 파일로 다운로드
  document.getElementById("download").addEventListener("click", function () {
    // 현재 hash에서 마크다운 복원 (새로운 압축 해제 함수 사용)
    const currentMarkdown = decompressData(window.location.hash.substring(1));

    if (!currentMarkdown) {
      alert("다운로드할 마크다운 내용이 없습니다.");
      return;
    }

    // 다운로드용 임시 링크 생성
    const blob = new Blob([currentMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    // 다운로드 속성 설정
    a.href = url;
    a.download = "markdown_" + new Date().toISOString().slice(0, 10) + ".md";

    // 링크 클릭 실행 및 정리
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // 해시 변경 이벤트에 렌더링 함수 연결
  window.addEventListener("hashchange", function () {
    renderMarkdown();
  });
});
