async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, message) {
  const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const msgBuffer = new TextEncoder().encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
  return new Uint8Array(signature);
}

function getDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['secretId', 'secretKey', 'sourceLang', 'targetLang', 'termRepoIds'], (result) => {
      resolve({
        secretId: result.secretId || '',
        secretKey: result.secretKey || '',
        sourceLang: result.sourceLang || 'auto',
        targetLang: result.targetLang || 'zh',
        termRepoIds: result.termRepoIds || []
      });
    });
  });
}

async function generateSignature(secretId, secretKey, service, action, payload, region, version) {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = getDate(timestamp);
  const host = `${service}.tencentcloudapi.com`;
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const contentType = 'application/json; charset=utf-8';
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedPayload = await sha256(payload);
  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;
  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = await sha256(canonicalRequest);
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;
  const secretDate = await hmacSha256(`TC3${secretKey}`, date);
  const secretService = await hmacSha256(secretDate, service);
  const secretSigning = await hmacSha256(secretService, 'tc3_request');
  const signatureArray = await hmacSha256(secretSigning, stringToSign);
  const signature = Array.from(signatureArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { authorization, timestamp, host };
}

async function translateText(text, sourceLang, targetLang, termRepoIds) {
  const { secretId, secretKey, sourceLang: defaultSource, targetLang: defaultTarget, termRepoIds: defaultTermRepoIds } = await getCredentials();
  
  if (!secretId || !secretKey) {
    throw new Error('请先在设置中配置腾讯云API密钥');
  }
  
  const service = 'tmt';
  const action = 'TextTranslate';
  const version = '2018-03-21';
  const region = 'ap-guangzhou';
  const src = sourceLang || defaultSource;
  const tgt = targetLang || defaultTarget;
  
  const payloadObj = {
    SourceText: text,
    Source: src,
    Target: tgt,
    ProjectId: 0
  };
  
  const termIds = termRepoIds || defaultTermRepoIds;
  if (termIds && termIds.length > 0) {
    payloadObj.TermRepoIDList = termIds;
  }
  
  const payload = JSON.stringify(payloadObj);
  const { authorization, timestamp, host } = await generateSignature(secretId, secretKey, service, action, payload, region, version);
  
  const response = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json; charset=utf-8',
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': version,
      'X-TC-Region': region
    },
    body: payload
  });
  
  if (!response.ok) {
    throw new Error(`翻译请求失败: ${response.status}`);
  }
  
  const result = await response.json();
  if (result.Response && result.Response.Error) {
    throw new Error(result.Response.Error.Message || '翻译失败');
  }
  
  return result.Response?.TargetText || '';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    translateText(request.text, request.sourceLang, request.targetLang, request.termRepoIds)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getSettings') {
    getCredentials().then(settings => sendResponse(settings));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translateSelection',
    title: '翻译选中文本',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translateSelection' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showTranslation',
      text: info.selectionText
    });
  }
});
