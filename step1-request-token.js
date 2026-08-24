const fs = require('fs');
const { buildSignature, oauthParams, buildAuthHeader, postForm } = require('./oauth-lib');

const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const AUTHORIZE_URL = 'https://api.twitter.com/oauth/authorize';

async function main() {
  const params = oauthParams({ oauth_callback: 'oob' });
  const sig = buildSignature('POST', REQUEST_TOKEN_URL, params, '');
  const header = buildAuthHeader({ ...params, oauth_signature: sig });
  const res = await postForm(REQUEST_TOKEN_URL, header);

  if (res.oauth_callback_confirmed !== 'true') {
    throw new Error('oauth_callback_confirmed が true ではありません。');
  }

  fs.writeFileSync('./.request-token.json', JSON.stringify(res, null, 2));

  console.log('\n以下のURLをブラウザで開き、リツイートさせたいアカウントでログインして連携を許可してください:\n');
  console.log(`${AUTHORIZE_URL}?oauth_token=${res.oauth_token}\n`);
  console.log('表示されたPINコードを教えてください。');
}

main().catch((err) => { console.error('エラー:', err.message); process.exit(1); });
