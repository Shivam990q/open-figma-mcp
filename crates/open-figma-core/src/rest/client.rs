use serde_json::Value;
use std::time::Duration;
use crate::model::node::{
    CanonicalNode, NodeType, LayoutMode, Color, Paint, BoundingBox, TextStyle, Padding,
    PrimaryAxisAlignItems, CounterAxisAlignItems
};
use crate::CoreError;

pub struct FigmaRestClient {
    client: reqwest::Client,
    api_key: String,
    base_url: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedFigmaUrl {
    pub file_key: String,
    pub node_id: Option<String>,
}

pub fn parse_figma_url(url_or_key: &str) -> Result<ParsedFigmaUrl, CoreError> {
    if !url_or_key.starts_with("http://") && !url_or_key.starts_with("https://") {
        // Direct file key passed
        return Ok(ParsedFigmaUrl {
            file_key: url_or_key.to_string(),
            node_id: None,
        });
    }

    let parsed = reqwest::Url::parse(url_or_key)
        .map_err(|e| CoreError::InvalidTarget(format!("Invalid URL syntax: {}", e)))?;

    let path_segments: Vec<&str> = parsed.path_segments()
        .map(|s| s.collect())
        .unwrap_or_default();

    // Figma URL paths: /design/:key/:title or /file/:key/:title
    let file_key = if path_segments.len() >= 2 && (path_segments[0] == "design" || path_segments[0] == "file") {
        path_segments[1].to_string()
    } else {
        return Err(CoreError::InvalidTarget("URL path must contain /design/:key or /file/:key".to_string()));
    };

    let mut node_id = None;
    for (key, val) in parsed.query_pairs() {
        if key == "node-id" {
            // Normalize dashes to colons (e.g. 12-822 -> 12:822)
            node_id = Some(val.replace('-', ":"));
            break;
        }
    }

    Ok(ParsedFigmaUrl { file_key, node_id })
}

impl FigmaRestClient {
    pub fn new(api_key: impl Into<String>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        Self {
            client,
            api_key: api_key.into(),
            base_url: "https://api.figma.com/v1".to_string(),
        }
    }

    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }

    /// Fetches file or specific node from Figma REST API
    pub async fn get_node(
        &self,
        file_key: &str,
        node_id: Option<&str>,
        depth: Option<usize>,
    ) -> Result<CanonicalNode, CoreError> {
        let mut url = if let Some(id) = node_id {
            format!("{}/files/{}/nodes?ids={}", self.base_url, file_key, id)
        } else {
            format!("{}/files/{}", self.base_url, file_key)
        };

        if let Some(d) = depth {
            url.push_str(&format!("&depth={}", d));
        }

        let resp = self.client
            .get(&url)
            .header("X-Figma-Token", &self.api_key)
            .send()
            .await
            .map_err(|e| CoreError::Http(format!("Failed to connect to Figma API: {}", e)))?;

        let status = resp.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(CoreError::RateLimit("Figma REST API rate limit exceeded (429)".to_string()));
        }

        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(CoreError::Http(format!("Figma API error {}: {}", status, body)));
        }

        let json: Value = resp.json().await
            .map_err(|e| CoreError::Http(format!("Failed to parse response JSON: {}", e)))?;

        if let Some(id) = node_id {
            // Response format is { "nodes": { "12:822": { "document": { ... } } } }
            let document = json.get("nodes")
                .and_then(|n| n.get(id))
                .and_then(|n| n.get("document"))
                .ok_or_else(|| CoreError::InvalidTarget(format!("Node ID '{}' not found in response", id)))?;

            Ok(parse_raw_node(document))
        } else {
            let document = json.get("document")
                .ok_or_else(|| CoreError::Http("No 'document' root found in Figma file response".to_string()))?;

            Ok(parse_raw_node(document))
        }
    }
}

