/* ═══════════════════════════════════════════════════════════════
   Ari's Poetry Photobooth — app.js
   ═══════════════════════════════════════════════════════════════ */

/* ── State ─────────────────────────────────────────────────────── */
let selectedFrame = null;
const photos = { 1: null, 2: null }; // ImageBitmap after loading

/* ── Frame layout data (positions as % of 1366×768 container)
      Each entry: { photos: [{l,t,w,h}, ...], poem: {l,t,w,align} }
      l/t/w/h are 0–100 percentages of the container dimension      */
/* Photo sizes and positions (% of 1366×768 container).
   h is computed as w * (1366/768) and set explicitly to eliminate gaps.
   _s = shifted up 15pp when poem is shown (not used for frame 3).     */
const FRAMES = {
  1: {
    w: 12.6,
    photos1: [{ l: 43.7 }],
    photos2: [{ l: 43.7 }, { l: 43.7 }],
    poem: { l: 20, t: 60, w: 60, align: 'center' }
  },
  2: {
    w: 11.1,
    photos1: [{ l: 44.45 }],
    photos2: [{ l: 44.45 }, { l: 44.45 }],
    poem: { l: 18, t: 63, w: 64, align: 'center' }
  },
  3: {
    w: 14.2,
    photos1: [{ l: 42.9 }],
    photos2: [{ l: 42.9 }, { l: 42.9 }],
    poem: { l: 20, t: 75, w: 60, align: 'center' }
  },
  4: {
    w: 14.2,
    photos1: [{ l: 42.9 }],
    photos2: [{ l: 42.9 }, { l: 42.9 }],
    poem: { l: 20, t: 63, w: 60, align: 'center' }
  }
};

/* ── Navigation ────────────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ── Frame selection ───────────────────────────────────────────── */
function selectFrame(n) {
  selectedFrame = n;
  showScreen('screen-upload');
}

/* ── File upload helpers ───────────────────────────────────────── */
function triggerUpload(slot) {
  if (photos[slot]) return; // already filled — ignore click on canvas area
  document.getElementById(`file-input-${slot}`).click();
}

async function handleFile(slot, input) {
  const file = input.files[0];
  if (!file) return;

  const bitmap = await createImageBitmap(file);
  photos[slot] = bitmap;

  // Draw cropped square preview into slot canvas
  const canvas = document.getElementById(`preview-${slot}`);
  const size = 320;
  canvas.width = size;
  canvas.height = size;
  drawCroppedSquare(canvas.getContext('2d'), bitmap, size);

  // Show preview, hide placeholder
  canvas.classList.remove('hidden');
  document.getElementById(`placeholder-${slot}`).classList.add('hidden');
  document.getElementById(`remove-${slot}`).classList.remove('hidden');
  document.getElementById(`slot-${slot}`).classList.add('filled');

  updateCreateButton();
  input.value = ''; // allow re-selecting same file
}

function removePhoto(slot, event) {
  event.stopPropagation();
  photos[slot] = null;
  const canvas = document.getElementById(`preview-${slot}`);
  canvas.classList.add('hidden');
  document.getElementById(`placeholder-${slot}`).classList.remove('hidden');
  document.getElementById(`remove-${slot}`).classList.add('hidden');
  document.getElementById(`slot-${slot}`).classList.remove('filled');
  updateCreateButton();
}

function updateCreateButton() {
  const hasAny = photos[1] !== null || photos[2] !== null;
  document.getElementById('btn-create').disabled = !hasAny;
}

/* ── Image utilities ───────────────────────────────────────────── */

/** Center-crops an ImageBitmap to a square, draws into ctx at (0,0,size,size) */
function drawCroppedSquare(ctx, bitmap, size) {
  const sw = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width  - sw) / 2;
  const sy = (bitmap.height - sw) / 2;
  ctx.drawImage(bitmap, sx, sy, sw, sw, 0, 0, size, size);
}

/** Applies vintage 90s film filter to the canvas in-place.
    Grayscale + high contrast + warm sepia shift + black film bars. */
