import { ObserveInfo } from "./observeInfo.js"
import { CommonIdType, Possition, Arrangement, mergeArrangements } from "./arrangement.js"
import * as messenger from "./messenger.js"
import * as storager from "./storager.js"
import { UidType, ArrangementStore, mergeArrangementStores } from "./storager.js"
import { Mutex } from "../common/mutex.js"


export var running: boolean = false;
var startstop: boolean = false;

var windowCreatedTimeout: number = 40000;
var backupTimeInterval: number = 300000;

var current: ArrangementStore;
var backupTimerIds: number[] = [];

var delay: (t: number) => Promise<unknown> = t => new Promise(resolve => setTimeout(resolve, t));

var preFilterInteresting: {populate: boolean, windowTypes: browser.windows.WindowType[]} = undefined; // defaults to {populate: false, windowTypes: ["normal", "panel", "popup"]};
                                                                                                      // TODO?: add devtool windows?
async function isInteresting(wndw: browser.windows.Window): Promise<boolean> {
	return true;
}


var mutex: Mutex = new Mutex();

async function windowCreated(wndw: browser.windows.Window): Promise<void> {
	await delay(windowCreatedTimeout);
	if (running) { await mutex.dispatch(async () => {
		const id = wndw.id;
		const changeOi = new ObserveInfo<CommonIdType>().add(id);
		await Promise.all([
			storager.changeObserved(changeOi),
			(async() => {
				const changed1: Arrangement = await messenger.changeObserved(changeOi);

				let moveToTopArrangement = new Arrangement();
				const topPossition: Possition = changed1.get(id).moveToTop();
				moveToTopArrangement.set(id, topPossition);
				const changed2: Arrangement = await messenger.setArrangement(moveToTopArrangement);

				const changed = mergeArrangements(changed1, changed2);

				await updateCurrent(changed);
			})(),
		]);
	}, "windowCreated")}
	else
		console.error("No running Main!");
}

async function windowRemoved(wndwId: number): Promise<void> {
	if (running) { await mutex.dispatch(async () => {
		const changeOi = new ObserveInfo<CommonIdType>().delete(wndwId);
		await Promise.all([
			storager.changeObserved(changeOi),
			messenger.changeObserved(changeOi),
		]);
		current.arrangement.delete(wndwId);
		current.date = new Date();
		await saveCurrent();
	}, "windowRemoved")}
	else
		console.error("No running Main!");
}

async function windowsRearranged(e: CustomEvent): Promise<void> {
	if (running) { await mutex.dispatch(async () => {
		const arrangementUpdate: Arrangement = e.detail;
		return updateCurrent(arrangementUpdate);
	}, "windowsRearranged")}
	else
		console.error("No running Main!");
}

async function updateCurrent(update: Arrangement | ArrangementStore): Promise<void> {
	// helper function: only used when already <running> and <mutex> locked
	if (update instanceof Arrangement)
		update = new ArrangementStore(update);
	current = mergeArrangementStores(current, update);
	await saveCurrent();
}

async function saveCurrent(): Promise<void> {
	// helper function: only used when already <running> and <mutex> locked
	return storager.saveArrangementStore("$current", current, 1);
}


export async function startMain(): Promise<void> {
	if (!running && !startstop) {
		startstop = true;

		await mutex.dispatch(async () => {
			const allWindows = await browser.windows.getAll(preFilterInteresting);
			const allWindowIds = (await allWindows.asyncFilter(isInteresting)).map(w => w.id);
			const allWindowOi = new ObserveInfo<CommonIdType>().add(allWindowIds);

			await storager.start();
			messenger.startConnection();

			await storager.changeObserved(allWindowOi);
			const arrangement = await messenger.changeObserved(allWindowOi);
			current = new ArrangementStore(arrangement);

			await storager.copyArrangementStore("$current", "$previous").catch(() => {});
			await storager.saveArrangementStore("$current", current, 1);

			browser.windows.onCreated.addListener(windowCreated);
			browser.windows.onRemoved.addListener(windowRemoved);
			messenger.onArrangementChanged.addEventListener("arrangementChanged", windowsRearranged);

			backupTimerIds.push(window.setInterval(() => storager.copyArrangementStore("$current", "$backupLong", 0, 1), backupTimeInterval));
		}, "startMain");

		running = true;
		startstop = false;
	}
	else
		throw Error("Main already running!");
}

