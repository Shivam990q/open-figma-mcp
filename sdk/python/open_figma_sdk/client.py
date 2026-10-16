"""OpenFigmaClient implementation using httpx"""

import os
from typing import Any, Dict, Optional
import httpx

class OpenFigmaClient:
    """Enterprise client for OpenFigma MCP server & design compiler."""

    def __init__(self, endpoint: str = "http://127.0.0.1:3845", api_key: Optional[str] = None):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key or os.getenv("FIGMA_API_KEY", "")
        self._request_id = 1

    def call_tool(self, name: str, arguments: Optional[Dict[str, Any]] = None) -> str:
        """Synchronous call to an MCP tool."""
        req_id = self._request_id
        self._request_id += 1

        payload = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments or {},
            },
        }

        headers = {
            "Content-Type": "application/json",
            "X-Figma-Token": self.api_key,
        }

        with httpx.Client(timeout=60.0) as client:
            resp = client.post(f"{self.endpoint}/mcp", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            if "error" in data:
                raise RuntimeError(f"MCP Error {data['error'].get('code')}: {data['error'].get('message')}")

            result = data.get("result", {})
            if result.get("isError"):
                content = result.get("content", [{}])[0].get("text", "Unknown tool error")
                raise RuntimeError(content)

            return result.get("content", [{}])[0].get("text", "")

    async def call_tool_async(self, name: str, arguments: Optional[Dict[str, Any]] = None) -> str:
        """Asynchronous call to an MCP tool."""
        req_id = self._request_id
        self._request_id += 1

        payload = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments or {},
            },
        }

        headers = {
            "Content-Type": "application/json",
            "X-Figma-Token": self.api_key,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{self.endpoint}/mcp", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            if "error" in data:
                raise RuntimeError(f"MCP Error {data['error'].get('code')}: {data['error'].get('message')}")

            result = data.get("result", {})
            if result.get("isError"):
                content = result.get("content", [{}])[0].get("text", "Unknown tool error")
                raise RuntimeError(content)

            return result.get("content", [{}])[0].get("text", "")

    def get_figma_data(self, url: str, format: str = "yaml", depth: Optional[int] = None) -> str:
        return self.call_tool("get_figma_data", {"url": url, "format": format, "depth": depth})

    def get_design_tokens(self, url: str, format: str = "tailwind-v4") -> str:
        return self.call_tool("get_design_tokens", {"url": url, "format": format})

    def generate_code(self, url: str, framework: str = "react-tailwind") -> str:
        return self.call_tool("generate_code", {"url": url, "framework": framework})

    def render_svg(self, url: str, data_uri: bool = False) -> str:
        return self.call_tool("render_svg", {"url": url, "data_uri": data_uri})

    def get_code_connect(self, url: str, scaffold: bool = False) -> str:
        return self.call_tool("get_code_connect", {"url": url, "scaffold": scaffold})

    def transpile_code(self, code: str) -> str:
        return self.call_tool("transpile_code_to_canvas", {"code": code})

    def audit(self, url: str) -> str:
        return self.call_tool("audit_accessibility_and_security", {"url": url})
