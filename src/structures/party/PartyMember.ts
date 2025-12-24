import PartyPermissionError from '../../exceptions/PartyPermissionError';
import { PROTECTED_META_KEYS } from '../../util/Meta';
import PartyMemberMeta from './PartyMemberMeta';
import User from '../user/User';
import { formatMetaFocus, formatMetaSummary } from '../../util/partyMetaDebug';
import type Party from './Party';
import type ClientParty from './ClientParty';
import type { PartyMemberData, PartyMemberSchema, PartyMemberUpdateData } from '../../../resources/structs';

const MATCHMAKING_INFO_KEYS = new Set(['Default:MatchmakingInfo_j'] as const);

const isIslandV2 = (island: unknown): boolean => {
  if (typeof island === 'string') {
    return island.includes('MatchmakingSettingsV2');
  }
  return typeof island === 'object' && island !== null;
};

const shouldIgnoreMatchmakingUpdate = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const info = (value as any).MatchmakingInfo;
  if (!info) return false;
  const islandSelection = info.islandSelection;
  if (!islandSelection) return false;
  return isIslandV2(islandSelection.island);
};

/**
 * Represents a party member
 */
class PartyMember extends User {
  /**
   * The member's role. "CAPTAIN" means leader
   */
  public role: string;

  /**
   * The date when this member joined the party
   */
  public joinedAt: Date;

  /**
   * The member's meta
   */
  public meta: PartyMemberMeta;

  /**
   * The party this member belongs to
   */
  public party: Party | ClientParty;

  /**
   * The member's revision
   */
  public revision: number;

  /**
   * Whether this member has received an initial state update
   */
  public receivedInitialStateUpdate: boolean;

  protected lastMatchmakingInfoRepairAt?: number;

  /**
   * @param party The party this member belongs to
   * @param data The member's data
   */
  constructor(party: Party | ClientParty, data: PartyMemberData) {
    super(party.client, {
      ...data,
      displayName: data.account_dn,
      id: data.account_id,
    });

    this.party = party;
    this.role = data.role;
    this.joinedAt = new Date(data.joined_at);
    this.meta = new PartyMemberMeta(data.meta);
    this.revision = data.revision;
    this.receivedInitialStateUpdate = false;
  }

  /**
   * Whether this member is the leader of the party
   */
  public get isLeader() {
    return this.role === 'CAPTAIN';
  }

  /**
   * The member's currently equipped outfit CID
   */
  public get outfit() {
    return this.meta.outfit;
  }

  /**
   * The member's currently equipped pickaxe ID
   */
  public get pickaxe() {
    return this.meta.pickaxe;
  }

  /**
   * The member's current emote EID
   */
  public get emote() {
    return this.meta.emote;
  }

  /**
   * The member's currently equipped backpack BID
   */
  public get backpack() {
    return this.meta.backpack;
  }

  /**
   * The member's currently equipped shoes
   */
  public get shoes() {
    return this.meta.shoes;
  }

  /**
   * Whether the member is ready
   */
  public get isReady() {
    return this.meta.isReady;
  }

  /**
   * Whether the member is sitting out
   */
  public get isSittingOut() {
    return this.meta.isSittingOut;
  }

  /**
   * The member's current input method
   */
  public get inputMethod() {
    return this.meta.input;
  }

  /**
   * The member's cosmetic variants
   */
  public get variants() {
    return this.meta.variants;
  }

  /**
   * The member's custom data store
   */
  public get customDataStore() {
    return this.meta.customDataStore;
  }

  /**
   * The member's banner info
   */
  public get banner() {
    return this.meta.banner;
  }

  /**
   * The member's battlepass info
   */
  public get battlepass() {
    return this.meta.battlepass;
  }

  /**
   * The member's platform
   */
  public get platform() {
    return this.meta.platform;
  }

  /**
   * The member's match info
   */
  public get matchInfo() {
    return this.meta.match;
  }

  /**
   * The member's current playlist
   */
  public get playlist() {
    return this.meta.island;
  }

  /**
   * Whether a marker has been set
   */
  public get isMarkerSet() {
    return this.meta.isMarkerSet;
  }

  /**
   * The member's marker location [x, y] tuple.
   * [0, 0] if there is no marker set
   */
  public get markerLocation() {
    return this.meta.markerLocation;
  }

