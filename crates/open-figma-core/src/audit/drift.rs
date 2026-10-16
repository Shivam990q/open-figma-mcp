use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use crate::model::symbols::SymbolTable;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DriftReport {
    /// Colors in design but missing in code
    pub missing_in_code: Vec<String>,
    /// Rogue colors found in code not defined in design system
    pub rogue_in_code: Vec<String>,
    /// Design token match score 0.0 to 100.0
    pub token_parity_score: f32,
}

/// Evaluates design-to-code token drift by comparing Figma symbols with code tokens
pub fn evaluate_drift(figma_symbols: &SymbolTable, code_tokens: &[String]) -> DriftReport {
    let design_colors: HashSet<String> = figma_symbols.colors.keys().cloned().collect();
    let code_colors: HashSet<String> = code_tokens.iter().map(|c| c.to_uppercase()).collect();

    let missing_in_code: Vec<String> = design_colors
        .difference(&code_colors)
        .cloned()
        .collect();

    let rogue_in_code: Vec<String> = code_colors
        .difference(&design_colors)
        .cloned()
        .collect();

    let total = design_colors.len().max(1);
    let matched = design_colors.intersection(&code_colors).count();
    let parity = (matched as f32 / total as f32) * 100.0;

    DriftReport {
        missing_in_code,
        rogue_in_code,
        token_parity_score: (parity * 10.0).round() / 10.0,
    }
}