function applyVintageFilter(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    // Luminance-weighted grayscale
    let g = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

    // High contrast S-curve (1.45 × deviation from midpoint)
    g = Math.max(0, Math.min(255, (g - 128) * 1.45 + 128));

    // Warm sepia shift: lift reds, reduce blues
    d[i]     = Math.min(255, g * 1.10 + 18);  // R
    d[i + 1] = Math.min(255, g * 0.97 +  8);  // G
    d[i + 2] = Math.min(255, g * 0.86       ); // B
  }

  ctx.putImageData(imageData, 0, 0);

  // Black film bars top & bottom (~6% each, 10% smaller than original)
  const bar = Math.round(height * 0.063);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, bar);
  ctx.fillRect(0, height - bar, width, bar);
}

/** Returns a new canvas with the photo cropped, filtered, at targetSize px square */
function makeVintageCanvas(bitmap, targetSize) {
  const c = document.createElement('canvas');
  c.width = targetSize;
  c.height = targetSize;
  drawCroppedSquare(c.getContext('2d'), bitmap, targetSize);
  applyVintageFilter(c);
  return c;
}

/* ── Main create flow ──────────────────────────────────────────── */
async function createFrame() {
  showScreen('screen-loading');

  const photoList = [photos[1], photos[2]].filter(Boolean);
  const vintageCanvases = photoList.map(bm => makeVintageCanvas(bm, 512));

  renderResult(vintageCanvases);
  showScreen('screen-result');
}

/* ── Position photos helper ────────────────────────────────────── */
function positionPhotos(f, tops, canvases) {
  const layout = FRAMES[f];
  const hPct = (layout.w * 1366 / 768).toFixed(3);
  const lValues = canvases.length >= 2 ? layout.photos2 : layout.photos1;

  canvases.forEach((src, i) => {
    const dest = document.getElementById(`photo-${i === 0 ? 'a' : 'b'}-${f}`);
    dest.width  = src.width;
    dest.height = src.height;
    dest.getContext('2d').drawImage(src, 0, 0);
    dest.style.left   = lValues[i].l + '%';
    dest.style.top    = tops[i] + '%';
    dest.style.width  = layout.w + '%';
    dest.style.height = hPct + '%';
    dest.style.display = 'block';
  });

  if (canvases.length === 1) {
    document.getElementById(`photo-b-${f}`).style.display = 'none';
  }
}

/* ── Centered photo tops (no poem) ─────────────────────────────── */
function centeredPhotoTops(f, photoCount) {
  const hPct = FRAMES[f].w * 1366 / 768;
  // Stack center at 40% — slightly above midpoint to leave room for poem
  const center = 40;
  return photoCount >= 2
    ? [center - hPct, center]
    : [center - hPct / 2];
}

/* ── Photo tops shifted up so stack bottom clears poem + gap ────── */
function shiftedPhotoTops(f, photoCount) {
  const layout = FRAMES[f];
  const hPct = layout.w * 1366 / 768;
  const gap = 3; // % between bottom of stack and top of poem
  const topPad = 5; // % minimum distance from top of frame
  const stackBottom = layout.poem.t - gap;

  if (photoCount >= 2) {
    const t2 = Math.max(stackBottom - hPct, topPad + hPct);
    return [t2 - hPct, t2];
  } else {
    return [Math.max(stackBottom - hPct, topPad)];
  }
}

/* ── Active tops: only shift up — never push photos down ─────────── */
function activePhotoTops(f, photoCount) {
  const centered = centeredPhotoTops(f, photoCount);
  const shifted  = shiftedPhotoTops(f, photoCount);
  return centered.map((c, i) => Math.min(c, shifted[i]));
}

/* ── Render result (photos only, no poem yet) ──────────────────── */
function renderResult(vintageCanvases) {
  const f = selectedFrame;
  const layout = FRAMES[f];
  const photoCount = vintageCanvases.length;

  window._vintageCanvases = vintageCanvases;
  window._photoCount = photoCount;

  document.querySelectorAll('.frame-output').forEach(el => el.classList.remove('active'));
  document.getElementById(`frame-output-${f}`).classList.add('active');

  positionPhotos(f, centeredPhotoTops(f, photoCount), vintageCanvases);

  const poemEl = document.getElementById(`poem-${f}`);
  poemEl.textContent = '';
  poemEl.style.opacity = '0';

  const btn = document.getElementById('btn-poem');
  btn.textContent = 'generate poem';
  btn.disabled = false;
}

