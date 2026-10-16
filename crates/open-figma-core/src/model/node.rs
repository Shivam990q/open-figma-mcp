use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum NodeType {
    Document,
    Canvas,
    Frame,
    Group,
    Vector,
    BooleanOperation,
    Star,
    Line,
    Ellipse,
    RegularPolygon,
    Rectangle,
    Text,
    Slice,
    Component,
    ComponentSet,
    Instance,
    Section,
    Sticky,
    ShapeWithText,
    Connector,
    WashiTape,
    Unknown(String),
}

impl Default for NodeType {
    fn default() -> Self {
        NodeType::Frame
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LayoutMode {
    None,
    Horizontal,
    Vertical,
    Grid,
}

impl Default for LayoutMode {
    fn default() -> Self {
        LayoutMode::None
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PrimaryAxisAlignItems {
    Min,
    Center,
    Max,
    SpaceBetween,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CounterAxisAlignItems {
    Min,
    Center,
    Max,
    Baseline,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct Color {
    pub r: f32,
    pub g: f32,
    pub b: f32,
    #[serde(default = "default_alpha")]
    pub a: f32,
}

fn default_alpha() -> f32 {
    1.0
}

impl Color {
    pub fn new(r: f32, g: f32, b: f32, a: f32) -> Self {
        Self { r, g, b, a }
    }

    pub fn to_hex(&self) -> String {
        let r = (self.r.clamp(0.0, 1.0) * 255.0).round() as u8;
        let g = (self.g.clamp(0.0, 1.0) * 255.0).round() as u8;
        let b = (self.b.clamp(0.0, 1.0) * 255.0).round() as u8;
        let a = (self.a.clamp(0.0, 1.0) * 255.0).round() as u8;

        if a == 255 {
            format!("#{:02X}{:02X}{:02X}", r, g, b)
        } else {
            format!("#{:02X}{:02X}{:02X}{:02X}", r, g, b, a)
        }
    }

    pub fn to_rgb_u8(&self) -> (u8, u8, u8) {
        (
            (self.r.clamp(0.0, 1.0) * 255.0).round() as u8,
            (self.g.clamp(0.0, 1.0) * 255.0).round() as u8,
            (self.b.clamp(0.0, 1.0) * 255.0).round() as u8,
        )
    }

    pub fn to_css_rgba(&self) -> String {
        let (r, g, b) = self.to_rgb_u8();
        if (self.a - 1.0).abs() < 0.001 {
            format!("rgb({}, {}, {})", r, g, b)
        } else {
            format!("rgba({}, {}, {}, {:.2})", r, g, b, self.a)
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Paint {
    Solid {
        color: Color,
        #[serde(default = "default_alpha")]
        opacity: f32,
        #[serde(default = "default_true")]
        visible: bool,
    },
    GradientLinear {
        stops: Vec<ColorStop>,
        #[serde(default = "default_true")]
        visible: bool,
    },
    GradientRadial {
        stops: Vec<ColorStop>,
        #[serde(default = "default_true")]
        visible: bool,
    },
    Image {
        #[serde(default)]
        image_ref: Option<String>,
        #[serde(default = "default_scale_mode")]
        scale_mode: String,
        #[serde(default = "default_true")]
        visible: bool,
    },
    Unknown,
}

fn default_true() -> bool {
    true
}

fn default_scale_mode() -> String {
    "FILL".to_string()
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ColorStop {
    pub position: f32,
    pub color: Color,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct TextStyle {
    #[serde(default)]
    pub font_family: String,
    #[serde(default)]
    pub font_weight: f32,
    #[serde(default)]
    pub font_size: f32,
    #[serde(default)]
    pub line_height_px: Option<f32>,
    #[serde(default)]
    pub letter_spacing: Option<f32>,
    #[serde(default)]
    pub text_align_horizontal: Option<String>,
    #[serde(default)]
    pub text_align_vertical: Option<String>,
    #[serde(default)]
    pub text_case: Option<String>,
    #[serde(default)]
    pub text_decoration: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Effect {
    DropShadow {
        color: Color,
        offset_x: f32,
        offset_y: f32,
        radius: f32,
        spread: f32,
        visible: bool,
    },
    InnerShadow {
        color: Color,
        offset_x: f32,
        offset_y: f32,
        radius: f32,
        spread: f32,
        visible: bool,
    },
    LayerBlur {
        radius: f32,
        visible: bool,
    },
    BackgroundBlur {
        radius: f32,
        visible: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct Padding {
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
    pub left: f32,
}

/// Strongly-typed, normalized representation of a Figma node.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct CanonicalNode {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    #[serde(default = "default_true")]
    pub visible: bool,

    #[serde(default)]
    pub bbox: BoundingBox,

    #[serde(default)]
    pub layout_mode: LayoutMode,
    #[serde(default)]
    pub primary_align: Option<PrimaryAxisAlignItems>,
    #[serde(default)]
    pub counter_align: Option<CounterAxisAlignItems>,
    #[serde(default)]
    pub padding: Option<Padding>,
    #[serde(default)]
    pub item_spacing: Option<f32>,

    #[serde(default)]
    pub corner_radius: Option<f32>,
    #[serde(default)]
    pub corner_radii: Option<[f32; 4]>,

    #[serde(default)]
    pub opacity: Option<f32>,

    #[serde(default)]
    pub fills: Vec<Paint>,
    #[serde(default)]
    pub strokes: Vec<Paint>,
    #[serde(default)]
    pub stroke_weight: Option<f32>,
    #[serde(default)]
    pub stroke_align: Option<String>,

    #[serde(default)]
    pub effects: Vec<Effect>,

    #[serde(default)]
    pub characters: Option<String>,
    #[serde(default)]
    pub style: Option<TextStyle>,

    #[serde(default)]
    pub vector_svg: Option<String>,

    #[serde(default)]
    pub component_id: Option<String>,
    #[serde(default)]
    pub component_properties: Option<serde_json::Value>,

    #[serde(default)]
    pub children: Vec<CanonicalNode>,
}

impl CanonicalNode {
    pub fn new(id: impl Into<String>, name: impl Into<String>, node_type: NodeType) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            node_type,
            visible: true,
            ..Default::default()
        }
    }

    /// Recursively counts total nodes in subtree
    pub fn total_nodes(&self) -> usize {
        1 + self.children.iter().map(|c| c.total_nodes()).sum::<usize>()
    }

    /// Returns primary fill hex color if solid
    pub fn primary_fill_hex(&self) -> Option<String> {
        self.fills.iter().find_map(|p| match p {
            Paint::Solid { color, visible, .. } if *visible => Some(color.to_hex()),
            _ => None,
        })
    }

    /// Returns primary text color if text node
    pub fn text_color_hex(&self) -> Option<String> {
        self.primary_fill_hex()
    }
}
