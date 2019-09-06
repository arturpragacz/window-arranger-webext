
var running = false;
// var operational = false; // TODO

var current: ArrangementStore;
var backupTimerIds: number[] = [];

function windowCreated(wndw: browser.windows.Window) {
	console.log("windowCreated: ", wndw);
}

function windowRemoved(wndwId: number) {
	const windowRemovedOi = new ObserveInfo().delete(wndwId);
	storager.changeObserved(windowRemovedOi)
}

function windowsRearranged(e: CustomEvent) {
	const arrangementUpdate: Arrangement = e.detail;
	const arrangementStoreUpdate = new ArrangementStore(arrangementUpdate);
	current = mergeArrangementStores(current, arrangementStoreUpdate);
	storager.saveArrangementStore("$current", current);
}


async function mainStart() {
	if (!running) {
		running = true;
		// operational = false;

		const allWindows = await browser.windows.getAll() // TODO?: add devtool windows?
		const allWindowIds = allWindows.map(w => w.id);
		const allWindowOi = new ObserveInfo().add(allWindowIds);

		await storager.start();
		arranger.startConnection();

		await storager.changeObserved(allWindowOi);
		const arrangement = await arranger.changeObserved(allWindowOi);
		current = new ArrangementStore(arrangement);

		await storager.copyArrangementStore("$current", "$previous").catch(() => {});
		await storager.saveArrangementStore("$current", current);

		browser.windows.onCreated.addListener(windowCreated);
		browser.windows.onRemoved.addListener(windowRemoved);
		arranger.onArrangementChanged.addEventListener("arrangementChanged", windowsRearranged);

		// operational = false;
	}
	else
		console.log("Main already running!");
}

function mainStop() {
	if (running) {
		running = false;

		storager.stop();
		arranger.stopConnection();

		arranger.onArrangementChanged.removeEventListener("arrangementChanged", windowsRearranged);
		browser.windows.onCreated.removeListener(windowCreated);
		browser.windows.onRemoved.removeListener(windowRemoved);
	}
	else
		console.log("No running Main!");
}

browser.browserAction.onClicked.addListener(function () {
	if (running) {
		mainStop();
	}
	else {
		mainStart();
	}
	// running = !running;
})


async function loadFromMemory(name: string) {

}

async function clear() {
	const allWindows = await browser.windows.getAll() // TODO?: add devtool windows?
	const allWindowIds = allWindows.map(w => w.id);
	allWindowIds.asyncForEach(id=>browser.sessions.removeWindowValue(id, "uid"));
	browser.storage.local.clear();
}