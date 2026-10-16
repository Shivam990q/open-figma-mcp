# Figma Kiwi Binary Protocol & File Format Specification

> **Engineering Reference:** Deep dissection of Figma's proprietary `.fig` binary container and Kiwi wire protocol.  
> **Source Engine:** `crates/open-figma-core/src/kiwi/`  

---

## 1. Container Structure

Figma document files (`.fig`, `.deck`) are standard ZIP archives containing a binary canvas payload:

```
[ .fig ZIP Container ]
 ├── canvas.fig          <- Primary Kiwi scenegraph payload (Binary)
 ├── thumbnail.png       <- Optional raster preview
 └── images/             <- Image fills stored by SHA-1 hash
```

---

## 2. Binary Wire Layout (`canvas.fig`)

The `canvas.fig` binary file begins with an 8-byte magic header, followed by a self-describing schema chunk and the compressed document payload:

```
+-------------------------------------------------------------------------+
| Byte Offset | Size (Bytes) | Field Name            | Description        |
+-------------------------------------------------------------------------+
| 0x00        | 8            | Magic Header          | ASCII "fig-kiwi"   |
| 0x08        | 4 (uint32_le)| Kiwi Format Version   | Version (e.g. 15+) |
| 0x0C        | 4 (uint32_le)| Schema Chunk Length   | Length of DEFLATE  |
| 0x10        | N            | Compressed Schema     | DEFLATE compressed |
| 0x10 + N    | Remainder    | Document Data Payload | Zstandard (zstd)   |
+-------------------------------------------------------------------------+
```

---

## 3. Schema Parsing Specification

Because Figma updates its internal document schema frequently, every `.fig` file contains its own Kiwi schema definition. The schema chunk is decompressed using DEFLATE:

### Schema Binary Encoding:
1. `type_count` (uint32 little-endian): Total number of definitions.
2. For each definition:
   * `name_length` (uint8) + `name_bytes` (UTF-8 string).
   * `kind` (uint8):
     * `0`: Enum
     * `1`: Struct
     * `2`: Message
3. **Enum Definition (`kind == 0`):**
   * `value_count` (uint32_le)
   * For each value: `name_len` (uint8) + `name_str` + `value` (uint32_le).
4. **Struct & Message Definition (`kind == 1` or `2`):**
   * `field_count` (uint32_le)
   * For each field:
     * `name_len` (uint8) + `name_str`
     * `type_id` (int32_le):
       * `-1`: `bool`
       * `-2`: `byte`
       * `-3`: `int` (Signed Zigzag varint)
       * `-4`: `uint` (Unsigned varint)
       * `-5`: `float` (32-bit IEEE float little-endian)
       * `-6`: `string` (Null-terminated UTF-8)
       * `>= 0`: Index referencing a compound definition in the schema table.
     * `is_array` (uint8): `1` if array, `0` if single value.
     * `field_value_id` (uint32_le): Numeric identifier used on the wire.

---

## 4. Document Data Decoding

The remaining payload is decompressed via Zstandard (`zstd::stream::decode_all`).

### Variable-Length Integer (Varint) Decoding:
Integers are encoded using standard 7-bit continuation bytes:
```rust
pub fn decode_varint(cursor: &mut Cursor<&[u8]>) -> Result<u64> {
    let mut result = 0u64;
    let mut shift = 0;
    loop {
        let byte = cursor.read_u8()?;
        result |= ((byte & 0x7F) as u64) << shift;
        if (byte & 0x80) == 0 {
            break;
        }
        shift += 7;
    }
    Ok(result)
}
```

### Zigzag Encoding for Signed Integers:
Signed integers use Zigzag encoding to ensure small negative values map to small positive integers:
$$\text{Decode}(v) = (v \gg 1) \oplus -(v \ \& \ 1)$$

---

## 5. Live WebSocket Multiplayer Stream

Figma's desktop client connects to multiplayer servers using WebSockets carrying binary Kiwi payloads:
* **`commandsBlob`**: Encodes incremental canvas mutations (moving a node, updating fill, inserting text).
* **`vectorNetworkBlob`**: Encodes Bézier curve path topologies (vertices, segments, loops).
OpenFigma hooks into these streams via Chrome DevTools Protocol (CDP) or the companion plugin to enable instant bidirectional synchronization with zero REST API overhead.
