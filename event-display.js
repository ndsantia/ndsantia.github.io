(() => {
  "use strict";

  const canvas = document.querySelector("#event-canvas");
  const resetButton = document.querySelector("#reset-view");
  const detectorToggle = document.querySelector("#toggle-detector");
  const hitsToggle = document.querySelector("#toggle-hits");
  const predictionToggle = document.querySelector("#toggle-prediction");

  if (!canvas || !resetButton || !detectorToggle || !hitsToggle || !predictionToggle) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const colors = {
    ink: "#171717",
    muted: "#7b7770",
    paper: "#fbfaf7",
    grid: "rgba(23, 23, 23, 0.13)",
    detector: "rgba(123, 85, 161, 0.88)",
    detectorSoft: "rgba(123, 85, 161, 0.22)",
    frame: "rgba(23, 23, 23, 0.68)",
    neutrino: "#2b9b92",
    muon: "#236a9f",
    proton: "#c84a3c",
    hits: "#9b63bb",
    vertex: "#d89b2b"
  };

  const initialView = { yaw: -0.58, pitch: -0.2, zoom: 0.88 };
  const view = { ...initialView };
  const segments = [];
  const points = [];
  const labels = [];
  let width = 0;
  let height = 0;
  let dragging = false;
  let pointerX = 0;
  let pointerY = 0;

  const point = (x, y, z) => ({ x, y, z });

  function addSegment(a, b, options = {}) {
    segments.push({
      a,
      b,
      color: options.color || colors.ink,
      width: options.width || 1,
      dash: options.dash || [],
      alpha: options.alpha ?? 1,
      group: options.group || "detector"
    });
  }

  function addPoint(position, options = {}) {
    points.push({
      position,
      color: options.color || colors.hits,
      radius: options.radius || 3,
      alpha: options.alpha ?? 1,
      group: options.group || "hits"
    });
  }

  function addBox(center, size, options = {}) {
    const x0 = center.x - size.x / 2;
    const x1 = center.x + size.x / 2;
    const y0 = center.y - size.y / 2;
    const y1 = center.y + size.y / 2;
    const z0 = center.z - size.z / 2;
    const z1 = center.z + size.z / 2;
    const corners = [
      point(x0, y0, z0), point(x1, y0, z0), point(x1, y1, z0), point(x0, y1, z0),
      point(x0, y0, z1), point(x1, y0, z1), point(x1, y1, z1), point(x0, y1, z1)
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    edges.forEach(([start, end]) => addSegment(corners[start], corners[end], options));
  }

  function addTrack(start, end, color, widthValue, label, labelOffset) {
    addSegment(start, end, { color, width: widthValue, group: "prediction" });
    labels.push({ position: end, text: label, color, offset: labelOffset });
  }

  function interpolate(a, b, amount) {
    return point(
      a.x + (b.x - a.x) * amount,
      a.y + (b.y - a.y) * amount,
      a.z + (b.z - a.z) * amount
    );
  }

  function seededJitter(index, scale) {
    const x = Math.sin(index * 91.17) * 43758.5453;
    return (x - Math.floor(x) - 0.5) * scale;
  }

  function buildScene() {
    // Floor grid and z-axis beam guide.
    for (let z = -1300; z <= 1300; z += 260) {
      addSegment(point(-650, -470, z), point(650, -470, z), {
        color: colors.grid,
        group: "detector"
      });
    }
    for (let x = -650; x <= 650; x += 260) {
      addSegment(point(x, -470, -1300), point(x, -470, 1300), {
        color: colors.grid,
        group: "detector"
      });
    }

    // Four central ArgonCube-inspired detector modules.
    const moduleCenters = [
      point(-190, 190, 0), point(190, 190, 0),
      point(-190, -190, 0), point(190, -190, 0)
    ];
    moduleCenters.forEach((center) => {
      addBox(center, point(350, 350, 700), {
        color: colors.detector,
        width: 1.65,
        group: "detector"
      });
    });
    addBox(point(0, 0, 0), point(760, 760, 760), {
      color: colors.detectorSoft,
      width: 3,
      group: "detector"
    });

    // Upstream and downstream tracker structures, based on the supplied view.
    [-1050, 1050].forEach((z) => {
      addBox(point(0, 0, z), point(940, 1050, 170), {
        color: colors.frame,
        width: 1.8,
        group: "detector"
      });
      [-330, 0, 330].forEach((x) => {
        addSegment(point(x, -525, z - 85), point(x, 525, z - 85), {
          color: colors.frame,
          alpha: 0.55,
          group: "detector"
        });
        addSegment(point(x, -525, z + 85), point(x, 525, z + 85), {
          color: colors.frame,
          alpha: 0.55,
          group: "detector"
        });
      });
      [-350, 0, 350].forEach((y) => {
        addSegment(point(-470, y, z), point(470, y, z), {
          color: colors.frame,
          alpha: 0.6,
          group: "detector"
        });
      });
    });

    // Place the interaction inside the upstream MINERvA scintillator detector.
    const vertex = point(0, 110, 1050);
    const beamStart = point(0, 110, 1480);
    const muonEnd = point(-105, 45, -1370);
    const protonEnd = point(-250, 315, 760);

    addSegment(beamStart, vertex, {
      color: colors.neutrino,
      width: 2.2,
      dash: [8, 8],
      group: "event"
    });
    labels.push({ position: beamStart, text: "νμ", color: colors.neutrino, offset: [-18, -12] });
    addTrack(vertex, muonEnd, colors.muon, 4.5, "μ−", [8, -10]);
    addTrack(vertex, protonEnd, colors.proton, 4.5, "p", [8, -10]);

    addPoint(vertex, { color: colors.vertex, radius: 7, group: "event" });
    addPoint(vertex, { color: colors.paper, radius: 2.3, group: "event" });

    // Reconstructed charge deposits along both outgoing tracks.
    for (let index = 1; index <= 42; index += 1) {
      const amount = index / 44;
      const hit = interpolate(vertex, muonEnd, amount);
      hit.x += seededJitter(index, 34);
      hit.y += seededJitter(index + 70, 28);
      addPoint(hit, { radius: index % 5 === 0 ? 3.2 : 2.2 });
    }
    for (let index = 1; index <= 20; index += 1) {
      const amount = index / 21;
      const hit = interpolate(vertex, protonEnd, amount);
      hit.x += seededJitter(index + 130, 28);
      hit.y += seededJitter(index + 190, 28);
      addPoint(hit, { radius: 2.8 + amount * 1.8 });
    }

    // Compact xyz orientation marker.
    const axisOrigin = point(-610, -460, -1280);
    addSegment(axisOrigin, point(-440, -460, -1280), { color: colors.proton, width: 2.5, group: "axis" });
    addSegment(axisOrigin, point(-610, -290, -1280), { color: colors.neutrino, width: 2.5, group: "axis" });
    addSegment(axisOrigin, point(-610, -460, -1110), { color: colors.muon, width: 2.5, group: "axis" });
    labels.push({ position: point(-430, -460, -1280), text: "x", color: colors.proton, offset: [3, 4] });
    labels.push({ position: point(-610, -280, -1280), text: "y", color: colors.neutrino, offset: [3, 4] });
    labels.push({ position: point(-610, -460, -1100), text: "z", color: colors.muon, offset: [3, 4] });
  }

  function rotateWorld(position) {
    const cosineYaw = Math.cos(view.yaw);
    const sineYaw = Math.sin(view.yaw);
    const cosinePitch = Math.cos(view.pitch);
    const sinePitch = Math.sin(view.pitch);
    const x = cosineYaw * position.x + sineYaw * position.z;
    const zYaw = -sineYaw * position.x + cosineYaw * position.z;
    const y = cosinePitch * position.y - sinePitch * zYaw;
    const z = sinePitch * position.y + cosinePitch * zYaw;
    return { x, y, z };
  }

  function project(position) {
    const rotated = rotateWorld(position);
    const fit = Math.min(width / 2600, height / 1550);
    const perspective = 1700 / Math.max(650, 1700 - rotated.z * 0.22);
    const scale = fit * view.zoom * perspective;
    return {
      x: width / 2 + rotated.x * scale,
      y: height / 2 - rotated.y * scale + 10,
      depth: rotated.z,
      scale
    };
  }

  function isVisible(group) {
    if (group === "detector" && !detectorToggle.checked) return false;
    if (group === "hits" && !hitsToggle.checked) return false;
    if (group === "prediction" && !predictionToggle.checked) return false;
    return true;
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    context.fillStyle = colors.paper;
    context.fillRect(0, 0, width, height);

    const drawableSegments = segments
      .filter((segment) => isVisible(segment.group))
      .map((segment) => ({
        ...segment,
        start: project(segment.a),
        end: project(segment.b),
        depth: (rotateWorld(segment.a).z + rotateWorld(segment.b).z) / 2
      }))
      .sort((a, b) => a.depth - b.depth);

    drawableSegments.forEach((segment) => {
      context.save();
      context.globalAlpha = segment.alpha;
      context.strokeStyle = segment.color;
      context.lineWidth = segment.width;
      context.setLineDash(segment.dash);
      context.beginPath();
      context.moveTo(segment.start.x, segment.start.y);
      context.lineTo(segment.end.x, segment.end.y);
      context.stroke();
      context.restore();
    });

    points
      .filter((item) => isVisible(item.group))
      .map((item) => ({ ...item, projected: project(item.position), depth: rotateWorld(item.position).z }))
      .sort((a, b) => a.depth - b.depth)
      .forEach((item) => {
        context.save();
        context.globalAlpha = item.alpha;
        context.fillStyle = item.color;
        context.beginPath();
        context.arc(item.projected.x, item.projected.y, item.radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });

    context.save();
    context.font = "600 15px system-ui, sans-serif";
    context.textBaseline = "middle";
    labels.forEach((label) => {
      const projected = project(label.position);
      context.fillStyle = label.color;
      context.fillText(label.text, projected.x + label.offset[0], projected.y + label.offset[1]);
    });
    context.restore();
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function resetView() {
    Object.assign(view, initialView);
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const deltaX = event.clientX - pointerX;
    const deltaY = event.clientY - pointerY;
    pointerX = event.clientX;
    pointerY = event.clientY;
    view.yaw += deltaX * 0.008;
    view.pitch = Math.max(-1.2, Math.min(1.2, view.pitch + deltaY * 0.008));
    draw();
  });

  function stopDragging(event) {
    dragging = false;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    view.zoom = Math.max(0.55, Math.min(2.4, view.zoom * Math.exp(-event.deltaY * 0.001)));
    draw();
  }, { passive: false });

  canvas.addEventListener("keydown", (event) => {
    const handled = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"].includes(event.key);
    if (!handled) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") view.yaw -= 0.1;
    if (event.key === "ArrowRight") view.yaw += 0.1;
    if (event.key === "ArrowUp") view.pitch = Math.max(-1.2, view.pitch - 0.1);
    if (event.key === "ArrowDown") view.pitch = Math.min(1.2, view.pitch + 0.1);
    if (event.key === "+" || event.key === "=") view.zoom = Math.min(2.4, view.zoom * 1.1);
    if (event.key === "-") view.zoom = Math.max(0.55, view.zoom / 1.1);
    if (event.key === "0") Object.assign(view, initialView);
    draw();
  });

  resetButton.addEventListener("click", resetView);
  detectorToggle.addEventListener("change", draw);
  hitsToggle.addEventListener("change", draw);
  predictionToggle.addEventListener("change", draw);

  buildScene();
  new ResizeObserver(resize).observe(canvas);
})();
