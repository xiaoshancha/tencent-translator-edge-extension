document.addEventListener('DOMContentLoaded', () => {
  const secretIdInput = document.getElementById('secretId');
  const secretKeyInput = document.getElementById('secretKey');
  const sourceLangSelect = document.getElementById('sourceLang');
  const targetLangSelect = document.getElementById('targetLang');
  const termRepoIdsInput = document.getElementById('termRepoIds');
  const enabledCheckbox = document.getElementById('enabled');
  const showOriginalCheckbox = document.getElementById('showOriginal');
  const themeColorInput = document.getElementById('themeColor');
  const themeColorHexInput = document.getElementById('themeColorHex');
  const colorPresets = document.getElementById('colorPresets');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const messageDiv = document.getElementById('message');

  loadSettings();

  themeColorInput.addEventListener('input', () => {
    themeColorHexInput.value = themeColorInput.value;
    updatePresetActive(themeColorInput.value);
  });

  themeColorHexInput.addEventListener('input', () => {
    let val = themeColorHexInput.value;
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      themeColorInput.value = val;
      updatePresetActive(val);
    }
  });

  colorPresets.addEventListener('click', (e) => {
    const preset = e.target.closest('.color-preset');
    if (preset) {
      const color = preset.dataset.color;
      themeColorInput.value = color;
      themeColorHexInput.value = color;
      updatePresetActive(color);
    }
  });

  function updatePresetActive(color) {
    colorPresets.querySelectorAll('.color-preset').forEach(p => {
      p.classList.toggle('active', p.dataset.color.toLowerCase() === color.toLowerCase());
    });
  }

  saveBtn.addEventListener('click', saveSettings);
  testBtn.addEventListener('click', testTranslation);

  function loadSettings() {
    chrome.storage.local.get([
      'secretId', 'secretKey', 'sourceLang', 'targetLang',
      'termRepoIds', 'enabled', 'showOriginal', 'themeColor'
    ], (result) => {
      secretIdInput.value = result.secretId || '';
      secretKeyInput.value = result.secretKey || '';
      sourceLangSelect.value = result.sourceLang || 'auto';
      targetLangSelect.value = result.targetLang || 'zh';
      enabledCheckbox.checked = result.enabled !== false;
      showOriginalCheckbox.checked = result.showOriginal !== false;

      const color = result.themeColor || '#006eff';
      themeColorInput.value = color;
      themeColorHexInput.value = color;
      updatePresetActive(color);

      if (result.termRepoIds && result.termRepoIds.length > 0) {
        termRepoIdsInput.value = result.termRepoIds.join('\n');
      }
    });
  }

  function saveSettings() {
    const termRepoIdsText = termRepoIdsInput.value.trim();
    const termRepoIds = termRepoIdsText
      ? termRepoIdsText.split('\n').map(id => id.trim()).filter(id => id.length > 0)
      : [];

    let themeColor = themeColorHexInput.value.trim();
    if (!themeColor.startsWith('#')) themeColor = '#' + themeColor;
    if (!/^#[0-9a-fA-F]{6}$/.test(themeColor)) {
      showMessage('请输入有效的颜色代码（如 #006eff）', 'error');
      return;
    }

    const settings = {
      secretId: secretIdInput.value.trim(),
      secretKey: secretKeyInput.value.trim(),
      sourceLang: sourceLangSelect.value,
      targetLang: targetLangSelect.value,
      termRepoIds: termRepoIds,
      enabled: enabledCheckbox.checked,
      showOriginal: showOriginalCheckbox.checked,
      themeColor: themeColor
    };

    chrome.storage.local.set(settings, () => {
      showMessage('设置已保存', 'success');
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'setEnabled',
              enabled: settings.enabled
            }).catch(() => {});
          }
        });
      });
    });
  }

  async function testTranslation() {
    const secretId = secretIdInput.value.trim();
    const secretKey = secretKeyInput.value.trim();

    if (!secretId || !secretKey) {
      showMessage('请先填写SecretId和SecretKey', 'error');
      return;
    }

    showMessage('正在测试翻译...', 'info');
    testBtn.disabled = true;

    try {
      const termRepoIdsText = termRepoIdsInput.value.trim();
      const termRepoIds = termRepoIdsText
        ? termRepoIdsText.split('\n').map(id => id.trim()).filter(id => id.length > 0)
        : [];

      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: 'Hello, World!',
        sourceLang: 'en',
        targetLang: 'zh',
        termRepoIds: termRepoIds
      });

      if (response.success) {
        showMessage(`测试成功！翻译结果: ${response.result}`, 'success');
      } else {
        showMessage(`测试失败: ${response.error}`, 'error');
      }
    } catch (error) {
      showMessage(`测试失败: ${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
    }
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message message-${type}`;
    messageDiv.style.display = 'block';
    if (type !== 'info') {
      setTimeout(() => {
        messageDiv.style.display = 'none';
      }, 3000);
    }
  }
});
