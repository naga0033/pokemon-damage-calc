import { supabase } from "./supabase";
import type { BattleTeam, BoxEntry } from "./box-storage";
import { loadBox, loadTeams } from "./box-storage";

export interface CloudSyncData {
  entries: BoxEntry[];
  teams: BattleTeam[];
}

function normalizeCloudData(data: unknown): CloudSyncData {
  if (Array.isArray(data)) {
    return { entries: data as BoxEntry[], teams: [] };
  }

  const payload = data as { entries?: BoxEntry[]; teams?: BattleTeam[] } | null;
  return {
    entries: Array.isArray(payload?.entries) ? payload.entries : [],
    teams: Array.isArray(payload?.teams) ? payload.teams : [],
  };
}

function getUpdatedAt(record: { createdAt: number; updatedAt?: number }): number {
  return record.updatedAt ?? record.createdAt;
}

function mergeByNewest<T extends { id: string; createdAt: number; updatedAt?: number }>(items: T[]): T[] {
  const merged = new Map<string, T>();

  for (const item of items) {
    const current = merged.get(item.id);
    if (!current || getUpdatedAt(item) >= getUpdatedAt(current)) {
      merged.set(item.id, item);
    }
  }

  return [...merged.values()].sort((a, b) => getUpdatedAt(b) - getUpdatedAt(a));
}

/**
 * Supabaseからボックスデータを読み込む
 */
export async function loadCloudDataFromCloud(userId: string): Promise<CloudSyncData | null> {
  const { data, error } = await supabase
    .from("box_entries")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle(); // single()だとデータなしでエラーになるためmaybeSingleに変更

  if (error) {
    console.error("[box-sync] loadCloudDataFromCloud error:", error.message);
    return null;
  }
  if (!data) return null;
  return normalizeCloudData(data.data);
}

/**
 * Supabaseにボックスデータを保存
 * 既存レコードがあればupdate、なければinsert
 */
export async function saveCloudDataToCloud(userId: string, syncData: CloudSyncData): Promise<boolean> {
  // まず既存レコードがあるか確認
  const { data: existing } = await supabase
    .from("box_entries")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    // 既存レコードを更新
    const { error } = await supabase
      .from("box_entries")
      .update({ data: syncData, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) {
      console.error("[box-sync] update error:", error.message);
      return false;
    }
  } else {
    // 新規レコードを挿入
    const { error } = await supabase
      .from("box_entries")
      .insert({ user_id: userId, data: syncData, updated_at: new Date().toISOString() });
    if (error) {
      console.error("[box-sync] insert error:", error.message);
      return false;
    }
  }

  console.log("[box-sync] saved to cloud:", syncData.entries.length, "entries,", syncData.teams.length, "teams");
  return true;
}

function mergeLocalAndCloud(cloudData: CloudSyncData, localData: CloudSyncData): CloudSyncData {
  return {
    entries: mergeByNewest<BoxEntry>([...cloudData.entries, ...localData.entries]),
    teams: mergeByNewest<BattleTeam>([...cloudData.teams, ...localData.teams]),
  };
}

/**
 * ログイン時にLocalStorageのデータをSupabaseに移行
 */
export async function migrateLocalToCloud(userId: string): Promise<CloudSyncData> {
  const cloudData = await loadCloudDataFromCloud(userId);
  const localData: CloudSyncData = {
    entries: loadBox(),
    teams: loadTeams(),
  };

  console.log(
    "[box-sync] migrate:",
    "cloud entries=", cloudData?.entries.length ?? 0,
    "local entries=", localData.entries.length,
    "cloud teams=", cloudData?.teams.length ?? 0,
    "local teams=", localData.teams.length
  );

  if (cloudData && (cloudData.entries.length > 0 || cloudData.teams.length > 0)) {
    const merged = mergeLocalAndCloud(cloudData, localData);
    if (
      merged.entries.length !== cloudData.entries.length ||
      merged.teams.length !== cloudData.teams.length
    ) {
      await saveCloudDataToCloud(userId, merged);
      return merged;
    }
    return cloudData;
  } else if (localData.entries.length > 0 || localData.teams.length > 0) {
    await saveCloudDataToCloud(userId, localData);
    return localData;
  }

  return { entries: [], teams: [] };
}

/**
 * リアルタイム同期を開始
 */
export function subscribeToCloudChanges(
  userId: string,
  onUpdate: (syncData: CloudSyncData) => void
) {
  const channel = supabase
    .channel("box_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "box_entries",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newData = normalizeCloudData((payload.new as { data?: unknown })?.data);
        if (newData) {
          console.log("[box-sync] realtime update:", newData.entries.length, "entries,", newData.teams.length, "teams");
          onUpdate(newData);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
