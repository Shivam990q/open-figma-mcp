use crate::model::node::CanonicalNode;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DlpLeakType {
    AwsAccessKey,
    GitHubToken,
    OpenAiKey,
    PrivateKey,
    JwtToken,
    GenericSecret,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DlpFinding {
    pub node_id: String,
    pub node_name: String,
    pub leak_type: DlpLeakType,
    pub masked_value: String,
    pub description: String,
}

/// Scans a `CanonicalNode` scenegraph tree for sensitive leaked credentials and secrets.
pub fn scan_dlp_leaks(node: &CanonicalNode) -> Vec<DlpFinding> {
    let mut findings = Vec::new();
    scan_node_dlp(node, &mut findings);
    findings
}

fn scan_node_dlp(node: &CanonicalNode, findings: &mut Vec<DlpFinding>) {
    if let Some(ref text) = node.characters {
        check_text_for_leaks(&node.id, &node.name, text, findings);
    }
    // Also check layer names
    check_text_for_leaks(&node.id, &node.name, &node.name, findings);

    for child in &node.children {
        scan_node_dlp(child, findings);
    }
}

fn check_text_for_leaks(node_id: &str, node_name: &str, text: &str, findings: &mut Vec<DlpFinding>) {
    // 1. AWS Access Key
    let aws_re = Regex::new(r"\b(AKIA[0-9A-Z]{16})\b").unwrap();
    for cap in aws_re.captures_iter(text) {
        let val = &cap[1];
        findings.push(DlpFinding {
            node_id: node_id.to_string(),
            node_name: node_name.to_string(),
            leak_type: DlpLeakType::AwsAccessKey,
            masked_value: mask_string(val),
            description: "Potential AWS Access Key ID exposed in design layer".to_string(),
        });
    }

    // 2. GitHub Token
    let gh_re = Regex::new(r"\b(ghp_[0-9a-zA-Z]{36})\b").unwrap();
    for cap in gh_re.captures_iter(text) {
        let val = &cap[1];
        findings.push(DlpFinding {
            node_id: node_id.to_string(),
            node_name: node_name.to_string(),
            leak_type: DlpLeakType::GitHubToken,
            masked_value: mask_string(val),
            description: "Potential GitHub Personal Access Token exposed".to_string(),
        });
    }

    // 3. OpenAI Secret Key
    let openai_re = Regex::new(r"\b(sk-[0-9a-zA-Z]{20,})\b").unwrap();
    for cap in openai_re.captures_iter(text) {
        let val = &cap[1];
        findings.push(DlpFinding {
            node_id: node_id.to_string(),
            node_name: node_name.to_string(),
            leak_type: DlpLeakType::OpenAiKey,
            masked_value: mask_string(val),
            description: "Potential OpenAI API Secret Key exposed".to_string(),
        });
    }

    // 4. Private Key Block
    if text.contains("-----BEGIN PRIVATE KEY-----")
        || text.contains("-----BEGIN RSA PRIVATE KEY-----")
        || text.contains("-----BEGIN OPENSSH PRIVATE KEY-----")
    {
        findings.push(DlpFinding {
            node_id: node_id.to_string(),
            node_name: node_name.to_string(),
            leak_type: DlpLeakType::PrivateKey,
            masked_value: "-----BEGIN PRIVATE KEY...[REDACTED]-----".to_string(),
            description: "Cryptographic Private Key block detected".to_string(),
        });
    }

    // 5. JWT Token
    let jwt_re = Regex::new(r"\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b").unwrap();
    for cap in jwt_re.captures_iter(text) {
        let val = &cap[1];
        findings.push(DlpFinding {
            node_id: node_id.to_string(),
            node_name: node_name.to_string(),
            leak_type: DlpLeakType::JwtToken,
            masked_value: mask_string(val),
            description: "JSON Web Token (JWT) credentials detected".to_string(),
        });
    }
}

/// Masks sensitive string leaving only first 4 and last 2 characters
pub fn mask_string(s: &str) -> String {
    if s.len() <= 6 {
        return "******".to_string();
    }
    let start = &s[0..4];
    let end = &s[s.len() - 2..];
    format!("{}...{}", start, end)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::node::NodeType;

    #[test]
    fn test_dlp_catches_aws_key() {
        let mut node = CanonicalNode::new("1:1", "ConfigLayer", NodeType::Text);
        node.characters = Some("Use access key AKIAIOSFODNN7EXAMPLE for staging".to_string());

        let findings = scan_dlp_leaks(&node);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].leak_type, DlpLeakType::AwsAccessKey);
        assert_eq!(findings[0].masked_value, "AKIA...LE");
    }

    #[test]
    fn test_dlp_catches_private_key() {
        let mut node = CanonicalNode::new("1:2", "Cert", NodeType::Text);
        node.characters = Some("-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...".to_string());

        let findings = scan_dlp_leaks(&node);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].leak_type, DlpLeakType::PrivateKey);
    }
}
