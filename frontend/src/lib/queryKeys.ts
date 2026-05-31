export const queryKeys = {
  artists: ["artists"] as const,
  artist: (id: string) => ["artists", id] as const,
  artistAppearsOn: (id: string) => ["artists", id, "appears-on"] as const,
  album: (id: string) => ["albums", id] as const,
  albums: ["albums"] as const,
  playlists: {
    my: ["playlists", "my"] as const,
    owned: ["playlists", "owned"] as const,
    public: ["playlists", "public"] as const,
    recommended: ["playlists", "recommended"] as const,
    detail: (id: string) => ["playlists", id] as const,
    recommendations: (id: string) => ["playlists", id, "recommendations"] as const,
  },
  home: {
    bootstrap: (authKey: string) => ["home", "bootstrap", authKey] as const,
    secondary: ["home", "secondary"] as const,
  },
  hubs: {
    list: ["hubs", "list"] as const,
    detail: (id: string) => ["hubs", id] as const,
  },
  listenHistory: ["songs", "history"] as const,
  search: {
    results: (q: string) => ["search", "results", q] as const,
    recent: ["search", "recent"] as const,
  },
  profile: {
    data: (userId: string) => ["profile", userId] as const,
  },
};
