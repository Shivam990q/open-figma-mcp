use crate::model::node::{CanonicalNode, Effect, NodeType, Paint};

/// Generates valid, self-contained SVG markup from a `CanonicalNode` scenegraph tree.
pub fn render_svg(node: &CanonicalNode) -> String {
    let width = if node.bbox.width > 0.0 { node.bbox.width } else { 800.0 };
    let height = if node.bbox.height > 0.0 { node.bbox.height } else { 600.0 };

    let mut defs = Vec::new();
    let mut elements = Vec::new();

    // Render node and its hierarchy
    render_node_to_svg(node, 0.0, 0.0, &mut defs, &mut elements);

    let defs_block = if defs.is_empty() {
        String::new()
    } else {
        format!("  <defs>\n{}\n  </defs>\n", defs.join("\n"))
    };

    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" width="{}" height="{}">
{}{}
</svg>"#,
        width, height, width, height, defs_block, elements.join("\n")
    )
}

/// Generates a data URI containing the SVG representation of a node.
pub fn render_svg_data_uri(node: &CanonicalNode) -> String {
    let svg = render_svg(node);
    let encoded = base64_encode(svg.as_bytes());
    format!("data:image/svg+xml;base64,{}", encoded)
}

fn render_node_to_svg(
    node: &CanonicalNode,
    offset_x: f32,
    offset_y: f32,
    defs: &mut Vec<String>,
    elements: &mut Vec<String>,
) {
    if !node.visible {
        return;
    }

    let x = node.bbox.x + offset_x;
    let y = node.bbox.y + offset_y;
    let w = node.bbox.width;
    let h = node.bbox.height;

    let fill_attr = resolve_fill(node, defs);
    let stroke_attr = resolve_stroke(node);
    let filter_attr = resolve_filter(node, defs);
    let opacity_attr = node.opacity.map(|o| format!(r#" opacity="{:.2}""#, o)).unwrap_or_default();

    match node.node_type {
        NodeType::Text => {
            if let Some(ref text) = node.characters {
                let font_family = node
                    .style
                    .as_ref()
                    .map(|s| s.font_family.as_str())
                    .filter(|f| !f.is_empty())
                    .unwrap_or("Inter, system-ui, sans-serif");

                let font_size = node.style.as_ref().map(|s| s.font_size).unwrap_or(16.0);
                let font_weight = node.style.as_ref().map(|s| s.font_weight).unwrap_or(400.0);

                let fill = node.text_color_hex().unwrap_or_else(|| "#000000".to_string());
                let baseline_y = y + font_size;

                elements.push(format!(
                    r#"  <text x="{:.1}" y="{:.1}" font-family="{}" font-size="{:.1}" font-weight="{:.0}" fill="{}"{}{}>{}</text>"#,
                    x, baseline_y, xml_escape(font_family), font_size, font_weight, fill, filter_attr, opacity_attr, xml_escape(text)
                ));
            }
        }
        NodeType::Ellipse => {
            let cx = x + w / 2.0;
            let cy = y + h / 2.0;
            let rx = w / 2.0;
            let ry = h / 2.0;

            if (rx - ry).abs() < 0.001 {
                elements.push(format!(
                    r#"  <circle cx="{:.1}" cy="{:.1}" r="{:.1}"{}{}{}{}{} id="{}" />"#,
                    cx, cy, rx, fill_attr, stroke_attr, filter_attr, opacity_attr, node_title(node), xml_escape(&node.id)
                ));
            } else {
                elements.push(format!(
                    r#"  <ellipse cx="{:.1}" cy="{:.1}" rx="{:.1}" ry="{:.1}"{}{}{}{}{} id="{}" />"#,
                    cx, cy, rx, ry, fill_attr, stroke_attr, filter_attr, opacity_attr, node_title(node), xml_escape(&node.id)
                ));
            }
        }
        NodeType::Vector | NodeType::Line | NodeType::Star | NodeType::RegularPolygon => {
            if let Some(ref svg_path) = node.vector_svg {
                elements.push(format!(
                    r#"  <g id="{}"{}{}{}>{}</g>"#,
                    xml_escape(&node.id), opacity_attr, filter_attr, node_title(node), svg_path
                ));
            } else {
                elements.push(format!(
                    r#"  <rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}"{}{}{}{}{} id="{}" />"#,
                    x, y, w, h, fill_attr, stroke_attr, filter_attr, opacity_attr, node_title(node), xml_escape(&node.id)
                ));
            }
        }
        _ => {
            // Frame, Rectangle, Group, Component, Instance
            let rx_attr = node.corner_radius.map(|r| format!(r#" rx="{:.1}""#, r)).unwrap_or_default();

            let has_visuals = !node.fills.is_empty() || !node.strokes.is_empty() || !node.effects.is_empty();
            if has_visuals && w > 0.0 && h > 0.0 {
                elements.push(format!(
                    r#"  <rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}"{}{}{}{}{}{} id="{}" />"#,
                    x, y, w, h, rx_attr, fill_attr, stroke_attr, filter_attr, opacity_attr, node_title(node), xml_escape(&node.id)
                ));
            }

            // Render children
            for child in &node.children {
                render_node_to_svg(child, offset_x, offset_y, defs, elements);
            }
        }
    }
}

fn resolve_fill(node: &CanonicalNode, defs: &mut Vec<String>) -> String {
    for (idx, fill) in node.fills.iter().enumerate() {
        match fill {
            Paint::Solid { color, visible, .. } if *visible => {
                return format!(r#" fill="{}""#, color.to_hex());
            }
            Paint::GradientLinear { stops, visible } if *visible => {
                let grad_id = format!("grad_{}_{}", sanitize_id(&node.id), idx);
                let mut stops_xml = Vec::new();
                for stop in stops {
                    stops_xml.push(format!(
                        r#"      <stop offset="{:.0}%" stop-color="{}" />"#,
                        stop.position * 100.0,
                        stop.color.to_hex()
                    ));
                }
                defs.push(format!(
                    r#"    <linearGradient id="{}" x1="0%" y1="0%" x2="100%" y2="100%">
{}
    </linearGradient>"#,
                    grad_id, stops_xml.join("\n")
                ));
                return format!(r#" fill="url(#{})""#, grad_id);
            }
            _ => {}
        }
    }

    if node.node_type == NodeType::Text {
        " fill=\"#000000\"".to_string()
    } else {
        " fill=\"none\"".to_string()
    }
}

fn resolve_stroke(node: &CanonicalNode) -> String {
    for stroke in &node.strokes {
        if let Paint::Solid { color, visible, .. } = stroke {
            if *visible {
                let sw = node.stroke_weight.unwrap_or(1.0);
                return format!(r#" stroke="{}" stroke-width="{:.1}""#, color.to_hex(), sw);
            }
        }
    }
    String::new()
}

fn resolve_filter(node: &CanonicalNode, defs: &mut Vec<String>) -> String {
    for (idx, effect) in node.effects.iter().enumerate() {
        if let Effect::DropShadow { color, offset_x, offset_y, radius, visible, .. } = effect {
            if *visible {
                let filter_id = format!("filter_{}_{}", sanitize_id(&node.id), idx);
                let (r, g, b) = color.to_rgb_u8();
                defs.push(format!(
                    r#"    <filter id="{}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="{:.1}" dy="{:.1}" stdDeviation="{:.1}" flood-color="rgb({}, {}, {})" flood-opacity="{:.2}" />
    </filter>"#,
                    filter_id, offset_x, offset_y, radius, r, g, b, color.a
                ));
                return format!(r#" filter="url(#{})""#, filter_id);
            }
        }
    }
    String::new()
}

fn node_title(node: &CanonicalNode) -> String {
    if !node.name.is_empty() {
        format!(r#" data-name="{}""#, xml_escape(&node.name))
    } else {
        String::new()
    }
}

fn sanitize_id(id: &str) -> String {
    id.chars().map(|c| if c.is_alphanumeric() { c } else { '_' }).collect()
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn base64_encode(input: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);

    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };

        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(CHARSET[((triple >> 18) & 0x3F) as usize] as char);
        out.push(CHARSET[((triple >> 12) & 0x3F) as usize] as char);

        if chunk.len() > 1 {
            out.push(CHARSET[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }

        if chunk.len() > 2 {
            out.push(CHARSET[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::node::{BoundingBox, Color, TextStyle};

    #[test]
    fn test_render_rect_svg() {
        let mut node = CanonicalNode::new("1:1", "PrimaryButton", NodeType::Rectangle);
        node.bbox = BoundingBox { x: 10.0, y: 20.0, width: 200.0, height: 48.0 };
        node.fills = vec![Paint::Solid {
            color: Color::new(0.0, 0.5, 1.0, 1.0),
            opacity: 1.0,
            visible: true,
        }];
        node.corner_radius = Some(8.0);

        let svg = render_svg(&node);
        assert!(svg.contains(r#"<rect x="10.0" y="20.0" width="200.0" height="48.0""#));
        assert!(svg.contains(r#"rx="8.0""#));
        assert!(svg.contains("fill=\"#0080FF\""));
    }

    #[test]
    fn test_render_text_svg() {
        let mut node = CanonicalNode::new("1:2", "Label", NodeType::Text);
        node.bbox = BoundingBox { x: 0.0, y: 0.0, width: 100.0, height: 24.0 };
        node.characters = Some("Hello World".to_string());
        node.style = Some(TextStyle {
            font_size: 16.0,
            font_weight: 700.0,
            font_family: "Inter".to_string(),
            ..Default::default()
        });
        node.fills = vec![Paint::Solid {
            color: Color::new(1.0, 1.0, 1.0, 1.0),
            opacity: 1.0,
            visible: true,
        }];

        let svg = render_svg(&node);
        assert!(svg.contains(r#"<text"#));
        assert!(svg.contains("Hello World"));
        assert!(svg.contains(r#"font-family="Inter""#));
    }

    #[test]
    fn test_render_svg_data_uri() {
        let node = CanonicalNode::new("1:3", "Frame", NodeType::Frame);
        let data_uri = render_svg_data_uri(&node);
        assert!(data_uri.starts_with("data:image/svg+xml;base64,"));
    }
}
