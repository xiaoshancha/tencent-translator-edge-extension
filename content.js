let floatingDiv = null;
let isEnabled = true;
let showOriginal = true;
let themeColor = '#006eff';
let selectionTimeout = null;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let divStartX = 0;
let divStartY = 0;

function applyTheme(color) {
  document.documentElement.style.setProperty('--tt-theme', color);
  document.documentElement.style.setProperty('--tt-theme-dark', adjustColor(color, -20));
}

function adjustColor(hex, amount) {
  hex = hex.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function createTooltip() {
  const div = document.createElement('div');
  div.id = 'tencent-translator-tooltip';
  div.innerHTML = `
    <div class="tt-header" id="tt-header">
      <span class="tt-title">翻译结果</span>
      <button class="tt-close" id="tt-close" type="button" aria-label="关闭">&times;</button>
    </div>
    <div class="tt-body">
      <div class="tt-original" id="tt-original" style="display:none"></div>
      <div class="tt-loading" id="tt-loading">
        <span class="tt-spinner"></span>
        <span>翻译中...</span>
      </div>
      <div class="tt-result" id="tt-result" style="display:none"></div>
      <div class="tt-error" id="tt-error" style="display:none"></div>
    </div>
  `;
  document.documentElement.appendChild(div);

  div.querySelector('#tt-close').addEventListener('click', function(e) {
    e.stopPropagation();
    hideTooltip();
  });

  div.addEventListener('wheel', function(e) {
    var body = div.querySelector('.tt-body');
    var scrollTop = body.scrollTop;
    var scrollHeight = body.scrollHeight;
    var height = body.clientHeight;
    var delta = e.deltaY;

    if ((delta > 0 && scrollTop + height >= scrollHeight) ||
        (delta < 0 && scrollTop <= 0)) {
      e.preventDefault();
    }
    e.stopPropagation();
  }, { passive: false });

  div.addEventListener('mousedown', function(e) {
    if (!e.target.classList.contains('tt-close')) {
      e.stopPropagation();
    }
  });

  const header = div.querySelector('#tt-header');
  header.addEventListener('mousedown', function(e) {
    if (e.target.classList.contains('tt-close')) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = div.getBoundingClientRect();
    divStartX = rect.left;
    divStartY = rect.top;
    e.preventDefault();
  });

  applyTheme(themeColor);

  return div;
}

document.addEventListener('mousemove', function(e) {
  if (!isDragging || !floatingDiv) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  let newX = divStartX + dx;
  let newY = divStartY + dy;
  const rect = floatingDiv.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (newX < 0) newX = 0;
  if (newY < 0) newY = 0;
  if (newX + rect.width > vw) newX = vw - rect.width;
  if (newY + rect.height > vh) newY = vh - rect.height;
  floatingDiv.style.left = newX + 'px';
  floatingDiv.style.top = newY + 'px';
});

document.addEventListener('mouseup', function() {
  isDragging = false;
});

function getTooltip() {
  if (!floatingDiv || !document.contains(floatingDiv)) {
    floatingDiv = createTooltip();
  }
  return floatingDiv;
}

function positionTooltip(x, y) {
  const tooltip = getTooltip();
  const pad = 15;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = x + pad;
  let top = y + pad;

  const rect = tooltip.getBoundingClientRect();

  if (left + rect.width > vw - pad) {
    left = x - rect.width - pad;
  }
  if (top + rect.height > vh - pad) {
    top = y - rect.height - pad;
  }
  if (left < pad) left = pad;
  if (top < pad) top = pad;

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

function showTooltip(x, y, originalText) {
  const tooltip = getTooltip();

  tooltip.querySelector('#tt-loading').style.display = 'flex';
  tooltip.querySelector('#tt-result').style.display = 'none';
  tooltip.querySelector('#tt-error').style.display = 'none';

  const originalDiv = tooltip.querySelector('#tt-original');
  if (showOriginal && originalText) {
    originalDiv.textContent = originalText;
    originalDiv.style.display = 'block';
  } else {
    originalDiv.style.display = 'none';
  }

  tooltip.style.left = (x + 15) + 'px';
  tooltip.style.top = (y + 15) + 'px';
  tooltip.style.display = 'block';

  setTimeout(function() { positionTooltip(x, y); }, 0);
}

function showResult(text) {
  const tooltip = getTooltip();
  tooltip.querySelector('#tt-loading').style.display = 'none';
  tooltip.querySelector('#tt-error').style.display = 'none';
  const resultDiv = tooltip.querySelector('#tt-result');
  resultDiv.textContent = text;
  resultDiv.style.display = 'block';
}

function showError(msg) {
  const tooltip = getTooltip();
  tooltip.querySelector('#tt-loading').style.display = 'none';
  tooltip.querySelector('#tt-result').style.display = 'none';
  const errorDiv = tooltip.querySelector('#tt-error');
  errorDiv.textContent = msg;
  errorDiv.style.display = 'block';
}

function hideTooltip() {
  if (floatingDiv) {
    floatingDiv.style.display = 'none';
  }
}

async function doTranslate(text, x, y) {
  if (!isEnabled) return;

  showTooltip(x, y, text);

  try {
    const resp = await chrome.runtime.sendMessage({
      action: 'translate',
      text: text
    });

    if (resp && resp.success) {
      showResult(resp.result);
    } else {
      showError((resp && resp.error) || '翻译失败');
    }
  } catch (err) {
    showError('请检查API配置');
  }
}

document.addEventListener('mouseup', function(e) {
  if (isDragging) return;
  if (!isEnabled) return;
  if (floatingDiv && floatingDiv.contains(e.target)) return;

  clearTimeout(selectionTimeout);

  var cx = e.clientX;
  var cy = e.clientY;

  selectionTimeout = setTimeout(function() {
    var sel = window.getSelection();
    var txt = sel ? sel.toString().trim() : '';

    if (txt.length > 0) {
      if (txt.length > 6000) {
        showTooltip(cx, cy, txt);
        showError('文本超过6000字限制');
        return;
      }
      doTranslate(txt, cx, cy);
    }
  }, 250);
});

document.addEventListener('mousedown', function(e) {
  if (floatingDiv && floatingDiv.style.display === 'block' && !floatingDiv.contains(e.target)) {
    hideTooltip();
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'showTranslation') {
    var sel = window.getSelection();
    var txt = sel ? sel.toString().trim() : '';
    if (txt) {
      doTranslate(txt, window.innerWidth / 2, window.innerHeight / 3);
    }
  }
  if (request.action === 'setEnabled') {
    isEnabled = request.enabled;
    if (!isEnabled) hideTooltip();
  }
});

chrome.storage.local.get(['enabled', 'showOriginal', 'themeColor'], function(result) {
  isEnabled = result.enabled !== false;
  showOriginal = result.showOriginal !== false;
  if (result.themeColor) {
    themeColor = result.themeColor;
    applyTheme(themeColor);
  }
});
