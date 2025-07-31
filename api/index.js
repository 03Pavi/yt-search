import express from 'express';
import cors from 'cors';
import { Innertube } from 'youtubei.js';
import { YouTube } from 'youtube-sr';
import ytdl from '@distube/ytdl-core';
import * as dotenv from "dotenv"

dotenv.config()

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

let yt;

(async () => {
  yt = await Innertube.create();
})();

app.get('/search', async (req, res) => {
  const query = req.query.q;
  const limit = parseInt(req.query.limit || '10', 10);
  if (!query) {
    return res.status(400).json({ error: 'Missing search query' });
  }
  try {
const results = await YouTube.search(query, { type: 'video' });

res.json(results.slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/video/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const videoInfo = await yt.getShortsVideoInfo(videoId);
    console.log(videoInfo,'videoInfo')
    res.json({
      title: videoInfo.basic_info.title,
      author: videoInfo.basic_info.author,
      duration: videoInfo.basic_info.duration,
      thumbnails: videoInfo.basic_info.thumbnail,
      description: videoInfo.basic_info.description,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not get video details' });
  }
});



app.get('/download/:id', async (req, res) => {
  const videoId = req.params.id;

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}.mp4"`);

    ytdl(url, {
      quality: 'highest',
      filter: 'audioandvideo',
    }).pipe(res);
  } catch (err) {
    console.error('❌ ytdl download error:', err);
    res.status(500).json({ error: 'Could not download video' });
  }
});


app.get('/related/:id', async (req, res) => {
  try {
    const videoId = req.params.id;

    const info = await yt.getBasicInfo(videoId);
    const related = info.related_items ?? [];

    const formatted = related.map((item) => ({
      id: item.id,
      title: item.title,
      duration: item.duration,
      thumbnail: item.thumbnails?.[0]?.url,
      channel: {
        name: item.author?.name,
        id: item.author?.id,
        icon: item.author?.thumbnails?.[0]?.url,
      },
      url: `https://www.youtube.com/watch?v=${item.id}`,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('❌ Failed to fetch related videos:', err);
    res.status(500).json({ error: 'Could not get related videos' });
  }
});


app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});