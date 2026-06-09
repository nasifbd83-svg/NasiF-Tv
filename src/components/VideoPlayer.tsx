import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Channel } from "../types";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  RotateCw, 
  Tv, 
  Info, 
  Star, 
  Activity, 
  Sparkles, 
  Sliders, 
  Flame,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Settings
} from "lucide-react";

interface VideoPlayerProps {
  channel: Channel | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isTheaterMode: boolean;
  onToggleTheaterMode: () => void;
  onPlayPrev?: () => void;
  onPlayNext?: () => void;
}

export default function VideoPlayer({
  channel,
  isFavorite,
  onToggleFavorite,
  isTheaterMode,
  onToggleTheaterMode,
  onPlayPrev,
  onPlayNext,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  
  // Custom YouTube-like features states
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [seekOverlay, setSeekOverlay] = useState<{ show: boolean; text: string; side: "left" | "right" }>({
    show: false,
    text: "",
    side: "left"
  });
  const [clickTimeout, setClickTimeout] = useState<number | null>(null);

  // Video Fit Mode: "contain" (Fit), "fill" (Stretch), "cover" (Zoom/Crop)
  const [fitMode, setFitMode] = useState<"contain" | "fill" | "cover">("contain");

  const toggleFitMode = () => {
    setFitMode((prev) => {
      let nextMode: "contain" | "fill" | "cover" = "contain";
      if (prev === "contain") {
        nextMode = "fill";
      } else if (prev === "fill") {
        nextMode = "cover";
      } else {
        nextMode = "contain";
      }

      // Display beautiful feedback overlay
      setSeekOverlay({
        show: true,
        text: nextMode === "contain" ? "Fit (Original)" : nextMode === "fill" ? "Stretch (Full)" : "Zoom (Crop)",
        side: "right"
      });

      setTimeout(() => {
        setSeekOverlay((curr) => {
          if (curr.text.includes("Fit") || curr.text.includes("Stretch") || curr.text.includes("Zoom")) {
            return { ...curr, show: false };
          }
          return curr;
        });
      }, 1000);

      return nextMode;
    });
  };

  // Advanced realtime stream stats
  const [stats, setStats] = useState({
    resolution: "Auto",
    bitrate: "0 Kbps",
    buffer: "0s",
    codec: "H.264",
  });

  const controlsTimeoutRef = useRef<number | null>(null);

  // Keyboard controls & click timeouts cleanup
  useEffect(() => {
    return () => {
      if (clickTimeout) window.clearTimeout(clickTimeout);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
  }, [clickTimeout]);

  // Handle stream loading and Hls playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset player state
    setIsLoading(true);
    setErrorText(null);
    setIsPlaying(false);

    let active = true;

    // Destroy previous HLS player
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!channel) {
      setIsLoading(false);
      return;
    }

    const startPlayback = (streamUrl: string, headers?: Record<string, string>) => {
      if (!active) return () => {};

      // Direct playback for browsers supporting HLS natively (Safari / iOS Chrome)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.load();
        
        const onLoadedMetadata = () => {
          if (!active) return;
          setIsLoading(false);
          video.playbackRate = playbackRate; // Restore chosen speed
          video.play()
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.log("Autoplay blocked:", err);
              setIsPlaying(false);
            });
        };

        const onError = () => {
          if (!active) return;
          setErrorText(
            "The live feed is currently offline or unreachable. Please try selecting another regional station."
          );
          setIsLoading(false);
        };

        video.addEventListener("loadedmetadata", onLoadedMetadata);
        video.addEventListener("error", onError);

        return () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("error", onError);
        };
      } 
      // Standard playback via hls.js for Chrome, Firefox, Edge, etc.
      else if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          appendErrorMaxRetry: 5,
          xhrSetup: (xhr, url) => {
            if (headers) {
              Object.entries(headers).forEach(([key, val]) => {
                if (val) {
                  try {
                    xhr.setRequestHeader(key, val);
                  } catch (e) {
                    console.warn(`Could not set header ${key}:`, e);
                  }
                }
              });
            }
          }
        });

        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!active) return;
          setIsLoading(false);
          video.playbackRate = playbackRate; // Restore chosen speed
          video.play()
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.log("Autoplay blocked:", err);
              setIsPlaying(false);
            });
        });

        hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
          if (!active) return;
          const level = data.details;
          const width = hls.levels[hls.currentLevel]?.width || video.videoWidth;
          const height = hls.levels[hls.currentLevel]?.height || video.videoHeight;
          const bitrate = hls.levels[hls.currentLevel]?.bitrate 
            ? `${Math.round(hls.levels[hls.currentLevel].bitrate / 1000)} Kbps` 
            : "Auto";
            
          setStats(prev => ({
            ...prev,
            resolution: width && height ? `${width}x${height}` : "Auto",
            bitrate,
            codec: data.details.live ? "H.264 Live" : "AVC / AAC"
          }));
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!active) return;
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("Network error encountered - attempting custom recovery...");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("Media error encountered - seeking recovery...");
                hls.recoverMediaError();
                break;
              default:
                setIsLoading(false);
                setErrorText(
                  "Feedback channel failed. This TV station might be currently off-air or has expired token links."
                );
                hls.destroy();
                hlsRef.current = null;
                break;
            }
          }
        });

        return () => {
          hls.destroy();
          if (hlsRef.current === hls) {
            hlsRef.current = null;
          }
        };
      } else {
        setIsLoading(false);
        setErrorText("Your browser does not support HLS streaming players.");
        return () => {};
      }
    };

    let cleanupFn: (() => void) | undefined;

    if (channel?.isTSports) {
      // Dynamic grabber fetching
      fetch("https://raw.githubusercontent.com/byte-capsule/TSports-m3u8-Grabber/main/TSports_m3u8_headers.Json")
        .then((res) => {
          if (!res.ok) throw new Error("Status: " + res.status);
          return res.json();
        })
        .then((data) => {
          if (!active) return;
          if (data && data.channels && data.channels[0]) {
            const liveUrl = data.channels[0].link || channel.streamUrl;
            const liveHeaders = data.channels[0].headers || undefined;
            cleanupFn = startPlayback(liveUrl, liveHeaders);
          } else {
            cleanupFn = startPlayback(channel.streamUrl);
          }
        })
        .catch((err) => {
          console.error("Error retrieving T Sports stream:", err);
          if (active) {
            cleanupFn = startPlayback(channel.streamUrl);
          }
        });
    } else if (channel) {
      cleanupFn = startPlayback(channel.streamUrl);
    }

    return () => {
      active = false;
      if (cleanupFn) {
        cleanupFn();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel]);

  // Sync playbackRate when it changes
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Monitor buffering stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      // Extract current video level details
      if (video.buffered && video.buffered.length > 0) {
        const currentPos = video.currentTime;
        let bufLen = 0;
        for (let i = 0; i < video.buffered.length; i++) {
          if (currentPos >= video.buffered.start(i) && currentPos <= video.buffered.end(i)) {
            bufLen = video.buffered.end(i) - currentPos;
            break;
          }
        }
        setStats(prev => ({
          ...prev,
          buffer: `${bufLen.toFixed(1)}s`,
          resolution: video.videoWidth ? `${video.videoWidth}x${video.videoHeight}` : prev.resolution
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Sync volume state
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Toggle play states
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.log("Manual play check error:", err));
    }
  };

  // Sync last non-zero active volume level to restore on unmute
  const lastActiveVolume = useRef(volume > 0 ? volume : 0.8);

  const updateVolume = (val: number) => {
    const rounded = Math.round(val * 100) / 100;
    const clamped = Math.max(0, Math.min(1, rounded));
    setVolume(clamped);
    if (clamped > 0) {
      setIsMuted(false);
      lastActiveVolume.current = clamped;
    } else {
      setIsMuted(true);
    }
  };

  // Toggle custom mute states
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (volume <= 0) {
        const restoreVal = lastActiveVolume.current > 0 ? lastActiveVolume.current : 0.8;
        setVolume(restoreVal);
        lastActiveVolume.current = restoreVal;
      }
    } else {
      setIsMuted(true);
    }
  };

  // Handle custom volume slider changes
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    updateVolume(val);
  };

  // Toggle fullscreen mode targeting container element (so controls stay overlaid!)
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error("Error attempting fullscreen:", err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error("Error exiting fullscreen:", err));
    }
  };

  // Seek forward or rewind by 10s
  const triggerSeek = (side: "left" | "right") => {
    const video = videoRef.current;
    if (!video) return;

    if (side === "right") {
      video.currentTime = Math.min(video.duration || 999999, video.currentTime + 10);
      setSeekOverlay({ show: true, text: "+10s", side: "right" });
    } else {
      video.currentTime = Math.max(0, video.currentTime - 10);
      setSeekOverlay({ show: true, text: "-10s", side: "left" });
    }

    // Hide seek overlay after 800ms
    setTimeout(() => {
      setSeekOverlay(prev => ({ ...prev, show: false }));
    }, 800);
  };

  // Double click / double tap handler on video layout
  const handleVideoClickOrTap = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const isRightSide = clickX > width / 2;
    const side = isRightSide ? "right" : "left";

    if (clickTimeout) {
      window.clearTimeout(clickTimeout);
      setClickTimeout(null);
      triggerSeek(side);
    } else {
      const timeout = window.setTimeout(() => {
        setClickTimeout(null);
        togglePlay();
      }, 250);
      setClickTimeout(timeout);
    }
  };

  // Handle speed rate update
  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    setShowSettingsMenu(false);
  };

  // Forced stream reload action
  const handleReloadStream = () => {
    if (!channel) return;
    setIsLoading(true);
    setErrorText(null);
    const video = videoRef.current;
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (video) {
      video.src = "";
    }

    // Reactivate selection
    const tempChannel = { ...channel };
    setTimeout(() => {
      // Trigger effect reload by assigning stream URL
      if (Hls.isSupported() && video) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(tempChannel.streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.playbackRate = playbackRate;
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        });
      }
    }, 200);
  };

  // Listen to fullscreen changes outside standard triggers
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Hide controls on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying && !errorText && !showSettingsMenu) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is editing inputs
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "t":
          e.preventDefault();
          onToggleTheaterMode();
          break;
        case "z":
          e.preventDefault();
          toggleFitMode();
          break;
        case "arrowleft":
          e.preventDefault();
          triggerSeek("left");
          break;
        case "arrowright":
          e.preventDefault();
          triggerSeek("right");
          break;
        case "arrowup":
          e.preventDefault();
          updateVolume(volume + 0.1);
          break;
        case "arrowdown":
          e.preventDefault();
          updateVolume(volume - 0.1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isMuted, volume, isFullscreen]);

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Video element and controls frame container */}
      <div 
        ref={containerRef}
        id="video-player-container"
        className={`relative aspect-video w-full overflow-hidden bg-stone-950 group transition-all duration-500 shadow-2xl border border-white/5 ${
          isFullscreen ? "rounded-none max-w-full h-screen" : isTheaterMode ? "rounded-none max-w-full" : "rounded-2xl"
        }`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && !showSettingsMenu && setShowControls(false)}
      >
        {/* Core HTML5 Video Element */}
        <video
          ref={videoRef}
          id="main-channel-video"
          className={`w-full h-full transition-all duration-300 ${
            fitMode === "contain" 
              ? "object-contain" 
              : fitMode === "fill" 
                ? "object-fill" 
                : "object-cover"
          }`}
          playsInline
        />

        {/* Double-tap / Seek Gesture Invisible Active overlay regions (leaves room for the bottom bar) */}
        {!isLoading && !errorText && (
          <div 
            className="absolute top-0 left-0 right-0 bottom-16 z-10 flex cursor-pointer"
            onClick={handleVideoClickOrTap}
          >
            <div id="seek-left-target" className="w-1/2 h-full" />
            <div id="seek-right-target" className="w-1/2 h-full" />
          </div>
        )}

        {/* Double-tap visual seek overlays / ripples */}
        {seekOverlay.show && (
          <div 
            className={`absolute top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md w-20 h-20 rounded-full flex flex-col items-center justify-center border border-white/10 shadow-2xl pointer-events-none z-30 transition-all duration-300 animate-pulse ${
              seekOverlay.side === "left" ? "left-[15%]" : "right-[15%]"
            }`}
          >
            {seekOverlay.side === "left" ? (
              <ChevronLeft className="w-7 h-7 text-white animate-bounce" />
            ) : (
              <ChevronRight className="w-7 h-7 text-white animate-bounce" />
            )}
            <span className="text-[10px] font-sans font-extrabold text-white mt-0.5 tracking-wider">{seekOverlay.text}</span>
          </div>
        )}

        {/* Loading Overlay Spinner */}
        {isLoading && !errorText && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0C10]/95 backdrop-blur-sm z-20">
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="absolute inset-0 w-full h-full border-t-2 border-r-2 border-purple-600 rounded-full animate-spin"></div>
              <Tv className="w-6 h-6 text-purple-500 animate-pulse" />
            </div>
            <p className="mt-4 text-stone-300 font-sans font-medium text-sm tracking-wide">
              Connecting stream link...
            </p>
          </div>
        )}

        {/* Playback Error Overlay Card */}
        {errorText && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950/95 p-6 text-center z-20">
            <div className="p-4 bg-purple-950/30 border border-purple-900/40 rounded-full mb-4">
              <Info className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold font-sans text-purple-100 mb-2">
              Station Broadcast Temporarily Offline
            </h3>
            <p className="text-sm font-sans text-stone-400 max-w-md mb-6 leading-relaxed">
              {errorText}
            </p>
            <div className="flex items-center gap-3_">
              <button
                id="btn-retry-stream"
                onClick={handleReloadStream}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:transform active:scale-95 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition duration-200 cursor-pointer shadow-lg shadow-purple-900/10"
              >
                <RotateCw className="w-4 h-4" />
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Live Badge Overlay - Top Right */}
        {channel && !errorText && (
          <div className="absolute top-4 right-4 bg-red-650/90 text-white font-mono text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider z-20 flex items-center gap-1.5 shadow-md">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}

        {/* Custom Navigation Arrows overlaid on the sides of the video */}
        {onPlayPrev && !isFullscreen && (
          <button 
            onClick={(e) => { e.stopPropagation(); onPlayPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-purple-600 text-white p-2 md:p-3 rounded-full backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-300 z-20 shadow-lg hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
            title="Previous Channel"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {onPlayNext && !isFullscreen && (
          <button 
            onClick={(e) => { e.stopPropagation(); onPlayNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-purple-600 text-white p-2 md:p-3 rounded-full backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-300 z-20 shadow-lg hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
            title="Next Channel"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Smooth integrated Auto-hiding Bottom Control Bar */}
        <div 
          className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/95 via-black/75 to-transparent flex items-end px-4 pb-3 select-none z-20 transition-all duration-300 ${
            showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full flex items-center justify-between">
            {/* Left Hand Controls Side */}
            <div className="flex items-center gap-4">
              {/* Play / Pause toggle */}
              <button 
                onClick={togglePlay}
                className="text-stone-100 hover:text-purple-400 p-1 transition-colors cursor-pointer flex items-center justify-center"
                title={isPlaying ? "Pause (space)" : "Play (space)"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>

              {/* Mute and Volume slider row */}
              <div className="flex items-center gap-1.5 group/volume">
                <button 
                  onClick={toggleMute}
                  className="text-stone-100 hover:text-purple-400 p-1 transition-colors cursor-pointer flex items-center justify-center"
                  title={isMuted ? "Unmute (m)" : "Mute (m)"}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 md:w-0 md:group-hover/volume:w-16 md:focus/volume:w-16 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer transition-all duration-300 accent-purple-500 hover:accent-purple-400 focus:outline-none"
                />
              </div>

              {/* Live Info badge */}
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-white/10 ml-1">
                <span className="w-2 h-2 rounded-full bg-red-650 animate-pulse shadow-[0_0_6px_#ef4444]" />
                <span className="font-mono text-[9px] font-bold text-red-500 uppercase tracking-widest leading-none">LIVE</span>
                <span className="font-mono text-[10px] tracking-wide text-stone-300 font-semibold ml-1 bg-white/[0.04] px-2 py-0.5 rounded">
                  Auto {stats.resolution !== "Auto" ? `(${stats.resolution})` : ""}
                </span>
                {channel && (
                  <span className="text-xs text-stone-300 truncate max-w-[130px] sm:max-w-[200px] font-semibold tracking-wide ml-2 hidden md:inline">
                    {channel.name}
                  </span>
                )}
              </div>
            </div>

            {/* Right Hand Controls Side */}
            <div className="flex items-center gap-4 relative">
              {/* Playback speed Gear icon */}
              <div className="relative">
                <button 
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className={`text-stone-100 hover:text-purple-400 p-1 transition-all duration-300 flex items-center justify-center cursor-pointer ${
                    showSettingsMenu ? "rotate-45 text-purple-400" : ""
                  }`}
                  title="Playback Speed Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Dropup Playback rate speed settings selector */}
                {showSettingsMenu && (
                  <div className="absolute right-0 bottom-full mb-3 bg-[#0B0C10]/95 border border-white/10 rounded-xl p-1.5 w-32 shadow-2xl z-30 backdrop-blur-md flex flex-col gap-0.5">
                    <p className="text-[9px] font-mono font-bold text-stone-400 px-2 py-1 uppercase tracking-widest border-b border-white/[0.06] mb-1">
                      Speed Rate
                    </p>
                    {[0.5, 1, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedChange(rate)}
                        className={`text-left text-xs px-2 py-1.5 rounded-lg transition duration-150 flex items-center justify-between font-medium cursor-pointer ${
                          playbackRate === rate 
                            ? "bg-purple-600/20 text-purple-300 font-bold" 
                            : "text-stone-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
                        {playbackRate === rate && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Video Zoom Toggle */}
              <button
                onClick={toggleFitMode}
                className={`text-stone-100 hover:text-purple-400 p-1.5 rounded transition-all duration-300 flex items-center justify-center cursor-pointer ${
                  fitMode !== "contain" ? "text-purple-400 scale-105" : ""
                }`}
                title={`Video Size: ${fitMode === "contain" ? "Default [Fit]" : fitMode === "fill" ? "Stretch [Full]" : "Zoom [Crop]"} (z)`}
              >
                <Maximize2 className="w-5 h-5" />
              </button>

              {/* Theater Mode Toggle */}
              <button
                onClick={onToggleTheaterMode}
                className={`text-stone-100 hover:text-purple-400 p-1 rounded transition-colors flex items-center justify-center cursor-pointer ${
                  isTheaterMode ? "text-purple-400" : ""
                }`}
                title="Theater Mode (t)"
              >
                <Tv className="w-5 h-5" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="text-stone-100 hover:text-purple-400 p-1 transition-colors flex items-center justify-center cursor-pointer"
                title="Fullscreen (f)"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
