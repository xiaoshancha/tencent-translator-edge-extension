document.addEventListener('DOMContentLoaded', () => {
  const enabledToggle = document.getElementById('enabledToggle');
  const toggleLabel = document.getElementById('toggleLabel');
  const inputText = document.getElementById('inputText');
  const outputText = document.getElementById('outputText');
  const sourceLang = document.getElementById('sourceLang');
  const targetLang = document.getElementById('targetLang');
  const translateBtn = document.getElementById('translateBtn');
  const settingsLink = document.getElementById('settingsLink');

  chrome.storage.local.get(['enabled', 'sourceLang', 'targetLang'], (result) => {
    enabledToggle.checked = result.enabled !== false;
    toggleLabel.textContent = enabledToggle.checked ? '已启用' : '已禁用';
    if (result.sourceLang) sourceLang.value = result.sourceLang;
    if (result.targetLang) targetLang.value = result.targetLang;
  });

  enabledToggle.addEventListener('change', () => {
    const enabled = enabledToggle.checked;
    toggleLabel.textContent = enabled ? '已启用' : '已禁用';
    chrome.storage.local.set({ enabled });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setEnabled',
          enabled
        }).catch(() => {});
      }
    });
  });

  translateBtn.addEventListener('click', async () => {
    const text = inputText.value.trim();
    if (!text) {
      outputText.innerHTML = '<span class="placeholder">请输入要翻译的文本</span>';
      return;
    }
    outputText.innerHTML = '<span class="loading">翻译中...</span>';
    translateBtn.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text,
        sourceLang: sourceLang.value,
        targetLang: targetLang.value
      });
      if (response.success) {
        outputText.textContent = response.result;
      } else {
        outputText.innerHTML = `<span class="error">${response.error}</span>`;
      }
    } catch (error) {
      outputText.innerHTML = '<span class="error">翻译失败，请检查网络和API配置</span>';
    } finally {
      translateBtn.disabled = false;
    }
  });

  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  inputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      translateBtn.click();
    }
  });
});
