const LOADING_MSGS = [
  "분석하는 중",
  "코디 찾는 중",
  "업사이클링 탐색 중",
  "거의 다 됐어요",
];
const sel = { type: null, material: null, reason: null, color: null };
let imageFile = null,
  currentResult = null,
  saved = false;
let closet = JSON.parse(localStorage.getItem("wardrobe_closet") || "[]");

function resetUploadArea() {
  document.getElementById("colorRow").style.display = "";
  document.getElementById("uploadArea").innerHTML =
    '<div class="upload-area" id="uploadBox"><div class="upload-icon">↑</div><div class="upload-label">사진 올리기</div><div class="upload-sub">옷을 직접 보고 분석해드릴게요</div></div><input type="file" id="fileInput" accept="image/*" style="display:none"/>';
  document.getElementById("uploadBox").addEventListener("click", function () {
    document.getElementById("fileInput").click();
  });
  document.getElementById("fileInput").addEventListener("change", handleFile);
}

function handleFile(e) {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  imageFile = file;
  const url = URL.createObjectURL(file);
  document.getElementById("colorRow").style.display = "none";
  document.getElementById("uploadArea").innerHTML =
    '<div class="img-preview"><img src="' +
    url +
    '" alt="업로드"/><button class="img-remove" id="removeImg">X</button></div>';
  document.getElementById("removeImg").addEventListener("click", function () {
    imageFile = null;
    resetUploadArea();
  });
}

document.getElementById("uploadBox").addEventListener("click", function () {
  document.getElementById("fileInput").click();
});
document.getElementById("fileInput").addEventListener("change", handleFile);

document.querySelectorAll(".chip").forEach(function (c) {
  c.addEventListener("click", function () {
    document
      .querySelectorAll('[data-group="' + this.dataset.group + '"]')
      .forEach(function (x) {
        x.classList.remove("active");
      });
    this.classList.add("active");
    sel[this.dataset.group] = this.textContent.trim();
  });
});

document.querySelectorAll(".swatch").forEach(function (s) {
  s.addEventListener("click", function () {
    document.querySelectorAll(".swatch").forEach(function (x) {
      x.classList.remove("active");
    });
    this.classList.add("active");
    sel.color = this.dataset.color;
    document.getElementById("colorText").value = "";
  });
});

document.getElementById("colorText").addEventListener("input", function () {
  document.querySelectorAll(".swatch").forEach(function (s) {
    s.classList.remove("active");
  });
  sel.color = this.value;
});

async function detectMediaType(file) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46)
    return "image/webp";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  return "image/jpeg";
}

function toBase64(file) {
  return new Promise(function (res, rej) {
    const r = new FileReader();
    r.onload = function () {
      res(r.result.split(",")[1]);
    };
    r.onerror = function () {
      rej(new Error("파일 읽기 실패"));
    };
    r.readAsDataURL(file);
  });
}

function parseResult(text) {
  const coordSection = (text.match(
    /\[코디추천\]([\s\S]*?)(?=\[업사이클링\]|$)/,
  ) || ["", ""])[1].trim();
  const upcycleSection = (text.match(/\[업사이클링\]([\s\S]*?)$/) || [
    "",
    "",
  ])[1].trim();
  const coords = coordSection
    .split(/\n(?=\d+\.)/)
    .filter(Boolean)
    .slice(0, 3)
    .map(function (s) {
      return s.replace(/^\d+\.\s*/, "").trim();
    });
  const upcycles = upcycleSection
    .split(/\n(?=\d+\.)/)
    .filter(Boolean)
    .slice(0, 2)
    .map(function (s) {
      const lines = s
        .replace(/^\d+\.\s*/, "")
        .trim()
        .split("\n")
        .filter(Boolean);
      const title = lines[0];
      const rest = lines.slice(1).join(" ");
      const dm = rest.match(/난이도[:\s]*(쉬움|보통|어려움)/);
      return {
        title: title,
        desc: rest.replace(/난이도[:\s]*(쉬움|보통|어려움)[.,\s]*/g, "").trim(),
        diff: dm ? dm[1] : "",
      };
    });
  return {
    coords: coords.length ? coords : [coordSection],
    upcycles: upcycles.length
      ? upcycles
      : [{ title: "업사이클링", desc: upcycleSection, diff: "" }],
  };
}

function showPhase(phase) {
  document.getElementById("formSection").style.display =
    phase === "form" ? "block" : "none";
  document.getElementById("loadingState").style.display =
    phase === "loading" ? "block" : "none";
  document.getElementById("errorState").style.display =
    phase === "error" ? "block" : "none";
  document.getElementById("resultSection").style.display =
    phase === "result" ? "block" : "none";
}

