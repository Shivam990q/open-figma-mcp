use std::process::Command;
use std::path::PathBuf;

fn get_open_figma_bin() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let workspace_root = manifest_dir.parent().unwrap().parent().unwrap();
    let is_windows = cfg!(target_os = "windows");
    let bin_name = if is_windows { "open-figma.exe" } else { "open-figma" };

    let release_bin = workspace_root.join("target").join("release").join(bin_name);
    if release_bin.exists() {
        return release_bin;
    }

    let debug_bin = workspace_root.join("target").join("debug").join(bin_name);
    if debug_bin.exists() {
        return debug_bin;
    }

    panic!("open-figma binary not found in release or debug target dirs");
}

#[test]
fn test_cli_version_flag() {
    let bin = get_open_figma_bin();
    let mut cmd = Command::new(bin);
    let output = cmd.arg("--version").output().expect("failed to execute open-figma");
    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("2.0.0"));
}

#[test]
fn test_cli_help_flag() {
    let bin = get_open_figma_bin();
    let mut cmd = Command::new(bin);
    let output = cmd.arg("--help").output().expect("failed to execute open-figma");
    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Autonomous enterprise Model Context Protocol"));
}
