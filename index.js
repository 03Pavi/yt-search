import express from 'express';
import cors from 'cors';
import { Innertube } from 'youtubei.js';
import { YouTube } from 'youtube-sr';
import * as dotenv from "dotenv"
import morgan from "morgan"

import { Readable } from 'stream';

function webStreamToNodeStream(webStream) {
  const reader = webStream.getReader();

  return new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null); // no more data
        } else {
          this.push(Buffer.from(value)); // push chunk to node stream
        }
      } catch (err) {
        this.destroy(err);
      }
    },
  });
}


dotenv.config()

const app = express();
const port = process.env.PORT || 3000;
app.use(morgan("tiny"))
app.use(cors());
app.use(express.json());

let yt;

const startServer = async () => {
  try {
    yt = await Innertube.create({
      cookies: process.env.YT_COOKIES
    });
    app.listen(port, () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("❌ Failed to initialize Innertube:", err);
  }
};

startServer();



app.get("/", (req, res) => {
  res.type("text").send(`

          server is up and running:

          Available routes:

          1.) /search?q={query}&limit={limit}
          2.) /video/{id}
          3.) /download/{id}
          4.) /related/{id}
          
`);
});

app.get("/trendings", async (req, res) => {
  try {
    const trending = await yt.getTrending();
    res.json(trending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



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
      description: videoInfo.basic_info.short_description,
      keywords: videoInfo.basic_info.keywords,
      embed: videoInfo.basic_info.embed,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not get video details' });
  }
});


app.get('/download/:id', async (req, res) => {
  const videoId = req.params.id;
  const quality = req.query.quality || 'best';
  const type = req.query.type || 'video+audio';

  try {
    let info;
    try {
      info = await yt.getInfo(videoId);
    } catch {
      info = await yt.getShortsVideoInfo(videoId); // fallback for shorts
    }

    // Try normal format selection first
    let format = info.chooseFormat({ quality, type });
    let url = format?.url || null;

    // Fallback: check if server_abr_streaming_url exists
    if (!url && info.streaming_data?.server_abr_streaming_url) {
      url = info.streaming_data.server_abr_streaming_url;
    }

    if (!url) {
      return res.status(404).json({ error: 'No direct stream URL found' });
    }

    res.json({ url });
  } catch (err) {
    console.error('❌ Failed to get stream data:', err);
    res.status(500).json({ error: 'Could not retrieve video URL' });
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
