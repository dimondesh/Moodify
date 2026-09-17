import axios from "axios";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

/**
 * Call Modal Demucs endpoint; write instrumental MP3 (128k) to destPath.
 * @param {string} hlsUrl
 * @param {string} destPath
 */
export async function separateInstrumentalFromHls(hlsUrl, destPath) {
  const url = process.env.MODAL_DEMUCS_URL;
  const secret = process.env.MODAL_DEMUCS_SECRET;

  if (!url || !secret) {
    throw new Error(
      "MODAL_DEMUCS_URL and MODAL_DEMUCS_SECRET must be set to generate instrumentals",
    );
  }

  await fsp.mkdir(path.dirname(destPath), { recursive: true });

  const response = await axios.post(
    url,
    { hls_url: hlsUrl, secret },
    {
      responseType: "stream",
      timeout: 10 * 60 * 1000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 300,
    },
  );

  const writer = fs.createWriteStream(destPath);
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
    response.data.on("error", reject);
  });

  const stat = await fsp.stat(destPath);
  if (!stat.size) {
    throw new Error("Modal returned empty instrumental file");
  }

  return destPath;
}
