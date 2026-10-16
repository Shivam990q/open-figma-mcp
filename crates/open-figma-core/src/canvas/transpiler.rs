use crate::model::node::{
    BoundingBox, CanonicalNode, Color, CounterAxisAlignItems, Effect, LayoutMode, NodeType, Padding,
    Paint, PrimaryAxisAlignItems, TextStyle,
};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeToCanvasResult {
    pub root_nodes: Vec<CanonicalNode>,
    pub warnings: Vec<String>,
}

/// Transpiles HTML / JSX / Tailwind snippets into strongly-typed `CanonicalNode` trees.
pub fn transpile_code_to_nodes(code: &str) -> CodeToCanvasResult {
    let mut warnings = Vec::new();
    let cleaned = clean_code_snippet(code);

    let nodes = parse_elements(&cleaned, &mut warnings);

    CodeToCanvasResult {
        root_nodes: nodes,
        warnings,
    }
}

fn clean_code_snippet(code: &str) -> String {
    // Strip React component wrapper boilerplate (e.g., export default function ... return ( ... ))
    let re_return = Regex::new(r"(?s)return\s*\(\s*(<.*>)\s*\)\s*;?").unwrap();
    if let Some(caps) = re_return.captures(code) {
        if let Some(m) = caps.get(1) {
            return m.as_str().trim().to_string();
        }
    }
    code.trim().to_string()
}

