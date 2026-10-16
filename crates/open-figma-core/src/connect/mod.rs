use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use crate::model::node::CanonicalNode;

/// Represents a single component mapping in Open Code Connect
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentMapping {
    /// Target Figma node ID, component name, or full Figma URL
    pub target: String,
    /// Codebase import path (e.g. "@/components/ui/button")
    pub import_path: String,
    /// Component name in code (e.g. "Button")
    pub component_name: String,
    /// Mapping of Figma property names to code prop names/transformations
    #[serde(default)]
    pub props_mapping: HashMap<String, String>,
    /// Optional custom JSX/code snippet template
    #[serde(default)]
    pub template: Option<String>,
}

/// Registry holding all Code Connect mappings discovered in the project
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CodeConnectRegistry {
    pub mappings: Vec<ComponentMapping>,
}

impl CodeConnectRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a mapping to the registry
    pub fn add(&mut self, mapping: ComponentMapping) {
        self.mappings.push(mapping);
    }

    /// Load mappings from a JSON file (e.g. code-connect.json or figma.config.json)
    pub fn load_from_file(path: impl AsRef<Path>) -> crate::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let val: serde_json::Value = serde_json::from_str(&content)?;

        // Support both { "mappings": [...] } and direct array [ ... ]
        if let Some(arr) = val.get("mappings").and_then(|m| m.as_array()) {
            let mappings: Vec<ComponentMapping> = serde_json::from_value(serde_json::Value::Array(arr.clone()))?;
            Ok(Self { mappings })
        } else if val.is_array() {
            let mappings: Vec<ComponentMapping> = serde_json::from_value(val)?;
            Ok(Self { mappings })
        } else {
            Ok(Self::default())
        }
    }

    /// Finds a matching Code Connect mapping for a given Figma node
    pub fn find_match(&self, node: &CanonicalNode) -> Option<&ComponentMapping> {
        for mapping in &self.mappings {
            if mapping.target == node.id || mapping.target.eq_ignore_ascii_case(&node.name) {
                return Some(mapping);
            }
            if let Some(ref comp_id) = node.component_id {
                if mapping.target == *comp_id {
                    return Some(mapping);
                }
            }
        }
        None
    }

    /// Generates connected code for a node if matched, substituting props
    pub fn generate_connected_code(&self, node: &CanonicalNode) -> Option<String> {
        let mapping = self.find_match(node)?;

        if let Some(ref template) = mapping.template {
            let mut code = template.clone();
            // Substitute props from node.component_properties or text
            if let Some(ref props) = node.component_properties {
                if let Some(obj) = props.as_object() {
                    for (k, v) in obj {
                        let prop_str = v.as_str().unwrap_or("");
                        let target_placeholder = format!("{{{{{}}}}}", k);
                        code = code.replace(&target_placeholder, prop_str);
                    }
                }
            }
            if let Some(ref text) = node.characters {
                code = code.replace("{{children}}", text);
                code = code.replace("{{label}}", text);
            }
            return Some(code);
        }

        // Default JSX generator from mapping
        let mut props_str = Vec::new();
        if let Some(ref props) = node.component_properties {
            if let Some(obj) = props.as_object() {
                for (figma_prop, val) in obj {
                    let code_prop = mapping.props_mapping.get(figma_prop).map(|s| s.as_str()).unwrap_or(figma_prop.as_str());
                    let val_str = val.as_str().unwrap_or("");
                    props_str.push(format!("{}=\"{}\"", code_prop, val_str));
                }
            }
        }

        let props_formatted = if props_str.is_empty() {
            String::new()
        } else {
            format!(" {}", props_str.join(" "))
        };

        let child_content = node.characters.as_deref().unwrap_or("");
        if child_content.is_empty() {
            Some(format!("<{}{} />", mapping.component_name, props_formatted))
        } else {
            Some(format!("<{}{}>{}</{}>", mapping.component_name, props_formatted, child_content, mapping.component_name))
        }
    }

    /// Generates a starter code-connect.json scaffolding from a node hierarchy
    pub fn scaffold_from_tree(node: &CanonicalNode) -> Self {
        let mut registry = Self::new();
        Self::collect_components(node, &mut registry);
        registry
    }

    fn collect_components(node: &CanonicalNode, registry: &mut Self) {
        if node.node_type == crate::model::node::NodeType::Component || node.node_type == crate::model::node::NodeType::Instance {
            let name = &node.name;
            let import_name = name.replace(' ', "");
            let mut props_mapping = HashMap::new();

            if let Some(ref props) = node.component_properties {
                if let Some(obj) = props.as_object() {
                    for k in obj.keys() {
                        let lower = k.to_lowercase();
                        props_mapping.insert(k.clone(), lower);
                    }
                }
            }

            registry.add(ComponentMapping {
                target: name.clone(),
                import_path: format!("@/components/ui/{}", name.to_lowercase().replace(' ', "-")),
                component_name: import_name,
                props_mapping,
                template: None,
            });
        }

        for child in &node.children {
            Self::collect_components(child, registry);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::node::NodeType;

    #[test]
    fn test_code_connect_mapping_match() {
        let mut registry = CodeConnectRegistry::new();
        let mut props = HashMap::new();
        props.insert("variant".to_string(), "intent".to_string());

        registry.add(ComponentMapping {
            target: "Button".to_string(),
            import_path: "@/components/ui/button".to_string(),
            component_name: "Button".to_string(),
            props_mapping: props,
            template: Some("<Button intent=\"{{variant}}\">{{children}}</Button>".to_string()),
        });

        let mut node = CanonicalNode::new("1:100", "Button", NodeType::Component);
        node.characters = Some("Submit Form".to_string());
        node.component_properties = Some(serde_json::json!({ "variant": "primary" }));

        let code = registry.generate_connected_code(&node);
        assert_eq!(code, Some("<Button intent=\"primary\">Submit Form</Button>".to_string()));
    }
}
