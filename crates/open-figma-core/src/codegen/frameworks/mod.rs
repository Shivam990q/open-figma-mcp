use serde::{Deserialize, Serialize};
use crate::model::node::{CanonicalNode, LayoutMode};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Framework {
    ReactTailwind,
    ReactInline,
    Vue,
    Svelte,
    Angular,
    Solid,
    HtmlCss,
    Flutter,
    SwiftUi,
}

impl Default for Framework {
    fn default() -> Self {
        Framework::ReactTailwind
    }
}

/// Synthesizes production code for a given CanonicalNode and target Framework
pub fn generate_code(node: &CanonicalNode, framework: Framework) -> String {
    match framework {
        Framework::ReactTailwind => generate_react_tailwind(node),
        Framework::ReactInline => generate_react_inline(node),
        Framework::Vue => generate_vue(node),
        Framework::Svelte => generate_svelte(node),
        Framework::Angular => generate_angular(node),
        Framework::Solid => generate_solid(node),
        Framework::HtmlCss => generate_html_css(node),
        Framework::Flutter => generate_flutter(node),
        Framework::SwiftUi => generate_swiftui(node),
    }
}

fn sanitize_component_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .collect();

    let words: Vec<&str> = cleaned.split(|c| c == ' ' || c == '-' || c == '_').filter(|s| !s.is_empty()).collect();
    if words.is_empty() {
        return "Component".to_string();
    }

    words
        .into_iter()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect()
}

fn node_to_tailwind_classes(node: &CanonicalNode) -> String {
    let mut classes = Vec::new();

    // Layout
    match node.layout_mode {
        LayoutMode::Horizontal => {
            classes.push("flex");
            classes.push("flex-row");
        }
        LayoutMode::Vertical => {
            classes.push("flex");
            classes.push("flex-col");
        }
        LayoutMode::Grid => {
            classes.push("grid");
        }
        LayoutMode::None => {
            if !node.children.is_empty() {
                classes.push("relative");
            }
        }
    }

    // Gap / Spacing
    if let Some(spacing) = node.item_spacing {
        if spacing > 0.0 {
            classes.push(match spacing as u32 {
                2 => "gap-0.5",
                4 => "gap-1",
                8 => "gap-2",
                12 => "gap-3",
                16 => "gap-4",
                24 => "gap-6",
                32 => "gap-8",
                _ => "gap-[var(--spacing)]",
            });
        }
    }

    // Padding
    if let Some(ref pad) = node.padding {
        if pad.top == pad.bottom && pad.left == pad.right && pad.top == pad.left && pad.top > 0.0 {
            classes.push(match pad.top as u32 {
                4 => "p-1",
                8 => "p-2",
                12 => "p-3",
                16 => "p-4",
                24 => "p-6",
                32 => "p-8",
                _ => "p-[16px]",
            });
        } else {
            if pad.top > 0.0 { classes.push("pt-4"); }
            if pad.bottom > 0.0 { classes.push("pb-4"); }
            if pad.left > 0.0 { classes.push("pl-4"); }
            if pad.right > 0.0 { classes.push("pr-4"); }
        }
    }

    // Border radius
    if let Some(radius) = node.corner_radius {
        if radius > 0.0 {
            classes.push(match radius as u32 {
                4 => "rounded-sm",
                8 => "rounded-md",
                12 => "rounded-lg",
                16 => "rounded-xl",
                9999 => "rounded-full",
                _ => "rounded-md",
            });
        }
    }

    // Background color
    if let Some(hex) = node.primary_fill_hex() {
        if hex == "#FFFFFF" {
            classes.push("bg-white");
        } else if hex == "#000000" {
            classes.push("bg-black");
        } else {
            // Tailwind arbitrary color
            classes.push("bg-[var(--fill-color)]");
        }
    }

    classes.join(" ")
}

