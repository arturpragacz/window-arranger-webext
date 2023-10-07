default : build

build:
	mv $$(web-ext build --verbose --artifacts-dir=builds | grep -oP "Your web extension is ready: \K.*" | sed -E 's:\\\\:/:g; s:(.*).zip$$:\\1.zip \\1.xpi:')

run:
	web-ext run --firefox=firefoxdeveloperedition --no-reload --start-url about:debugging#/runtime/this-firefox --devtools --pref extensions.experiments.enabled=true

run-reloading:
	web-ext run --firefox=firefoxdeveloperedition --start-url about:debugging#/runtime/this-firefox --devtools --pref extensions.experiments.enabled=true

# clean :
# 	-rmdir /s /q builds
