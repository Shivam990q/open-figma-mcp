use taffy::prelude::*;
use crate::model::node::{CanonicalNode, LayoutMode, PrimaryAxisAlignItems, CounterAxisAlignItems, BoundingBox};

/// Computes layout bounds using Taffy flexbox and grid engine
pub fn compute_layout(root: &mut CanonicalNode, available_width: f32, available_height: f32) -> anyhow::Result<()> {
    let mut taffy = TaffyTree::new();
    let root_node = build_taffy_tree(&mut taffy, root)?;

    taffy.compute_layout(
        root_node,
        Size {
            width: AvailableSpace::Definite(available_width),
            height: AvailableSpace::Definite(available_height),
        },
    )?;

    apply_taffy_layout(&taffy, root_node, root, 0.0, 0.0);
    Ok(())
}

fn build_taffy_tree(taffy: &mut TaffyTree<()>, node: &CanonicalNode) -> anyhow::Result<NodeId> {
    let mut child_ids = Vec::with_capacity(node.children.len());
    for child in &node.children {
        child_ids.push(build_taffy_tree(taffy, child)?);
    }

    let flex_direction = match node.layout_mode {
        LayoutMode::Horizontal => FlexDirection::Row,
        LayoutMode::Vertical => FlexDirection::Column,
        _ => FlexDirection::Row,
    };

    let justify_content = match node.primary_align {
        Some(PrimaryAxisAlignItems::Center) => Some(JustifyContent::Center),
        Some(PrimaryAxisAlignItems::Max) => Some(JustifyContent::FlexEnd),
        Some(PrimaryAxisAlignItems::SpaceBetween) => Some(JustifyContent::SpaceBetween),
        _ => Some(JustifyContent::FlexStart),
    };

    let align_items = match node.counter_align {
        Some(CounterAxisAlignItems::Center) => Some(AlignItems::Center),
        Some(CounterAxisAlignItems::Max) => Some(AlignItems::FlexEnd),
        Some(CounterAxisAlignItems::Baseline) => Some(AlignItems::Baseline),
        _ => Some(AlignItems::FlexStart),
    };

    let gap = node.item_spacing.unwrap_or(0.0);

    let style = Style {
        display: Display::Flex,
        flex_direction,
        justify_content,
        align_items,
        gap: Size {
            width: LengthPercentage::Length(gap),
            height: LengthPercentage::Length(gap),
        },
        size: Size {
            width: if node.bbox.width > 0.0 {
                Dimension::Length(node.bbox.width)
            } else {
                Dimension::Auto
            },
            height: if node.bbox.height > 0.0 {
                Dimension::Length(node.bbox.height)
            } else {
                Dimension::Auto
            },
        },
        ..Default::default()
    };

    let node_id = taffy.new_with_children(style, &child_ids)?;
    Ok(node_id)
}

fn apply_taffy_layout(
    taffy: &TaffyTree<()>,
    taffy_id: NodeId,
    node: &mut CanonicalNode,
    parent_x: f32,
    parent_y: f32,
) {
    if let Ok(layout) = taffy.layout(taffy_id) {
        let abs_x = parent_x + layout.location.x;
        let abs_y = parent_y + layout.location.y;

        node.bbox = BoundingBox {
            x: abs_x,
            y: abs_y,
            width: layout.size.width,
            height: layout.size.height,
        };

        if let Ok(child_nodes) = taffy.children(taffy_id) {
            for (idx, child_id) in child_nodes.iter().enumerate() {
                if let Some(child_canonical) = node.children.get_mut(idx) {
                    apply_taffy_layout(taffy, *child_id, child_canonical, abs_x, abs_y);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::node::NodeType;

    #[test]
    fn test_flex_row_layout() {
        let mut root = CanonicalNode::new("1", "Navbar", NodeType::Frame);
        root.layout_mode = LayoutMode::Horizontal;
        root.item_spacing = Some(16.0);

        let mut item1 = CanonicalNode::new("2", "Logo", NodeType::Rectangle);
        item1.bbox.width = 100.0;
        item1.bbox.height = 40.0;

        let mut item2 = CanonicalNode::new("3", "Links", NodeType::Rectangle);
        item2.bbox.width = 200.0;
        item2.bbox.height = 40.0;

        root.children.push(item1);
        root.children.push(item2);

        compute_layout(&mut root, 800.0, 60.0).expect("layout compute failed");

        assert_eq!(root.children[0].bbox.x, 0.0);
        // item 2 should be at 100 + 16 = 116.0
        assert_eq!(root.children[1].bbox.x, 116.0);
    }
}
