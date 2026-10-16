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

    def create_frame(self, name: str, width: float = 400.0, height: float = 300.0, x: float = 0.0, y: float = 0.0, background_color: str = "#FFFFFF") -> str:
        return self.call_tool("canvas_create_frame", {
            "name": name,
            "width": width,
            "height": height,
            "x": x,
            "y": y,
            "background_color": background_color,
        })

    def create_text(self, text: str, font_size: float = 16.0, x: float = 0.0, y: float = 0.0, color: str = "#000000") -> str:
        return self.call_tool("canvas_create_text", {
            "text": text,
            "font_size": font_size,
            "x": x,
            "y": y,
            "color": color,
        })

    def create_rectangle(self, width: float = 100.0, height: float = 100.0, x: float = 0.0, y: float = 0.0, fill_color: str = "#3B82F6", corner_radius: float = 8.0) -> str:
        return self.call_tool("canvas_create_rectangle", {
            "width": width,
            "height": height,
            "x": x,
            "y": y,
            "fill_color": fill_color,
            "corner_radius": corner_radius,
        })

    def insert_code(self, code: str, x: float = 0.0, y: float = 0.0) -> str:
        return self.call_tool("canvas_insert_code", {"code": code, "x": x, "y": y})

