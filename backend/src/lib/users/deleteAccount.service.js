import { User } from "../../models/user.model.js";
import { Playlist } from "../../models/playlist.model.js";
import { SavedPlaylist } from "../../models/savedPlaylist.model.js";
import { SavedAlbum } from "../../models/savedAlbum.model.js";
import { LikedSong } from "../../models/likedSong.model.js";
import { FollowedArtist } from "../../models/followedArtist.model.js";
import { RecentSearch } from "../../models/recentSearch.model.js";
import { ListenHistory } from "../../models/listenHistory.model.js";
import { RecentActivity } from "../../models/recentActivity.model.js";
import { HomeFeed } from "../../models/homeFeed.model.js";
import { FollowedUser } from "../../models/followedUser.model.js";
import { Message } from "../../models/message.model.js";
import { deletePlaylistCoverFromCdn } from "../playlists/playlistCover.service.js";
import { deleteImageVariants } from "../media/imageVariants.service.js";
import { purgeUserListeningState } from "../activity/activityPersistence.service.js";

export class DeleteAccountError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Permanently removes a user and all associated data from MongoDB and CDN.
 * @param {import("mongoose").Types.ObjectId | string} userId
 */
export async function deleteUserAccount(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new DeleteAccountError(404, "User not found");
  }
  if (user.role === "admin") {
    throw new DeleteAccountError(403, "Admin accounts cannot be deleted");
  }

  const userPlaylists = await Playlist.find({
    $or: [{ owner: userId }, { madeFor: userId }],
  }).lean();

  const playlistIds = userPlaylists.map((p) => p._id);

  if (playlistIds.length > 0) {
    await SavedPlaylist.deleteMany({ playlist: { $in: playlistIds } });
  }

  await Promise.allSettled(
    userPlaylists.map((playlist) => deletePlaylistCoverFromCdn(playlist)),
  );

  if (playlistIds.length > 0) {
    await Playlist.deleteMany({ _id: { $in: playlistIds } });
  }

  await Promise.all([
    SavedAlbum.deleteMany({ user: userId }),
    LikedSong.deleteMany({ user: userId }),
    FollowedArtist.deleteMany({ user: userId }),
    RecentSearch.deleteMany({ user: userId }),
    ListenHistory.deleteMany({ user: userId }),
    RecentActivity.deleteMany({ userId }),
    HomeFeed.deleteMany({ userId }),
    FollowedUser.deleteMany({
      $or: [{ follower: userId }, { following: userId }],
    }),
    Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    }),
    SavedPlaylist.deleteMany({ user: userId }),
    RecentSearch.deleteMany({ item: userId, itemType: "User" }),
  ]);

  await purgeUserListeningState(userId);

  try {
    await deleteImageVariants(user);
  } catch (err) {
    console.error(`[deleteAccount] CDN avatar cleanup failed for ${userId}:`, err);
  }

  await User.deleteOne({ _id: userId });
}