/* ── Generate poem on demand ───────────────────────────────────── */
async function generatePoem() {
  const f = selectedFrame;
  const btn = document.getElementById('btn-poem');
  btn.disabled = true;
  btn.textContent = 'writing poem...';

  const photoList = [photos[1], photos[2]].filter(Boolean);
  let poemText = '';

  try {
    const a = document.createElement('canvas');
    a.width = 512; a.height = 512;
    drawCroppedSquare(a.getContext('2d'), photoList[0], 512);

    let base64Image;
    if (photoList.length === 2) {
      const combo = document.createElement('canvas');
      combo.width = 1024; combo.height = 512;
      const cctx = combo.getContext('2d');
      cctx.drawImage(a, 0, 0);
      const b = document.createElement('canvas');
      b.width = 512; b.height = 512;
      drawCroppedSquare(b.getContext('2d'), photoList[1], 512);
      cctx.drawImage(b, 512, 0);
      base64Image = combo.toDataURL('image/jpeg', 0.85).split(',')[1];
    } else {
      base64Image = a.toDataURL('image/jpeg', 0.85).split(',')[1];
    }

    const response = await fetch('/api/generate-poem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image })
    });

    if (response.ok) {
      const data = await response.json();
      poemText = data.poem || '';
    }
  } catch (err) {
    console.error('Poem generation failed:', err);
    poemText = 'light held still\nfor one small breath';
  }

  const layout = FRAMES[f];
  const photoCount = window._photoCount;
  const canvases  = window._vintageCanvases;

  // Place poem (invisible) so layout is computed before measuring
  const poemEl = document.getElementById(`poem-${f}`);
  const p = layout.poem;
  poemEl.textContent = poemText;
  poemEl.style.left      = p.l + '%';
  poemEl.style.top       = p.t + '%';
  poemEl.style.width     = p.w + '%';
  poemEl.style.textAlign = p.align;
  poemEl.style.opacity   = '0';

  requestAnimationFrame(() => {
    positionPhotos(f, activePhotoTops(f, photoCount), canvases);
    poemEl.style.opacity = '1';
  });

  btn.textContent = 'regenerate';
  btn.disabled = false;
}

/* ── Download ──────────────────────────────────────────────────── */
async function downloadFrame() {
  const frameEl = document.getElementById(`frame-output-${selectedFrame}`);
  try {
    const canvas = await html2canvas(frameEl, {
      useCORS: true,
      allowTaint: false,
      scale: 2,            // 2× for crisp download
      backgroundColor: null
    });
    const link = document.createElement('a');
    link.download = `poetry-photobooth-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Download failed:', err);
    alert('Download failed — please try screenshotting instead.');
  }
}

/* ── Restart ───────────────────────────────────────────────────── */
function restart() {
  // Reset state
  photos[1] = null;
  photos[2] = null;
  selectedFrame = null;

  // Reset upload UI
  [1, 2].forEach(slot => {
    const canvas = document.getElementById(`preview-${slot}`);
    canvas.classList.add('hidden');
    document.getElementById(`placeholder-${slot}`).classList.remove('hidden');
    document.getElementById(`remove-${slot}`).classList.add('hidden');
    document.getElementById(`slot-${slot}`).classList.remove('filled');
  });
  document.getElementById('btn-create').disabled = true;

  // Reset all photo canvases and poem text
  for (let f = 1; f <= 4; f++) {
    ['a', 'b'].forEach(ab => {
      const c = document.getElementById(`photo-${ab}-${f}`);
      if (c) { c.style.display = 'none'; c.width = 0; c.height = 0; }
    });
    const p = document.getElementById(`poem-${f}`);
    if (p) p.textContent = '';
  }

  showScreen('screen-landing');
}
