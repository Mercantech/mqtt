(function () {
  const presentBtn = document.getElementById("presentBtn");
  const presentChrome = document.getElementById("presentChrome");
  const presentPrev = document.getElementById("presentPrev");
  const presentNext = document.getElementById("presentNext");
  const presentExit = document.getElementById("presentExit");
  const presentCounter = document.getElementById("presentCounter");
  const presentProgress = document.getElementById("presentProgress");
  const presentProgressBar = document.getElementById("presentProgressBar");

  const slides = [
    document.querySelector(".hero"),
    ...document.querySelectorAll("main > section"),
  ].filter(Boolean);

  let index = 0;
  let active = false;

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      el.isContentEditable
    );
  }

  function updateChrome() {
    presentCounter.textContent = `${index + 1} / ${slides.length}`;
    const pct = slides.length <= 1 ? 100 : (index / (slides.length - 1)) * 100;
    presentProgressBar.style.width = `${pct}%`;
    presentPrev.disabled = index <= 0;
    presentNext.disabled = index >= slides.length - 1;
  }

  function showSlide(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((slide, n) => {
      slide.classList.toggle("present-active", n === index);
      slide.classList.toggle("present-slide", true);
    });
    updateChrome();

    const activeSlide = slides[index];
    if (activeSlide) {
      activeSlide.scrollTop = 0;
      const id = activeSlide.id;
      if (id) {
        history.replaceState(null, "", `#${id}`);
      } else if (index === 0) {
        history.replaceState(null, "", "#");
      }
    }
  }

  function enterPresent(startIndex) {
    if (active) return;
    active = true;
    document.body.classList.add("present-mode");
    presentChrome.hidden = false;
    presentProgress.hidden = false;
    presentBtn.textContent = "Afslut";
    presentBtn.setAttribute("aria-pressed", "true");

    let start = typeof startIndex === "number" ? startIndex : 0;
    const hash = location.hash.replace("#", "");
    if (typeof startIndex !== "number" && hash) {
      const found = slides.findIndex((s) => s.id === hash);
      if (found >= 0) start = found;
    }

    showSlide(start);

    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (_) {
      /* fullscreen er valgfrit */
    }
  }

  function exitPresent() {
    if (!active) return;
    active = false;
    document.body.classList.remove("present-mode");
    presentChrome.hidden = true;
    presentProgress.hidden = true;
    presentBtn.textContent = "Presentér";
    presentBtn.setAttribute("aria-pressed", "false");
    slides.forEach((slide) => {
      slide.classList.remove("present-active", "present-slide");
    });

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    const current = slides[index];
    if (current && current.id) {
      current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function togglePresent() {
    if (active) exitPresent();
    else enterPresent();
  }

  function next() {
    if (index < slides.length - 1) showSlide(index + 1);
  }

  function prev() {
    if (index > 0) showSlide(index - 1);
  }

  presentBtn.addEventListener("click", togglePresent);
  presentPrev.addEventListener("click", prev);
  presentNext.addEventListener("click", next);
  presentExit.addEventListener("click", exitPresent);

  document.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;

    if (!active) {
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        enterPresent();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        exitPresent();
        break;
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
      case " ":
      case "Enter":
        e.preventDefault();
        next();
        break;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
      case "Backspace":
        e.preventDefault();
        prev();
        break;
      case "Home":
        e.preventDefault();
        showSlide(0);
        break;
      case "End":
        e.preventDefault();
        showSlide(slides.length - 1);
        break;
      default:
        break;
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (active && !document.fullscreenElement) {
      /* Bliv i present mode uden fullscreen */
    }
  });

  // Klik på slide-områdets højre/venstre kant (ikke på knapper/input)
  document.addEventListener("click", (e) => {
    if (!active) return;
    if (e.target.closest(".present-chrome, .present-progress, button, a, input, label, summary, details, .led-item")) {
      return;
    }
    const slide = e.target.closest(".present-active");
    if (!slide) return;
    const rect = slide.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width * 0.72) next();
    else if (x < rect.width * 0.28) prev();
  });

  if (location.search.includes("present=1") || location.hash === "#present") {
    enterPresent(0);
  }
})();
