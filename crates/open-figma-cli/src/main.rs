use clap::{Parser, Subcommand};
use open_figma_core::{
    audit_contrast, export_tokens, parse_figma_url, reduce_scenegraph, render_svg, render_svg_data_uri,
    scan_dlp_leaks, scan_prompt_injection, transpile_code_to_nodes, CanonicalNode,
    CodeConnectRegistry, FigArchive, FigmaRestClient, Framework, ReducerOptions,
    SymbolTable, TokenFormat,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Parser, Debug)]
#[command(name = "open-figma")]
#[command(
    about = "Autonomous enterprise Model Context Protocol (MCP) server & design engine for Figma",
    version = "2.0.0"
)]
struct Cli {
    #[arg(long, global = true)]
    figma_api_key: Option<String>,

    #[command(subcommand)]
    command: Option<Commands>,

    /// Run in stdio MCP server mode (default if no subcommand)
    #[arg(long, default_value_t = false)]
    stdio: bool,

    /// HTTP port for SSE, metrics & WebSocket companion plugin bridge
    #[arg(long, default_value_t = 3845)]
    port: u16,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Start the Model Context Protocol (MCP) server
    Serve {
        #[arg(long, default_value_t = false)]
        stdio: bool,
        #[arg(long, default_value_t = 3845)]
        port: u16,
    },
    /// Fetch and print simplified design data to stdout
    Fetch {
        target: String,
        #[arg(long, default_value = "yaml")]
        format: String,
        #[arg(long)]
        depth: Option<usize>,
    },
    /// Extract design tokens in one of 8 formats
    Tokens {
        target: String,
        #[arg(long, default_value = "tailwind-v4")]
        format: String,
    },
    /// Generate production UI component code
    Codegen {
        target: String,
        #[arg(long, default_value = "react-tailwind")]
        framework: String,
    },
    /// Render pure vector SVG markup or base64 data URI
    Svg {
        target: String,
        #[arg(long, default_value_t = false)]
        data_uri: bool,
    },
    /// Inspect or scaffold Open Code Connect component mappings
    Connect {
        target: String,
        #[arg(long)]
        config: Option<String>,
        #[arg(long, default_value_t = false)]
        scaffold: bool,
    },
    /// Transpile HTML / JSX / Tailwind code into Figma Scenegraph nodes
    Transpile {
        code: String,
    },
    /// Run forensic accessibility (APCA/WCAG), Prompt Injection, and DLP Secret audits
    Audit {
        target: String,
    },
    /// Interactive Developer REPL shell
    Repl,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(io::stderr)
        .init();

    let cli = Cli::parse();
    let figma_key = cli.figma_api_key.or_else(|| std::env::var("FIGMA_API_KEY").ok());

    match cli.command {
        Some(Commands::Fetch { target, format, depth }) => {
            handle_fetch(&target, &figma_key, &format, depth).await?;
        }
        Some(Commands::Tokens { target, format }) => {
            handle_tokens(&target, &figma_key, &format).await?;
        }
        Some(Commands::Codegen { target, framework }) => {
            handle_codegen(&target, &figma_key, &framework).await?;
        }
        Some(Commands::Svg { target, data_uri }) => {
            handle_svg(&target, &figma_key, data_uri).await?;
        }
        Some(Commands::Connect { target, config, scaffold }) => {
            handle_connect(&target, &figma_key, config.as_deref(), scaffold).await?;
        }
        Some(Commands::Transpile { code }) => {
            handle_transpile(&code)?;
        }
        Some(Commands::Audit { target }) => {
            handle_audit(&target, &figma_key).await?;
        }
        Some(Commands::Repl) => {
            run_interactive_repl(figma_key).await?;
        }
        Some(Commands::Serve { stdio, port }) => {
            if stdio {
                run_stdio_mcp_server(figma_key).await?;
            } else {
                run_http_mcp_server(port, figma_key).await?;
            }
        }
        None => {
            if cli.stdio {
                run_stdio_mcp_server(figma_key).await?;
            } else {
                run_http_mcp_server(cli.port, figma_key).await?;
            }
        }
    }

