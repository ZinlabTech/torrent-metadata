import express from "express";
import { isValidTorrentData } from "../middlewares.js";
import { log } from "../utils.js";
import WebTorrent, { type Torrent } from "webtorrent";
import WebtorrentHealth from "webtorrent-health";

const router = express.Router();
const SITE_URL = process.env.SITE_URL;
const METADATA_FETCH_TIMEOUT = 6000; // in ms
const webtorrent = new WebTorrent();

interface Response {
  name: string,
  infoHash: string,
  magnetURI: string,
  peers: string | number,
  seeders?: string | number,
  created: Date,
  createdBy: string,
  comment:string,
  announce: string[],
  files: {
    name: string,
    size: number,
    path: string
  }[],
}

const constructData = async (torrent: Torrent) => {

  let data : Response = {
    name: torrent.name,
    infoHash: torrent.infoHash,
    magnetURI: torrent.magnetURI,
    peers: torrent.numPeers,
    created: torrent.created,
    createdBy: torrent.createdBy,
    comment: torrent.comment,
    announce: torrent.announce,
    files: torrent.files.map((file) => ({
      name: file.name,
      size: file.length,
      path: file.path,
    })),
  };

  // await WebtorrentHealth(torrent.magnetURI, function(err, dataHealth){
  //   if (err) return;

  //   if(dataHealth.peers !== 0) {
  //     data.peers = dataHealth.peers;
  //   }
  //   if(dataHealth.seeds !== 0) {
  //     data.seeders = dataHealth.seeds;
  //   }
  // });

  const webtorrentData = async () => {
    return await fetch(`http://185.145.245.13:3033/check?magnet=${encodeURIComponent(torrent.magnetURI)}`)
                .then(res => res.json());
  }

  await webtorrentData().then(webtorrentData => {
    data.seeders = webtorrentData.seeds;
    data.peers = webtorrentData.peers;
  });

  return data;
};

router.get("/", (_, res) => {
  if (process.env.NODE_ENV === "production" && SITE_URL) {
    return res.redirect(301, SITE_URL);
  }
  res.status(200).json({ status: "ok" });
});

router.get("/ping", (req, res) => {
  res.send(`pong: ${Date.now() - req.startTime}ms`);
});

// This has to come first for `req.parsedTorrent` to be validated and populated
router.post("/", isValidTorrentData);

router.post("/", async (req, res) => {
  log("Init POST ...");
  const parsedTorrent = req.parsedTorrent;
  let torrent = webtorrent.add(parsedTorrent, {
    destroyStoreOnDestroy: true,
  });

  // If the torrent doesn't have enough peers to retrieve metadata, return
  // limited info we get from parsing the magnet URI (the parsed metadata is guaranteed
  // to have `infoHash` field)
  const timeoutID = setTimeout(async () => {
    webtorrent.remove(torrent, {}, () => {
      log("Timeout while fetching torrent metadata.");
    });

    torrent = webtorrent.add(parsedTorrent, {
      destroyStoreOnDestroy: true,
    });

    const timeoutID = setTimeout(async () => {
      webtorrent.remove(torrent, {}, () => {
        log("Timeout while fetching torrent metadata.");
      });
  
      res.status(200).json({
        data: await constructData(torrent),
        message:
          "The torrent provided doesn't seem to have enough peers to fetch metadata. Returning limited info.",
      });
    }, METADATA_FETCH_TIMEOUT);
    
  }, METADATA_FETCH_TIMEOUT);

  torrent.on("metadata", async () => {
    log("Metadata parsed...");
    clearTimeout(timeoutID);
    let dataObj = await constructData(torrent);
    res.json({ data: dataObj });
    
    webtorrent.remove(torrent, {}, () => {
      log("Torrent removed.");
    });
  });
});

export default router;
