//! # OpenFigma Core
//!
//! High-performance engine for parsing, simplifying, rendering, auditing, and generating
//! production-grade code from Figma designs (both via REST API and offline `.fig` Kiwi binaries).

pub mod audit;
pub mod cache;
pub mod canvas;
pub mod codegen;
pub mod connect;
pub mod kiwi;
pub mod layout;
pub mod model;
pub mod resilience;
pub mod rest;
pub mod vector;

pub use audit::contrast::{apca_contrast, audit_contrast, wcag_contrast, ContrastAuditResult};
pub use audit::dlp::{scan_dlp_leaks, DlpFinding, DlpLeakType};
pub use audit::security::{scan_prompt_injection, sanitize_text};
pub use cache::{MultiTierCache, CacheStats};
pub use canvas::transpiler::{transpile_code_to_nodes, CodeToCanvasResult};
pub use codegen::frameworks::Framework;
pub use codegen::tokens::{export_tokens, TokenFormat};
pub use connect::{CodeConnectRegistry, ComponentMapping};
pub use kiwi::fig_file::FigArchive;
pub use model::node::{CanonicalNode, NodeType, LayoutMode, Color, Paint, BoundingBox};
pub use model::reducer::{reduce_scenegraph, ReducerOptions};
pub use model::symbols::SymbolTable;
pub use resilience::{CircuitBreaker, CircuitState};
pub use rest::client::{parse_figma_url, FigmaRestClient};
pub use vector::svg::{render_svg, render_svg_data_uri};

/// Unified error type for open-figma-core
#[derive(thiserror::Error, Debug)]
pub enum CoreError {
    #[error("Kiwi format error: {0}")]
    Kiwi(String),

    #[error("ZIP archive error: {0}")]
    Zip(String),

    #[error("Decompression error: {0}")]
    Decompress(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("HTTP REST API error: {0}")]
    Http(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),

    #[error("Invalid URL or Node ID: {0}")]
    InvalidTarget(String),

    #[error("Layout computation error: {0}")]
    Layout(String),
}

pub type Result<T> = std::result::Result<T, CoreError>;