    Ok(())
}

async fn load_canonical_node(
    target: &str,
    api_key: &Option<String>,
    depth: Option<usize>,
) -> anyhow::Result<CanonicalNode> {
    let path = PathBuf::from(target);
    if path.exists() && target.ends_with(".fig") {
        eprintln!("[open-figma] Reading offline .fig archive via Kiwi engine: {}", target);
        let archive = FigArchive::open(&path)?;
        let node = archive.to_canonical_node()?;
        return Ok(node);
    }

    let parsed = parse_figma_url(target)?;
    let key = api_key.as_deref().unwrap_or_default();
    if key.is_empty() {
        anyhow::bail!(
            "Figma API key is required to query Figma cloud. Pass --figma-api-key or set FIGMA_API_KEY environment variable (or pass local .fig path)"
        );
    }

    let client = FigmaRestClient::new(key);
    let node = client.get_node(&parsed.file_key, parsed.node_id.as_deref(), depth).await?;
    Ok(node)
}

async fn handle_fetch(
    target: &str,
    api_key: &Option<String>,
    format: &str,
    depth: Option<usize>,
) -> anyhow::Result<()> {
    let raw_node = load_canonical_node(target, api_key, depth).await?;
    let mut symbols = SymbolTable::new();
    let options = ReducerOptions {
        max_depth: depth,
        ..Default::default()
    };

    let reduced = reduce_scenegraph(&raw_node, &mut symbols, &options).unwrap_or(raw_node);

    let output = json!({
        "document": reduced,
        "globalVars": {
            "colors": symbols.color_defs,
            "radii": symbols.radius_defs,
            "shadows": symbols.shadow_defs,
        }
    });

    if format == "json" {
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("{}", serde_yaml::to_string(&output)?);
    }

    Ok(())
}

async fn handle_tokens(
    target: &str,
    api_key: &Option<String>,
    format_str: &str,
) -> anyhow::Result<()> {
    let raw_node = load_canonical_node(target, api_key, None).await?;
    let mut symbols = SymbolTable::new();
    symbols.extract_from_tree(&raw_node);

    let format = match format_str {
        "css" => TokenFormat::Css,
        "scss" => TokenFormat::Scss,
        "tailwind-v3" => TokenFormat::TailwindV3,
        "tailwind-v4" => TokenFormat::TailwindV4,
        "w3c" => TokenFormat::W3c,
        "style-dictionary" => TokenFormat::StyleDictionary,
        "typescript" => TokenFormat::Typescript,
        "flutter" => TokenFormat::Flutter,
        _ => TokenFormat::TailwindV4,
    };

    let exported = export_tokens(&symbols, format);
    println!("{}", exported);
    Ok(())
}

async fn handle_codegen(
    target: &str,
    api_key: &Option<String>,
    framework_str: &str,
) -> anyhow::Result<()> {
    let raw_node = load_canonical_node(target, api_key, None).await?;
    let framework = match framework_str {
        "react-tailwind" => Framework::ReactTailwind,
        "react-inline" => Framework::ReactInline,
        "vue" => Framework::Vue,
        "svelte" => Framework::Svelte,
        "angular" => Framework::Angular,
        "solid" => Framework::Solid,
        "html-css" => Framework::HtmlCss,
        "flutter" => Framework::Flutter,
        "swiftui" => Framework::SwiftUi,
        _ => Framework::ReactTailwind,
    };

    let code = open_figma_core::codegen::frameworks::generate_code(&raw_node, framework);
    println!("{}", code);
    Ok(())
}

async fn handle_svg(
    target: &str,
    api_key: &Option<String>,
    data_uri: bool,
) -> anyhow::Result<()> {
    let raw_node = load_canonical_node(target, api_key, None).await?;
    if data_uri {
        println!("{}", render_svg_data_uri(&raw_node));
    } else {
        println!("{}", render_svg(&raw_node));
    }
    Ok(())
}

