type MetaPayload = Record<string, unknown>;

const INTERESTING_META_KEYS = new Set<string>([
  'Default:MatchmakingInfo_j',
  'Default:PlatformSessions_j',
  'Default:PlatformData_j',
  'Default:SquadInformation_j',
  'urn:epic:member:dn_s',
  'Default:CustomMatchKey_s',
  'Default:RegionId_s',
]);

const MAX_LIST_PREVIEW = 24;
const MAX_STRING = 260;
const MAX_JSON = 900;

const truncate = (value: string, limit = MAX_STRING) => (
  value.length > limit ? `${value.slice(0, limit)}...` : value
);

const safeStringify = (value: unknown, limit = MAX_JSON) => {
  let out = '';
  try {
    out = JSON.stringify(value);
  } catch {
    out = '"[unserializable]"';
  }
  return truncate(out, limit);
};

const previewList = (items: string[], limit = MAX_LIST_PREVIEW) => {
  if (items.length <= limit) return items.join(',');
  return `${items.slice(0, limit).join(',')}...+${items.length - limit}`;
};

const shortId = (id: string) => {
  if (!id) return id;
  return id.length <= 8 ? id : `${id.slice(0, 4)}...${id.slice(-4)}`;
};

const parseJsonValue = (value: unknown) => {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const summarizeIsland = (entry: any) => {
  if (!entry || typeof entry !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  const islandRaw = entry.island;
  const islandObj = parseJsonValue(islandRaw);
  if (islandObj) {
    if (typeof (islandObj as any).LinkId === 'string') {
      out.linkId = (islandObj as any).LinkId;
    }
    const v1 = (islandObj as any).MatchmakingSettingsV1;
    const v2 = (islandObj as any).MatchmakingSettingsV2;
    if (v1) {
      out.settings = {
        v: 'v1',
        region: v1.regionId,
        privacy: v1.privacy,
      };
    }
    if (v2) {
      out.settings = {
        v: 'v2',
        region: v2['/Fortnite.com/Matchmaking:Region'],
      };
    }
  } else if (typeof islandRaw === 'string') {
    out.island = truncate(islandRaw, 200);
  }
  if (entry.timestamp !== undefined) out.timestamp = entry.timestamp;
  return out;
};

const summarizeMatchmakingInfo = (value: unknown) => {
  const root = parseJsonValue(value);
  const info = root && (root as any).MatchmakingInfo;
  if (!info || typeof info !== 'object') {
    return { raw: truncate(typeof value === 'string' ? value : safeStringify(value), 240) };
  }
  return {
    islandSelection: summarizeIsland((info as any).islandSelection),
    currentIsland: summarizeIsland((info as any).currentIsland),
  };
};

const summarizePlatformSessions = (value: unknown) => {
  const root = parseJsonValue(value);
  const sessions = Array.isArray((root as any)?.PlatformSessions)
    ? (root as any).PlatformSessions
    : [];
  return sessions.map((session: any) => ({
    ownerPrimaryId: shortId(session?.ownerPrimaryId),
    sessionId: session?.sessionId,
    sessionType: session?.sessionType,
  }));
};

const summarizeSquadInformation = (value: unknown) => {
  const root = parseJsonValue(value);
  const info = root && (root as any).SquadInformation;
  const assignments = Array.isArray(info?.rawSquadAssignments) ? info.rawSquadAssignments : [];
  return {
    assignments: assignments.map((entry: any) => ({
      memberId: shortId(entry?.memberId),
      idx: entry?.absoluteMemberIdx,
    })),
    squadCount: Array.isArray(info?.squadData) ? info.squadData.length : 0,
  };
};

const summarizePlatformData = (value: unknown) => {
  const root = parseJsonValue(value);
  const platform = (root as any)?.PlatformData?.platform?.platformDescription;
  const data = (root as any)?.PlatformData;
  return {
    platformType: platform?.platformType,
    onlineSubsystem: platform?.onlineSubsystem,
    sessionId: data?.sessionId,
    uniqueId: data?.uniqueId,
  };
};

const summarizeMetaValue = (key: string, value: unknown) => {
  switch (key) {
    case 'Default:MatchmakingInfo_j':
      return summarizeMatchmakingInfo(value);
    case 'Default:PlatformSessions_j':
      return summarizePlatformSessions(value);
    case 'Default:SquadInformation_j':
      return summarizeSquadInformation(value);
    case 'Default:PlatformData_j':
      return summarizePlatformData(value);
    default:
      if (typeof value === 'string') return truncate(value);
      return value;
  }
};

export const summarizeMetaPayload = (payload?: MetaPayload) => {
  const keys = payload ? Object.keys(payload) : [];
  const focus: Record<string, unknown> = {};
  for (const key of keys) {
    if (INTERESTING_META_KEYS.has(key)) {
      focus[key] = summarizeMetaValue(key, payload![key]);
    }
  }
  return { keys, focus };
};

export const formatMetaSummary = (label: string, payload?: MetaPayload, removed?: string[]) => {
  const { keys, focus } = summarizeMetaPayload(payload);
  const parts: string[] = [label];
  parts.push(`keys=${keys.length ? previewList(keys) : '<none>'}`);
  if (removed && removed.length) {
    parts.push(`removed=${previewList(removed)}`);
  }
  if (Object.keys(focus).length > 0) {
    parts.push(`focus=${safeStringify(focus)}`);
  }
  return parts.join(' ');
};

export const formatMetaFocus = (label: string, payload: MetaPayload) => {
  const { focus } = summarizeMetaPayload(payload);
  if (Object.keys(focus).length === 0) return `${label} focus=<none>`;
  return `${label} focus=${safeStringify(focus)}`;
};
