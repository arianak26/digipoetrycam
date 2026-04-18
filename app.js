/* ═══════════════════════════════════════════════════════════════
   Ari's Poetry Photobooth — app.js
   ═══════════════════════════════════════════════════════════════ */

/* ── State ─────────────────────────────────────────────────────── */
let selectedFrame = null;
const photos = { 1: null, 2: null }; // ImageBitmap after loading

/* ── Frame layout data (positions as % of 1366×768 container)
      Each entry: { photos: [{l,t,w,h}, ...], poem: {l,t,w,align} }
      l/t/w/h are 0–100 percentages of the container dimension      */
/* Photo height as % of container = w * (1366/768)
   w=16.4 → h=29.2%   w=15.8 → h=28.1%
   2-photo stack centered in mat (y: 5%–95%):
     t1 = 5 + (90 - 2*h) / 2,  t2 = t1 + h                  */
const FRAMES = {
  1: {
    // Dark red frame (frame1.png)
    photos1: [{ l: 41.8, t: 35.4, w: 16.4 }],
    photos2: [
      { l: 41.8, t: 20.8, w: 16.4 },
      { l: 41.8, t: 50.0, w: 16.4 }
    ],
    poem: { l: 20, t: 82.5, w: 60, align: 'center' }
  },
  2: {
    // Plaid / doily frame (frame2.png)
    photos1: [{ l: 41.8, t: 35.4, w: 16.4 }],
    photos2: [
      { l: 41.8, t: 20.8, w: 16.4 },
      { l: 41.8, t: 50.0, w: 16.4 }
    ],
    poem: { l: 18, t: 83.5, w: 64, align: 'center' }
  },
  3: {
    // Pink stripe + stars frame (frame3.png)
    photos1: [{ l: 24.0, t: 35.9, w: 15.8 }],
    photos2: [
      { l: 24.0, t: 21.9, w: 15.8 },
      { l: 24.0, t: 50.0, w: 15.8 }
    ],
    poem: { l: 59.0, t: 38.0, w: 32, align: 'left' }
  },
  4: {
    // Green polka dot frame (frame4.png)
    photos1: [{ l: 33.0, t: 35.9, w: 15.8 }],
    photos2: [
      { l: 33.0, t: 21.9, w: 15.8 },
      { l: 33.0, t: 50.0, w: 15.8 }
    ],
    poem: { l: 60.0, t: 18.0, w: 34, align: 'left' }
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

  // Black film bars top & bottom (~7% each)
  const bar = Math.round(height * 0.07);
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

  // Gather uploaded photos
  const photoList = [photos[1], photos[2]].filter(Boolean);

  // Process photos into vintage canvases (512px squares for quality)
  const vintageCanvases = photoList.map(bm => makeVintageCanvas(bm, 512));

  // Send the FIRST photo (unfiltered) to Claude for poem generation
  // We use a 512×512 crop of the original for analysis
  let poemText = '';
  try {
    const analysisCanvas = document.createElement('canvas');
    analysisCanvas.width = 512;
    analysisCanvas.height = 512;
    drawCroppedSquare(analysisCanvas.getContext('2d'), photoList[0], 512);
    // If 2 photos, also analyse photo 2 and stitch side-by-side for context
    let base64Image;
    if (photoList.length === 2) {
      const combo = document.createElement('canvas');
      combo.width = 1024;
      combo.height = 512;
      const cctx = combo.getContext('2d');
      cctx.drawImage(analysisCanvas, 0, 0);
      const c2 = document.createElement('canvas');
      c2.width = 512; c2.height = 512;
      drawCroppedSquare(c2.getContext('2d'), photoList[1], 512);
      cctx.drawImage(c2, 512, 0);
      base64Image = combo.toDataURL('image/jpeg', 0.85).split(',')[1];
    } else {
      base64Image = analysisCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];
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

  renderResult(vintageCanvases, poemText);
  showScreen('screen-result');
}

/* ── Render result frame ───────────────────────────────────────── */
function renderResult(vintageCanvases, poemText) {
  const f = selectedFrame;
  const layout = FRAMES[f];
  const photoCount = vintageCanvases.length;
  const positions = photoCount >= 2 ? layout.photos2 : layout.photos1;

  // Hide all frames, show selected
  document.querySelectorAll('.frame-output').forEach(el => el.classList.remove('active'));
  document.getElementById(`frame-output-${f}`).classList.add('active');

  // Position and draw photo canvases
  vintageCanvases.forEach((src, i) => {
    const pos = positions[i];
    if (!pos) return;

    const dest = document.getElementById(`photo-${i === 0 ? 'a' : 'b'}-${f}`);
    // Copy pixel data from src vintage canvas
    dest.width  = src.width;
    dest.height = src.height;
    dest.getContext('2d').drawImage(src, 0, 0);

    // Position as % within the frame container
    dest.style.left   = pos.l + '%';
    dest.style.top    = pos.t + '%';
    dest.style.width  = pos.w + '%';
    dest.style.height = 'auto';
    dest.style.aspectRatio = '1 / 1';
    dest.style.display = 'block';
  });

  // Hide unused canvases
  const unusedId = vintageCanvases.length === 1
    ? `photo-b-${f}`
    : null;
  if (unusedId) document.getElementById(unusedId).style.display = 'none';

  // Set poem text
  const poemEl = document.getElementById(`poem-${f}`);
  poemEl.textContent = poemText;
  const p = layout.poem;
  poemEl.style.left      = p.l + '%';
  poemEl.style.top       = p.t + '%';
  poemEl.style.width     = p.w + '%';
  poemEl.style.textAlign = p.align;
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