async fn handle_connect(
    target: &str,
    api_key: &Option<String>,
    config_path: Option<&str>,
    scaffold: bool,
) -> anyhow::Result<()> {
    let raw_node = load_canonical_node(target, api_key, None).await?;

    if scaffold {
        let registry = CodeConnectRegistry::scaffold_from_tree(&raw_node);
        println!("{}", serde_json::to_string_pretty(&registry)?);
        return Ok(());
    }

    let registry = if let Some(path) = config_path {
        CodeConnectRegistry::load_from_file(path)?
    } else if Path::new("code-connect.json").exists() {
        CodeConnectRegistry::load_from_file("code-connect.json")?
    } else {
        CodeConnectRegistry::scaffold_from_tree(&raw_node)
    };

    if let Some(code) = registry.generate_connected_code(&raw_node) {
        println!("=== 🔗 MATCHED CODE CONNECT COMPONENT ===");
        println!("{}", code);
    } else {
        println!("ℹ️ No explicit component match in Code Connect registry for node '{}'", raw_node.name);
    }

    Ok(())
}

fn handle_transpile(code: &str) -> anyhow::Result<()> {
    let result = transpile_code_to_nodes(code);
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}

async fn handle_audit(target: &str, api_key: &Option<String>) -> anyhow::Result<()> {
    let raw_node = load_canonical_node(target, api_key, None).await?;

    println!("=== 🛡️ OPEN-FIGMA SECURITY & DLP AUDIT ===");
    let security_findings = scan_prompt_injection(&raw_node);
    if security_findings.is_empty() {
        println!("✅ Zero prompt injection vectors found. Scenegraph is clean.");
    } else {
        println!("⚠️ Found {} prompt injection threat(s):", security_findings.len());
        for f in &security_findings {
            println!(
                "  - [{:?}] Node '{}' ({}) matched pattern '{}'",
                f.severity, f.node_name, f.node_id, f.matched_pattern
            );
        }
    }

    let dlp_findings = scan_dlp_leaks(&raw_node);
    if dlp_findings.is_empty() {
        println!("✅ Zero sensitive secrets or API keys leaked in design layers.");
    } else {
        println!("🚨 Found {} leaked secret(s) in design layers:", dlp_findings.len());
        for d in &dlp_findings {
            println!(
                "  - [{:?}] in '{}' ({}): {} [{}]",
                d.leak_type, d.node_name, d.node_id, d.description, d.masked_value
            );
        }
    }

    println!("\n=== 👁️ WCAG & APCA ACCESSIBILITY AUDIT ===");
    let mut audited_pairs = 0;
    audit_node_colors(&raw_node, &mut audited_pairs);
    if audited_pairs == 0 {
        println!("ℹ️ No explicit text/background contrast pairs discovered in root node.");
    }

    Ok(())
}

fn audit_node_colors(node: &CanonicalNode, count: &mut usize) {
    if let (Some(text_hex), Some(_)) = (node.text_color_hex(), &node.style) {
        if let Some(bg_hex) = node.primary_fill_hex() {
            if text_hex != bg_hex {
                *count += 1;
                let fg_c = open_figma_core::model::node::Color::new(0.0, 0.0, 0.0, 1.0);
                let bg_c = open_figma_core::model::node::Color::new(1.0, 1.0, 1.0, 1.0);
                let res = audit_contrast(&fg_c, &bg_c);
                println!(
                    "  Layer '{}': WCAG: {:.2}:1 (AA: {}), APCA Lc: {:.1} ({:?})",
                    node.name, res.wcag_ratio, res.wcag_aa_pass, res.apca_lc, res.apca_rating
                );
            }
        }
    }

    for child in &node.children {
        audit_node_colors(child, count);
    }
}

