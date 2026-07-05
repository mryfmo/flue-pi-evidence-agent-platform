.PHONY: setup validate-release test e2e build
setup:
	npm ci
	./node_modules/node/bin/node scripts/setup-python.mjs
validate-release:
	./node_modules/node/bin/node scripts/validate-release.mjs
test:
	npm run test
	.venv/bin/python -m pytest -q tests_py --cov=scripts --cov-report=term-missing --cov-fail-under=85
e2e:
	npm run flue:e2e
build:
	npm run flue:build
