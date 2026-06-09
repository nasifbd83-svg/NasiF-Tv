import { Channel } from "./types";

/**
 * Extracts the value of a specific attribute from an EXTINF line.
 * Handles both quoted values: attribute="value" and unquoted values.
 */
export function getAttributeValue(line: string, attrName: string): string {
  // Try quoted first: tvg-logo="url"
  const quotedRegex = new RegExp(`${attrName}\\s*=\\s*"([^"]*?)"`, "i");
  const quotedMatch = line.match(quotedRegex);
  if (quotedMatch && quotedMatch[1]) {
    return quotedMatch[1].trim();
  }

  // Fallback to unquoted if present (no spaces)
  const unquotedRegex = new RegExp(`${attrName}\\s*=\\s*([^\\s,]+)`, "i");
  const unquotedMatch = line.match(unquotedRegex);
  if (unquotedMatch && unquotedMatch[1]) {
    return unquotedMatch[1].trim();
  }

  return "";
}

/**
 * Parses an M3U playlist text structure into a Channel array.
 */
export function parseM3U(m3uText: string, defaultGroupOverride?: string, seenNames: Set<string> = new Set()): Channel[] {
  const channels: Channel[] = [];
  const lines = m3uText.split(/\r?\n/);
  
  let currentChannel: Partial<Channel> = {};
  let indexCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    // Parse the metadata line
    if (line.startsWith("#EXTINF:")) {
      currentChannel = {}; // Reset for new block
      
      // Extract attributes
      const logo = getAttributeValue(line, "tvg-logo") || getAttributeValue(line, "logo");
      const groupTitle = (getAttributeValue(line, "group-title") || getAttributeValue(line, "group") || "").toLowerCase();
      const countryCode = getAttributeValue(line, "tvg-country").toUpperCase();
      
      // Name is after the comma in EXTINF: ... ,Channel Name
      let name = "";
      const commaIndex = line.lastIndexOf(",");
      if (commaIndex !== -1 && commaIndex < line.length - 1) {
        name = line.substring(commaIndex + 1).trim();
      } else {
        // Fallback: use tvg-name
        name = getAttributeValue(line, "tvg-name") || "Unnamed Channel";
      }

      // Smart classification into Bangladesh or Kolkata
      let detectedGroup = defaultGroupOverride || "Bangladesh"; // standard default

      if (!defaultGroupOverride) {
        const lowerName = name.toLowerCase();
        const kolkataKeywords = [
          "jalsha", "zee bangla", "colors bangla", "sony aath", "sun bangla", "rupashi", "akash aath", 
          "news18 bangla", "abp ananda", "24 ghanta", "calcutta", "kolkata", "tara muzik", "sangeet bangla", 
          "star j", "starj", "zee b", "zeeb", "colors b", "colorsb", "tv9", "tv 9", "r plus", "rplus", "r-plus"
        ];

        const bdKeywords = [
          "somoy", "jamuna", "independent", "rtv", "ntv", "atn", "channel i", "ekattor", "71", "deepto", 
          "gtv", "gazi", "btv", "sangsad", "banglavision", "maasranga", "news 24", "dbc", "ekushey", 
          "etv", "desh", "mohona", "asian", "sa tv", "channel 9", "bijoy", "mytv", "boishakhi", 
          "duronto", "t sports", "nagorik", "bd", "bangladesh", "dhaka"
        ];

        // Detect if channel has "IN" at the front of its name (e.g. "IN | Star Plus", "[IN] Zee Cinema", "IN Zee Cafe")
        const startsWithIN = /^(in\b|\[in\]|in\s*[\-|:\]/\\_])/i.test(name.trim());

        if (startsWithIN) {
          detectedGroup = "Kolkata";
        } else if (kolkataKeywords.some(kw => lowerName.includes(kw))) {
          detectedGroup = "Kolkata";
        } else if (bdKeywords.some(kw => lowerName.includes(kw))) {
          detectedGroup = "Bangladesh";
        } else if (
          countryCode === "BD" || 
          groupTitle.includes("bangladesh") || 
          groupTitle.includes("bd") || 
          groupTitle.includes("dhaka")
        ) {
          detectedGroup = "Bangladesh";
        } else if (
          countryCode === "IN" || 
          groupTitle.includes("kolkata") || 
          groupTitle.includes("west bengal") || 
          groupTitle.includes("wb") || 
          groupTitle.includes("india") || 
          groupTitle.includes("indian")
        ) {
          detectedGroup = "Kolkata";
        } else {
          detectedGroup = "Bangladesh";
        }
      }

      currentChannel.name = name;
      currentChannel.logo = logo;
      currentChannel.group = detectedGroup;
    } 
    // Parse the stream URL line (ignore comment lines)
    else if (!line.startsWith("#") && (line.startsWith("http://") || line.startsWith("https://"))) {
      if (currentChannel.name) {
        if (!seenNames.has(currentChannel.name)) {
          seenNames.add(currentChannel.name);
          currentChannel.streamUrl = line;
          currentChannel.id = `channel-${indexCounter++}-${encodeURIComponent(currentChannel.name)}`;
          currentChannel.rawIndex = indexCounter;
          channels.push(currentChannel as Channel);
        }
      }
      currentChannel = {}; // Reset
    }
  }

  // Ensure "T Sports" is in the parsed channels exactly once
  const cleanChannels = channels.filter(
    (c) => c.name.trim().toLowerCase() !== "t sports"
  );

  if (!seenNames.has("T Sports")) {
    seenNames.add("T Sports");
    cleanChannels.push({
      id: "manual-tsports",
      name: "T Sports",
      logo: "https://raw.githubusercontent.com/SHAJON-404/iptv/refs/heads/main/app/data/logos/tsports.png",
      streamUrl: "https://live.tsports.com/mobile_hls/tsports_live_1/playlist.m3u8",
      group: "Sports",
      rawIndex: indexCounter++,
      isTSports: true
    });
  }

  return cleanChannels;
}