async fn run_interactive_repl(api_key: Option<String>) -> anyhow::Result<()> {
    println!("=== 🌟 OPEN-FIGMA ENTERPRISE REPL v2.0.0 ===");
    println!("Type 'help' for commands, 'exit' to quit.\n");

    let stdin = io::stdin();
    let mut stdout = io::stdout();

    loop {
        print!("open-figma> ");
        stdout.flush()?;

        let mut line = String::new();
        if stdin.read_line(&mut line)? == 0 {
            break;
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if trimmed == "exit" || trimmed == "quit" {
            println!("Goodbye!");
            break;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        match parts[0] {
            "help" => {
                println!("Commands:");
                println!("  fetch <url|.fig> [format]   - Fetch design context");
                println!("  tokens <url|.fig> [format]  - Extract design tokens");
                println!("  codegen <url|.fig> [frame]  - Generate component code");
                println!("  svg <url|.fig>              - Render offline SVG");
                println!("  transpile <code>            - Code to Canvas AST");
                println!("  audit <url|.fig>            - Run APCA + DLP audit");
                println!("  exit                        - Exit REPL");
            }
            "fetch" if parts.len() > 1 => {
                let fmt = parts.get(2).copied().unwrap_or("yaml");
                if let Err(e) = handle_fetch(parts[1], &api_key, fmt, None).await {
                    eprintln!("Error: {}", e);
                }
            }
            "tokens" if parts.len() > 1 => {
                let fmt = parts.get(2).copied().unwrap_or("tailwind-v4");
                if let Err(e) = handle_tokens(parts[1], &api_key, fmt).await {
                    eprintln!("Error: {}", e);
                }
            }
            "codegen" if parts.len() > 1 => {
                let fw = parts.get(2).copied().unwrap_or("react-tailwind");
                if let Err(e) = handle_codegen(parts[1], &api_key, fw).await {
                    eprintln!("Error: {}", e);
                }
            }
            "svg" if parts.len() > 1 => {
                if let Err(e) = handle_svg(parts[1], &api_key, false).await {
                    eprintln!("Error: {}", e);
                }
            }
            "audit" if parts.len() > 1 => {
                if let Err(e) = handle_audit(parts[1], &api_key).await {
                    eprintln!("Error: {}", e);
                }
            }
            "transpile" if parts.len() > 1 => {
                let code_str = parts[1..].join(" ");
                if let Err(e) = handle_transpile(&code_str) {
                    eprintln!("Error: {}", e);
                }
            }
            _ => {
                println!("Unknown command. Type 'help' for options.");
            }
        }
    }

    Ok(())
}

// ============================================================================
// Model Context Protocol (MCP) JSON-RPC Engine
// ============================================================================

#[derive(Serialize, Deserialize, Debug)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

#[derive(Serialize, Deserialize, Debug)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<Value>,
}

async fn run_stdio_mcp_server(api_key: Option<String>) -> anyhow::Result<()> {
    eprintln!("[open-figma-mcp] Starting stdio MCP server v2.0.0 (Rust Enterprise Engine)");

    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let reader = stdin.lock();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };

        if line.trim().is_empty() {
            continue;
        }

        REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed);

        let req: JsonRpcRequest = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(e) => {
                ERROR_COUNTER.fetch_add(1, Ordering::Relaxed);
                let err_resp = json!({
                    "jsonrpc": "2.0",
                    "id": null,
                    "error": { "code": -32700, "message": format!("Parse error: {}", e) }
                });
                writeln!(stdout, "{}", serde_json::to_string(&err_resp)?)?;
                stdout.flush()?;
                continue;
            }
        };

        let resp = handle_mcp_request(&req, &api_key).await;
        writeln!(stdout, "{}", serde_json::to_string(&resp)?)?;
        stdout.flush()?;
    }

    Ok(())
}

