import { supabase } from "./supabase";
import type { BoxEntry } from "./box-storage";
import { loadBox } from "./box-storage";

/**
 * Supabaseからボックスデータを読み込む
 */
export async function loadBoxFromCloud(userId: string): Promise<BoxEntry[] | null> {
  const { data, error } = await supabase
    .from("box_entries")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle(); // single()だとデータなしでエラーになるためmaybeSingleに変更

  if (error) {
    console.error("[box-sync] loadBoxFromCloud error:", error.message);
    return null;
  }
  if (!data) return null;
  return data.data as BoxEntry[];
}

/**
 * Supabaseにボックスデータを保存
 * 既存レコードがあればupdate、なければinsert
 */
export async function saveBoxToCloud(userId: string, entries: BoxEntry[]): Promise<boolean> {
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
      .update({ data: entries, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) {
      console.error("[box-sync] update error:", error.message);
      return false;
    }
  } else {
    // 新規レコードを挿入
    const { error } = await supabase
      .from("box_entries")
      .insert({ user_id: userId, data: entries, updated_at: new Date().toISOString() });
    if (error) {
      console.error("[box-sync] insert error:", error.message);
      return false;
    }
  }

  console.log("[box-sync] saved to cloud:", entries.length, "entries");
  return true;
}

/**
 * ログイン時にLocalStorageのデータをSupabaseに移行
 */
export async function migrateLocalToCloud(userId: string): Promise<BoxEntry[]> {
  const cloudData = await loadBoxFromCloud(userId);
  const localData = loadBox();

  console.log("[box-sync] migrate: cloud=", cloudData?.length ?? 0, "local=", localData.length);

  if (cloudData && cloudData.length > 0) {
    const cloudIds = new Set(cloudData.map((e) => e.id));
    const localOnly = localData.filter((e) => !cloudIds.has(e.id));

    if (localOnly.length > 0) {
      const merged = [...cloudData, ...localOnly];
      await saveBoxToCloud(userId, merged);
      return merged;
    }
    return cloudData;
  } else if (localData.length > 0) {
    await saveBoxToCloud(userId, localData);
    return localData;
  }

  return [];
}

/**
 * リアルタイム同期を開始
 */
export function subscribeToBoxChanges(
  userId: string,
  onUpdate: (entries: BoxEntry[]) => void
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
        const newData = (payload.new as { data: BoxEntry[] })?.data;
        if (newData) {
          console.log("[box-sync] realtime update:", newData.length, "entries");
          onUpdate(newData);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
