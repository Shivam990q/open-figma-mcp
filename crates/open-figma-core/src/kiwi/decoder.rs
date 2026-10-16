use std::io::Cursor;
use byteorder::{LittleEndian, ReadBytesExt};
use serde_json::{json, Value};
use crate::kiwi::schema::{KiwiDefinition, KiwiSchema, KiwiType};
use crate::CoreError;

pub struct KiwiDecoder<'a> {
    schema: &'a KiwiSchema,
    cursor: Cursor<&'a [u8]>,
}

impl<'a> KiwiDecoder<'a> {
    pub fn new(schema: &'a KiwiSchema, data: &'a [u8]) -> Self {
        Self {
            schema,
            cursor: Cursor::new(data),
        }
    }

    pub fn decode_varint(&mut self) -> Result<u64, CoreError> {
        let mut result = 0u64;
        let mut shift = 0;
        loop {
            let byte = self.cursor.read_u8()
                .map_err(|e| CoreError::Kiwi(format!("Unexpected EOF in varint: {}", e)))?;
            result |= ((byte & 0x7F) as u64) << shift;
            if (byte & 0x80) == 0 {
                break;
            }
            shift += 7;
            if shift >= 64 {
                return Err(CoreError::Kiwi("Varint overflow".to_string()));
            }
        }
        Ok(result)
    }

    pub fn decode_string(&mut self) -> Result<String, CoreError> {
        let mut bytes = Vec::new();
        loop {
            let b = self.cursor.read_u8()
                .map_err(|e| CoreError::Kiwi(format!("Unexpected EOF reading string: {}", e)))?;
            if b == 0 {
                break;
            }
            bytes.push(b);
        }
        Ok(String::from_utf8_lossy(&bytes).to_string())
    }

    pub fn decode_message(&mut self, type_index: usize) -> Result<Value, CoreError> {
        let def = self.schema.definitions.get(type_index)
            .ok_or_else(|| CoreError::Kiwi(format!("Type index out of bounds: {}", type_index)))?;

        match def {
            KiwiDefinition::Enum { name: _, values } => {
                let val = self.decode_varint()? as u32;
                for (k, v) in values {
                    if *v == val {
                        return Ok(json!(k));
                    }
                }
                Ok(json!(val))
            }
            KiwiDefinition::Struct { fields, .. } => {
                let mut map = serde_json::Map::new();
                for field in fields {
                    let field_val = self.decode_field(&field.field_type, field.is_array)?;
                    map.insert(field.name.clone(), field_val);
                }
                Ok(Value::Object(map))
            }
            KiwiDefinition::Message { fields, .. } => {
                let mut map = serde_json::Map::new();
                loop {
                    let field_id = self.decode_varint()? as u32;
                    if field_id == 0 {
                        break;
                    }

                    if let Some(field) = fields.iter().find(|f| f.value == field_id) {
                        let field_val = self.decode_field(&field.field_type, field.is_array)?;
                        map.insert(field.name.clone(), field_val);
                    } else {
                        // Unknown field, skip byte
                        let _ = self.decode_varint();
                    }
                }
                Ok(Value::Object(map))
            }
        }
    }

    fn decode_field(&mut self, field_type: &KiwiType, is_array: bool) -> Result<Value, CoreError> {
        if is_array {
            let count = self.decode_varint()? as usize;
            let mut list = Vec::with_capacity(count);
            for _ in 0..count {
                list.push(self.decode_single_value(field_type)?);
            }
            Ok(Value::Array(list))
        } else {
            self.decode_single_value(field_type)
        }
    }

    fn decode_single_value(&mut self, field_type: &KiwiType) -> Result<Value, CoreError> {
        match field_type {
            KiwiType::Bool => {
                let b = self.cursor.read_u8().map_err(|e| CoreError::Kiwi(e.to_string()))?;
                Ok(json!(b != 0))
            }
            KiwiType::Byte => {
                let b = self.cursor.read_u8().map_err(|e| CoreError::Kiwi(e.to_string()))?;
                Ok(json!(b))
            }
            KiwiType::Int => {
                let v = self.decode_varint()?;
                // Zigzag decode
                let int_val = ((v >> 1) as i64) ^ (-((v & 1) as i64));
                Ok(json!(int_val))
            }
            KiwiType::Uint => {
                let v = self.decode_varint()?;
                Ok(json!(v))
            }
            KiwiType::Float => {
                let f = self.cursor.read_f32::<LittleEndian>()
                    .map_err(|e| CoreError::Kiwi(e.to_string()))?;
                Ok(json!(f))
            }
            KiwiType::String => {
                let s = self.decode_string()?;
                Ok(json!(s))
            }
            KiwiType::Compound(idx) => {
                self.decode_message(*idx)
            }
        }
    }
}