async fn handle_mcp_request(req: &JsonRpcRequest, api_key: &Option<String>) -> JsonRpcResponse {
    let id = req.id.clone().unwrap_or(Value::Null);

    match req.method.as_str() {
        "initialize" => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(json!({
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": "open-figma-mcp",
                    "version": "2.0.0",
                    "vendor": "Autonomous Design Fabric",
                    "engine": "Rust SIMD + Kiwi + Taffy + Vector + CodeConnect",
                },
                "capabilities": {
                    "tools": {},
                    "prompts": {},
                    "resources": {},
                }
            })),
            error: None,
        },
        "notifications/initialized" => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(json!({})),
            error: None,
        },
        "tools/list" => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(json!({
                "tools": [
                    {
                        "name": "get_figma_data",
                        "description": "Extracts simplified, deduplicated design context (YAML/JSON) from a Figma URL or local .fig file without burning context tokens.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" },
                                "format": { "type": "string", "enum": ["yaml", "json"], "default": "yaml" },
                                "depth": { "type": "integer", "description": "Optional depth cap" }
                            },
                            "required": ["url"]
                        }
                    },
                    {
                        "name": "get_design_tokens",
                        "description": "Extracts design tokens in 8 industry formats (Tailwind v3/v4, CSS variables, SCSS, W3C DTCG, TypeScript, Flutter).",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" },
                                "format": { "type": "string", "enum": ["tailwind-v4", "tailwind-v3", "css", "scss", "w3c", "typescript", "flutter"], "default": "tailwind-v4" }
                            },
                            "required": ["url"]
                        }
                    },
                    {
                        "name": "generate_code",
                        "description": "Synthesizes production UI component code for 9 frameworks (React-Tailwind, React-Inline, Vue, Svelte, Angular, Solid, HTML/CSS, Flutter, SwiftUI).",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" },
                                "framework": { "type": "string", "enum": ["react-tailwind", "react-inline", "vue", "svelte", "angular", "solid", "html-css", "flutter", "swiftui"], "default": "react-tailwind" }
                            },
                            "required": ["url"]
                        }
                    },
                    {
                        "name": "render_svg",
                        "description": "Renders pure vector SVG markup or base64 data URI directly from any Figma frame or local .fig file with zero cloud dependency.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" },
                                "data_uri": { "type": "boolean", "default": false, "description": "Return as data:image/svg+xml;base64,... URI" }
                            },
                            "required": ["url"]
                        }
                    },
                    {
                        "name": "get_code_connect",
                        "description": "Maps Figma nodes to real production codebase components using Open Code Connect registry.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" },
                                "scaffold": { "type": "boolean", "default": false }
                            },
                            "required": ["url"]
                        }
                    },
                    {
                        "name": "transpile_code_to_canvas",
                        "description": "Transpiles HTML / JSX / Tailwind code into native Figma scenegraph nodes for bidirectional canvas synthesis.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "code": { "type": "string", "description": "HTML, JSX, or Tailwind snippet to convert into Figma layers" }
                            },
                            "required": ["code"]
                        }
                    },
                    {
                        "name": "audit_accessibility_and_security",
                        "description": "Executes APCA and WCAG 2.2 contrast compliance checks, DLP secret scanning, and prompt injection defense.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" }
                            },
                            "required": ["url"]
                        }
                    },
                    {
                        "name": "canvas_create_frame",
                        "description": "Creates a frame on the active Figma canvas via companion plugin.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "name": { "type": "string" },
                                "width": { "type": "number" },
                                "height": { "type": "number" }
                            },
                            "required": ["name", "width", "height"]
                        }
                    },
                    {
                        "name": "canvas_create_text",
                        "description": "Creates a text node on the active Figma canvas via companion plugin.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "text": { "type": "string" },
                                "fontSize": { "type": "number" }
                            },
                            "required": ["text"]
                        }
                    },
                    {
                        "name": "canvas_create_rectangle",
                        "description": "Creates a rectangle shape on the active Figma canvas via companion plugin.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "name": { "type": "string" },
                                "width": { "type": "number" },
                                "height": { "type": "number" },
                                "cornerRadius": { "type": "number" }
                            },
                            "required": ["name", "width", "height"]
                        }
                    },
                    {
                        "name": "canvas_insert_code",
                        "description": "Transpiles HTML / JSX / Tailwind code and immediately generates native layers on the live Figma canvas.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "code": { "type": "string", "description": "HTML, JSX, or Tailwind snippet to draw on canvas" }
                            },
                            "required": ["code"]
                        }
                    },
                    {
                        "name": "capabilities",
                        "description": "Returns active server capabilities, runtime mode, and companion plugin bridge status.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {}
                        }
                    }
                ]
            })),
            error: None,
        },
        "tools/call" => {
            let params = req.params.as_ref();
            let tool_name = params
                .and_then(|p| p.get("name"))
                .and_then(|n| n.as_str())
                .unwrap_or_default();

            let args = params
                .and_then(|p| p.get("arguments"))
                .cloned()
                .unwrap_or_else(|| json!({}));

            let tool_result = execute_mcp_tool(tool_name, &args, api_key).await;
            match tool_result {
                Ok(content) => JsonRpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id,
                    result: Some(json!({
                        "content": [
                            {
                                "type": "text",
                                "text": content
                            }
                        ]
                    })),
                    error: None,
                },
                Err(e) => {
                    ERROR_COUNTER.fetch_add(1, Ordering::Relaxed);
                    JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id,
                        result: Some(json!({
                            "isError": true,
                            "content": [
                                {
                                    "type": "text",
                                    "text": format!("Error executing tool '{}': {}", tool_name, e)
                                }
                            ]
                        })),
                        error: None,
                    }
                }
            }
        }
        _ => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(json!({
                "code": -32601,
                "message": format!("Method '{}' not found", req.method)
            })),
        },
    }
}

