// arranger = {
// 	getArrangement,
// 	setArrangement,
// 	onArrangementChanged,
// 	startConnection
// }

window.storage.init().then(() => {

	let runningConnection = false;

	browser.browserAction.onClicked.addListener(function () {
		if (runningConnection) {
			arranger.stopConnection();
		}
		else {
			arranger.startConnection();
		}
		runningConnection = !runningConnection;
	})

	arranger.onArrangementChanged.addEventListener("shuffled", function (e) {
		console.log("shuffled: ", e);
	})

	// arranger.startConnection();

});