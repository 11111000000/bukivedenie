all:
	@echo 'Makefile targets: frontend-install, dev, build, deploy, dev-all'

# Install frontend deps (tries --no-bin-links fallback for Termux).
# We disable npm progress spinner and force CI mode to avoid interactive spinners on Termux/CI.
# Output is tee'd to logs/frontend-install.log so you can inspect the full log.
frontend-install:
	@mkdir -p logs
	@echo "Running frontend install; logs will be written to logs/frontend-install.log"
	@cd frontend && \
		# prefer stdbuf for line-buffered live output when available
		if command -v stdbuf >/dev/null 2>&1; then \
		  echo "Using stdbuf to stream output"; \
		  stdbuf -oL sh -c 'CI=true NPM_CONFIG_PROGRESS=false npm ci --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund --no-optional --loglevel=info --no-progress' 2>&1 | sed -u 's/\x1b\[[0-9;]*m//g' | tee ../logs/frontend-install.log || \
		  ( echo "npm ci failed, retrying with npm install..."; stdbuf -oL sh -c 'CI=true NPM_CONFIG_PROGRESS=false npm install --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund --no-optional --loglevel=info --no-progress' 2>&1 | sed -u 's/\x1b\[[0-9;]*m//g' | tee ../logs/frontend-install.log ); \
		else \
		  echo "stdbuf not found; running without stdbuf"; \
		  sh -c 'CI=true NPM_CONFIG_PROGRESS=false npm ci --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund --no-optional --loglevel=info --no-progress' 2>&1 | sed -u 's/\x1b\[[0-9;]*m//g' | tee ../logs/frontend-install.log || \
		  ( echo "npm ci failed, retrying with npm install..."; sh -c 'CI=true NPM_CONFIG_PROGRESS=false npm install --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund --no-optional --loglevel=info --no-progress' 2>&1 | sed -u 's/\x1b\[[0-9;]*m//g' | tee ../logs/frontend-install.log ); \
		fi
	@echo "Install finished; see logs/frontend-install.log for full output"
	@echo "Last 200 lines of log:"
	@tail -n 200 logs/frontend-install.log || true

# Start frontend dev server only (rollup/browser-sync watcher)
frontend-dev:
	cd frontend && npm run dev:rollup || npm run dev:bs

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

# Clean target (optional)
clean:
	rm -rf frontend/node_modules frontend/dist
	rm -f logs/frontend-install.log
