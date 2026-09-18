import axios from "axios";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

/**
 * Send an audio URL to Modal Demucs; write instrumental MP3 to destPath.
 * @param {string} audioUrl - public HTTPS URL (deemix MP3 on Bunny, or song HLS)
 * @param {string} destPath
 */
export async function separateInstrumentalFromUrl(audioUrl, destPath) {
  const url = process.env.MODAL_DEMUCS_URL;
  const secret = process.env.MODAL_DEMUCS_SECRET;

  if (!url || !secret) {
    throw new Error(
      "MODAL_DEMUCS_URL and MODAL_DEMUCS_SECRET must be set to generate instrumentals",
    );
  }

  await fsp.mkdir(path.dirname(destPath), { recursive: true });

  let response;
  try {
    response = await axios.post(
      url,
      { audio_url: audioUrl, secret },
      {
        responseType: "stream",
        timeout: 10 * 60 * 1000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );
  } catch (err) {
    const status = err.response?.status;
    let detail = "";
    try {
      const data = err.response?.data;
      if (data && typeof data.pipe === "function") {
        const chunks = [];
        for await (const chunk of data) chunks.push(chunk);
        detail = Buffer.concat(chunks).toString("utf8").slice(0, 500);
      } else if (typeof data === "string") {
        detail = data.slice(0, 500);
      } else if (data) {
        detail = JSON.stringify(data).slice(0, 500);
      }
    } catch {
      /* ignore */
    }
    throw new Error(
      `Modal demucs failed${status ? ` (${status})` : ""}: ${detail || err.message}`,
    );
  }

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
