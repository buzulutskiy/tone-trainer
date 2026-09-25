(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const state = { count: 4, points: [], image: null, fileName: "", checked: false };
  const taskNames = ["самый светлый тон", "следующий светлый тон", "средний светлый тон", "средний тёмный тон", "следующий тёмный тон", "самый тёмный тон"];
  const canvas = $("#imageCanvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const resultCanvas = $("#resultCanvas");
  const resultCtx = resultCanvas.getContext("2d");

  const setView = (name) => {
    $("#setupPanel").hidden = name !== "setup";
    $("#workspace").hidden = name !== "workspace";
    $("#results").hidden = name !== "results";
  };

  const toneLabel = (index) => {
    if (index === 0) return "Самый светлый";
    if (index === state.count - 1) return "Самый тёмный";
    return `Тон ${index + 1}`;
  };

  const renderList = () => {
    $("#toneList").innerHTML = Array.from({ length: state.count }, (_, i) => {
      const point = state.points[i];
      const mode = point ? "done" : i === state.points.length ? "active" : "";
      const swatch = point ? `<span class="swatch" style="background:rgb(${point.rgb.join(",")})"></span>` : "<span></span>";
      return `<li class="${mode}"><span class="number">${i + 1}</span><span>${toneLabel(i)}</span>${swatch}</li>`;
    }).join("");

    const next = state.points.length;
    $("#stepCurrent").textContent = Math.min(next + 1, state.count);
    $("#stepTotal").textContent = state.count;
    $("#taskTitle").textContent = next < state.count ? `Найдите ${taskNames[next]}` : "Все тона отмечены";
    $("#taskHint").textContent = next < state.count
      ? "Поставьте точку в центре крупного пятна. Не цепляйтесь за блики и мелкие детали."
      : "Теперь уберите цвет и проверьте порядок выбранных пятен.";
    $("#stageStatus").textContent = next < state.count ? `Кликните: ${taskNames[next]}` : "Готово — переходите к проверке";
    $("#checkButton").disabled = next !== state.count;
    $("#undoButton").disabled = next === 0;
  };

  const drawImage = (targetCanvas, targetCtx, grayscale = false) => {
    const maxW = targetCanvas.parentElement.clientWidth;
    const maxH = targetCanvas.parentElement.clientHeight;
    const ratio = Math.min(maxW / state.image.naturalWidth, maxH / state.image.naturalHeight);
    targetCanvas.width = Math.max(1, Math.round(state.image.naturalWidth * ratio));
    targetCanvas.height = Math.max(1, Math.round(state.image.naturalHeight * ratio));
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    targetCtx.filter = grayscale ? "grayscale(1)" : "none";
    targetCtx.drawImage(state.image, 0, 0, targetCanvas.width, targetCanvas.height);
    targetCtx.filter = "none";
  };

  const markerHTML = (point, index, targetCanvas) => {
    const left = targetCanvas.offsetLeft + point.x * targetCanvas.clientWidth;
    const top = targetCanvas.offsetTop + point.y * targetCanvas.clientHeight;
    return `<span class="marker" style="left:${left}px;top:${top}px">${index + 1}</span>`;
  };

  const renderMarkers = () => {
    $("#markers").innerHTML = state.points.map((p, i) => markerHTML(p, i, canvas)).join("");
  };

  const resize = () => {
    if (!state.image) return;
    const source = state.checked ? resultCanvas : canvas;
    const context = state.checked ? resultCtx : ctx;
    drawImage(source, context, state.checked);
    if (state.checked) $("#resultMarkers").innerHTML = state.points.map((p, i) => markerHTML(p, i, resultCanvas)).join("");
    else renderMarkers();
  };

  const resetPoints = () => {
    state.points = [];
    state.checked = false;
    $("#markers").innerHTML = "";
    $("#blurToggle").checked = false;
    $("#imageStage").classList.remove("blurred");
    renderList();
  };

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return alert("Выберите изображение в формате JPG, PNG или WebP.");
    if (file.size > 20 * 1024 * 1024) return alert("Изображение больше 20 МБ. Выберите файл поменьше.");
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      if (state.image?.src.startsWith("blob:")) URL.revokeObjectURL(state.image.src);
      state.image = image;
      state.fileName = file.name;
      $("#fileName").textContent = file.name;
      resetPoints();
      setView("workspace");
      requestAnimationFrame(() => { drawImage(canvas, ctx); renderMarkers(); });
    };
    image.onerror = () => { URL.revokeObjectURL(url); alert("Не удалось прочитать изображение."); };
    image.src = url;
  };

  const samplePoint = (event) => {
    if (state.points.length >= state.count || $("#imageStage").classList.contains("blurred")) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const px = x * canvas.width;
    const py = y * canvas.height;
    const radius = Math.max(3, Math.round(Math.min(canvas.width, canvas.height) * .012));
    const sx = Math.max(0, Math.round(px - radius));
    const sy = Math.max(0, Math.round(py - radius));
    const sw = Math.min(canvas.width - sx, radius * 2 + 1);
    const sh = Math.min(canvas.height - sy, radius * 2 + 1);
    const data = ctx.getImageData(sx, sy, sw, sh).data;
    let r = 0, g = 0, b = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; total++; }
    const rgb = [Math.round(r / total), Math.round(g / total), Math.round(b / total)];
    const linear = rgb.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); });
    const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    state.points.push({ x, y, rgb, luminance });
    renderMarkers();
    renderList();
  };

  const showResults = () => {
    state.checked = true;
    setView("results");
    requestAnimationFrame(() => {
      drawImage(resultCanvas, resultCtx, true);
      $("#resultMarkers").innerHTML = state.points.map((p, i) => markerHTML(p, i, resultCanvas)).join("");
      const sorted = [...state.points].map((p, i) => ({ ...p, original: i })).sort((a, b) => b.luminance - a.luminance);
      const actualRank = new Map(sorted.map((p, i) => [p.original, i]));
      const distances = state.points.map((_, i) => Math.abs(i - actualRank.get(i)));
      const inversions = state.points.reduce((sum, p, i) => sum + state.points.slice(i + 1).filter(q => p.luminance < q.luminance).length, 0);
      const maxInv = state.count * (state.count - 1) / 2;
      const score = Math.round((1 - inversions / maxInv) * 100);
      $("#scoreValue").textContent = `${score}%`;
      $("#resultSummary").textContent = score === 100
        ? "Отлично: все выбранные пятна выстроены по светлоте верно."
        : score >= 75
          ? "Почти точно. Обратите внимание на соседние тона — они оказались ближе, чем казалось."
          : "Цвет отвлёк от светлоты. Сравните серые образцы и попробуйте ещё раз.";
      $("#resultList").innerHTML = state.points.map((p, i) => {
        const gray = Math.round(Math.pow(p.luminance, 1 / 2.2) * 255);
        const actual = actualRank.get(i);
        const correct = distances[i] === 0;
        return `<li><span class="rank">${i + 1}</span><span class="bar" style="background:rgb(${gray},${gray},${gray})"></span><span>${toneLabel(i)}<br><small>Фактически: место ${actual + 1}</small></span><b class="${correct ? "ok" : "miss"}">${correct ? "✓" : `${actual + 1}`}</b></li>`;
      }).join("");
    });
  };

  $$("[data-count]").forEach(button => button.addEventListener("click", () => {
    state.count = Number(button.dataset.count);
    $$("[data-count]").forEach(b => b.setAttribute("aria-checked", String(b === button)));
  }));
  $("#chooseButton").addEventListener("click", () => $("#fileInput").click());
  $("#changeImage").addEventListener("click", () => $("#fileInput").click());
  $("#fileInput").addEventListener("change", e => loadFile(e.target.files[0]));
  $("#dropZone").addEventListener("dragover", e => { e.preventDefault(); e.currentTarget.classList.add("dragging"); });
  $("#dropZone").addEventListener("dragleave", e => e.currentTarget.classList.remove("dragging"));
  $("#dropZone").addEventListener("drop", e => { e.preventDefault(); e.currentTarget.classList.remove("dragging"); loadFile(e.dataTransfer.files[0]); });
  $("#imageStage").addEventListener("click", samplePoint);
  $("#undoButton").addEventListener("click", () => { state.points.pop(); renderMarkers(); renderList(); });
  $("#checkButton").addEventListener("click", showResults);
  $("#blurToggle").addEventListener("change", e => {
    $("#imageStage").classList.toggle("blurred", e.target.checked);
    $("#stageStatus").textContent = e.target.checked ? "Смотрите на большие массы, затем выключите расфокусировку и поставьте точку" : `Кликните: ${taskNames[state.points.length]}`;
  });
  $("#tryAgain").addEventListener("click", () => { resetPoints(); setView("workspace"); requestAnimationFrame(resize); });
  $("#newImage").addEventListener("click", () => { state.image = null; state.points = []; state.checked = false; $("#fileInput").value = ""; setView("setup"); });
  $("#compareSlider").addEventListener("input", e => { resultCanvas.style.filter = `grayscale(${e.target.value / 100})`; });
  $("#helpButton").addEventListener("click", () => $("#helpDialog").showModal());
  $("#closeHelp").addEventListener("click", () => $("#helpDialog").close());
  $("#helpDialog").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  window.addEventListener("resize", () => requestAnimationFrame(resize));

  const registerTools = () => {
    if (!document.modelContext?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(document.modelContext.registerTool({
      name: "set_tone_count",
      title: "Выбрать количество тонов",
      description: "Устанавливает для новой тренировки количество тональных пятен от 4 до 6.",
      inputSchema: { type: "object", properties: { count: { type: "integer", minimum: 4, maximum: 6 } }, required: ["count"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (![4, 5, 6].includes(input?.count)) throw new Error("Количество тонов должно быть от 4 до 6");
        state.count = input.count;
        $$("[data-count]").forEach(b => b.setAttribute("aria-checked", String(Number(b.dataset.count) === state.count)));
        return { count: state.count };
      }
    }, { signal: controller.signal })).catch(() => {});
  };
  registerTools();
})();