/**
 * Extracts initials from names to draw beautiful circular fallbacks
 */
export function getInitials(name: string): string {
  if (!name) return "TV";
  const parts = name.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TV";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Standard fallbacks in case the fetch fails or is blocked by CORS/network filters.
 * Having some working streams as safe backup guarantees a highly reliable user experience.
 */
export const FALLBACK_CHANNELS: Channel[] = [
  {
    id: "fb-1",
    name: "Somoy TV (News)",
    logo: "https://raw.githubusercontent.com/SHAJON-404/iptv/main/assets/logos/somoy.png",
    streamUrl: "https://vcp-active.shadhin.co/somoy/SomoyTV/playlist.m3u8",
    group: "Bangladesh"
  },
  {
    id: "fb-2",
    name: "Jamuna TV (News)",
    logo: "https://raw.githubusercontent.com/SHAJON-404/iptv/main/assets/logos/jamuna.png",
    streamUrl: "https://vcp-live.shadhin.co/jamuna/JamunLive/playlist.m3u8",
    group: "Bangladesh"
  },
  {
    id: "fb-3",
    name: "Independent TV (News)",
    logo: "https://raw.githubusercontent.com/SHAJON-404/iptv/main/assets/logos/independent.png",
    streamUrl: "https://stream.shadhin.co/hls/independent.m3u8",
    group: "Bangladesh"
  },
  {
    id: "fb-4",
    name: "RTV Music (Entertainment)",
    logo: "https://raw.githubusercontent.com/SHAJON-404/iptv/main/assets/logos/rtv.png",
    streamUrl: "https://vcp-live.shadhin.co/rtv/RtvMusic/playlist.m3u8",
    group: "Bangladesh"
  },
  {
    id: "manual-tsports-fb",
    name: "T Sports",
    logo: "https://raw.githubusercontent.com/SHAJON-404/iptv/refs/heads/main/app/data/logos/tsports.png",
    streamUrl: "https://live.tsports.com/mobile_hls/tsports_live_1/playlist.m3u8",
    group: "Sports",
    isTSports: true
  }
];
