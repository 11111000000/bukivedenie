all:
	@echo 'Makefile targets: frontend-install, dev-setup, dev-all, frontend-dev, frontend-build, dev-rollup, clean'

# Install frontend deps (tries --no-bin-links fallback for Termux).
# We disable npm progress spinner and force CI mode to avoid interactive spinners on Termux/CI.
# Output is tee'd to logs/frontend-install.log so you can inspect the full log.
frontend-install:
	@sh scripts/frontend_install.sh

# Start frontend dev server only (rollup/browser-sync watcher)
frontend-dev:
	cd frontend && npm run dev:rollup || npm run dev:bs

# Build frontend and copy to backend static folder
frontend-build:
	cd frontend && npm run build
	mkdir -p src/web_view
	cp -r frontend/dist/* src/web_view/

frontend-deploy: frontend-build

# One-time dev setup (install deps only)
dev-setup:
	@sh scripts/frontend_install.sh

# Start backend + frontend in parallel (dev), use scripts/dev.sh
dev-all:
	bash scripts/dev.sh

# dev-rollup: start backend + rollup watcher (Termux-friendly)
dev-rollup:
	bash scripts/dev_rollup.sh

# Clean target (optional)
clean:
	rm -rf frontend/node_modules frontend/dist
	rm -f logs/frontend-install.log
