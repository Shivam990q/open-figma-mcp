"""LangChain Tool Integration for OpenFigma"""

from typing import Optional
from .client import OpenFigmaClient

class OpenFigmaLangChainTool:
    """Provides LangChain structured tool interface for AI agents."""

    def __init__(self, client: Optional[OpenFigmaClient] = None):
        self.client = client or OpenFigmaClient()

    def get_figma_context(self, url: str) -> str:
        """Fetches compressed, deduplicated design context without blowing context tokens."""
        return self.client.get_figma_data(url, format="yaml")

    def extract_design_tokens(self, url: str, format: str = "tailwind-v4") -> str:
        """Extracts design tokens in Tailwind v4 CSS, CSS variables, or W3C format."""
        return self.client.get_design_tokens(url, format=format)

    def generate_ui_code(self, url: str, framework: str = "react-tailwind") -> str:
        """Generates production-grade UI component code from a Figma URL."""
        return self.client.generate_code(url, framework=framework)

    def render_svg_vector(self, url: str) -> str:
        """Renders offline SVG vector markup directly from any Figma frame or node."""
        return self.client.render_svg(url, data_uri=False)

    def audit_security_and_a11y(self, url: str) -> str:
        """Runs APCA contrast checks, DLP secret leak scans, and prompt injection defense."""
        return self.client.audit(url)

    def transpile_html_to_canvas(self, code: str) -> str:
        """Transpiles HTML/JSX/Tailwind code to Figma scene graph nodes."""
        return self.client.transpile_code(code)

    def insert_component_to_canvas(self, code: str, x: float = 0.0, y: float = 0.0) -> str:
        """Transpiles code and directly inserts it into the active Figma canvas."""
        return self.client.insert_code(code, x=x, y=y)

    def create_canvas_shape(self, shape_type: str, width: float = 100.0, height: float = 100.0, x: float = 0.0, y: float = 0.0, fill_color: str = "#3B82F6") -> str:
        """Creates a primitive rectangle or frame directly on the canvas."""
        if shape_type.lower() == "frame":
            return self.client.create_frame(name="New Frame", width=width, height=height, x=x, y=y, background_color=fill_color)
        return self.client.create_rectangle(width=width, height=height, x=x, y=y, fill_color=fill_color)

