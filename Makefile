all:
	@echo 'Makefile targets: frontend-install, dev, build, deploy, dev-all'

# Install frontend deps (tries --no-bin-links fallback for Termux)
frontend-install:
	cd frontend && npm ci --no-bin-links || npm install --no-bin-links

# Start frontend dev server only
frontend-dev:
	cd frontend && npm run dev

# Build frontend and copy to backend static folder
frontend-build:
	cd frontend && npm run build
	mkdir -p src/web_view
	cp -r frontend/dist/* src/web_view/

frontend-deploy: frontend-build

# Start backend + frontend in parallel (dev), use scripts/dev.sh
dev-all:
	bash scripts/dev.sh

# dev-rollup: start backend + rollup watcher (Termux-friendly)
dev-rollup:
	bash scripts/dev_rollup.sh

frontend-install:
	cd frontend && npm ci --no-bin-links || npm install --no-bin-links

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build
	rm -rf src/web_view/* || true
	mkdir -p src/web_view
	cp -r frontend/dist/* src/web_view/

frontend-deploy: frontend-build
