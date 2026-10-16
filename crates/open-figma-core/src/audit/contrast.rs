use serde::{Deserialize, Serialize};
use crate::model::node::Color;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ContrastAuditResult {
    pub foreground_hex: String,
    pub background_hex: String,
    pub wcag_ratio: f32,
    pub wcag_aa_pass: bool,
    pub wcag_aaa_pass: bool,
    pub apca_lc: f32,
    pub apca_rating: ApcaRating,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ApcaRating {
    /// |Lc| >= 75: Preferred for body text
    PreferredBody,
    /// |Lc| >= 60: Minimum for content text
    MinimumContent,
    /// |Lc| >= 45: Minimum for large titles & headlines
    LargeDisplayOnly,
    /// |Lc| < 45: Non-compliant / sub-fluent
    Fail,
}

/// Converts sRGB 0..1 to linear luminance channel
fn srgb_to_linear(channel: f32) -> f32 {
    let c = channel.clamp(0.0, 1.0);
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

/// Computes standard relative luminance per WCAG 2.1
pub fn relative_luminance(c: &Color) -> f32 {
    let r = srgb_to_linear(c.r);
    let g = srgb_to_linear(c.g);
    let b = srgb_to_linear(c.b);
    0.2126 * r + 0.7152 * g + 0.0722 * b
}

/// Computes standard WCAG 2.1/2.2 contrast ratio (1.0 to 21.0)
pub fn wcag_contrast(fg: &Color, bg: &Color) -> f32 {
    let l1 = relative_luminance(fg);
    let l2 = relative_luminance(bg);

    let lighter = l1.max(l2);
    let darker = l1.min(l2);

    (lighter + 0.05) / (darker + 0.05)
}

/// Computes APCA (Advanced Perceptual Contrast Algorithm) Lightness Contrast (Lc)
/// Returns a signed float typically between -108.0 and +106.0.
/// Positive values indicate dark text on light background; negative indicate light text on dark.
pub fn apca_contrast(fg: &Color, bg: &Color) -> f32 {
    // 1. Compute sRGB to Y (perceptual luminance)
    let y_fg = 0.2126729 * srgb_to_linear(fg.r) + 0.7151522 * srgb_to_linear(fg.g) + 0.0721750 * srgb_to_linear(fg.b);
    let y_bg = 0.2126729 * srgb_to_linear(bg.r) + 0.7151522 * srgb_to_linear(bg.g) + 0.0721750 * srgb_to_linear(bg.b);

    // 2. Soft clamp black levels to account for ambient screen flare
    let blk_thresh = 0.022;
    let blk_clamp = 1.414;

    let y_fg_clamped = if y_fg > blk_thresh {
        y_fg
    } else {
        y_fg + (blk_thresh - y_fg).powf(blk_clamp)
    };

    let y_bg_clamped = if y_bg > blk_thresh {
        y_bg
    } else {
        y_bg + (blk_thresh - y_bg).powf(blk_clamp)
    };

    // 3. APCA Contrast Formula based on polarity
    let lc = if y_bg_clamped >= y_fg_clamped {
        // Dark text on lighter background (normal polarity)
        let s_bg = y_bg_clamped.powf(0.56);
        let s_fg = y_fg_clamped.powf(0.62);
        (s_bg - s_fg) * 1.14
    } else {
        // Light text on darker background (reverse polarity)
        let s_bg = y_bg_clamped.powf(0.65);
        let s_fg = y_fg_clamped.powf(0.55);
        (s_bg - s_fg) * 1.14
    };

    // Scale to standard percentage scale
    let scaled = if lc.abs() < 0.1 {
        0.0
    } else if lc > 0.0 {
        (lc - 0.027) * 100.0
    } else {
        (lc + 0.027) * 100.0
    };

    (scaled * 100.0).round() / 100.0
}

pub fn rate_apca(lc: f32) -> ApcaRating {
    let abs_lc = lc.abs();
    if abs_lc >= 75.0 {
        ApcaRating::PreferredBody
    } else if abs_lc >= 60.0 {
        ApcaRating::MinimumContent
    } else if abs_lc >= 45.0 {
        ApcaRating::LargeDisplayOnly
    } else {
        ApcaRating::Fail
    }
}

pub fn audit_contrast(fg: &Color, bg: &Color) -> ContrastAuditResult {
    let wcag = (wcag_contrast(fg, bg) * 100.0).round() / 100.0;
    let apca = apca_contrast(fg, bg);
    let rating = rate_apca(apca);

    ContrastAuditResult {
        foreground_hex: fg.to_hex(),
        background_hex: bg.to_hex(),
        wcag_ratio: wcag,
        wcag_aa_pass: wcag >= 4.5,
        wcag_aaa_pass: wcag >= 7.0,
        apca_lc: apca,
        apca_rating: rating,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_black_on_white() {
        let black = Color::new(0.0, 0.0, 0.0, 1.0);
        let white = Color::new(1.0, 1.0, 1.0, 1.0);

        let audit = audit_contrast(&black, &white);
        assert!(audit.wcag_ratio >= 20.0);
        assert!(audit.wcag_aa_pass);
        assert!(audit.wcag_aaa_pass);
        assert!(audit.apca_lc >= 100.0);
        assert_eq!(audit.apca_rating, ApcaRating::PreferredBody);
    }

    #[test]
    fn test_white_on_dark_blue() {
        let white = Color::new(1.0, 1.0, 1.0, 1.0);
        let dark_blue = Color::new(0.05, 0.1, 0.3, 1.0);

        let audit = audit_contrast(&white, &dark_blue);
        assert!(audit.wcag_ratio >= 10.0);
        assert!(audit.wcag_aa_pass);
        // Reverse polarity APCA is negative
        assert!(audit.apca_lc <= -75.0);
        assert_eq!(audit.apca_rating, ApcaRating::PreferredBody);
    }
}
