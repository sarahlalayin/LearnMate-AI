function parseDuration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), s = parseInt(m[3] || 0);
  if (h > 0) return `${h}小時${min}分`;
  if (min > 0 && s > 0) return `${min}分${s}秒`;
  if (min > 0) return `${min}分鐘`;
  return `${s}秒`;
}

async function searchYouTubeVideo(keyword) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&videoEmbeddable=true&safeSearch=strict&relevanceLanguage=zh-TW&maxResults=1&key=${key}`;
    const searchData = await (await fetch(searchUrl)).json();
    if (!searchData.items?.length) return null;
    const item = searchData.items[0];
    const videoId = item.id.videoId;
    // 取得時長（1 Quota Unit）
    const detailData = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${key}`)).json();
    const duration = parseDuration(detailData.items?.[0]?.contentDetails?.duration);
    return {
      videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      duration
    };
  } catch(e) {
    console.error('YouTube API 失敗:', e.message);
    return null;
  }
}

module.exports = {
  searchYouTubeVideo,
  parseDuration
};
