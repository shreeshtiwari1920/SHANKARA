// This is the piece that answers: "which of the 4 links is this drone
// actually talking over right now?"
//
// Rules, straight from the spec discussed with the team:
//   1. Cellular (5G/4G)  - 1st priority for bulk data (live video, stills)
//   2. WiFi              - 2nd priority, used when no cell tower in range
//   3. Radio (COFDM/RF)  - 3rd priority, used when neither of the above
//   4. LoRa               - always-on default: low-bandwidth text only
//                           (location, human-presence flags, short status),
//                           keeps working even when 1-3 are all down.
//
// A channel counts as "up" if we've heard from it within CHANNEL_FRESHNESS_MS.
// LoRa is not part of the failover chain for bulk data - it's a parallel
// channel that's always expected to be there, so we report it separately.

const FRESHNESS_MS = Number(process.env.CHANNEL_FRESHNESS_MS || 15000);

const PRIORITY = ["cellular", "wifi", "radio"]; // bulk-data channels, in order

function isFresh(ts, now) {
  return typeof ts === "number" && now - ts <= FRESHNESS_MS;
}

// Given a drone record ({lastSeen: {cellular, wifi, radio, lora}}), work out
// the active bulk-data channel (or null if all three are down - LoRa-only
// survival mode) plus whether LoRa itself is currently reachable.
function resolveActiveChannel(drone, now = Date.now()) {
  const lastSeen = (drone && drone.lastSeen) || {};

  for (const ch of PRIORITY) {
    if (isFresh(lastSeen[ch], now)) {
      return { channel: ch, degraded: false, loraOnly: false };
    }
  }

  // Nothing in the bulk-data chain is fresh - are we at least hearing LoRa?
  if (isFresh(lastSeen.lora, now)) {
    return { channel: "lora", degraded: true, loraOnly: true };
  }

  return { channel: null, degraded: true, loraOnly: true, offline: true };
}

function channelStatusForDrone(drone, now = Date.now()) {
  const resolved = resolveActiveChannel(drone, now);
  return {
    droneId: drone.id,
    activeChannel: resolved.channel,
    loraOnly: resolved.loraOnly,
    offline: !!resolved.offline,
    links: PRIORITY.concat(["lora"]).reduce((acc, ch) => {
      acc[ch] = {
        lastSeen: (drone.lastSeen || {})[ch] || null,
        fresh: isFresh((drone.lastSeen || {})[ch], now),
      };
      return acc;
    }, {}),
  };
}

module.exports = { resolveActiveChannel, channelStatusForDrone, PRIORITY, FRESHNESS_MS };
