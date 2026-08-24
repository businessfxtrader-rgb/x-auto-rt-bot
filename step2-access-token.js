const fs = require('fs');
const { buildSignature, oauthParams, buildAuthHeader, postForm } = require('./oauth-lib');

const ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';

async function main() {
  const pin = process.argv[2];
  if (!pin) {
    console.error('使い方: node step2-access-token.js <PIN>');
    process.exit(1);
  }

  const { oauth_token: requestToken, oauth_token_secret: requestTokenSecret } =
    JSON.parse(fs.readFileSync('./.request-token.json', 'utf8'));

  const params = oauthParams({ oauth_token: requestToken, oauth_verifier: pin.trim() });
  const sig = buildSignature('POST', ACCESS_TOKEN_URL, params, requestTokenSecret);
  const header = buildAuthHeader({ ...params, oauth_signature: sig });
  const res = await postForm(ACCESS_TOKEN_URL, header);

  console.log('\n=== 発行結果 ===');
  console.log('screen_name   :', res.screen_name);
  console.log('user_id       :', res.user_id);
  console.log('access_token  :', res.oauth_token);
  console.log('access_secret :', res.oauth_token_secret);
  console.log('\nscreen_nameが想定のアカウントと一致しているか確認してください。');

  fs.unlinkSync('./.request-token.json');
}

main().catch((err) => { console.error('エラー:', err.message); process.exit(1); });
