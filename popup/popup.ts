import type * as BackgroundWindow from "../background/background"

browser.runtime.getBackgroundPage().then((backgroundWindow) => {

	var bg = (backgroundWindow as any).bg as typeof BackgroundWindow;

	if (bg.running) {
		document.getElementById("start-stop").textContent = "Stop";
	}
	else {
		document.getElementById("start-stop").textContent = "Start";
	}

	const goToConsoleSettings = "settings_goToConsoleInPopup";
	browser.storage.local.get(goToConsoleSettings).then(items => {
		if (items[goToConsoleSettings] === true) {
			let goToConsoleElement = document.getElementById("go-to-console");
			goToConsoleElement.classList.remove("hidden");
		}
	});

	document.addEventListener("click", e => {

		const target = e.target as Element;

		if (target.id === "restore-previous") {
			bg.loadFromMemory("$previous").then(suc => {
				window.close();
			})
		}

		if (target.id === "go-to-console") {
			browser.tabs.create({});
			navigator.clipboard.writeText(
				"about:devtools-toolbox?type=extension&id=window_arranger%40webext.pragacz.com");
			window.close();
		}

		else if (target.id === "start-stop") {
			if (bg.running) {
				bg.stopMain(); // can throw
				document.getElementById("start-stop").textContent = "Start";
			}
			else {
				bg.startMain().then(suc => {
					document.getElementById("start-stop").textContent = "Stop";
				});
			}
		}

		e.preventDefault();
		
	});

});