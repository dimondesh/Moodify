/**
 * ponytail: assert SpotifyRateLimitError shape.
 * Run: node src/lib/integrations/spotifyRateLimit.check.js
 */
import assert from "node:assert/strict";
import { SpotifyRateLimitError } from "./spotifyService.js";

const err = new SpotifyRateLimitError(12);
assert.equal(err.isSpotifyRateLimit, true);
assert.equal(err.statusCode, 429);
assert.equal(err.retryAfterSec, 12);
assert.equal(new SpotifyRateLimitError(NaN).retryAfterSec, 30);

console.log("spotifyRateLimit.check: ok");