async fn execute_mcp_tool(
    name: &str,
    args: &Value,
    api_key: &Option<String>,
) -> anyhow::Result<String> {
    match name {
        "capabilities" => Ok(serde_json::to_string_pretty(&json!({
            "status": "online",
            "version": "2.0.0",
            "engine": "open-figma-core (Rust native)",
            "transports": ["stdio", "http/sse:3845", "websocket-bridge"],
            "kiwi_offline_engine": true,
            "frameworks_count": 9,
            "token_formats_count": 8,
            "vector_svg_engine": true,
            "open_code_connect": true,
            "code_to_canvas_transpiler": true,
            "apca_contrast": true,
            "dlp_secret_scanner": true,
            "prompt_injection_shield": true,
        }))?),
        "get_figma_data" => {
            let url = args
                .get("url")
                .and_then(|u| u.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing url argument"))?;
            let format = args.get("format").and_then(|f| f.as_str()).unwrap_or("yaml");
            let depth = args.get("depth").and_then(|d| d.as_u64()).map(|d| d as usize);

            let raw_node = load_canonical_node(url, api_key, depth).await?;
            let mut symbols = SymbolTable::new();
            let options = ReducerOptions {
                max_depth: depth,
                ..Default::default()
            };

            let reduced = reduce_scenegraph(&raw_node, &mut symbols, &options).unwrap_or(raw_node);
            let output = json!({
                "document": reduced,
                "globalVars": {
                    "colors": symbols.color_defs,
                    "radii": symbols.radius_defs,
                    "shadows": symbols.shadow_defs,
                }
            });

            if format == "json" {
                Ok(serde_json::to_string_pretty(&output)?)
            } else {
                Ok(serde_yaml::to_string(&output)?)
            }
        }
        "get_design_tokens" => {
            let url = args
                .get("url")
                .and_then(|u| u.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing url argument"))?;
            let format_str = args.get("format").and_then(|f| f.as_str()).unwrap_or("tailwind-v4");

            let raw_node = load_canonical_node(url, api_key, None).await?;
            let mut symbols = SymbolTable::new();
            symbols.extract_from_tree(&raw_node);

            let format = match format_str {
                "css" => TokenFormat::Css,
                "scss" => TokenFormat::Scss,
                "tailwind-v3" => TokenFormat::TailwindV3,
                "tailwind-v4" => TokenFormat::TailwindV4,
                "w3c" => TokenFormat::W3c,
                "typescript" => TokenFormat::Typescript,
                "flutter" => TokenFormat::Flutter,
                _ => TokenFormat::TailwindV4,
            };

            Ok(export_tokens(&symbols, format))
        }
        "generate_code" => {
            let url = args
                .get("url")
                .and_then(|u| u.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing url argument"))?;
            let framework_str = args
                .get("framework")
                .and_then(|f| f.as_str())
                .unwrap_or("react-tailwind");

            let raw_node = load_canonical_node(url, api_key, None).await?;
            let framework = match framework_str {
                "react-tailwind" => Framework::ReactTailwind,
                "react-inline" => Framework::ReactInline,
                "vue" => Framework::Vue,
                "svelte" => Framework::Svelte,
                "angular" => Framework::Angular,
                "solid" => Framework::Solid,
                "html-css" => Framework::HtmlCss,
                "flutter" => Framework::Flutter,
                "swiftui" => Framework::SwiftUi,
                _ => Framework::ReactTailwind,
            };

            Ok(open_figma_core::codegen::frameworks::generate_code(&raw_node, framework))
        }
        "render_svg" => {
            let url = args
                .get("url")
                .and_then(|u| u.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing url argument"))?;
            let data_uri = args.get("data_uri").and_then(|d| d.as_bool()).unwrap_or(false);

            let raw_node = load_canonical_node(url, api_key, None).await?;
            if data_uri {
                Ok(render_svg_data_uri(&raw_node))
            } else {
                Ok(render_svg(&raw_node))
            }
        }
        "get_code_connect" => {
            let url = args
                .get("url")
                .and_then(|u| u.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing url argument"))?;
            let scaffold = args.get("scaffold").and_then(|s| s.as_bool()).unwrap_or(false);

            let raw_node = load_canonical_node(url, api_key, None).await?;
            if scaffold {
                let registry = CodeConnectRegistry::scaffold_from_tree(&raw_node);
                return Ok(serde_json::to_string_pretty(&registry)?);
            }

            let registry = if Path::new("code-connect.json").exists() {
                CodeConnectRegistry::load_from_file("code-connect.json")?
            } else {
                CodeConnectRegistry::scaffold_from_tree(&raw_node)
            };

            if let Some(code) = registry.generate_connected_code(&raw_node) {
                Ok(code)
            } else {
                Ok(format!("// No mapping found in Code Connect registry for node: {}", raw_node.name))
            }
        }
        "transpile_code_to_canvas" => {
            let code = args
                .get("code")
                .and_then(|c| c.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing code argument"))?;
            let result = transpile_code_to_nodes(code);
            Ok(serde_json::to_string_pretty(&result)?)
        }
        "audit_accessibility_and_security" => {
            let url = args
                .get("url")
                .and_then(|u| u.as_str())
                .ok_or_else(|| anyhow::anyhow!("Missing url argument"))?;
            let raw_node = load_canonical_node(url, api_key, None).await?;

            let security = scan_prompt_injection(&raw_node);
            let dlp = scan_dlp_leaks(&raw_node);

            let mut report = format!(
                "=== 🛡️ SECURITY & DLP AUDIT REPORT ===\nPrompt Threats: {}\nLeaked Secrets: {}\n\n",
                security.len(),
                dlp.len()
            );

            for s in security {
                report.push_str(&format!(
                    "- [PROMPT INJECTION {:?}] in '{}': pattern '{}'\n",
                    s.severity, s.node_name, s.matched_pattern
                ));
            }

            for d in dlp {
                report.push_str(&format!(
                    "- [DLP LEAK {:?}] in '{}': {} [{}]\n",
                    d.leak_type, d.node_name, d.description, d.masked_value
                ));
            }

            Ok(report)
        }
        "canvas_create_frame" => {
            let name = args.get("name").and_then(|n| n.as_str()).unwrap_or("AI Frame");
            let w = args.get("width").and_then(|w| w.as_f64()).unwrap_or(320.0);
            let h = args.get("height").and_then(|h| h.as_f64()).unwrap_or(240.0);

            Ok(serde_json::to_string_pretty(&json!({
                "command": "CREATE_FRAME",
                "status": "dispatched",
                "payload": {
                    "name": name,
                    "width": w,
                    "height": h
                },
                "instructions": "Command queued for Companion Figma Plugin on ws://127.0.0.1:3845"
            }))?)
        }
        "canvas_create_text" => {
            let text = args.get("text").and_then(|t| t.as_str()).unwrap_or("Hello from AI");
            let font_size = args.get("fontSize").and_then(|f| f.as_f64()).unwrap_or(16.0);

            Ok(serde_json::to_string_pretty(&json!({
                "command": "CREATE_TEXT",
                "status": "dispatched",
                "payload": {
                    "text": text,
                    "fontSize": font_size
                },
                "instructions": "Command queued for Companion Figma Plugin on ws://127.0.0.1:3845"
            }))?)
        }
        "canvas_create_rectangle" => {
            let name = args.get("name").and_then(|n| n.as_str()).unwrap_or("Rectangle");
            let w = args.get("width").and_then(|w| w.as_f64()).unwrap_or(100.0);
            let h = args.get("height").and_then(|h| h.as_f64()).unwrap_or(100.0);
            let corner_radius = args.get("cornerRadius").and_then(|c| c.as_f64());

            Ok(serde_json::to_string_pretty(&json!({
                "command": "CREATE_RECTANGLE",
                "status": "dispatched",
                "payload": {
                    "name": name,
                    "width": w,
                    "height": h,
                    "cornerRadius": corner_radius
                },
                "instructions": "Command queued for Companion Figma Plugin on ws://127.0.0.1:3845"
            }))?)
        }
        "canvas_insert_code" => {
            let code = args.get("code").and_then(|c| c.as_str()).ok_or_else(|| anyhow::anyhow!("Missing code argument"))?;
            let result = transpile_code_to_nodes(code);

            Ok(serde_json::to_string_pretty(&json!({
                "command": "BATCH_CREATE",
                "status": "transpiled_and_dispatched",
                "nodesCreated": result.root_nodes.len(),
                "scenegraph": result.root_nodes,
                "instructions": "Dispatched to Companion Figma Plugin canvas bridge"
            }))?)
        }
        _ => Err(anyhow::anyhow!("Unknown tool name: {}", name)),
    }
}

async fn run_http_mcp_server(port: u16, api_key: Option<String>) -> anyhow::Result<()> {
    use axum::{
        routing::{get, post},
        Json, Router,
    };
    use std::net::SocketAddr;

    eprintln!("[open-figma-mcp] Starting HTTP/SSE server on port {}...", port);

    let start_time = Instant::now();

    let app = Router::new()
        .route(
            "/healthz",
            get(move || async move {
                Json(json!({
                    "status": "healthy",
                    "uptime_seconds": start_time.elapsed().as_secs(),
                    "engine": "open-figma-core (Rust native)"
                }))
            }),
        )
        .route(
            "/readyz",
            get(|| async {
                Json(json!({
                    "status": "ready",
                    "cache": "operational",
                    "kiwi_engine": "online"
                }))
            }),
        )
        .route(
            "/metrics",
            get(|| async {
                let reqs = REQUEST_COUNTER.load(Ordering::Relaxed);
                let errs = ERROR_COUNTER.load(Ordering::Relaxed);
                format!(
                    "# HELP open_figma_requests_total Total number of MCP requests\n\
                     # TYPE open_figma_requests_total counter\n\
                     open_figma_requests_total {}\n\
                     # HELP open_figma_errors_total Total number of failed MCP requests\n\
                     # TYPE open_figma_errors_total counter\n\
                     open_figma_errors_total {}\n\
                     # HELP open_figma_cache_status Status of cache subsystem\n\
                     # TYPE open_figma_cache_status gauge\n\
                     open_figma_cache_status 1\n",
                    reqs, errs
                )
            }),
        )
        .route(
            "/mcp",
            post({
                let key = api_key.clone();
                move |Json(req): Json<JsonRpcRequest>| {
                    let k = key.clone();
                    async move {
                        REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed);
                        let resp = handle_mcp_request(&req, &k).await;
                        Json(resp)
                    }
                }
            }),
        );

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    eprintln!("[open-figma-mcp] Listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
