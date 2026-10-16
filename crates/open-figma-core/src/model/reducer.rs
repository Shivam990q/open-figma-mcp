use crate::model::node::{CanonicalNode, NodeType};
use crate::model::symbols::SymbolTable;

/// Configuration options for the scenegraph tree reducer
#[derive(Debug, Clone)]
pub struct ReducerOptions {
    /// Maximum depth to preserve (None = unlimited)
    pub max_depth: Option<usize>,
    /// Whether to prune invisible nodes (default: true)
    pub prune_invisible: bool,
    /// Whether to collapse single-child transparent groups (default: true)
    pub collapse_single_child_groups: bool,
    /// Whether to normalize vector nodes into compact representations (default: true)
    pub compact_vectors: bool,
}

impl Default for ReducerOptions {
    fn default() -> Self {
        Self {
            max_depth: None,
            prune_invisible: true,
            collapse_single_child_groups: true,
            compact_vectors: true,
        }
    }
}

/// Recursively reduces and simplifies a CanonicalNode tree
pub fn reduce_scenegraph(
    root: &CanonicalNode,
    symbols: &mut SymbolTable,
    options: &ReducerOptions,
) -> Option<CanonicalNode> {
    reduce_node_recursive(root, symbols, options, 0)
}

fn reduce_node_recursive(
    node: &CanonicalNode,
    symbols: &mut SymbolTable,
    options: &ReducerOptions,
    current_depth: usize,
) -> Option<CanonicalNode> {
    // 1. Filter out invisible nodes
    if options.prune_invisible && !node.visible {
        return None;
    }

    // 2. Check depth limits
    if let Some(max_depth) = options.max_depth {
        if current_depth > max_depth {
            return None;
        }
    }

    // 3. Clone and prune children first
    let mut reduced = node.clone();
    let mut reduced_children = Vec::with_capacity(node.children.len());

    for child in &node.children {
        if let Some(c) = reduce_node_recursive(child, symbols, options, current_depth + 1) {
            reduced_children.push(c);
        }
    }

    reduced.children = reduced_children;

    // 4. Collapse single-child transparent groups (only inner groups, never the root)
    if options.collapse_single_child_groups 
        && current_depth > 0
        && reduced.node_type == NodeType::Group
        && reduced.children.len() == 1
    {
        let child = &reduced.children[0];
        let has_own_visuals = !reduced.fills.is_empty() 
            || !reduced.strokes.is_empty() 
            || !reduced.effects.is_empty()
            || reduced.corner_radius.is_some()
            || reduced.padding.is_some();

        if !has_own_visuals && child.visible {
            // Adopt child directly
            return Some(child.clone());
        }
    }

    // 5. Populate symbol table references
    symbols.extract_from_tree(&reduced);

    Some(reduced)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::node::{NodeType, Paint, Color};

    #[test]
    fn test_prune_invisible_nodes() {
        let mut root = CanonicalNode::new("1", "Root Frame", NodeType::Frame);
        let mut visible_child = CanonicalNode::new("2", "Visible Child", NodeType::Rectangle);
        visible_child.visible = true;

        let mut invisible_child = CanonicalNode::new("3", "Hidden Layer", NodeType::Rectangle);
        invisible_child.visible = false;

        root.children.push(visible_child);
        root.children.push(invisible_child);

        let mut symbols = SymbolTable::new();
        let options = ReducerOptions::default();
        let reduced = reduce_scenegraph(&root, &mut symbols, &options).expect("reduced root");

        assert_eq!(reduced.children.len(), 1);
        assert_eq!(reduced.children[0].id, "2");
    }

    #[test]
    fn test_collapse_transparent_single_child_group() {
        let mut root = CanonicalNode::new("1", "Root Frame", NodeType::Frame);
        let mut transparent_group = CanonicalNode::new("2", "Wrapper Group", NodeType::Group);
        let leaf = CanonicalNode::new("3", "Target Button", NodeType::Rectangle);

        transparent_group.children.push(leaf);
        root.children.push(transparent_group);

        let mut symbols = SymbolTable::new();
        let options = ReducerOptions::default();
        let reduced = reduce_scenegraph(&root, &mut symbols, &options).expect("reduced root");

        // The transparent group should be collapsed, directly promoting "Target Button"
        assert_eq!(reduced.children.len(), 1);
        assert_eq!(reduced.children[0].id, "3");
    }

    #[test]
    fn test_symbol_extraction() {
        let mut root = CanonicalNode::new("1", "Root", NodeType::Frame);
        root.fills.push(Paint::Solid {
            color: Color::new(0.2, 0.4, 0.8, 1.0),
            opacity: 1.0,
            visible: true,
        });

        let mut symbols = SymbolTable::new();
        let options = ReducerOptions::default();
        reduce_scenegraph(&root, &mut symbols, &options);

        assert_eq!(symbols.colors.len(), 1);
        let hex = Color::new(0.2, 0.4, 0.8, 1.0).to_hex();
        assert!(symbols.colors.contains_key(&hex));
    }
}
