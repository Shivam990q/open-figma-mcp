# OpenFigma Python SDK (`open-figma-sdk`)

Enterprise Python SDK for the OpenFigma Model Context Protocol (MCP) server & design engine.

## Installation

```bash
pip install open-figma-sdk
```

## Quickstart

```python
from open_figma_sdk import OpenFigmaClient

# Connect to local OpenFigma daemon or remote server
client = OpenFigmaClient(endpoint="http://127.0.0.1:3845")

# Fetch compressed scenegraph context
design_yaml = client.get_figma_data("https://figma.com/design/AbC123XyZ/App?node-id=12-822")
print(design_yaml)

# Extract design tokens into Tailwind v4 format
tokens = client.get_design_tokens("https://figma.com/design/AbC123XyZ/App", format="tailwind-v4")
print(tokens)

# Synthesize code into React + Tailwind
react_code = client.generate_code("https://figma.com/design/AbC123XyZ/App?node-id=12-822", framework="react-tailwind")
print(react_code)

# Pure vector SVG rendering
svg_markup = client.render_svg("https://figma.com/design/AbC123XyZ/App?node-id=12-822")
```

## LangChain Integration

```python
from open_figma_sdk import OpenFigmaClient
from open_figma_sdk.langchain_tools import OpenFigmaLangChainTool

client = OpenFigmaClient(endpoint="http://127.0.0.1:3845")
figma_tool = OpenFigmaLangChainTool(client)

# Bind tool directly to your LangChain agent / LLM
# tools = [figma_tool]
```

## License
MIT