/// Converts raw Figma JSON node into strongly typed CanonicalNode
pub fn parse_raw_node(val: &Value) -> CanonicalNode {
    let id = val.get("id").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let name = val.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed").to_string();
    let type_str = val.get("type").and_then(|v| v.as_str()).unwrap_or("FRAME");

    let node_type = match type_str {
        "DOCUMENT" => NodeType::Document,
        "CANVAS" => NodeType::Canvas,
        "FRAME" => NodeType::Frame,
        "GROUP" => NodeType::Group,
        "VECTOR" => NodeType::Vector,
        "BOOLEAN_OPERATION" => NodeType::BooleanOperation,
        "STAR" => NodeType::Star,
        "LINE" => NodeType::Line,
        "ELLIPSE" => NodeType::Ellipse,
        "REGULAR_POLYGON" => NodeType::RegularPolygon,
        "RECTANGLE" => NodeType::Rectangle,
        "TEXT" => NodeType::Text,
        "COMPONENT" => NodeType::Component,
        "COMPONENT_SET" => NodeType::ComponentSet,
        "INSTANCE" => NodeType::Instance,
        "SECTION" => NodeType::Section,
        other => NodeType::Unknown(other.to_string()),
    };

    let visible = val.get("visible").and_then(|v| v.as_bool()).unwrap_or(true);

    let bbox = if let Some(b) = val.get("absoluteBoundingBox") {
        BoundingBox {
            x: b.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            y: b.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            width: b.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            height: b.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
        }
    } else {
        BoundingBox::default()
    };

    let layout_mode = match val.get("layoutMode").and_then(|v| v.as_str()) {
        Some("HORIZONTAL") => LayoutMode::Horizontal,
        Some("VERTICAL") => LayoutMode::Vertical,
        Some("GRID") => LayoutMode::Grid,
        _ => LayoutMode::None,
    };

    let primary_align = match val.get("primaryAxisAlignItems").and_then(|v| v.as_str()) {
        Some("CENTER") => Some(PrimaryAxisAlignItems::Center),
        Some("MAX") => Some(PrimaryAxisAlignItems::Max),
        Some("SPACE_BETWEEN") => Some(PrimaryAxisAlignItems::SpaceBetween),
        _ => Some(PrimaryAxisAlignItems::Min),
    };

    let counter_align = match val.get("counterAxisAlignItems").and_then(|v| v.as_str()) {
        Some("CENTER") => Some(CounterAxisAlignItems::Center),
        Some("MAX") => Some(CounterAxisAlignItems::Max),
        Some("BASELINE") => Some(CounterAxisAlignItems::Baseline),
        _ => Some(CounterAxisAlignItems::Min),
    };

    let padding = if val.get("paddingTop").is_some() || val.get("paddingLeft").is_some() {
        Some(Padding {
            top: val.get("paddingTop").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            right: val.get("paddingRight").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            bottom: val.get("paddingBottom").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            left: val.get("paddingLeft").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
        })
    } else {
        None
    };

    let item_spacing = val.get("itemSpacing").and_then(|v| v.as_f64()).map(|s| s as f32);
    let corner_radius = val.get("cornerRadius").and_then(|v| v.as_f64()).map(|r| r as f32);
    let opacity = val.get("opacity").and_then(|v| v.as_f64()).map(|o| o as f32);

    let fills = parse_paints(val.get("fills"));
    let strokes = parse_paints(val.get("strokes"));
    let stroke_weight = val.get("strokeWeight").and_then(|v| v.as_f64()).map(|w| w as f32);

    let characters = val.get("characters").and_then(|v| v.as_str()).map(|s| s.to_string());
    let style = parse_text_style(val.get("style"));

    let children = if let Some(arr) = val.get("children").and_then(|v| v.as_array()) {
        arr.iter().map(parse_raw_node).collect()
    } else {
        Vec::new()
    };

    CanonicalNode {
        id,
        name,
        node_type,
        visible,
        bbox,
        layout_mode,
        primary_align,
        counter_align,
        padding,
        item_spacing,
        corner_radius,
        corner_radii: None,
        opacity,
        fills,
        strokes,
        stroke_weight,
        stroke_align: val.get("strokeAlign").and_then(|v| v.as_str()).map(|s| s.to_string()),
        effects: Vec::new(),
        characters,
        style,
        vector_svg: None,
        component_id: val.get("componentId").and_then(|v| v.as_str()).map(|s| s.to_string()),
        component_properties: val.get("componentProperties").cloned(),
        children,
    }
}

fn parse_paints(val: Option<&Value>) -> Vec<Paint> {
    let mut paints = Vec::new();
    if let Some(arr) = val.and_then(|v| v.as_array()) {
        for p in arr {
            let p_type = p.get("type").and_then(|v| v.as_str()).unwrap_or("SOLID");
            let visible = p.get("visible").and_then(|v| v.as_bool()).unwrap_or(true);
            let opacity = p.get("opacity").and_then(|v| v.as_f64()).unwrap_or(1.0) as f32;

            if p_type == "SOLID" {
                if let Some(c) = p.get("color") {
                    let r = c.get("r").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                    let g = c.get("g").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                    let b = c.get("b").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                    let a = c.get("a").and_then(|v| v.as_f64()).unwrap_or(1.0) as f32;
                    paints.push(Paint::Solid {
                        color: Color::new(r, g, b, a),
                        opacity,
                        visible,
                    });
                }
            }
        }
    }
    paints
}

fn parse_text_style(val: Option<&Value>) -> Option<TextStyle> {
    val.map(|s| TextStyle {
        font_family: s.get("fontFamily").and_then(|v| v.as_str()).unwrap_or("Inter").to_string(),
        font_weight: s.get("fontWeight").and_then(|v| v.as_f64()).unwrap_or(400.0) as f32,
        font_size: s.get("fontSize").and_then(|v| v.as_f64()).unwrap_or(14.0) as f32,
        line_height_px: s.get("lineHeightPx").and_then(|v| v.as_f64()).map(|l| l as f32),
        letter_spacing: s.get("letterSpacing").and_then(|v| v.as_f64()).map(|l| l as f32),
        text_align_horizontal: s.get("textAlignHorizontal").and_then(|v| v.as_str()).map(|s| s.to_string()),
        text_align_vertical: s.get("textAlignVertical").and_then(|v| v.as_str()).map(|s| s.to_string()),
        text_case: s.get("textCase").and_then(|v| v.as_str()).map(|s| s.to_string()),
        text_decoration: s.get("textDecoration").and_then(|v| v.as_str()).map(|s| s.to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_figma_url() {
        let url = "https://www.figma.com/design/AbC123XyZ/Design-System?node-id=12-822";
        let parsed = parse_figma_url(url).expect("parsed");
        assert_eq!(parsed.file_key, "AbC123XyZ");
        assert_eq!(parsed.node_id, Some("12:822".to_string()));

        let url_file = "https://www.figma.com/file/K9J8H7/Project-File?node-id=0:1";
        let parsed_file = parse_figma_url(url_file).expect("parsed file");
        assert_eq!(parsed_file.file_key, "K9J8H7");
        assert_eq!(parsed_file.node_id, Some("0:1".to_string()));
    }
}
