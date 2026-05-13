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
	python scripts/build_site_data.py --source outputs --target site/public/data
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
	python scripts/build_site_data.py --source outputs --target site/public/data
	cd site && npm run build

# Enter the full build/test shell from Nix.
shell:
	nix develop

# Clean target (optional)
clean:
	rm -rf site/node_modules site/dist site/public/data
