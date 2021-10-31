import type * as BackgroundWindow from "../background/background"
import { RunningState, InternalMessage } from "../common/const.js"

enum RunningText {
	NOT_RUNNING = "Start",
	RUNNING = "Stop",
	STARTING = "Starting",
	STOPPING = "Stopping"
}

function setStartStopText(running: RunningState) {
	document.getElementById("start-stop").textContent = RunningText[RunningState[running]];
}

browser.runtime.getBackgroundPage().then((backgroundWindow) => {
	let bg = (backgroundWindow as any).bg as typeof BackgroundWindow;

	setStartStopText(bg.running);

	document.addEventListener("click", e => {
		e.preventDefault();

		const target = e.target as Element;

		if (target.id === "restore-previous") {
			bg.loadFromMemory("$previous").then(suc => {
				window.close();
			});
		}

		if (target.id === "go-to-console") {
			browser.tabs.create({});
			navigator.clipboard.writeText(
				"about:devtools-toolbox?type=extension&id=window_arranger%40webext.pragacz.com");
			window.close();
		}

		else if (target.id === "start-stop") {
			bg.switchMain();
		}
	});
});

(function applySettings() {
	const goToConsoleSetting = "settings_goToConsoleInPopup";
	browser.storage.local.get(goToConsoleSetting).then(items => {
		if (items[goToConsoleSetting] === true) {
			let goToConsoleElement = document.getElementById("go-to-console");
			goToConsoleElement.classList.remove("hidden");
		}
	});
})();

browser.runtime.onMessage.addListener((msg: InternalMessage) => {
	if (msg.type == "runningChange")
		setStartStopText(msg.value);
});
