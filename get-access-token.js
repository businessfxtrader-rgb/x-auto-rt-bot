// PIN方式のOAuth1.0a 3-legged認証で、任意のXアカウント用のAccess Token/Secretを発行するスクリプト
// 使い方: node get-access-token.js

const crypto = require('crypto');
const readline = require('readline');
const { consumerKey, consumerSecret } = require('./config.json');

const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const AUTHORIZE_URL = 'https://api.twitter.com/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function buildSignature(method, url, params, tokenSecret) {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');
  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&');
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret || '')}`;
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function oauthParams(extra = {}) {
  return {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    ...extra,
  };
}

function buildAuthHeader(params) {
  const parts = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(params[k])}"`);
  return 'OAuth ' + parts.join(', ');
}

async function postForm(url, authHeader) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return Object.fromEntries(new URLSearchParams(text));
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function main() {
  // Step 1: request token
  const step1Params = oauthParams({ oauth_callback: 'oob' });
  const sig1 = buildSignature('POST', REQUEST_TOKEN_URL, step1Params, '');
  const header1 = buildAuthHeader({ ...step1Params, oauth_signature: sig1 });
  const reqTokenRes = await postForm(REQUEST_TOKEN_URL, header1);

  if (reqTokenRes.oauth_callback_confirmed !== 'true') {
    throw new Error('oauth_callback_confirmed が true ではありません。Consumer Key/Secretを確認してください。');
  }

  const { oauth_token: requestToken, oauth_token_secret: requestTokenSecret } = reqTokenRes;

  console.log('\n以下のURLをブラウザで開き、リツイートさせたいアカウント（minna_tsunagaruなど）でログインして連携を許可してください:\n');
  console.log(`${AUTHORIZE_URL}?oauth_token=${requestToken}\n`);

  const pin = await ask('表示されたPINコードを入力してください: ');

  // Step 2: access token
  const step2Params = oauthParams({ oauth_token: requestToken, oauth_verifier: pin.trim() });
  const sig2 = buildSignature('POST', ACCESS_TOKEN_URL, step2Params, requestTokenSecret);
  const header2 = buildAuthHeader({ ...step2Params, oauth_signature: sig2 });
  const accessRes = await postForm(ACCESS_TOKEN_URL, header2);

  console.log('\n=== 発行結果 ===');
  console.log('screen_name   :', accessRes.screen_name);
  console.log('user_id       :', accessRes.user_id);
  console.log('access_token  :', accessRes.oauth_token);
  console.log('access_secret :', accessRes.oauth_token_secret);
  console.log('\nscreen_nameが想定のアカウントと一致しているか確認してください。');
}

main().catch((err) => {
  console.error('エラー:', err.message);
  process.exit(1);
});
