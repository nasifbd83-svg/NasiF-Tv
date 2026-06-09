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
  ChevronRight
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
  
  // Advanced realtime stream stats
  const [stats, setStats] = useState({
    resolution: "Auto",
    bitrate: "0 Kbps",
    buffer: "0s",
    codec: "H.264",
  });

  const controlsTimeoutRef = useRef<number | null>(null);

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

    if (channel.isTSports) {
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
    } else {
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

  // Toggle custom mute states
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Handle custom volume slider changes
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0) {
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
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
      if (isPlaying && !errorText) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

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
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        });
      }
    }, 200);
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
        case "arrowup":
          e.preventDefault();
          setVolume(prev => Math.min(1, prev + 0.1));
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume(prev => Math.max(0, prev - 0.1));
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
        className={`relative aspect-video w-full overflow-hidden bg-stone-950 rounded-2xl group transition-all duration-500 shadow-2xl border border-white/5 ${
          isFullscreen ? "rounded-none max-w-full h-screen" : ""
        }`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {/* Core HTML5 Video Element */}
        <video
          ref={videoRef}
          id="main-channel-video"
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          playsInline
        />

        {/* Loading Overlay Spinner */}
        {isLoading && !errorText && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0C10]/90 backdrop-blur-sm z-20">
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
            <div className="flex items-center gap-3">
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

        {/* Live Badge Overlay */}
        {channel && !errorText && (
          <div className="absolute top-4 right-4 bg-red-650/90 text-white font-mono text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider z-20 flex items-center gap-1.5 shadow-md">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}

        {/* Custom Navigation Arrows overlaid on the sides of the video */}
        {onPlayPrev && (
          <button 
            onClick={(e) => { e.stopPropagation(); onPlayPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-purple-600 text-white p-2 md:p-3 rounded-full backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-300 z-20 shadow-lg hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
            title="Previous Channel"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {onPlayNext && (
          <button 
            onClick={(e) => { e.stopPropagation(); onPlayNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-purple-600 text-white p-2 md:p-3 rounded-full backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-300 z-20 shadow-lg hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
            title="Next Channel"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Floating Custom Controller Bar at Bottom Center */}
        {/* Visible on hover or when controls are active */}
        <div 
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-stone-950/75 backdrop-blur-md px-6 py-2.5 rounded-full flex items-center justify-center border border-white/10 shadow-2xl select-none z-20 gap-6 transition-all duration-300 ${
            showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
          }`}
        >
          {/* Mute toggle button */}
          <button 
            id="btn-volume-floating"
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className="text-stone-300 hover:text-purple-400 transition-colors p-1 cursor-pointer flex items-center justify-center"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Auto Quality Status badge */}
          <div className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] px-3.5 py-1 rounded-full text-xs font-semibold text-stone-200 border border-white/5 transition duration-150">
            <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7] animate-pulse" />
            <span className="font-mono text-[10px] tracking-wide text-stone-300">Auto {stats.resolution !== "Auto" ? `(${stats.resolution})` : ""}</span>
          </div>

          {/* Fullscreen toggle button */}
          <button
            id="btn-fullscreen-floating"
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            className="text-stone-300 hover:text-purple-400 transition-colors p-1 cursor-pointer flex items-center justify-center"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>

    </div>
  );
}