  /**
   * Kicks this member from the client's party.
   * @throws {PartyPermissionError} The client is not a member or not the leader of the party
   */
  public async kick() {
    // This is a very hacky solution, but it's required since we cannot import ClientParty (circular dependencies)
    if (typeof (this.party as any).kick !== 'function') throw new PartyPermissionError();
    return (this.party as any).kick(this.id);
  }

  /**
   * Promotes this member
   * @throws {PartyPermissionError} The client is not a member or not the leader of the party
   */
  public async promote() {
    // This is a very hacky solution, but it's required since we cannot import ClientParty (circular dependencies)
    if (typeof (this.party as any).promote !== 'function') throw new PartyPermissionError();
    return (this.party as any).promote(this.id);
  }

  /**
   * Hides this member
   * @param hide Whether the member should be hidden
   * @throws {PartyPermissionError} The client is not the leader of the party
   * @throws {EpicgamesAPIError}
   */
  public async hide(hide = true) {
    // This is a very hacky solution, but it's required since we cannot import ClientParty (circular dependencies)
    if (typeof (this.party as any).hideMember !== 'function') throw new PartyPermissionError();
    return (this.party as any).hideMember(this.id, hide);
  }

  /**
   * Bans this member from the client's party.
   */
  public async chatBan() {
    // This is a very hacky solution, but it's required since we cannot import ClientParty (circular dependencies)
    if (typeof (this.party as any).chatBan !== 'function') throw new PartyPermissionError();
    return (this.party as any).chatBan(this.id);
  }

  /**
   * Updates this members data
   * @param data The update data
   */
  public updateData(data: PartyMemberUpdateData) {
    if (data.revision > this.revision) this.revision = data.revision;
    if (data.account_dn !== this.displayName) this.update({ id: this.id, displayName: data.account_dn, externalAuths: this.externalAuths });

    const updates = { ...data.member_state_updated };
    const removedKeys = (data.member_state_removed || []) as string[];
    if (updates['Default:MatchmakingInfo_j'] && shouldIgnoreMatchmakingUpdate(updates['Default:MatchmakingInfo_j'])) {
      this.client.debug(formatMetaFocus(
        `[PartyMember ${this.id}] ignore MatchmakingInfo (v2)`,
        { 'Default:MatchmakingInfo_j': updates['Default:MatchmakingInfo_j'] },
      ));
      delete updates['Default:MatchmakingInfo_j'];
      this.queueMatchmakingInfoRepair();
    }

    if (Object.keys(updates).length || removedKeys.length) {
      this.client.debug(formatMetaSummary(
        `[PartyMember ${this.id}] member_state_updated`,
        updates as Record<string, unknown>,
        removedKeys,
      ));
    }

    this.meta.update(updates, true, {
      allowedProtectedKeys: MATCHMAKING_INFO_KEYS,
    });
    const removed = removedKeys.filter((key) => !PROTECTED_META_KEYS.has(key as keyof PartyMemberSchema & string));
    if (removed.length) this.meta.remove(removed as (keyof PartyMemberSchema)[]);
  }

  private queueMatchmakingInfoRepair() {
    const party = this.party as any;
    if (!party?.me || party.me.id !== this.id) return;
    if (!party.me.isLeader) return;
    if (typeof (this as any).sendPatch !== 'function') return;

    const now = Date.now();
    const last = this.lastMatchmakingInfoRepairAt || 0;
    if (now - last < 1500) return;

    const currentRaw = (this.meta.schema as any)?.['Default:MatchmakingInfo_j'];
    if (!currentRaw || typeof currentRaw !== 'string') return;

    this.lastMatchmakingInfoRepairAt = now;
    this.client.debug(`[PartyMember ${this.id}] reapply MatchmakingInfo (v1 snapshot)`);
    void (this as any).sendPatch({
      'Default:MatchmakingInfo_j': currentRaw,
    }).catch((err: any) => {
      this.client.debug(`[PartyMember ${this.id}] reapply MatchmakingInfo failed: ${err?.message || err}`);
    });
  }

  /**
   * Converts this party member into an object
   */
  public toObject(): PartyMemberData {
    return {
      id: this.id,
      account_id: this.id,
      joined_at: this.joinedAt.toISOString(),
      updated_at: new Date().toISOString(),
      meta: this.meta.schema,
      revision: 0,
      role: this.role,
      account_dn: this.displayName,
    };
  }
}

export default PartyMember;
