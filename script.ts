// TODO: OBRZYDLIWY HACK!
export interface BackgroundWindow {
	running: boolean;
	startstop: boolean;

	windowCreatedTimeout: number;
	backupTimeInterval: number;
	
	current: ArrangementStore;
	backupTimerIds: number[];
	
	delay: (t: number) => Promise<unknown>;
	
	preFilterInteresting: browser.windows.WindowType[];

	isInteresting: (wndw: browser.windows.Window) => Promise<boolean>;
	
	
	mutex: Mutex;
	
	windowCreated: (wndw: browser.windows.Window) => Promise<void>;
	
	windowRemoved: (wndwId: number) => Promise<void>;
	
	windowsRearranged: (e: CustomEvent) => Promise<void>;
	
	updateCurrent: (update: Arrangement | ArrangementStore) => Promise<void>;
	
	saveCurrent: () => Promise<void>;
	
	startMain: () => Promise<void>;
	
	stopMain: () => void;
	
	
	loadFromMemory: (name: string) => Promise<Arrangement>;
	
	saveToMemory: (name: string) => Promise<void>;
	
	copyInMemory: (source: string, destination: string) => Promise<void>;
	
	deleteFromMemory: (name: string) => Promise<void>;
	
	memoryDumpGlobal: () => any;
	
	memoryDumpWindows: () => any;

	clearAllMemory: () => Promise<void>;
	
	showWindowCounter: () => number;
}

var running = false;
var startstop = false;

var windowCreatedTimeout = 40000;
var backupTimeInterval = 300000;

var current: ArrangementStore;
var backupTimerIds: number[] = [];

var delay = (t: number) => new Promise(resolve => setTimeout(resolve, t));

var preFilterInteresting = undefined; // defaults to {populate: false, windowTypes: ['normal', 'panel', 'popup']};
                                                                       // TODO?: add devtool windows?
async function isInteresting(wndw: browser.windows.Window): Promise<boolean> {
	return true;
}


var mutex = new Mutex();

async function windowCreated(wndw: browser.windows.Window): Promise<void> {
	await delay(windowCreatedTimeout);
	if (running) { await mutex.dispatch(async () => {
		const id = wndw.id;
		const changeOi = new ObserveInfo<CommonIdType>().add(id);
		await Promise.all([
			storager.changeObserved(changeOi),
			(async() => {
				const changed1: Arrangement = await arranger.changeObserved(changeOi);

				let moveToTopArrangement = new Arrangement();
				const topPossition: Possition = changed1.get(id).moveToTop();
				moveToTopArrangement.set(id, topPossition);
				const changed2: Arrangement = await arranger.setArrangement(moveToTopArrangement);

				const changed = mergeArrangements(changed1, changed2);

				await updateCurrent(changed);
			})(),
		]);
	})}
}

async function windowRemoved(wndwId: number): Promise<void> {
	if (running) { await mutex.dispatch(async () => {
		const changeOi = new ObserveInfo<CommonIdType>().delete(wndwId);
		await Promise.all([
			storager.changeObserved(changeOi),
			arranger.changeObserved(changeOi),
		]);
		current.arrangement.delete(wndwId);
		current.date = new Date();
		await saveCurrent();
	})}
}

async function windowsRearranged(e: CustomEvent): Promise<void> {
	if (running) { await mutex.dispatch(async () => {
		const arrangementUpdate: Arrangement = e.detail;
		return updateCurrent(arrangementUpdate);
	})}
}

async function updateCurrent(update: Arrangement | ArrangementStore): Promise<void> {
	// helper function: only used when already running and mutex locked
	if (update instanceof Arrangement)
		update = new ArrangementStore(update);
	current = mergeArrangementStores(current, update);
	await saveCurrent();
}

async function saveCurrent(): Promise<void> {
	// helper function: only used when already running and mutex locked
	return storager.saveArrangementStore("$current", current);
}


async function startMain(): Promise<void> {
	if (!running && !startstop) {
		startstop = true;

		await mutex.dispatch(async () => {
			const allWindows = await browser.windows.getAll(preFilterInteresting);
			const allWindowIds = (await allWindows.asyncFilter(isInteresting)).map(w => w.id);
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

			backupTimerIds.push(window.setInterval(() => storager.copyArrangementStore("$current", "$backupLong"), backupTimeInterval));
		});

		running = true;
		startstop = false;
	}
	else
		console.log("Main already running!");
}

function stopMain(): void {
	if (running && !startstop) {
		running = false;
		startstop = true;

		storager.stop();
		arranger.stopConnection();

		arranger.onArrangementChanged.removeEventListener("arrangementChanged", windowsRearranged);
		browser.windows.onCreated.removeListener(windowCreated);
		browser.windows.onRemoved.removeListener(windowRemoved);

		for (let timerId of backupTimerIds) {
			window.clearInterval(timerId);
		}
		backupTimerIds = [];

		startstop = false;
	}
	else
		console.log("No running Main!");
}

startMain();


async function loadFromMemory(name: string): Promise<Arrangement> {
	if (running) { return mutex.dispatch(async () => {
		let changed: Arrangement;
		const order = await storager.loadArrangementStore(name);
		await Promise.all([
			storager.saveArrangementStore("$auxiliary", current),
			(async() => {
				changed = await arranger.setArrangement(order.arrangement);
			})(),
		])
		await updateCurrent(changed);
		return changed;
	})}
}

async function saveToMemory(name: string): Promise<void> {
	if (running) { await mutex.dispatch<void>(async () => {
		await storager.saveArrangementStore(name, current);
	})}
}

async function copyInMemory(source: string, destination: string): Promise<void> {
	// nie musi być running, aby się dało (patrz na źródło storager.copyArrangementStore)
	await mutex.dispatch<void>(async () => {
		await storager.copyArrangementStore(source, destination);
	})
}

async function deleteFromMemory(name: string): Promise<void> {
	// nie musi być running, aby się dało (patrz na źródło storager.deleteArrangementStore)
	await mutex.dispatch<void>(async () => {
		await storager.deleteArrangementStore(name);
	});
}

async function memoryDumpGlobal() {
	return browser.storage.local.get(null);
}

async function memoryDumpWindows() {
	let pairs: [CommonIdType, CustomIdType][] = [];
	const allWindows = await browser.windows.getAll(preFilterInteresting);
	const allWindowIds = (await allWindows.asyncFilter(isInteresting)).map(w => w.id);
	await allWindowIds.asyncForEach(async id => { pairs.push([id, await browser.sessions.getWindowValue(id, "uid") as string]); });
	return pairs;
}

async function clearAllMemory() {
	const allWindows = await browser.windows.getAll({ windowTypes: ['normal', 'panel', 'popup', 'devtools'] }); // wszystkie windowTypes
	const allWindowIds = allWindows.map(w => w.id);
	await Promise.all([
		allWindowIds.asyncForEach(id => browser.sessions.removeWindowValue(id, "uid")),
		browser.storage.local.clear(),
	]);
}

function showWindowCounter(): number {
	return storager.showWindowCounter();
}