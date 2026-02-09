import { createServiceRoleClient } from '@/lib/supabase/service';
import { RAG_SETTINGS_CACHE_TTL_MS } from '@/config/constants';

export interface RagSettingsValues {
  embedding_model: string;
  top_k: number;
  match_threshold: number;
  rerank_enabled: boolean;
  hyde_enabled: boolean;
}

interface RagSettingsCache {
  settings: RagSettingsValues;
  timestamp: number;
}

const DEFAULT_RAG_SETTINGS: RagSettingsValues = {
  embedding_model: 'text-embedding-3-small',
  top_k: 8,
  match_threshold: 0.15,
  rerank_enabled: false,
  hyde_enabled: false,
};

const CACHE_TTL_MS = RAG_SETTINGS_CACHE_TTL_MS;
const settingsCache = new Map<string, RagSettingsCache>();

/**
 * Get RAG settings for a university with 60-second in-memory cache
 */
export async function getRagSettings(universityId: string): Promise<RagSettingsValues> {
  const cached = settingsCache.get(universityId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.settings;
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('rag_settings')
      .select('*')
      .eq('university_id', universityId)
      .single();

    if (error || !data) {
      console.log(`[Search] No rag_settings for ${universityId}, using defaults`);
      settingsCache.set(universityId, {
        settings: DEFAULT_RAG_SETTINGS,
        timestamp: Date.now(),
      });
      return DEFAULT_RAG_SETTINGS;
    }

    const settings: RagSettingsValues = {
      embedding_model: data.embedding_model,
      top_k: data.top_k,
      match_threshold: data.match_threshold,
      rerank_enabled: data.rerank_enabled,
      hyde_enabled: data.hyde_enabled,
    };

    settingsCache.set(universityId, { settings, timestamp: Date.now() });
    return settings;
  } catch (error) {
    console.error('[Search] Failed to load rag_settings:', error);
    return DEFAULT_RAG_SETTINGS;
  }
}
