all:
	@echo 'Makefile targets: frontend-install, dev, build, deploy, dev-all'

# Install frontend deps (tries --no-bin-links fallback for Termux). Include flags to avoid peer-deps/audit/funding problems in Termux
frontend-install:
	cd frontend && npm ci --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund || npm install --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund

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
	cd frontend && npm ci --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund || npm install --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build
	rm -rf src/web_view/* || true
	mkdir -p src/web_view
	cp -r frontend/dist/* src/web_view/

frontend-deploy: frontend-build
