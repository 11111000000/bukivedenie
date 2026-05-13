all:
	@echo 'Makefile targets: site-install, site-data, site-build, site-dev, site-preview, dev, ui-smoke, build-data, build-data-fast, clean'

# Install site deps.
site-install:
	cd site && npm install

build-data:
	python -m src.static_dist.build_dist --input data/raw --out data/dist --top-n 100

build-data-fast:
	python -m src.static_dist.build_dist --input data/raw --out data/dist --top-n 50 --no-cooccur --no-sentiment --no-hapax

site-data:
	python scripts/regenerate_all.py
	python scripts/build_war_and_peace_data.py --source data/dist --target site/public/data/war-and-peace

site-build: site-data
	cd site && npm run build

# dev: prepare site data and run the static site in dev mode
site-dev: site-data
	cd site && npm run dev

# preview the built site locally
site-preview: site-build
	cd site && npm run preview

dev: site-dev

site-open: site-build
	sh -c '(cd site; npm run preview -- --host 127.0.0.1 >/tmp/bukivedenie-site-preview.log 2>&1 & echo $$! > /tmp/bukivedenie-site-preview.pid; trap "kill $$(cat /tmp/bukivedenie-site-preview.pid) >/dev/null 2>&1 || true" EXIT INT TERM; sleep 2; node scripts/open-with-console.js http://127.0.0.1:4173)'

ui-smoke:
	python scripts/regenerate_all.py
	cd site && npm run build

# regenerate presentation screenshots (serves site/dist on :5173 and runs capture script)
.PHONY: preza-screens
preza-screens:
	# ensure site is built
	make site-build
	# serve in background and run capture
	@echo "Starting http server on :5173 (site/dist)"
	@nohup python3 -m http.server 5173 --directory site/dist > logs/site-server.log 2>&1 & echo $$! > logs/site-server.pid
	@sleep 0.6
	# run capture script
	@CHROMIUM_PATH=/run/current-system/sw/bin/chromium node site/scripts/capture-articles-screenshots.js --base=http://127.0.0.1:5173 --out=site/presentation/screens

# generate AITUNNEL images (uses AITUNNEL_KEY env var). creates variants -v1/-v2
.PHONY: preza-images
preza-images:
	@echo "Generating images via AITUNNEL (requires AITUNNEL_KEY env var)"
	@CHROMIUM_PATH=/run/current-system/sw/bin/chromium node site/scripts/generate-images-aitunnel.js

# convenience: regenerate full presentation (screens + images + rebuild pdf/pptx)
.PHONY: preza-regenerate
preza-regenerate: preza-screens
	@echo "Rebuilding preza artifacts (PDF and PPTX)"
	@CHROMIUM_PATH=/run/current-system/sw/bin/chromium node site/scripts/render-preza-pdf.js
	@CHROMIUM_PATH=/run/current-system/sw/bin/chromium node site/scripts/generate-preza-pptx.js

# Local helper: regenerate only outputs (fast)
regen-outputs:
	python scripts/regenerate_all.py

# Enter the full build/test shell from Nix.
shell:
	nix develop

# Clean target (optional)
clean:
	rm -rf site/node_modules site/dist site/public/data
