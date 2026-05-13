all:
	@echo 'Makefile targets: frontend-install, frontend-build, build-data, dev, dev-server, dev-rollup, ui-smoke, clean'

# Install frontend deps (tries --no-bin-links fallback for Termux).
# We disable npm progress spinner and force CI mode to avoid interactive spinners on Termux/CI.
# Output is tee'd to logs/frontend-install.log so you can inspect the full log.
frontend-install:
	@sh scripts/frontend_install.sh

frontend-build:
	cd frontend && npm run build
	mkdir -p frontend/dist/data
	rm -rf frontend/dist/data/dist
	cp -R data/dist frontend/dist/data/

build-data:
	python -m src.static_dist.build_dist --input data/raw --out data/dist --top-n 100

build-data-fast:
	python -m src.static_dist.build_dist --input data/raw --out data/dist --top-n 50 --no-cooccur --no-sentiment --no-hapax

# dev: build static data and frontend artifacts
dev:
	$(MAKE) build-data-fast frontend-build

# dev-server: start backend + rollup watcher (Termux-friendly)
dev-server:
	bash scripts/dev_rollup.sh

# dev-rollup: alias for the server-mode workflow
dev-rollup:
	bash scripts/dev_rollup.sh

ui-smoke:
	bash scripts/ui_smoke.sh

# Enter the full build/test shell from Nix.
shell:
	nix develop

# Clean target (optional)
clean:
	rm -rf frontend/node_modules frontend/dist
	rm -f logs/frontend-install.log
