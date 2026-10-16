use serde::{Deserialize, Serialize};
use crate::model::symbols::SymbolTable;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TokenFormat {
    W3c,
    TailwindV3,
    TailwindV4,
    Css,
    Scss,
    StyleDictionary,
    Typescript,
    Flutter,
}

impl Default for TokenFormat {
    fn default() -> Self {
        TokenFormat::TailwindV4
    }
}

/// Exports a SymbolTable into the specified token format string
pub fn export_tokens(symbols: &SymbolTable, format: TokenFormat) -> String {
    match format {
        TokenFormat::Css => export_css_tokens(symbols),
        TokenFormat::Scss => export_scss_tokens(symbols),
        TokenFormat::TailwindV4 => export_tailwind_v4_tokens(symbols),
        TokenFormat::TailwindV3 => export_tailwind_v3_tokens(symbols),
        TokenFormat::W3c => export_w3c_tokens(symbols),
        TokenFormat::StyleDictionary => export_style_dictionary_tokens(symbols),
        TokenFormat::Typescript => export_typescript_tokens(symbols),
        TokenFormat::Flutter => export_flutter_tokens(symbols),
    }
}

fn export_css_tokens(symbols: &SymbolTable) -> String {
    let mut out = String::from(":root {\n  /* Colors */\n");
    for (hex, sym) in &symbols.colors {
        let name = sym.to_lowercase().replace('$', "");
        out.push_str(&format!("  --color-{}: {};\n", name, hex));
    }

    out.push_str("\n  /* Border Radii */\n");
    for (radius, sym) in &symbols.radii {
        let name = sym.to_lowercase().replace('$', "");
        out.push_str(&format!("  --radius-{}: {}px;\n", name, radius));
    }

    out.push_str("\n  /* Box Shadows */\n");
    for (shadow, sym) in &symbols.shadows {
        let name = sym.to_lowercase().replace('$', "");
        out.push_str(&format!("  --shadow-{}: {};\n", name, shadow));
    }

    out.push_str("}\n");
    out
}

fn export_scss_tokens(symbols: &SymbolTable) -> String {
    let mut out = String::from("// SCSS Design Tokens\n// Colors\n");
    for (hex, sym) in &symbols.colors {
        let name = sym.to_lowercase().replace('$', "");
        out.push_str(&format!("$color-{}: {};\n", name, hex));
    }

    out.push_str("\n// Radii\n");
    for (radius, sym) in &symbols.radii {
        let name = sym.to_lowercase().replace('$', "");
        out.push_str(&format!("$radius-{}: {}px;\n", name, radius));
    }
    out
}

fn export_tailwind_v4_tokens(symbols: &SymbolTable) -> String {
    let mut out = String::from("@theme {\n  /* Tailwind CSS v4 Theme Tokens */\n");
    for (hex, sym) in &symbols.colors {
        let name = sym.to_lowercase().replace('$', "");
        out.push_str(&format!("  --color-{}: {};\n", name, hex));
    }
    for (radius, sym) in &symbols.radii {
        let name = sym.to_lowercase().replace('$', "");
        out.push_str(&format!("  --radius-{}: {}px;\n", name, radius));
    }
    out.push_str("}\n");
    out
}

fn export_tailwind_v3_tokens(symbols: &SymbolTable) -> String {
    let mut colors_json = String::new();
    for (hex, sym) in &symbols.colors {
        let name = sym.to_lowercase().replace('$', "");
        colors_json.push_str(&format!("      '{}': '{}',\n", name, hex));
    }

    format!(
        "/** @type {{import('tailwindcss').Config}} */\nmodule.exports = {{\n  theme: {{\n    extend: {{\n      colors: {{\n{}\n      }},\n    }},\n  }},\n}};\n",
        colors_json
    )
}

fn export_w3c_tokens(symbols: &SymbolTable) -> String {
    let mut root = serde_json::json!({
        "color": {},
        "borderRadius": {},
        "boxShadow": {}
    });

    for (hex, sym) in &symbols.colors {
        let name = sym.to_lowercase().replace('$', "");
        root["color"][name] = serde_json::json!({
            "$value": hex,
            "$type": "color"
        });
    }

    for (radius, sym) in &symbols.radii {
        let name = sym.to_lowercase().replace('$', "");
        root["borderRadius"][name] = serde_json::json!({
            "$value": format!("{}px", radius),
            "$type": "dimension"
        });
    }

    serde_json::to_string_pretty(&root).unwrap_or_else(|_| "{}".to_string())
}

fn export_style_dictionary_tokens(symbols: &SymbolTable) -> String {
    export_w3c_tokens(symbols)
}

fn export_typescript_tokens(symbols: &SymbolTable) -> String {
    let mut out = String::from("export const designTokens = {\n  colors: {\n");
    for (hex, sym) in &symbols.colors {
        let name = sym.to_lowercase().replace('$', "");
        out.push_str(&format!("    '{}': '{}',\n", name, hex));
    }
    out.push_str("  },\n  radii: {\n");
    for (radius, sym) in &symbols.radii {
        let name = sym.to_lowercase().replace('$', "");
        out.push_str(&format!("    '{}': {} ,\n", name, radius));
    }
    out.push_str("  },\n} as const;\n");
    out
}

fn export_flutter_tokens(symbols: &SymbolTable) -> String {
    let mut out = String::from("import 'package:flutter/material.dart';\n\nclass AppColors {\n");
    for (hex, sym) in &symbols.colors {
        let name = sym.to_lowercase().replace('$', "");
        let clean_hex = hex.trim_start_matches('#');
        let dart_hex = if clean_hex.len() == 6 {
            format!("0xFF{}", clean_hex)
        } else {
            format!("0x{}", clean_hex)
        };
        out.push_str(&format!("  static const Color color{} = Color({});\n", name, dart_hex));
    }
    out.push_str("}\n");
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_formats() {
        let mut symbols = SymbolTable::new();
        symbols.register_color("#3B82F6");
        symbols.register_radius(8.0);

        let css = export_tokens(&symbols, TokenFormat::Css);
        assert!(css.contains("--color-c1: #3B82F6"));
        assert!(css.contains("--radius-r1: 8px"));

        let tw4 = export_tokens(&symbols, TokenFormat::TailwindV4);
        assert!(tw4.contains("@theme"));
        assert!(tw4.contains("--color-c1: #3B82F6"));

        let ts = export_tokens(&symbols, TokenFormat::Typescript);
        assert!(ts.contains("export const designTokens"));

        let flutter = export_tokens(&symbols, TokenFormat::Flutter);
        assert!(flutter.contains("class AppColors"));
    }
}