fn generate_react_tailwind(node: &CanonicalNode) -> String {
    let component_name = sanitize_component_name(&node.name);
    let classes = node_to_tailwind_classes(node);

    let inner_content = if let Some(ref text) = node.characters {
        format!("      <span>{}</span>\n", text)
    } else if !node.children.is_empty() {
        let mut children_str = String::new();
        for child in &node.children {
            let child_classes = node_to_tailwind_classes(child);
            if let Some(ref text) = child.characters {
                children_str.push_str(&format!("        <p className=\"text-sm\">{}</p>\n", text));
            } else {
                children_str.push_str(&format!("        <div className=\"{}\"></div>\n", child_classes));
            }
        }
        children_str
    } else {
        String::new()
    };

    format!(
        r#"import React from 'react';

export interface {name}Props {{
  className?: string;
  children?: React.ReactNode;
}}

export const {name}: React.FC<{name}Props> = ({{ className = '', children }}) => {{
  return (
    <div className="{classes} ${{className}}">
{inner}      {{children}}
    </div>
  );
}};

export default {name};
"#,
        name = component_name,
        classes = classes,
        inner = inner_content
    )
}

fn generate_react_inline(node: &CanonicalNode) -> String {
    let component_name = sanitize_component_name(&node.name);
    let bg = node.primary_fill_hex().unwrap_or_else(|| "transparent".to_string());
    let radius = node.corner_radius.unwrap_or(0.0);

    format!(
        r#"import React from 'react';

export const {name}: React.FC = () => {{
  const style: React.CSSProperties = {{
    backgroundColor: '{bg}',
    borderRadius: '{radius}px',
    display: 'flex',
    boxSizing: 'border-box',
  }};

  return (
    <div style={{style}}>
      <span>{text}</span>
    </div>
  );
}};

export default {name};
"#,
        name = component_name,
        bg = bg,
        radius = radius,
        text = node.characters.as_deref().unwrap_or(&node.name)
    )
}

fn generate_vue(node: &CanonicalNode) -> String {
    let component_name = sanitize_component_name(&node.name);
    let classes = node_to_tailwind_classes(node);

    format!(
        r#"<script setup lang="ts">
defineProps<{{
  customClass?: string;
}}>();
</script>

<template>
  <div :class="['{classes}', customClass]">
    <slot>{text}</slot>
  </div>
</template>
"#,
        classes = classes,
        text = node.characters.as_deref().unwrap_or(&component_name)
    )
}

fn generate_svelte(node: &CanonicalNode) -> String {
    let classes = node_to_tailwind_classes(node);

    format!(
        r#"<script lang="ts">
  let {{ class: customClass = '', children }} = $props();
</script>

<div class="{classes} {{customClass}}">
  {{#if children}}
    {{@render children()}}
  {{:else}}
    <span>{text}</span>
  {{/if}}
</div>
"#,
        classes = classes,
        text = node.characters.as_deref().unwrap_or(&node.name)
    )
}

fn generate_angular(node: &CanonicalNode) -> String {
    let component_name = sanitize_component_name(&node.name);
    let selector = component_name.to_lowercase();

    format!(
        r#"import {{ Component, input }} from '@angular/core';

@Component({{
  selector: 'app-{selector}',
  standalone: true,
  template: `
    <div class="{classes}">
      <ng-content>{text}</ng-content>
    </div>
  `,
}})
export class {name}Component {{
  customClass = input<string>('');
}}
"#,
        selector = selector,
        name = component_name,
        classes = node_to_tailwind_classes(node),
        text = node.characters.as_deref().unwrap_or(&node.name)
    )
}

fn generate_solid(node: &CanonicalNode) -> String {
    let component_name = sanitize_component_name(&node.name);

    format!(
        r#"import {{ Component, ParentProps }} from 'solid-js';

export const {name}: Component<ParentProps> = (props) => {{
  return (
    <div class="{classes}">
      {{props.children || '{text}'}}
    </div>
  );
}};

export default {name};
"#,
        name = component_name,
        classes = node_to_tailwind_classes(node),
        text = node.characters.as_deref().unwrap_or(&node.name)
    )
}

fn generate_html_css(node: &CanonicalNode) -> String {
    let classes = node_to_tailwind_classes(node);
    let text = node.characters.as_deref().unwrap_or(&node.name);

    format!(
        r#"<!-- Semantic HTML5 -->
<section class="{classes}">
  <div class="content-wrapper">
    <p>{text}</p>
  </div>
</section>
"#,
        classes = classes,
        text = text
    )
}

fn generate_flutter(node: &CanonicalNode) -> String {
    let component_name = sanitize_component_name(&node.name);
    let color_hex = node.primary_fill_hex().unwrap_or_else(|| "#FFFFFF".to_string());
    let clean_hex = color_hex.trim_start_matches('#');

    format!(
        r#"import 'package:flutter/material.dart';

class {name}Widget extends StatelessWidget {{
  const {name}Widget({{super.key}});

  @override
  Widget build(BuildContext context) {{
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF{hex}),
        borderRadius: BorderRadius.circular({radius}.0),
      ),
      child: const Center(
        child: Text('{text}'),
      ),
    );
  }}
}}
"#,
        name = component_name,
        hex = clean_hex,
        radius = node.corner_radius.unwrap_or(8.0) as u32,
        text = node.characters.as_deref().unwrap_or(&node.name)
    )
}

