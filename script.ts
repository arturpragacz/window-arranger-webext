
var running = false;
// var operational = false; // TODO

const windowCreatedTimeout = 3000;
const backupTimeInterval = 3000;

var current: ArrangementStore;
var backupTimerIds: number[] = [];

const delay = (t: number) => new Promise(resolve => setTimeout(resolve, t));

// TODO: jakiś mechanizm synchronizacji tych callbacków poniżej? (anonimowa async?)

async function windowCreated(wndw: browser.windows.Window): Promise<void> {
	await delay(windowCreatedTimeout);
	const changeOi = new ObserveInfo<CommonIdType>().add(wndw.id);
	storager.changeObserved(changeOi);
	const arrangementUpdate = await arranger.changeObserved(changeOi);
	await updateCurrent(arrangementUpdate);
}

async function windowRemoved(wndwId: number): Promise<void> {
	const changeOi = new ObserveInfo<CommonIdType>().delete(wndwId);
	await Promise.all([
		storager.changeObserved(changeOi),
		arranger.changeObserved(changeOi),
	]);
	current.arrangement.delete(wndwId);
	current.date = new Date();
	// TODO: nie zapisujemy tego? wydaje się działać...
}

async function windowsRearranged(e: CustomEvent): Promise<void> {
	const arrangementUpdate: Arrangement = e.detail;
	return updateCurrent(arrangementUpdate);
}

async function updateCurrent(update: Arrangement | ArrangementStore): Promise<void> {
	if (update instanceof Arrangement)
		update = new ArrangementStore(update);
	current = mergeArrangementStores(current, update);
	await storager.saveArrangementStore("$current", current);
}


async function mainStart(): Promise<void> {
	if (!running) {
		running = true;
		// operational = false;

		const allWindows = await browser.windows.getAll() // TODO?: add devtool windows?
		const allWindowIds = allWindows.map(w => w.id);
		const allWindowOi = new ObserveInfo<CommonIdType>().add(allWindowIds);

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

		backupTimerIds.push(window.setInterval(() => storager.copyArrangementStore("$current", "$backup"), backupTimeInterval));

		// operational = false;
	}
	else
		console.log("Main already running!");
}

function mainStop(): void {
	if (running) {
		running = false;

		storager.stop();
		arranger.stopConnection();

		arranger.onArrangementChanged.removeEventListener("arrangementChanged", windowsRearranged);
		browser.windows.onCreated.removeListener(windowCreated);
		browser.windows.onRemoved.removeListener(windowRemoved);

		for (let timerId of backupTimerIds) {
			window.clearInterval(timerId);
		}
		backupTimerIds = [];
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



async function loadFromMemory(name: string): Promise<Arrangement> {
	let changed: Arrangement;
	await Promise.all([
		saveToMemory("$auxiliary"),
		(async() => {
			const order = await storager.loadArrangementStore(name);
			changed = await arranger.setArrangement(order.arrangement);
		})(),
	])
	await updateCurrent(changed);
	return changed;
}

async function saveToMemory(name: string): Promise<void> {
	await storager.saveArrangementStore(name, current);
}

async function copyInMemory(source: string, destination: string): Promise<void> {
	await storager.copyArrangementStore(source, destination);
}

async function deleteFromMemory(name: string): Promise<void> {
	await storager.deleteArrangementStore(name);
}

async function memoryDumpGlobal() {
	return browser.storage.local.get(null);
}

async function memoryDumpWindows() {
	let pairs: [CommonIdType, CustomIdType][] = [];
	const allWindows = await browser.windows.getAll() // TODO?: add devtool windows?
	const allWindowIds = allWindows.map(w => w.id);
	await allWindowIds.asyncForEach(async id => { pairs.push([id, await browser.sessions.getWindowValue(id, "uid") as string]); });
	return pairs;
}

async function clearAllMemory() {
	const allWindows = await browser.windows.getAll() // TODO?: add devtool windows?
	const allWindowIds = allWindows.map(w => w.id);
	await Promise.all([
		allWindowIds.asyncForEach(id => browser.sessions.removeWindowValue(id, "uid")),
		browser.storage.local.clear(),
	]);
}