export function stopMain(): void {
	if (running && !startstop) {
		running = false;
		startstop = true;

		storager.stop();
		messenger.stopConnection();

		messenger.onArrangementChanged.removeEventListener("arrangementChanged", windowsRearranged);
		browser.windows.onCreated.removeListener(windowCreated);
		browser.windows.onRemoved.removeListener(windowRemoved);

		for (let timerId of backupTimerIds) {
			window.clearInterval(timerId);
		}
		backupTimerIds = [];

		startstop = false;
	}
	else
		throw Error("No running Main!");
}

startMain();


export async function loadFromMemory(name: string, index?: number): Promise<Arrangement> {
	if (running) { return mutex.dispatch(async () => {
		let changed: Arrangement;
		const order = await storager.loadArrangementStore(name, index);
		await Promise.all([
			storager.saveArrangementStore("$auxiliary", current, 1),
			(async() => {
				changed = await messenger.setArrangement(order.arrangement);
			})(),
		])
		await updateCurrent(changed);
		return changed;
	}, "loadFromMemory")}
	else
		throw Error("No running Main!");
}

export async function saveToMemory(name: string, maxSize?: number): Promise<void> {
	if (running) { await mutex.dispatch<void>(async () => {
		await storager.saveArrangementStore(name, current, maxSize);
	}, "saveToMemory")}
	else
		throw Error("No running Main!");
}

export async function copyInMemory(source: string, destination: string, index?: number, maxSize?: number): Promise<void> {
	// does not have to be <running> to be possible (look at the source at storager.copyArrangementStore)
	await mutex.dispatch<void>(async () => {
		await storager.copyArrangementStore(source, destination, index, maxSize);
	}, "copyInMemory")
}

export async function copyArrayInMemory(source: string, destination: string): Promise<void> {
	// does not have to be <running> to be possible (look at the source at storager.copyArrangementStore)
	await mutex.dispatch<void>(async () => {
		await storager.copyArrangementStoreArray(source, destination);
	}, "copyArrayInMemory")
}

export async function deleteFromMemory(name: string, index?: number): Promise<void> {
	// does not have to be <running> to be possible (look at the source at storager.copyArrangementStore)
	await mutex.dispatch<void>(async () => {
		await storager.deleteArrangementStore(name, index);
	}, "deleteFromMemory");
}

export async function deleteArrayFromMemory(name: string): Promise<void> {
	// does not have to be <running> to be possible (look at the source at storager.copyArrangementStore)
	await mutex.dispatch<void>(async () => {
		await storager.deleteArrangementStoreArray(name);
	}, "deleteArrayFromMemory");
}

export async function memoryDumpGlobal(): Promise<any> {
	return browser.storage.local.get(null);
}

export async function memoryDumpWindows(): Promise<any> {
	let pairs: [CommonIdType, UidType][] = [];
	const allWindows = await browser.windows.getAll(preFilterInteresting);
	const allWindowIds = (await allWindows.asyncFilter(isInteresting)).map(w => w.id);
	await allWindowIds.asyncForEach(async id => { pairs.push([id, await browser.sessions.getWindowValue(id, "uid") as UidType]); });
	return pairs;
}

export async function clearAllMemory(): Promise<void> {
	const allWindows = await browser.windows.getAll({ windowTypes: ["normal", "panel", "popup", "devtools"] }); // all windowTypes
	const allWindowIds = allWindows.map(w => w.id);
	await Promise.all([
		allWindowIds.asyncForEach(id => browser.sessions.removeWindowValue(id, "uid")),
		browser.storage.local.clear(),
	]);
}

export function showWindowCounter(): number {
	return storager.showWindowCounter();
}
