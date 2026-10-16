use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntryMetadata {
    pub key: String,
    pub etag: Option<String>,
    pub created_at_unix: u64,
    pub ttl_seconds: u64,
    pub content_hash: String,
}

#[derive(Debug, Clone)]
struct MemoryEntry {
    data: Vec<u8>,
    etag: Option<String>,
    expires_at: Instant,
}

#[derive(Debug, Default)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
}

/// Multi-tier cache providing L1 in-memory and L2 persistent disk caching with ETag support.
#[derive(Debug, Clone)]
pub struct MultiTierCache {
    memory_store: Arc<Mutex<HashMap<String, MemoryEntry>>>,
    disk_path: PathBuf,
    stats: Arc<Mutex<CacheStats>>,
}

impl MultiTierCache {
    pub fn new(disk_dir: impl AsRef<Path>) -> Self {
        let p = disk_dir.as_ref().to_path_buf();
        let _ = fs::create_dir_all(&p);

        Self {
            memory_store: Arc::new(Mutex::new(HashMap::new())),
            disk_path: p,
            stats: Arc::new(Mutex::new(CacheStats::default())),
        }
    }

    pub fn default_dir() -> PathBuf {
        std::env::temp_dir().join("open_figma_cache")
    }

    /// Retrieve an entry from L1 (memory) or L2 (disk).
    pub fn get(&self, key: &str) -> Option<(Vec<u8>, Option<String>)> {
        // 1. Check L1 Memory Cache
        {
            let mut mem = self.memory_store.lock().unwrap();
            if let Some(entry) = mem.get(key) {
                if Instant::now() < entry.expires_at {
                    let mut stats = self.stats.lock().unwrap();
                    stats.hits += 1;
                    return Some((entry.data.clone(), entry.etag.clone()));
                } else {
                    mem.remove(key);
                    let mut stats = self.stats.lock().unwrap();
                    stats.evictions += 1;
                }
            }
        }

        // 2. Check L2 Disk Cache
        let disk_file = self.disk_key_path(key);
        if disk_file.exists() {
            if let Ok(mut f) = File::open(&disk_file) {
                let mut data = Vec::new();
                if f.read_to_end(&mut data).is_ok() {
                    let etag = self.read_disk_etag(key);

                    // Promote to L1 memory cache (1 hour TTL)
                    let mut mem = self.memory_store.lock().unwrap();
                    mem.insert(
                        key.to_string(),
                        MemoryEntry {
                            data: data.clone(),
                            etag: etag.clone(),
                            expires_at: Instant::now() + Duration::from_secs(3600),
                        },
                    );

                    let mut stats = self.stats.lock().unwrap();
                    stats.hits += 1;
                    return Some((data, etag));
                }
            }
        }

        let mut stats = self.stats.lock().unwrap();
        stats.misses += 1;
        None
    }

    /// Store an entry into both L1 (memory) and L2 (disk).
    pub fn put(&self, key: &str, data: &[u8], etag: Option<&str>, ttl: Duration) {
        // Write to L1 Memory
        {
            let mut mem = self.memory_store.lock().unwrap();
            mem.insert(
                key.to_string(),
                MemoryEntry {
                    data: data.to_vec(),
                    etag: etag.map(str::to_string),
                    expires_at: Instant::now() + ttl,
                },
            );
        }

        // Write to L2 Disk
        let disk_file = self.disk_key_path(key);
        if let Ok(mut f) = File::create(&disk_file) {
            let _ = f.write_all(data);
        }

        if let Some(et) = etag {
            let etag_file = self.disk_etag_path(key);
            let _ = fs::write(etag_file, et);
        }
    }

    /// Invalidate an entry across all tiers
    pub fn invalidate(&self, key: &str) {
        {
            let mut mem = self.memory_store.lock().unwrap();
            mem.remove(key);
        }
        let _ = fs::remove_file(self.disk_key_path(key));
        let _ = fs::remove_file(self.disk_etag_path(key));
    }

    /// Retrieve cache statistics
    pub fn get_stats(&self) -> (u64, u64, u64) {
        let stats = self.stats.lock().unwrap();
        (stats.hits, stats.misses, stats.evictions)
    }

    fn disk_key_path(&self, key: &str) -> PathBuf {
        let hash = self.hash_key(key);
        self.disk_path.join(format!("{}.bin", hash))
    }

    fn disk_etag_path(&self, key: &str) -> PathBuf {
        let hash = self.hash_key(key);
        self.disk_path.join(format!("{}.etag", hash))
    }

    fn read_disk_etag(&self, key: &str) -> Option<String> {
        let path = self.disk_etag_path(key);
        fs::read_to_string(path).ok().map(|s| s.trim().to_string())
    }

    fn hash_key(&self, key: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_put_get_l1_and_l2() {
        let temp_dir = std::env::temp_dir().join(format!("test_cache_{}", uuid::Uuid::new_v4()));
        let cache = MultiTierCache::new(&temp_dir);

        let key = "figma:file:test123";
        let payload = b"{\"document\":{\"name\":\"Frame 1\"}}";

        assert_eq!(cache.get(key), None);

        cache.put(key, payload, Some("W/\"etag-123\""), Duration::from_secs(60));

        let retrieved = cache.get(key);
        assert!(retrieved.is_some());
        let (data, etag) = retrieved.unwrap();
        assert_eq!(data, payload);
        assert_eq!(etag, Some("W/\"etag-123\"".to_string()));

        let (hits, misses, _) = cache.get_stats();
        assert_eq!(hits, 1);
        assert_eq!(misses, 1);

        let _ = fs::remove_dir_all(temp_dir);
    }
}
