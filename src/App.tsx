import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Channel } from "./types";
import { parseM3U, FALLBACK_CHANNELS, getInitials } from "./utils";
import VideoPlayer from "./components/VideoPlayer";
import { motion, AnimatePresence } from "motion/react";
import { 
  Tv, 
  Settings, 
  HelpCircle, 
  Flame, 
  Download, 
  RefreshCcw, 
  SlidersHorizontal,
  FolderSync,
  Heart,
  Search,
  X,
  Coffee,
  Sun,
  Moon,
  Link2,
  Check,
  AlertCircle,
  Sparkles,
  Compass,
  Facebook
} from "lucide-react";

const DEFAULT_M3U_URL = "https://raw.githubusercontent.com/SHAJON-404/iptv/refs/heads/main/app/data/bangla.m3u";

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playlistUrl, setPlaylistUrl] = useState(DEFAULT_M3U_URL);
  const [customInputUrl, setCustomInputUrl] = useState("");
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "offline" | "fetching">("fetching");
  
  // Custom states matching TeleZo specifications
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [cosmicTheme, setCosmicTheme] = useState(true); // true = #0B0C10 (Space Blue/Grey), false = #050508 (Ultra Velvet Black)
  const [showCoffeeTip, setShowCoffeeTip] = useState(false);
  const [showM3UDrawer, setShowM3UDrawer] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // 1. Sync Favorites and Recents from Local Storage
  useEffect(() => {
    try {
      const storedFavs = localStorage.getItem("telezo_favorites_v3");
      if (storedFavs) {
        setFavorites(JSON.parse(storedFavs));
      }
      const storedRecents = localStorage.getItem("telezo_recents_v3");
      if (storedRecents) {
        setRecents(JSON.parse(storedRecents));
      }
    } catch (e) {
      console.warn("Could not retrieve local storage lists:", e);
    }
  }, []);

  // Write favorites to local updates 
  const toggleFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId];
      try {
        localStorage.setItem("telezo_favorites_v3", JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not persist local storage favorites:", e);
      }
      return updated;
    });
  }, []);

  // Add played channel to Recents context
  const addToRecents = useCallback((channelId: string) => {
    setRecents((prev) => {
      const filtered = prev.filter((id) => id !== channelId);
      const updated = [channelId, ...filtered].slice(0, 15);
      try {
        localStorage.setItem("telezo_recents_v3", JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not persist local storage recents:", e);
      }
      return updated;
    });
  }, []);

  // 2. Fetch Playlist from M3U Source
  const loadPlaylist = async (url: string) => {
    setIsLoading(true);
    setConnectionStatus("fetching");
    setImportError(null);
    try {
      if (url === DEFAULT_M3U_URL) {
        const SPORTS_M3U_URL = "https://raw.githubusercontent.com/SHAJON-404/iptv/refs/heads/main/app/data/sports.m3u";
        
        let banglaText = "";
        let sportsText = "";
        
        const [banglaRes, sportsRes] = await Promise.all([
          fetch(DEFAULT_M3U_URL),
          fetch(SPORTS_M3U_URL).catch(e => {
            console.error("Failed to fetch sports m3u", e);
            return null;
          })
        ]);

        if (banglaRes.ok) {
          banglaText = await banglaRes.text();
        } else {
          throw new Error(`Primary playlist returned status: ${banglaRes.status}`);
        }

        if (sportsRes && sportsRes.ok) {
          sportsText = await sportsRes.text();
        }

        const seenNames = new Set<string>();
        const parsedBangla = parseM3U(banglaText, undefined, seenNames);
        const parsedSports = sportsText ? parseM3U(sportsText, "Sports", seenNames) : [];

        const combined = [...parsedBangla, ...parsedSports];

        if (combined && combined.length > 0) {
          setChannels(combined);
          setPlaylistUrl(url);
          // Automatically start with BTV if available, otherwise the first channel
          const btvChannel = combined.find(
            (c) => c.name.trim().toLowerCase() === "btv"
          ) || combined.find(
            (c) => c.name.toLowerCase().includes("btv")
          ) || combined[0];
          setActiveChannel(btvChannel);
          setConnectionStatus("connected");
        } else {
          throw new Error("No channels detected in standard M3U format.");
        }
      } else {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`System returned status: ${response.status}`);
        }
        const rawText = await response.text();
        const parsed = parseM3U(rawText);

        if (parsed && parsed.length > 0) {
          setChannels(parsed);
          setPlaylistUrl(url);
          // Automatically start with BTV if available, otherwise the first channel
          const btvChannel = parsed.find(
            (c) => c.name.trim().toLowerCase() === "btv"
          ) || parsed.find(
            (c) => c.name.toLowerCase().includes("btv")
          ) || parsed[0];
          setActiveChannel(btvChannel);
          setConnectionStatus("connected");
        } else {
          throw new Error("No channels detected in standard M3U format.");
        }
      }
    } catch (error) {
      console.error("CORS block or fetch issue on github playlist, loading fallback channels", error);
      // Load robust public fallback channels so the applet is immediately functional
      setChannels(FALLBACK_CHANNELS);
      const btvChannel = FALLBACK_CHANNELS.find(
        (c) => c.name.trim().toLowerCase() === "btv"
      ) || FALLBACK_CHANNELS.find(
        (c) => c.name.toLowerCase().includes("btv")
      ) || FALLBACK_CHANNELS[0];
      setActiveChannel(btvChannel);
      setConnectionStatus("offline");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial bootstrap
  useEffect(() => {
    loadPlaylist(DEFAULT_M3U_URL);
  }, []);

  // Import custom URL action trigger
  const handleImportPlaylistUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInputUrl) {
      setImportError("Please enter a valid M3U playlist URL link.");
      return;
    }
    if (!customInputUrl.startsWith("http://") && !customInputUrl.startsWith("https://")) {
      setImportError("Playlist URL must begin with http:// or https://");
      return;
    }
    loadPlaylist(customInputUrl);
    setShowM3UDrawer(false);
  };

  // Reset to original M3U
  const handleResetPlaylist = () => {
    setCustomInputUrl("");
    loadPlaylist(DEFAULT_M3U_URL);
  };

  // Download Channel playlist as a lightweight JSON list configuration
  const handleDownloadBackup = () => {
    // Deliberately no-op as requested: clicking download will do nothing
    return;
  };

  // Derive unique categories from active channel list
  const categories = useMemo(() => {
    return ["All", "Favorites", "Bangladesh", "Kolkata", "Sports"];
  }, []);

  // Filter channels based on Search Query and Selected Tab / Category
  const activeFilteredChannels = useMemo(() => {
    return channels.filter((c) => {
      // Tab Category filter
      if (activeTab !== "All") {
        if (activeTab === "Favorites") {
          if (!favorites.includes(c.id)) return false;
        } else {
          if (c.group !== activeTab) return false;
        }
      }

      // Search Query filter
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesname = c.name.toLowerCase().includes(q);
        const matchesgroup = c.group && c.group.toLowerCase().includes(q);
        return matchesname || matchesgroup;
      }

      return true;
    });
  }, [channels, activeTab, searchQuery, favorites]);

  // Navigation Arrows click controllers
  const playNext = useCallback(() => {
    if (activeFilteredChannels.length === 0) return;
    const currentIdx = activeFilteredChannels.findIndex(c => c.id === activeChannel?.id);
    let nextIdx = currentIdx + 1;
    if (nextIdx >= activeFilteredChannels.length) nextIdx = 0;
    
    const nextChan = activeFilteredChannels[nextIdx];
    if (nextChan) {
      setActiveChannel(nextChan);
      addToRecents(nextChan.id);
    }
  }, [activeFilteredChannels, activeChannel, addToRecents]);

  const playPrev = useCallback(() => {
    if (activeFilteredChannels.length === 0) return;
    const currentIdx = activeFilteredChannels.findIndex(c => c.id === activeChannel?.id);
    let prevIdx = currentIdx - 1;
    if (prevIdx < 0) prevIdx = activeFilteredChannels.length - 1;
    
    const prevChan = activeFilteredChannels[prevIdx];
    if (prevChan) {
      setActiveChannel(prevChan);
      addToRecents(prevChan.id);
    }
  }, [activeFilteredChannels, activeChannel, addToRecents]);

  return (
    <div 
      id="main-app-container" 
      className={`min-h-screen font-sans selection:bg-purple-600/30 selection:text-white flex flex-col pb-12 transition-colors duration-700 ${
        cosmicTheme ? "bg-[#0B0C10] text-stone-100" : "bg-[#F3F4F6] text-stone-900"
      }`}
    >
      {/* Background Neon ambient gradients on active state */}
      {cosmicTheme && (
        <div className="absolute top-0 inset-x-0 h-[450px] bg-gradient-to-b from-purple-950/10 via-purple-900/0 to-transparent pointer-events-none filter blur-3xl" />
      )}

      {/* 1. Header component */}
      <header className={`relative w-full border-b backdrop-blur-md z-30 transition-all duration-300 ${
        cosmicTheme ? "border-white/[0.04] bg-black/30" : "border-stone-200 bg-white/75 shadow-sm"
      }`}>
        <div className="max-w-[850px] mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          {/* Brand block (TV icon, title, subtitle) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 bg-gradient-to-br from-purple-500 to-purple-800 rounded-xl shadow-lg shadow-purple-650/15">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-xl font-extrabold tracking-tight leading-none ${
                  cosmicTheme ? "text-white" : "text-stone-900"
                }`}>
                  Nasif Live TV
                </h1>
                <span className={`px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-widest rounded uppercase ${
                  cosmicTheme 
                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" 
                    : "bg-purple-600/10 text-purple-600 border border-purple-600/20"
                }`}>
                  Nasif OTT
                </span>
              </div>
              <p className={`text-[10px] font-sans mt-1 ${
                cosmicTheme ? "text-stone-400" : "text-stone-600"
              }`}>
                Live TV Streaming
              </p>
            </div>
          </div>

          {/* Right side Utility Icons (theme toggle & Facebook link) */}
          <div className="flex items-center gap-3">
            {/* Sun/theme toggle button */}
            <button
              id="btn-theme-toggle"
              onClick={() => setCosmicTheme(!cosmicTheme)}
              className={`p-2 rounded-xl border transition-all duration-150 cursor-pointer ${
                cosmicTheme
                  ? "bg-white/[0.03] hover:bg-white/[0.08] text-stone-400 hover:text-white border-white/[0.05]"
                  : "bg-white hover:bg-stone-100 text-stone-600 hover:text-stone-900 border-stone-200 shadow-sm"
              }`}
              title="Toggle theme contrast"
            >
              {cosmicTheme ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Facebook direct contact link */}
            <a
              id="btn-facebook-link"
              href="https://www.facebook.com/share/1HWoW9pp35/"
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-xl border transition-all duration-150 flex items-center justify-center cursor-pointer ${
                cosmicTheme
                  ? "bg-white/[0.03] hover:bg-purple-500/15 text-stone-400 hover:text-purple-400 border-white/[0.05]"
                  : "bg-white hover:bg-stone-100 text-[#1877F2] border-stone-200 shadow-sm"
              }`}
              title="Contact Nasif on Facebook"
            >
              <Facebook className="w-4.5 h-4.5" />
            </a>
          </div>
        </div>
      </header>

      {/* 2. Interactive Tip & Drawer Sections */}
      <div className="w-full max-w-[850px] mx-auto px-4 mt-4">
        {/* Custom M3U Paste Box Drawer */}
        <AnimatePresence>
          {showM3UDrawer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <form 
                onSubmit={handleImportPlaylistUrl}
                className={`p-5 border rounded-2xl flex flex-col gap-3.5 shadow-xl transition-all duration-300 ${
                  cosmicTheme ? "bg-[#12141C] border-white/[0.05]" : "bg-white border-stone-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h4 className={`text-xs font-bold ${cosmicTheme ? "text-stone-200" : "text-stone-800"}`}>Load M3U Stream Playlist Link</h4>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowM3UDrawer(false)} 
                    className="text-stone-500 hover:text-red-500 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <input
                    id="input-custom-m3u-url"
                    type="url"
                    value={customInputUrl}
                    onChange={(e) => setCustomInputUrl(e.target.value)}
                    placeholder="https://example.com/live-tv-playlist.m3u"
                    className={`w-full border rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-1 transition duration-150 ${
                      cosmicTheme 
                        ? "bg-[#0B0C10] border-white/[0.06] text-white placeholder-stone-600 focus:border-purple-500/80 focus:ring-purple-500/20" 
                        : "bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400 focus:border-purple-500 focus:ring-purple-500/20"
                    }`}
                  />
                  {importError && (
                    <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-sans mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{importError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={handleResetPlaylist}
                    className={`text-[11px] font-sans flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border transition duration-150 cursor-pointer ${
                      cosmicTheme 
                        ? "text-stone-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05]" 
                        : "text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border-stone-200"
                    }`}
                  >
                    <RefreshCcw className="w-3 h-3" />
                    Reset to Default Bangla
                  </button>
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-[11px] font-sans px-4.5 py-2.5 rounded-xl flex items-center gap-1.5 transition duration-150 cursor-pointer shadow-lg shadow-purple-900/15"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Sync Playlist Link
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Main Container Stack (Centered stack below the header) */}
      <main className={`flex-1 w-full mx-auto flex flex-col gap-5 transition-all duration-500 ease-out ${
        isTheaterMode ? "max-w-full px-0" : "max-w-[850px] px-4"
      }`}>
        
        {/* A. Live Video Player centered */}
        <section id="player-view-section" className="w-full">
          <VideoPlayer
            channel={activeChannel}
            isFavorite={activeChannel ? favorites.includes(activeChannel.id) : false}
            onToggleFavorite={() => activeChannel && toggleFavorite(activeChannel.id)}
            isTheaterMode={isTheaterMode}
            onToggleTheaterMode={() => setIsTheaterMode(!isTheaterMode)}
            onPlayPrev={playPrev}
            onPlayNext={playNext}
          />
        </section>

        {/* Centralised contents wrapper for Theater Mode to keep grid, tabs and search centered */}
        <div className={`w-full mx-auto flex flex-col gap-5 ${isTheaterMode ? "max-w-[850px] px-4" : ""}`}>
          {/* B. Full-width, pill-shaped dark input search bar */}
          <section id="search-bar-section" className="w-full">
            <div className="relative">
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${
                cosmicTheme ? "text-stone-500" : "text-stone-400"
              }`} />
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search channel lists..."
                className={`w-full border rounded-full pl-11 pr-10 py-3.5 text-sm focus:outline-none focus:ring-4 transition-all duration-300 shadow-sm ${
                  cosmicTheme 
                    ? "bg-[#0F1115] hover:bg-[#121419] border-white/[0.04] text-white placeholder-stone-500 focus:border-purple-500/50 focus:ring-purple-500/10" 
                    : "bg-white hover:bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400 focus:border-purple-500 focus:ring-purple-500/10"
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-0.5 transition duration-150 ${
                    cosmicTheme ? "text-stone-400 hover:text-white hover:bg-white/5" : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                  }`}
                  title="Clear Search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </section>

          {/* C. Horizontal Scrolling Filter Tabs */}
          <section id="filter-tabs-section" className="w-full overflow-hidden">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 cursor-grab active:cursor-grabbing scroll-smooth">
              {categories.map((tab) => {
                // Custom human-friendly label mapping for standard tabs
                let tabLabel = tab;
                const count = tab === "All" 
                  ? channels.length 
                  : tab === "Favorites"
                    ? favorites.length
                    : channels.filter(c => c.group === tab).length;
                tabLabel = `${tab} (${count})`;

                const isActive = activeTab === tab;

                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                    }}
                    className={`flex-shrink-0 px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 border cursor-pointer ${
                      isActive
                        ? "bg-[#7B2CBF] border-[#7B2CBF] text-white shadow-lg shadow-purple-900/25 scale-[1.03]"
                        : cosmicTheme
                          ? "bg-[#121415]/60 hover:bg-[#16191b] text-stone-400 hover:text-stone-100 border-white/[0.04]"
                          : "bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 border-stone-200 shadow-sm"
                    }`}
                  >
                    {tabLabel}
                  </button>
                );
              })}
            </div>
          </section>

          {/* D. Responsive Channel Grid directory */}
          <section id="channels-grid-section" className="w-full mt-1.5 flex-1">
            {isLoading ? (
              <div className="py-24 flex flex-col items-center justify-center text-center gap-3">
                <div className="relative flex items-center justify-center w-12 h-12">
                  <div className="absolute inset-0 w-full h-full border-2 border-t-purple-600 border-white/5 rounded-full animate-spin"></div>
                </div>
                <p className={`text-xs font-sans ${cosmicTheme ? "text-stone-400" : "text-stone-600"}`}>
                  Reading and parsing M3U streaming playlist indexes...
                </p>
              </div>
            ) : activeFilteredChannels.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {activeFilteredChannels.map((channel) => {
                  const isPlayingCard = activeChannel?.id === channel.id;

                  return (
                    <div
                      key={channel.id}
                      onClick={async () => {
                        // Scroll up to the video player container smoothly
                        document.getElementById("player-view-section")?.scrollIntoView({ behavior: "smooth" });

                        if (channel.isTSports) {
                          try {
                            const res = await fetch("https://raw.githubusercontent.com/byte-capsule/TSports-m3u8-Grabber/main/TSports_m3u8_headers.Json");
                            if (res.ok) {
                              const data = await res.json();
                              if (data && data.channels && data.channels[0]) {
                                const updatedChannel = {
                                  ...channel,
                                  streamUrl: data.channels[0].link || channel.streamUrl,
                                  headers: data.channels[0].headers || undefined
                                };
                                setActiveChannel(updatedChannel);
                                addToRecents(channel.id);
                                return;
                              }
                            }
                          } catch (err) {
                            console.error("Error fetching T Sports config on click:", err);
                          }
                        }
                        setActiveChannel(channel);
                        addToRecents(channel.id);
                      }}
                      className={`relative flex flex-col items-center justify-between p-4 border rounded-2xl cursor-pointer transition-all duration-300 aspect-square text-center select-none ${
                        isPlayingCard
                          ? "border-[#7B2CBF] bg-[#7B2CBF]/5 shadow-[0_0_15px_rgba(123,44,191,0.25)] scale-[1.02]"
                          : cosmicTheme
                            ? "bg-[#12141C] border-white/[0.04] hover:bg-[#161a26]/75 hover:border-white/10 text-white"
                            : "bg-white border-stone-200 hover:bg-stone-50 hover:border-stone-300 hover:shadow-md text-stone-900"
                      }`}
                    >
                      {/* Centered Logo Box (with white background) */}
                      <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center p-1.5 overflow-hidden shadow-inner shrink-0 mt-1">
                        {channel.logo ? (
                          <img
                            src={channel.logo}
                            alt={channel.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent && !parent.querySelector(".fallback-text")) {
                                const fallbackText = document.createElement("span");
                                fallbackText.className = "fallback-text text-purple-600 font-extrabold text-xs tracking-wider";
                                fallbackText.innerText = getInitials(channel.name);
                                parent.appendChild(fallbackText);
                              }
                            }}
                          />
                        ) : (
                          <span className="fallback-text text-[#7B2CBF] font-extrabold text-xs tracking-wider">
                            {getInitials(channel.name)}
                          </span>
                        )}
                      </div>

                      {/* M3U Category tags indicator / Active tag dot */}
                      {isPlayingCard && (
                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_6px_#a855f7]" />
                      )}

                      {/* Channel name printed in custom text at the bottom */}
                      <div className="w-full mt-2">
                        <p className={`text-[12px] font-semibold truncate w-full tracking-wide leading-tight ${
                          isPlayingCard || cosmicTheme ? "text-white" : "text-stone-800"
                        }`}>
                          {channel.name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`py-20 border rounded-2xl text-center p-6 flex flex-col items-center justify-center ${
                cosmicTheme ? "bg-[#12141C]/60 border-white/[0.04]" : "bg-white border-stone-200"
              }`}>
                <div className="p-3 bg-stone-950 border border-stone-850 rounded-full mb-3 text-stone-600">
                  <Search className="w-6 h-6 text-purple-500/70" />
                </div>
                <h5 className={`text-sm font-semibold ${cosmicTheme ? "text-stone-300" : "text-stone-800"}`}>
                  No IPTV Stations Detected
                </h5>
                <p className="text-xs text-stone-500 mt-1 max-w-sm leading-relaxed">
                  No stations match active category search query. Try typing something else or click <strong>Reset Playlist</strong> in the load drawer menu at the top.
                </p>
              </div>
            )}
          </section>
        </div>

      </main>

      {/* 4. Footer */}
      <footer className={`mt-16 text-center text-xs border-t pt-8 max-w-[850px] mx-auto w-full px-4 flex items-center justify-center transition-all duration-300 ${
        cosmicTheme ? "text-stone-500 border-white/[0.04]" : "text-stone-600 border-stone-200"
      }`}>
        <p className="font-sans">
          © 2026 Nasif Live TV Streaming Player
        </p>
      </footer>

    </div>
  );
}
