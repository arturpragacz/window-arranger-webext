
import { BackgroundWindow } from "./script";

browser.runtime.getBackgroundPage().then((background) => {

	var bg = background as any as BackgroundWindow; // TODO: OBRZYDLIWY HACK!

	if (bg.running) {
		document.getElementById("start-stop").textContent = "Stop";
	}
	else {
		document.getElementById("start-stop").textContent = "Start";
	}

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
				"about:devtools-toolbox?type=extension&id=window_arranger%40extension.pragacz.com");
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