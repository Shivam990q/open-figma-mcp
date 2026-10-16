import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from open_figma_sdk.client import OpenFigmaClient
from open_figma_sdk.langchain_tools import OpenFigmaLangChainTool

class TestOpenFigmaSdk(unittest.TestCase):
    def test_client_init(self):
        client = OpenFigmaClient(endpoint="http://127.0.0.1:3845", api_key="test_key")
        self.assertEqual(client.endpoint, "http://127.0.0.1:3845")
        self.assertEqual(client.api_key, "test_key")

    def test_langchain_adapter_init(self):
        client = OpenFigmaClient()
        tool = OpenFigmaLangChainTool(client)
        self.assertIsNotNone(tool.get_figma_context)
        self.assertIsNotNone(tool.extract_design_tokens)
        self.assertIsNotNone(tool.generate_ui_code)
        self.assertIsNotNone(tool.render_svg_vector)
        self.assertIsNotNone(tool.audit_security_and_a11y)
        self.assertIsNotNone(tool.transpile_html_to_canvas)
        self.assertIsNotNone(tool.insert_component_to_canvas)
        self.assertIsNotNone(tool.create_canvas_shape)

    def test_client_canvas_methods_exist(self):
        client = OpenFigmaClient()
        self.assertTrue(hasattr(client, "create_frame"))
        self.assertTrue(hasattr(client, "create_text"))
        self.assertTrue(hasattr(client, "create_rectangle"))
        self.assertTrue(hasattr(client, "insert_code"))


if __name__ == "__main__":
    unittest.main()
