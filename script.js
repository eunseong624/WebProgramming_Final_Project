// ── 상태 ──
const sel = { type: null, material: null, reason: null, color: null };
let currentResult = null;

const loadingMsgs = [
  "AI가 옷을 분석하고 있어요...",
  "코디 조합을 생각하는 중...",
  "업사이클링 아이디어를 찾는 중...",
  "거의 다 됐어요! 잠깐만요...",
];

// ── 칩 토글 ──
function toggleChip(el, group) {
  document
    .querySelectorAll(`#chips-${group} .chip`)
    .forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  sel[group] = el.textContent.trim();
}

// ── 색상 스와치 ──
function selectColor(el, name) {
  document
    .querySelectorAll(".swatch")
    .forEach((s) => s.classList.remove("active"));
  el.classList.add("active");
  sel.color = name;
  document.getElementById("colorText").value = "";
}

function clearSwatches() {
  document
    .querySelectorAll(".swatch")
    .forEach((s) => s.classList.remove("active"));
  sel.color = document.getElementById("colorText").value;
}

// ── API 호출 ──
async function analyze() {
  if (!sel.type) {
    alert("옷 종류를 선택해주세요!");
    return;
  }
  if (!sel.reason) {
    alert("안 입는 이유를 선택해주세요!");
    return;
  }

  const colorVal = document.getElementById("colorText").value || sel.color;
  const desc = document.getElementById("description").value;

  // UI 전환
  document.getElementById("formSection").style.display = "none";
  document.getElementById("resultSection").style.display = "none";
  const loading = document.getElementById("loadingState");
  loading.style.display = "block";

  let mi = 0;
  const timer = setInterval(() => {
    mi = (mi + 1) % loadingMsgs.length;
    const el = document.getElementById("loadingText");
    el.style.opacity = "0";
    setTimeout(() => {
      el.textContent = loadingMsgs[mi];
      el.style.opacity = "1";
    }, 200);
  }, 1800);

  const prompt = `당신은 패션 스타일리스트이자 업사이클링 전문가입니다.
사용자의 옷 정보를 보고 실용적이고 따라하기 쉬운 조언을 한국어로 해주세요.

옷 정보:
- 종류: ${sel.type}
- 색상: ${colorVal || "미상"}
- 소재: ${sel.material || "미상"}
- 안 입는 이유: ${sel.reason}
- 추가 설명: ${desc || "없음"}

아래 형식으로 정확히 답변하세요. 마크다운 기호 없이 깔끔한 텍스트로만 작성하세요.

[코디추천]
이 옷을 활용한 새로운 코디 방법 3가지를 구체적으로 알려주세요. 어떤 아이템과 매치하면 좋은지, 어떤 분위기가 연출되는지 자세히 설명해주세요. 실용적이고 지금 트렌드에 맞는 스타일링을 추천해주세요.

[업사이클링]
이 옷을 새로운 아이템으로 만드는 방법 2가지를 알려주세요. 각각 난이도(쉬움/보통/어려움), 필요한 재료, 핵심 제작 과정을 설명해주세요.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBeSxAYlG_kbOPDu19a7bYDvPbupWZIGCo`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    const data = await res.json();
    const text = data.candidates[0].content.parts[0].text;

    const coordMatch = text.match(/\[코디추천\]([\s\S]*?)(?=\[업사이클링\]|$)/);
    const upcycleMatch = text.match(/\[업사이클링\]([\s\S]*?)$/);

    const coordText = coordMatch
      ? coordMatch[1].trim()
      : "코디 정보를 불러오지 못했어요.";
    const upcycleText = upcycleMatch
      ? upcycleMatch[1].trim()
      : "업사이클링 정보를 불러오지 못했어요.";

    currentResult = {
      type: sel.type,
      color: colorVal,
      material: sel.material,
      reason: sel.reason,
      description: desc,
      coord: coordText,
      upcycle: upcycleText,
      date: new Date().toLocaleDateString("ko-KR"),
      id: Date.now(),
    };

    clearInterval(timer);
    loading.style.display = "none";

    // 결과 태그
    const tags = [sel.type, colorVal, sel.material, sel.reason].filter(Boolean);
    document.getElementById("resultTags").innerHTML = tags
      .map((t) => `<span class="result-tag">${t}</span>`)
      .join("");

    document.getElementById("coordContent").textContent = coordText;
    document.getElementById("upcycleContent").textContent = upcycleText;
    document.getElementById("saveBtn").textContent = "💾 내 옷장에 저장";

    const rs = document.getElementById("resultSection");
    rs.style.display = "block";
    setTimeout(() => {
      document.getElementById("coordCard").classList.add("visible");
      document.getElementById("upcycleCard").classList.add("visible");
    }, 80);
    rs.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    clearInterval(timer);
    loading.style.display = "none";
    document.getElementById("formSection").style.display = "block";
    alert("오류가 발생했어요. 다시 시도해주세요.\n" + err.message);
  }
}