fn generate_swiftui(node: &CanonicalNode) -> String {
    let component_name = sanitize_component_name(&node.name);

    format!(
        r#"import SwiftUI

struct {name}View: View {{
    var body: some View {{
        ZStack {{
            RoundedRectangle(cornerRadius: {radius})
                .fill(Color.accentColor)
            Text("{text}")
                .font(.headline)
                .foregroundColor(.white)
        }}
        .frame(maxWidth: .infinity, maxHeight: 60)
    }}
}}
"#,
        name = component_name,
        radius = node.corner_radius.unwrap_or(8.0) as u32,
        text = node.characters.as_deref().unwrap_or(&node.name)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::node::{NodeType, Paint, Color};

    #[test]
    fn test_react_tailwind_codegen() {
        let mut node = CanonicalNode::new("1", "User Card", NodeType::Frame);
        node.layout_mode = LayoutMode::Horizontal;
        node.corner_radius = Some(8.0);
        node.fills.push(Paint::Solid {
            color: Color::new(1.0, 1.0, 1.0, 1.0),
            opacity: 1.0,
            visible: true,
        });

        let code = generate_code(&node, Framework::ReactTailwind);
        assert!(code.contains("export const UserCard: React.FC"));
        assert!(code.contains("flex flex-row"));
        assert!(code.contains("rounded-md"));
        assert!(code.contains("bg-white"));
    }

    #[test]
    fn test_vue_codegen() {
        let node = CanonicalNode::new("1", "Navbar Menu", NodeType::Frame);
        let code = generate_code(&node, Framework::Vue);
        assert!(code.contains("<script setup lang=\"ts\">"));
        assert!(code.contains("<template>"));
    }

    #[test]
    fn test_svelte_codegen() {
        let node = CanonicalNode::new("1", "ActionButton", NodeType::Frame);
        let code = generate_code(&node, Framework::Svelte);
        assert!(code.contains("$props()"));
    }

    #[test]
    fn test_flutter_codegen() {
        let node = CanonicalNode::new("1", "ProfileButton", NodeType::Frame);
        let code = generate_code(&node, Framework::Flutter);
        assert!(code.contains("class ProfileButtonWidget extends StatelessWidget"));
    }

    #[test]
    fn test_swiftui_codegen() {
        let node = CanonicalNode::new("1", "HeaderBanner", NodeType::Frame);
        let code = generate_code(&node, Framework::SwiftUi);
        assert!(code.contains("struct HeaderBannerView: View"));
    }
}
