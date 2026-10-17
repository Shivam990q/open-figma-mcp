.PHONY: all build build-release test test-rust test-node test-sdks test-all run run-rust desktop studio clean docker-build docker-run help

help:
	@echo "OpenFigma Autonomous Design Fabric - Enterprise MCP Build System"
	@echo "================================================================"
	@echo "make build          - Build debug Rust binary and install Node dependencies"
	@echo "make build-release  - Compile optimized native release binary (open-figma)"
	@echo "make test           - Run Node.js test suite"
	@echo "make test-rust      - Run Rust test suite (27 unit & integration tests)"
	@echo "make test-sdks      - Run TypeScript and Python SDK test suites"
	@echo "make test-all       - Run the entire multi-language test battery"
	@echo "make desktop        - Launch standalone native desktop app studio"
	@echo "make studio         - Launch interactive browser canvas preview"
	@echo "make run            - Run universal Node.js MCP server (port 3845)"
	@echo "make run-rust       - Run native high-throughput Rust MCP server (port 3845)"
	@echo "make docker-build   - Build non-root production Docker container"
	@echo "make docker-run     - Run production Docker container"
	@echo "make clean          - Clean Rust build cache and artifacts"

build:
	npm install
	cargo build

build-release:
	cargo build --release

test:
	node --test tests/*.test.js

test-rust:
	cargo test --workspace

test-sdks:
	node --test sdk/typescript/test/*.test.js
	python sdk/python/test_client.py

test-all: test test-rust test-sdks

desktop:
	node desktop/launch.js

studio:
	node src/server.js --open

run:
	node src/server.js

run-rust:
	./target/release/open-figma serve --port 3845

docker-build:
	docker build -t open-figma:2.0.0 .

docker-run:
	docker run -p 3845:3845 -e FIGMA_API_KEY=$${FIGMA_API_KEY} open-figma:2.0.0

clean:
	cargo clean
