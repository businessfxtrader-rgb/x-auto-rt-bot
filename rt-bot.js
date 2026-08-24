// 対象アカウントの新規投稿を検知して自動リツイートする
// 使い方:
//   node rt-bot.js --dry-run   投稿の検知のみ行い、実際のRTは行わない（動作確認用）
//   node rt-bot.js             実際にRTを実行する

const fs = require('fs');
const path = require('path');
const { apiGet, apiPostJson, loadConfig } = require('./oauth-lib');
const config = loadConfig();

const STATE_FILE = path.join(__dirname, 'state.json');
const API_BASE = 'https://api.twitter.com/2';

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { lastTweetId: null };
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function getUserId(username) {
  const res = await apiGet(
    `${API_BASE}/users/by/username/${username}`,
    {},
    config.posterAccessToken,
    config.posterAccessSecret
  );
  return res.data.id;
}

async function getLatestTweets(userId) {
  const res = await apiGet(
    `${API_BASE}/users/${userId}/tweets`,
    { max_results: '5', exclude: 'replies', 'tweet.fields': 'created_at' },
    config.posterAccessToken,
    config.posterAccessSecret
  );
  return res.data || [];
}

async function retweet(myUserId, tweetId) {
  return apiPostJson(
    `${API_BASE}/users/${myUserId}/retweets`,
    { tweet_id: tweetId },
    config.posterAccessToken,
    config.posterAccessSecret
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const state = loadState();

  const targetUserId = config.targetUserId || (await getUserId(config.targetUsername));
  const tweets = await getLatestTweets(targetUserId); // newest first

  if (tweets.length === 0) {
    console.log('投稿が見つかりませんでした。');
    return;
  }

  if (!state.lastTweetId) {
    // 初回実行時は「これより新しい投稿から検知開始」の基準点を保存するだけ
    state.lastTweetId = tweets[0].id;
    saveState(state);
    console.log(`初回実行: 基準となる最新投稿(ID: ${tweets[0].id})を記録しました。次回以降、これより新しい投稿を検知します。`);
    return;
  }

  const newTweets = tweets.filter((t) => BigInt(t.id) > BigInt(state.lastTweetId));
  newTweets.reverse(); // 古い順に処理

  if (newTweets.length === 0) {
    console.log('新規投稿はありません。');
    return;
  }

  const myUserId = config.posterAccessToken.split('-')[0];

  for (const tweet of newTweets) {
    console.log(`新規投稿検知: [${tweet.id}] ${tweet.text.slice(0, 50)}...`);
    if (dryRun) {
      console.log('  → (dry-run) RTはスキップしました');
    } else {
      await retweet(myUserId, tweet.id);
      console.log('  → RTしました');
    }
    state.lastTweetId = tweet.id;
  }

  saveState(state);
}

main().catch((err) => {
  console.error('エラー:', err.message);
  process.exit(1);
});
