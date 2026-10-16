use std::collections::HashMap;
use byteorder::{LittleEndian, ReadBytesExt};
use std::io::{Cursor, Read};
use crate::CoreError;

#[derive(Debug, Clone, PartialEq)]
pub enum KiwiType {
    Bool,
    Byte,
    Int,
    Uint,
    Float,
    String,
    Compound(usize), // Index into schema.types
}

#[derive(Debug, Clone, PartialEq)]
pub struct KiwiField {
    pub name: String,
    pub field_type: KiwiType,
    pub is_array: bool,
    pub value: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub enum KiwiDefinition {
    Enum {
        name: String,
        values: HashMap<String, u32>,
    },
    Struct {
        name: String,
        fields: Vec<KiwiField>,
    },
    Message {
        name: String,
        fields: Vec<KiwiField>,
    },
}

#[derive(Debug, Clone, Default)]
pub struct KiwiSchema {
    pub definitions: Vec<KiwiDefinition>,
    pub name_to_index: HashMap<String, usize>,
}

impl KiwiSchema {
    pub fn parse_binary(bytes: &[u8]) -> Result<Self, CoreError> {
        let mut cursor = Cursor::new(bytes);
        let count = cursor.read_u32::<LittleEndian>()
            .map_err(|e| CoreError::Kiwi(format!("Failed to read schema type count: {}", e)))? as usize;

        let mut definitions = Vec::with_capacity(count);
        let mut name_to_index = HashMap::with_capacity(count);

        for idx in 0..count {
            let name_len = cursor.read_u8()
                .map_err(|e| CoreError::Kiwi(format!("Failed to read type name len: {}", e)))? as usize;
            let mut name_bytes = vec![0u8; name_len];
            cursor.read_exact(&mut name_bytes)
                .map_err(|e| CoreError::Kiwi(format!("Failed to read type name: {}", e)))?;
            let name = String::from_utf8_lossy(&name_bytes).to_string();

            let kind = cursor.read_u8()
                .map_err(|e| CoreError::Kiwi(format!("Failed to read kind: {}", e)))?;

            let def = match kind {
                0 => { // Enum
                    let val_count = cursor.read_u32::<LittleEndian>()
                        .map_err(|e| CoreError::Kiwi(format!("Enum val count: {}", e)))? as usize;
                    let mut values = HashMap::with_capacity(val_count);
                    for _ in 0..val_count {
                        let v_len = cursor.read_u8().unwrap_or(0) as usize;
                        let mut v_bytes = vec![0u8; v_len];
                        cursor.read_exact(&mut v_bytes).unwrap_or_default();
                        let v_name = String::from_utf8_lossy(&v_bytes).to_string();
                        let v_val = cursor.read_u32::<LittleEndian>().unwrap_or(0);
                        values.insert(v_name, v_val);
                    }
                    KiwiDefinition::Enum { name: name.clone(), values }
                }
                1 | 2 => { // Struct or Message
                    let f_count = cursor.read_u32::<LittleEndian>()
                        .map_err(|e| CoreError::Kiwi(format!("Field count: {}", e)))? as usize;
                    let mut fields = Vec::with_capacity(f_count);
                    for _ in 0..f_count {
                        let f_len = cursor.read_u8().unwrap_or(0) as usize;
                        let mut f_bytes = vec![0u8; f_len];
                        cursor.read_exact(&mut f_bytes).unwrap_or_default();
                        let f_name = String::from_utf8_lossy(&f_bytes).to_string();

                        let type_id = cursor.read_i32::<LittleEndian>().unwrap_or(-1);
                        let is_array = cursor.read_u8().unwrap_or(0) != 0;
                        let value = cursor.read_u32::<LittleEndian>().unwrap_or(0);

                        let field_type = match type_id {
                            -1 => KiwiType::Bool,
                            -2 => KiwiType::Byte,
                            -3 => KiwiType::Int,
                            -4 => KiwiType::Uint,
                            -5 => KiwiType::Float,
                            -6 => KiwiType::String,
                            idx if idx >= 0 => KiwiType::Compound(idx as usize),
                            _ => KiwiType::Compound(0),
                        };

                        fields.push(KiwiField {
                            name: f_name,
                            field_type,
                            is_array,
                            value,
                        });
                    }

                    if kind == 1 {
                        KiwiDefinition::Struct { name: name.clone(), fields }
                    } else {
                        KiwiDefinition::Message { name: name.clone(), fields }
                    }
                }
                _ => return Err(CoreError::Kiwi(format!("Unknown Kiwi definition kind: {}", kind))),
            };

            name_to_index.insert(name, idx);
            definitions.push(def);
        }

        Ok(KiwiSchema { definitions, name_to_index })
    }
}
