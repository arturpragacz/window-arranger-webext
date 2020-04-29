default : build

build:
	mv $$(web-ext build --verbose --artifacts-dir=builds | grep -oP "Your web extension is ready: \K.*" | sed -E 's:\\\\:/:g; s:(.*).zip$$:\\1.zip \\1.xpi:')

run:
	web-ext run --firefox=firefoxdeveloperedition --no-reload --start-url about:debugging#/runtime/this-firefox

clean :
	-rmdir /s /q builds