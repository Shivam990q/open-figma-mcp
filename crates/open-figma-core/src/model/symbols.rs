use std::collections::BTreeMap;
use serde::{Deserialize, Serialize};
use crate::model::node::{CanonicalNode, Paint, TextStyle, Effect};

/// Global symbol table representing deduplicated design tokens extracted from a scenegraph.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct SymbolTable {
    /// Color hex -> Symbol key (e.g. "#3B82F6" -> "$C1")
    pub colors: BTreeMap<String, String>,
    /// Reverse mapping: Symbol key -> Color hex
    pub color_defs: BTreeMap<String, String>,

    /// Typography signature -> Symbol key
    pub typography: BTreeMap<String, String>,
    /// Reverse mapping: Symbol key -> Typography definition
    pub typography_defs: BTreeMap<String, TextStyle>,

    /// Shadow signature -> Symbol key
    pub shadows: BTreeMap<String, String>,
    /// Reverse mapping: Symbol key -> CSS box shadow string
    pub shadow_defs: BTreeMap<String, String>,

    /// Corner radius -> Symbol key
    pub radii: BTreeMap<String, String>,
    /// Reverse mapping: Symbol key -> radius px string
    pub radius_defs: BTreeMap<String, f32>,

    color_counter: usize,
    typography_counter: usize,
    shadow_counter: usize,
    radius_counter: usize,
}

impl SymbolTable {
    pub fn new() -> Self {
        Self::default()
    }

    /// Registers a color and returns its symbol key (e.g. "$C1")
    pub fn register_color(&mut self, hex: &str) -> String {
        let normalized = hex.to_uppercase();
        if let Some(existing) = self.colors.get(&normalized) {
            return existing.clone();
        }

        self.color_counter += 1;
        let symbol = format!("$C{}", self.color_counter);
        self.colors.insert(normalized.clone(), symbol.clone());
        self.color_defs.insert(symbol.clone(), normalized);
        symbol
    }

    /// Registers a typography style and returns its symbol key (e.g. "$T1")
    pub fn register_typography(&mut self, style: &TextStyle) -> String {
        let sig = format!(
            "{}:{}:{}:{}",
            style.font_family,
            style.font_weight,
            style.font_size,
            style.line_height_px.unwrap_or(0.0)
        );

        if let Some(existing) = self.typography.get(&sig) {
            return existing.clone();
        }

        self.typography_counter += 1;
        let symbol = format!("$T{}", self.typography_counter);
        self.typography.insert(sig, symbol.clone());
        self.typography_defs.insert(symbol.clone(), style.clone());
        symbol
    }

    /// Registers an effect / shadow and returns its symbol key (e.g. "$S1")
    pub fn register_effect(&mut self, effect: &Effect) -> Option<String> {
        match effect {
            Effect::DropShadow { color, offset_x, offset_y, radius, spread, visible } if *visible => {
                let css = format!(
                    "{}px {}px {}px {}px {}",
                    offset_x, offset_y, radius, spread, color.to_css_rgba()
                );
                if let Some(existing) = self.shadows.get(&css) {
                    return Some(existing.clone());
                }

                self.shadow_counter += 1;
                let symbol = format!("$S{}", self.shadow_counter);
                self.shadows.insert(css.clone(), symbol.clone());
                self.shadow_defs.insert(symbol.clone(), css);
                Some(symbol)
            }
            _ => None,
        }
    }

    /// Registers a corner radius and returns its symbol key (e.g. "$R1")
    pub fn register_radius(&mut self, r: f32) -> String {
        let key = if r.fract().abs() < 0.001 {
            format!("{:.0}", r)
        } else {
            format!("{:.1}", r)
        };
        if let Some(existing) = self.radii.get(&key) {
            return existing.clone();
        }

        self.radius_counter += 1;
        let symbol = format!("$R{}", self.radius_counter);
        self.radii.insert(key, symbol.clone());
        self.radius_defs.insert(symbol.clone(), r);
        symbol
    }

    /// Recursively populates the symbol table from a canonical node tree
    pub fn extract_from_tree(&mut self, node: &CanonicalNode) {
        for fill in &node.fills {
            if let Paint::Solid { color, visible, .. } = fill {
                if *visible {
                    self.register_color(&color.to_hex());
                }
            }
        }

        for stroke in &node.strokes {
            if let Paint::Solid { color, visible, .. } = stroke {
                if *visible {
                    self.register_color(&color.to_hex());
                }
            }
        }

        if let Some(ref style) = node.style {
            self.register_typography(style);
        }

        for effect in &node.effects {
            self.register_effect(effect);
        }

        if let Some(radius) = node.corner_radius {
            if radius > 0.0 {
                self.register_radius(radius);
            }
        }

        for child in &node.children {
            self.extract_from_tree(child);
        }
    }
}
