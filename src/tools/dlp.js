/**
 * Data Loss Prevention (DLP) & Secret Leak Scanner in JavaScript
 */

export function scanDlpLeaks(node) {
  const findings = [];
  walkAndScan(node, findings);
  return findings;
}

function walkAndScan(node, findings) {
  if (node.characters) {
    checkText(node.id, node.name, node.characters, findings);
  }
  if (node.name) {
    checkText(node.id, node.name, node.name, findings);
  }

  if (node.children) {
    for (const child of node.children) {
      walkAndScan(child, findings);
    }
  }
}

function checkText(nodeId, nodeName, text, findings) {
  // AWS Access Key
  const awsMatch = text.match(/\b(AKIA[0-9A-Z]{16})\b/);
  if (awsMatch) {
    findings.push({
      nodeId,
      nodeName,
      leakType: 'AwsAccessKey',
      maskedValue: maskString(awsMatch[1]),
      description: 'Potential AWS Access Key ID exposed in design layer',
    });
  }

  // GitHub Token
  const ghMatch = text.match(/\b(ghp_[0-9a-zA-Z]{36})\b/);
  if (ghMatch) {
    findings.push({
      nodeId,
      nodeName,
      leakType: 'GitHubToken',
      maskedValue: maskString(ghMatch[1]),
      description: 'Potential GitHub Personal Access Token exposed',
    });
  }

  // OpenAI Secret
  const openaiMatch = text.match(/\b(sk-[0-9a-zA-Z]{20,})\b/);
  if (openaiMatch) {
    findings.push({
      nodeId,
      nodeName,
      leakType: 'OpenAiKey',
      maskedValue: maskString(openaiMatch[1]),
      description: 'Potential OpenAI API Secret Key exposed',
    });
  }

  // Private Key
  if (text.includes('-----BEGIN PRIVATE KEY-----') || text.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    findings.push({
      nodeId,
      nodeName,
      leakType: 'PrivateKey',
      maskedValue: '-----BEGIN PRIVATE KEY...[REDACTED]-----',
      description: 'Cryptographic Private Key block detected in design',
    });
  }
}

function maskString(s) {
  if (!s || s.length <= 6) return '******';
  return `${s.slice(0, 4)}...${s.slice(-2)}`;
}