// ── 초기화 ──
function reset() {
  currentResult = null;
  sel.type = sel.material = sel.reason = sel.color = null;
  document
    .querySelectorAll(".chip")
    .forEach((c) => c.classList.remove("active"));
  document
    .querySelectorAll(".swatch")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("description").value = "";
  document.getElementById("colorText").value = "";
  document.getElementById("coordCard").classList.remove("visible");
  document.getElementById("upcycleCard").classList.remove("visible");
  document.getElementById("resultSection").style.display = "none";
  document.getElementById("formSection").style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── 저장 ──
function saveToCloset() {
  if (!currentResult) return;
  const closet = JSON.parse(localStorage.getItem("wardrobe_closet") || "[]");
  const exists = closet.find((i) => i.id === currentResult.id);
  if (!exists) {
    closet.unshift(currentResult);
    localStorage.setItem("wardrobe_closet", JSON.stringify(closet));
  }
  const btn = document.getElementById("saveBtn");
  btn.textContent = "✅ 저장됐어요!";
  btn.style.cssText = "border-color:#1E3A2F; color:#1E3A2F;";
  setTimeout(() => {
    btn.textContent = "💾 내 옷장에 저장";
    btn.style.cssText = "";
  }, 2200);
}

// ── 내 옷장 ──
function openCloset() {
  const closet = JSON.parse(localStorage.getItem("wardrobe_closet") || "[]");
  const list = document.getElementById("closetList");
  if (!closet.length) {
    list.innerHTML =
      '<div class="closet-empty">아직 저장된 옷이 없어요 👗<br><br>분석 후 저장하면 여기에 모여요!</div>';
  } else {
    list.innerHTML = closet
      .map(
        (item) => `
      <div class="closet-item" onclick="loadItem(${item.id})">
        <div class="closet-item-top">
          <span class="closet-item-name">${item.type}${item.color ? " · " + item.color : ""}${item.description ? " — " + item.description.slice(0, 22) + (item.description.length > 22 ? "..." : "") : ""}</span>
          <span class="closet-item-date">${item.date}</span>
        </div>
        <div class="closet-chips">
          ${[item.material, item.reason]
            .filter(Boolean)
            .map((t) => `<span class="closet-chip">${t}</span>`)
            .join("")}
        </div>
      </div>
    `,
      )
      .join("");
  }
  document.getElementById("overlay").classList.add("open");
}

function closeCloset() {
  document.getElementById("overlay").classList.remove("open");
}

function closeIfOverlay(e) {
  if (e.target.id === "overlay") closeCloset();
}

function loadItem(id) {
  const closet = JSON.parse(localStorage.getItem("wardrobe_closet") || "[]");
  const item = closet.find((i) => i.id === id);
  if (!item) return;
  closeCloset();

  currentResult = item;
  const tags = [item.type, item.color, item.material, item.reason].filter(
    Boolean,
  );
  document.getElementById("resultTags").innerHTML = tags
    .map((t) => `<span class="result-tag">${t}</span>`)
    .join("");
  document.getElementById("coordContent").textContent = item.coord;
  document.getElementById("upcycleContent").textContent = item.upcycle;
  document.getElementById("coordCard").classList.remove("visible");
  document.getElementById("upcycleCard").classList.remove("visible");
  document.getElementById("formSection").style.display = "none";
  const rs = document.getElementById("resultSection");
  rs.style.display = "block";
  setTimeout(() => {
    document.getElementById("coordCard").classList.add("visible");
    document.getElementById("upcycleCard").classList.add("visible");
  }, 80);
  rs.scrollIntoView({ behavior: "smooth" });
}
