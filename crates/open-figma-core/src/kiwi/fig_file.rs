use byteorder::{LittleEndian, ReadBytesExt};
use flate2::read::DeflateDecoder;
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::Path;
use crate::kiwi::decoder::KiwiDecoder;
use crate::kiwi::schema::KiwiSchema;
use crate::model::node::{CanonicalNode, NodeType};
use crate::rest::client::parse_raw_node;
use crate::CoreError;

pub struct FigArchive {
    pub version: u32,
    pub schema: KiwiSchema,
    pub raw_data: Vec<u8>,
}

impl FigArchive {
    /// Opens and decodes a `.fig` binary file from disk
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, CoreError> {
        let file = File::open(path)?;
        let mut zip = zip_extract_canvas(file)?;
        Self::from_canvas_bytes(&mut zip)
    }

    /// Reads canvas.fig binary bytes directly
    pub fn from_canvas_bytes(bytes: &[u8]) -> Result<Self, CoreError> {
        let mut cursor = Cursor::new(bytes);

        // 1. Verify 8-byte magic header "fig-kiwi"
        let mut magic = [0u8; 8];
        cursor.read_exact(&mut magic)
            .map_err(|e| CoreError::Kiwi(format!("Failed to read magic header: {}", e)))?;

        if &magic != b"fig-kiwi" {
            return Err(CoreError::Kiwi(format!(
                "Invalid .fig magic header: expected 'fig-kiwi', found '{}'",
                String::from_utf8_lossy(&magic)
            )));
        }

        // 2. Read version
        let version = cursor.read_u32::<LittleEndian>()
            .map_err(|e| CoreError::Kiwi(format!("Failed to read version: {}", e)))?;

        // 3. Read compressed schema length
        let schema_len = cursor.read_u32::<LittleEndian>()
            .map_err(|e| CoreError::Kiwi(format!("Failed to read schema length: {}", e)))? as usize;

        let mut compressed_schema = vec![0u8; schema_len];
        cursor.read_exact(&mut compressed_schema)
            .map_err(|e| CoreError::Kiwi(format!("Failed to read compressed schema bytes: {}", e)))?;

        // 4. Decompress schema via DEFLATE
        let mut deflate = DeflateDecoder::new(&compressed_schema[..]);
        let mut decompressed_schema = Vec::new();
        deflate.read_to_end(&mut decompressed_schema)
            .map_err(|e| CoreError::Decompress(format!("Deflate decompression failed: {}", e)))?;

        let schema = KiwiSchema::parse_binary(&decompressed_schema)?;

        // 5. Read remaining data payload (compressed with zstd)
        let mut compressed_data = Vec::new();
        cursor.read_to_end(&mut compressed_data)
            .map_err(|e| CoreError::Kiwi(format!("Failed to read data payload: {}", e)))?;

        // Decompress via zstd if compressed, or use raw bytes
        let raw_data = match zstd::stream::decode_all(Cursor::new(&compressed_data)) {
            Ok(decompressed) => decompressed,
            Err(_) => compressed_data, // fallback to uncompressed
        };

        Ok(Self {
            version,
            schema,
            raw_data,
        })
    }

    /// Decodes the document scenegraph into CanonicalNode
    pub fn to_canonical_node(&self) -> Result<CanonicalNode, CoreError> {
        let message_idx = self.schema.name_to_index.get("Message")
            .copied()
            .or_else(|| self.schema.name_to_index.get("Document").copied())
            .unwrap_or(0);

        let mut decoder = KiwiDecoder::new(&self.schema, &self.raw_data);
        let val = decoder.decode_message(message_idx)?;

        // If the decoded structure has a document node, parse it
        if let Some(doc) = val.get("document") {
            Ok(parse_raw_node(doc))
        } else if val.get("type").is_some() {
            Ok(parse_raw_node(&val))
        } else {
            // Synthesize a canvas root
            let mut root = CanonicalNode::new("root", "Offline Fig Document", NodeType::Document);
            root.characters = Some(serde_json::to_string(&val).unwrap_or_default());
            Ok(root)
        }
    }
}

/// Helper to extract canvas.fig from a ZIP archive
fn zip_extract_canvas(file: File) -> Result<Vec<u8>, CoreError> {
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| CoreError::Zip(format!("Failed to open ZIP archive: {}", e)))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| CoreError::Zip(format!("Invalid zip entry: {}", e)))?;

        if entry.name() == "canvas.fig" {
            let mut bytes = Vec::with_capacity(entry.size() as usize);
            entry.read_to_end(&mut bytes)
                .map_err(|e| CoreError::Zip(format!("Failed to read canvas.fig: {}", e)))?;
            return Ok(bytes);
        }
    }

    Err(CoreError::Zip("canvas.fig not found inside .fig archive".to_string()))
}
