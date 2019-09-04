default : build

build: clean
	web-ext build --artifacts-dir=builds

run:
	web-ext run --firefox=firefoxdeveloperedition --no-reload --start-url about:debugging#/runtime/this-firefox

clean :
	-rmdir /s /q builds