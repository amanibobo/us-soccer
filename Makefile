# larpers — one command per job.
#
#   make data MATCH=2006229     fetch + build a bundle for one match
#   make fetch MATCH=2006229    download the four raw files only
#   make build MATCH=2006229    build the bundle from already-downloaded files
#   make dev                    run the web app locally
#   make test                   run pipeline tests

MATCH ?= 2006229
RAW   := data/raw/$(MATCH)
OUT   := web/public/data/$(MATCH)

.PHONY: data fetch build dev test clean headshots crests

data: fetch build

fetch:
	uv run --directory pipeline python fetch.py $(MATCH) --out ../$(RAW)

build:
	uv run --directory pipeline python build.py $(MATCH) --raw ../$(RAW) --out ../$(OUT)

dev:
	cd web && npm run dev

test:
	uv run --directory pipeline --group dev pytest -q

clean:
	rm -rf $(OUT)

headshots:
	uv run --directory pipeline python headshots.py $(patsubst %,../%,$(wildcard web/public/data/*/meta.json)) --out ../web/public/players --index ../web/src/config/players.json

crests:
	uv run --directory pipeline python crests.py $(patsubst %,../%,$(wildcard web/public/data/*/meta.json)) --out ../web/public/logos --index ../web/src/config/logos.json