async function analyze() {
  if (!sel.reason) {
    alert("안 입는 이유를 선택해주세요!");
    return;
  }
  showPhase("loading");
  let mi = 0;
  const timer = setInterval(function () {
    mi = (mi + 1) % LOADING_MSGS.length;
    const el = document.getElementById("loadingText");
    el.style.opacity = "0";
    setTimeout(function () {
      el.textContent = LOADING_MSGS[mi];
      el.style.opacity = "1";
    }, 200);
  }, 1800);

  const colorVal = document.getElementById("colorText").value || sel.color;
  const desc = document.getElementById("description").value;
  const prompt =
    "당신은 패션 스타일리스트이자 업사이클링 전문가입니다.\n" +
    (imageFile ? "첨부된 사진의 옷을 분석해주세요.\n" : "") +
    "아래 정보를 참고해 한국어로 조언해주세요.\n\n옷 정보:\n" +
    "- 종류: " +
    (sel.type || (imageFile ? "사진 참고" : "미상")) +
    "\n" +
    "- 색상: " +
    (colorVal || (imageFile ? "사진 참고" : "미상")) +
    "\n" +
    "- 소재: " +
    (sel.material || "미상") +
    "\n" +
    "- 안 입는 이유: " +
    sel.reason +
    "\n" +
    "- 추가 설명: " +
    (desc || "없음") +
    "\n\n" +
    "아래 형식으로 정확히 답변하세요. 각 항목은 1-2문장으로 간결하게 써주세요.\n\n" +
    "[코디추천]\n1. (스타일명): 한두 문장\n2. (스타일명): 한두 문장\n3. (스타일명): 한두 문장\n\n" +
    "[업사이클링]\n1. (아이템명)\n난이도: 쉬움/보통/어려움\n한두 문장\n\n2. (아이템명)\n난이도: 쉬움/보통/어려움\n한두 문장";

  try {
    const res = await fetch(
      "https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer r97fGStawn0rX2QenegVGVUK5E9JQWbF",
        },
        body: JSON.stringify({
          model: "gpt-5.4-nano",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      },
    );
    const data = await res.json();
    if (!res.ok || !data.choices || !data.choices[0])
      throw new Error(
        (data.error && data.error.message) || "오류 " + res.status,
      );
    const parsed = parseResult(data.choices[0].message.content);

    currentResult = Object.assign({}, parsed, {
      type: sel.type,
      color: colorVal,
      material: sel.material,
      reason: sel.reason,
      date: new Date().toLocaleDateString("ko-KR"),
      id: Date.now(),
      imageUrl: imageFile ? URL.createObjectURL(imageFile) : null,
    });
    saved = false;
    clearInterval(timer);

    const tags = [sel.type, colorVal, sel.material, sel.reason].filter(Boolean);
    document.getElementById("resultTags").innerHTML = tags
      .map(function (t) {
        return '<span class="result-tag">' + t + "</span>";
      })
      .join("");
    document.getElementById("resultImg").innerHTML = currentResult.imageUrl
      ? '<img src="' + currentResult.imageUrl + '"/>'
      : "";
    document.getElementById("coordContent").innerHTML = parsed.coords
      .map(function (c, i) {
        return (
          '<div class="coord-item"><span class="coord-num">0' +
          (i + 1) +
          '</span><span class="coord-text">' +
          c +
          "</span></div>"
        );
      })
      .join("");
    document.getElementById("upcycleContent").innerHTML = parsed.upcycles
      .map(function (u) {
        return (
          '<div class="upcycle-item">' +
          (u.diff ? '<span class="badge">난이도 ' + u.diff + "</span>" : "") +
          '<div class="upcycle-title">' +
          u.title +
          '</div><div class="upcycle-desc">' +
          u.desc +
          "</div></div>"
        );
      })
      .join("");

    document.getElementById("resultTitle").style.display = "";
    document.getElementById("resultActions").innerHTML =
      '<button class="btn-save" id="saveBtn">내 옷장에 저장</button>' +
      '<button class="btn-reset" id="resetBtn">다른 옷 분석하기</button>';
    document.getElementById("saveBtn").addEventListener("click", saveToCloset);
    document.getElementById("resetBtn").addEventListener("click", reset);

    showPhase("result");
    setTimeout(function () {
      document.getElementById("coordCard").classList.add("visible");
      document.getElementById("upcycleCard").classList.add("visible");
    }, 80);
  } catch (err) {
    clearInterval(timer);
    document.getElementById("errorMsg").textContent = err.message;
    showPhase("error");
  }
}