fn parse_elements(html: &str, warnings: &mut Vec<String>) -> Vec<CanonicalNode> {
    let mut nodes = Vec::new();
    let open_re = Regex::new(r#"<([a-zA-Z0-9_-]+)([^>]*?)(/?)>"#).unwrap();

    let mut cursor = 0;
    let mut id_counter = 1;

    while let Some(mat) = open_re.find_at(html, cursor) {
        if let Some(caps) = open_re.captures(&html[mat.start()..mat.end()]) {
            let tag_name = caps[1].to_string();
            let attrs_str = caps[2].to_string();
            let is_self_closing = &caps[3] == "/";

            let id = format!("code_node_{}", id_counter);
            id_counter += 1;

            let node_type = match tag_name.to_lowercase().as_str() {
                "button" => NodeType::Frame,
                "div" | "section" | "main" | "article" | "nav" | "header" | "footer" | "card" => NodeType::Frame,
                "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "label" => NodeType::Text,
                "input" => NodeType::Frame,
                "img" => NodeType::Rectangle,
                _ => NodeType::Frame,
            };

            let mut node = CanonicalNode::new(id, format!("{}Layer", capitalize(&tag_name)), node_type);
            node.bbox = BoundingBox { x: 0.0, y: 0.0, width: 320.0, height: 48.0 };

            // Extract class or className
            let class_re = Regex::new(r#"(?:class|className)=["']([^"']+)["']"#).unwrap();
            if let Some(class_cap) = class_re.captures(&attrs_str) {
                let class_names = &class_cap[1];
                apply_tailwind_classes(&mut node, class_names);
            }

            if is_self_closing {
                nodes.push(node);
                cursor = mat.end();
            } else {
                let close_tag = format!("</{}>", tag_name);
                if let Some(close_idx) = html[mat.end()..].find(&close_tag) {
                    let inner_content = &html[mat.end()..mat.end() + close_idx];
                    let trimmed_inner = inner_content.trim();

                    if !trimmed_inner.is_empty() {
                        if trimmed_inner.contains('<') {
                            let children = parse_elements(trimmed_inner, warnings);
                            node.children = children;
                        } else {
                            if node.node_type == NodeType::Text || node.node_type == NodeType::Frame {
                                node.characters = Some(trimmed_inner.to_string());
                                if node.node_type == NodeType::Frame && node.children.is_empty() {
                                    let mut text_child = CanonicalNode::new(
                                        format!("{}_text", node.id),
                                        "Label",
                                        NodeType::Text,
                                    );
                                    text_child.characters = Some(trimmed_inner.to_string());
                                    text_child.style = Some(TextStyle {
                                        font_size: 14.0,
                                        font_weight: 500.0,
                                        font_family: "Inter".to_string(),
                                        ..Default::default()
                                    });
                                    if let Some(text_fill) = node.text_color_hex() {
                                        text_child.fills = vec![Paint::Solid {
                                            color: parse_hex_color(&text_fill),
                                            opacity: 1.0,
                                            visible: true,
                                        }];
                                    }
                                    node.children.push(text_child);
                                }
                            }
                        }
                    }

                    nodes.push(node);
                    cursor = mat.end() + close_idx + close_tag.len();
                } else {
                    nodes.push(node);
                    cursor = mat.end();
                }
            }
        } else {
            break;
        }
    }

    nodes
}

fn apply_tailwind_classes(node: &mut CanonicalNode, classes: &str) {
    let mut padding = Padding::default();
    let mut has_padding = false;

    for token in classes.split_whitespace() {
        match token {
            // Layout modes
            "flex" => node.layout_mode = LayoutMode::Horizontal,
            "flex-col" => node.layout_mode = LayoutMode::Vertical,
            "flex-row" => node.layout_mode = LayoutMode::Horizontal,

            // Alignments
            "items-center" => node.counter_align = Some(CounterAxisAlignItems::Center),
            "items-start" => node.counter_align = Some(CounterAxisAlignItems::Min),
            "items-end" => node.counter_align = Some(CounterAxisAlignItems::Max),
            "justify-center" => node.primary_align = Some(PrimaryAxisAlignItems::Center),
            "justify-between" => node.primary_align = Some(PrimaryAxisAlignItems::SpaceBetween),

            // Radii
            "rounded-none" => node.corner_radius = Some(0.0),
            "rounded-sm" => node.corner_radius = Some(2.0),
            "rounded" => node.corner_radius = Some(4.0),
            "rounded-md" => node.corner_radius = Some(6.0),
            "rounded-lg" => node.corner_radius = Some(8.0),
            "rounded-xl" => node.corner_radius = Some(12.0),
            "rounded-2xl" => node.corner_radius = Some(16.0),
            "rounded-full" => node.corner_radius = Some(9999.0),

            // Shadows
            "shadow-sm" => node.effects.push(Effect::DropShadow {
                color: Color::new(0.0, 0.0, 0.0, 0.05),
                offset_x: 0.0,
                offset_y: 1.0,
                radius: 2.0,
                spread: 0.0,
                visible: true,
            }),
            "shadow" | "shadow-md" => node.effects.push(Effect::DropShadow {
                color: Color::new(0.0, 0.0, 0.0, 0.1),
                offset_x: 0.0,
                offset_y: 4.0,
                radius: 6.0,
                spread: -1.0,
                visible: true,
            }),
            "shadow-lg" => node.effects.push(Effect::DropShadow {
                color: Color::new(0.0, 0.0, 0.0, 0.15),
                offset_x: 0.0,
                offset_y: 10.0,
                radius: 15.0,
                spread: -3.0,
                visible: true,
            }),

            // Background fills
            "bg-white" => set_solid_fill(node, Color::new(1.0, 1.0, 1.0, 1.0)),
            "bg-black" => set_solid_fill(node, Color::new(0.0, 0.0, 0.0, 1.0)),
            "bg-transparent" => node.fills.clear(),
            "bg-blue-500" | "bg-blue-600" => set_solid_fill(node, Color::new(0.15, 0.5, 0.95, 1.0)),
            "bg-slate-900" | "bg-gray-900" => set_solid_fill(node, Color::new(0.06, 0.09, 0.15, 1.0)),
            "bg-slate-100" | "bg-gray-100" => set_solid_fill(node, Color::new(0.95, 0.96, 0.98, 1.0)),
            "bg-emerald-500" | "bg-green-600" => set_solid_fill(node, Color::new(0.1, 0.7, 0.4, 1.0)),
            "bg-red-500" | "bg-red-600" => set_solid_fill(node, Color::new(0.9, 0.2, 0.2, 1.0)),

            // Text colors
            "text-white" => set_text_color(node, Color::new(1.0, 1.0, 1.0, 1.0)),
            "text-black" => set_text_color(node, Color::new(0.0, 0.0, 0.0, 1.0)),
            "text-gray-500" | "text-slate-500" => set_text_color(node, Color::new(0.4, 0.45, 0.5, 1.0)),

            // Typography
            "font-bold" => set_font_weight(node, 700.0),
            "font-semibold" => set_font_weight(node, 600.0),
            "font-medium" => set_font_weight(node, 500.0),
            "text-xs" => set_font_size(node, 12.0),
            "text-sm" => set_font_size(node, 14.0),
            "text-base" => set_font_size(node, 16.0),
            "text-lg" => set_font_size(node, 18.0),
            "text-xl" => set_font_size(node, 20.0),
            "text-2xl" => set_font_size(node, 24.0),

            _ => {
                // Gap / Spacing (gap-2, gap-4)
                if let Some(gap_str) = token.strip_prefix("gap-") {
                    if let Ok(multiplier) = gap_str.parse::<f32>() {
                        node.item_spacing = Some(multiplier * 4.0);
                    }
                }
                // Padding (p-2, p-4, px-4, py-2)
                else if let Some(p_str) = token.strip_prefix("p-") {
                    if let Ok(multiplier) = p_str.parse::<f32>() {
                        let px = multiplier * 4.0;
                        padding = Padding { top: px, right: px, bottom: px, left: px };
                        has_padding = true;
                    }
                } else if let Some(px_str) = token.strip_prefix("px-") {
                    if let Ok(multiplier) = px_str.parse::<f32>() {
                        let px = multiplier * 4.0;
                        padding.left = px;
                        padding.right = px;
                        has_padding = true;
                    }
                } else if let Some(py_str) = token.strip_prefix("py-") {
                    if let Ok(multiplier) = py_str.parse::<f32>() {
                        let py = multiplier * 4.0;
                        padding.top = py;
                        padding.bottom = py;
                        has_padding = true;
                    }
                }
            }
        }
    }

    if has_padding {
        node.padding = Some(padding);
    }
}

fn set_solid_fill(node: &mut CanonicalNode, color: Color) {
    node.fills = vec![Paint::Solid {
        color,
        opacity: 1.0,
        visible: true,
    }];
}

fn set_text_color(node: &mut CanonicalNode, color: Color) {
    if node.node_type == NodeType::Text {
        set_solid_fill(node, color);
    }
}

fn set_font_weight(node: &mut CanonicalNode, weight: f32) {
    let mut style = node.style.clone().unwrap_or_default();
    style.font_weight = weight;
    node.style = Some(style);
}

fn set_font_size(node: &mut CanonicalNode, size: f32) {
    let mut style = node.style.clone().unwrap_or_default();
    style.font_size = size;
    node.style = Some(style);
}

fn parse_hex_color(hex: &str) -> Color {
    let clean = hex.trim_start_matches('#');
    if clean.len() >= 6 {
        let r = u8::from_str_radix(&clean[0..2], 16).unwrap_or(0) as f32 / 255.0;
        let g = u8::from_str_radix(&clean[2..4], 16).unwrap_or(0) as f32 / 255.0;
        let b = u8::from_str_radix(&clean[4..6], 16).unwrap_or(0) as f32 / 255.0;
        Color::new(r, g, b, 1.0)
    } else {
        Color::new(0.0, 0.0, 0.0, 1.0)
    }
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transpile_button() {
        let snippet = r#"<button className="flex items-center justify-center p-4 bg-blue-600 rounded-lg text-white font-bold">Save Changes</button>"#;
        let result = transpile_code_to_nodes(snippet);

        assert_eq!(result.root_nodes.len(), 1);
        let btn = &result.root_nodes[0];
        assert_eq!(btn.name, "ButtonLayer");
        assert_eq!(btn.layout_mode, LayoutMode::Horizontal);
        assert_eq!(btn.corner_radius, Some(8.0));
        assert!(btn.padding.is_some());
        assert_eq!(btn.padding.as_ref().unwrap().top, 16.0);
        assert!(!btn.children.is_empty());
        assert_eq!(btn.children[0].characters, Some("Save Changes".to_string()));
    }
}