function reset() {
  sel.type = sel.material = sel.reason = sel.color = null;
  imageFile = null;
  currentResult = null;
  saved = false;
  document.querySelectorAll(".chip").forEach(function (c) {
    c.classList.remove("active");
  });
  document.querySelectorAll(".swatch").forEach(function (s) {
    s.classList.remove("active");
  });
  document.getElementById("colorText").value = "";
  document.getElementById("description").value = "";
  document.getElementById("coordCard").classList.remove("visible");
  document.getElementById("upcycleCard").classList.remove("visible");
  resetUploadArea();
  showPhase("form");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveToCloset() {
  if (!currentResult || saved) return;
  closet.unshift(currentResult);
  localStorage.setItem("wardrobe_closet", JSON.stringify(closet));
  saved = true;
  const btn = document.getElementById("saveBtn");
  if (btn) {
    btn.textContent = "저장됐어요 ✓";
    btn.classList.add("saved");
  }
}

function closeCloset() {
  document.getElementById("overlay").classList.remove("open");
}
function closeClosetView() {
  showPhase("form");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openCloset() {
  const list = document.getElementById("closetList");
  if (!closet.length) {
    list.innerHTML =
      '<div class="closet-empty">아직 저장된 옷이 없어요<br/><br/>분석 후 저장하면 여기에 모여요</div>';
  } else {
    list.innerHTML = closet
      .map(function (item) {
        return (
          '<div class="closet-item" data-id="' +
          item.id +
          '">' +
          (item.imageUrl
            ? '<img src="' +
              item.imageUrl +
              '" style="width:44px;height:44px;object-fit:cover;margin-right:12px;flex-shrink:0;">'
            : "") +
          '<span class="closet-name">' +
          (item.type || "") +
          (item.color ? " · " + item.color : "") +
          "</span>" +
          '<div class="closet-meta">' +
          [item.material, item.reason]
            .filter(Boolean)
            .map(function (t) {
              return '<span class="closet-chip">' + t + "</span>";
            })
            .join("") +
          '<span class="closet-date">' +
          item.date +
          "</span>" +
          '<button class="delete-btn" data-id="' +
          item.id +
          '" style="margin-left:8px;font-size:.7rem;color:var(--g3);background:none;border:none;cursor:pointer;">X</button>' +
          "</div></div>"
        );
      })
      .join("");
    document.querySelectorAll(".closet-item").forEach(function (el) {
      el.addEventListener("click", function () {
        loadItem(Number(el.dataset.id));
      });
    });
    document.querySelectorAll(".delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        closet = closet.filter(function (i) {
          return i.id !== Number(btn.dataset.id);
        });
        localStorage.setItem("wardrobe_closet", JSON.stringify(closet));
        openCloset();
      });
    });
  }
  document.getElementById("overlay").classList.add("open");
}

function loadItem(id) {
  const item = closet.find(function (i) {
    return i.id === id;
  });
  if (!item) return;
  closeCloset();
  currentResult = item;
  saved = true;
  const tags = [item.type, item.color, item.material, item.reason].filter(
    Boolean,
  );
  document.getElementById("resultTags").innerHTML = tags
    .map(function (t) {
      return '<span class="result-tag">' + t + "</span>";
    })
    .join("");
  document.getElementById("resultImg").innerHTML = item.imageUrl
    ? '<img src="' + item.imageUrl + '"/>'
    : "";
  document.getElementById("coordContent").innerHTML = (item.coords || [])
    .map(function (c, i) {
      return (
        '<div class="coord-item"><span class="coord-num">0' +
        (i + 1) +
        '</span><span class="coord-text">' +
        c +
        "</span></div>"
      );
    })
    .join("");
  document.getElementById("upcycleContent").innerHTML = (item.upcycles || [])
    .map(function (u) {
      return (
        '<div class="upcycle-item">' +
        (u.diff ? '<span class="badge">난이도 ' + u.diff + "</span>" : "") +
        '<div class="upcycle-title">' +
        u.title +
        '</div><div class="upcycle-desc">' +
        u.desc +
        "</div></div>"
      );
    })
    .join("");
  document.getElementById("coordCard").classList.remove("visible");
  document.getElementById("upcycleCard").classList.remove("visible");
  document.getElementById("resultTitle").style.display = "none";
  document.getElementById("resultActions").innerHTML =
    '<button class="btn-reset" onclick="closeClosetView()">옷장 닫기</button>';
  showPhase("result");
  setTimeout(function () {
    document.getElementById("coordCard").classList.add("visible");
    document.getElementById("upcycleCard").classList.add("visible");
  }, 80);
}

document.getElementById("analyzeBtn").addEventListener("click", analyze);
document.getElementById("retryBtn").addEventListener("click", function () {
  showPhase("form");
});
document.getElementById("closetBtn").addEventListener("click", openCloset);
document.getElementById("modalClose").addEventListener("click", closeCloset);
document.getElementById("overlay").addEventListener("click", function (e) {
  if (e.target === this) closeCloset();
});
