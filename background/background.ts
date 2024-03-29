import { ObserveInfo } from "./observeInfo.js"
import { CommonIdType, Possition, Arrangement, mergeArrangements } from "./arrangement.js"
import * as messenger from "./messenger.js"
import * as storager from "./storager.js"
import { UidType, ArrangementStore, mergeArrangementStores } from "./storager.js"
import { Mutex } from "../common/mutex.js"
import { RunningState, InternalMessage } from "../common/const.js"


export let isRunning: RunningState = RunningState.NOT_RUNNING;

class RunningError extends Error {}

function assertRunning(): void {
	let err: string;
	switch (isRunning) {
		case RunningState.RUNNING:
			return;
		case RunningState.NOT_RUNNING:
			err = "Main not running!";
			break;
		case RunningState.STARTING:
			err = "Main starting!";
			break;
		case RunningState.STOPPING:
			err = "Main stopping!";
			break;
	}
	throw new RunningError(err);
}

function assertNotRunning(): void {
	let err: string;
	switch (isRunning) {
		case RunningState.NOT_RUNNING:
			return;
		case RunningState.RUNNING:
			err = "Main already running!";
			break;
		case RunningState.STARTING:
			err = "Main starting!";
			break;
		case RunningState.STOPPING:
			err = "Main stopping!";
			break;
	}
	throw new RunningError(err);
}

function changeRunningState(newRunning: RunningState): void {
	isRunning = newRunning;

	const message: InternalMessage = {
		type: "runningChange",
		value: isRunning
	}
	browser.runtime.sendMessage(message).catch(() => {});
}

function warnOnError(f: () => void): boolean {
	try {
		f();
		return false;
	}
	catch (error) {
		console.warn(error.message);
		return true;
	}
}


// let windowCreatedTimeout: number = 40000;
let backupTimeInterval: number = 300000;

let current: ArrangementStore;
let backupTimerIds: number[] = [];

let delay: (t: number) => Promise<unknown> = t => new Promise(resolve => setTimeout(resolve, t));

let preFilterInteresting: {populate: boolean, windowTypes: browser.windows.WindowType[]} = undefined;
	// defaults to {populate: false, windowTypes: ["normal", "panel", "popup"]};
	// TODO?: add devtool windows?
async function isInteresting(wndw: browser.windows.Window): Promise<boolean> {
	return true;
}


let mutex: Mutex = new Mutex();


async function windowCreated(wndw: browser.windows.Window): Promise<void> {
	// await delay(windowCreatedTimeout);

	const id = wndw.id;
	const moveNewWindowsToTopSetting = "settings_moveNewWindowsToTop";
		// TODO: replace using SETTING.MOVE_NEW_WINDOWS_TO_TOP

	await mutex.dispatch(async () => {
		assertRunning();

		const changeOi = new ObserveInfo<CommonIdType>().add(id);
		await Promise.all([
			storager.changeObserved(changeOi),
			(async() => {
				const changed1: Arrangement = await messenger.changeObserved(changeOi);

				let changed = changed1;

				let moveToTop = false;
				const gettingItem = await browser.storage.local.get(moveNewWindowsToTopSetting);
				if (gettingItem.hasOwnProperty(moveNewWindowsToTopSetting))
					moveToTop = gettingItem[moveNewWindowsToTopSetting] as boolean;

				if (moveToTop) {
					const moveToTopArrangement = new Arrangement();
					const topPossition = Possition.copy(changed1.windows.get(id));
					topPossition.moveToTop();
					moveToTopArrangement.addWindow(id, topPossition, changed1.groups.get(topPossition.group));
					const changed2: Arrangement = await messenger.setArrangement(moveToTopArrangement);

					changed = mergeArrangements(changed1, changed2);
				}

				await updateCurrent(changed);
			})(),
		]);
	}, `windowCreated with id: ${id}`);
}

async function windowRemoved(wndwId: number): Promise<void> {
	await mutex.dispatch(async () => {
		assertRunning();

		const changeOi = new ObserveInfo<CommonIdType>().delete(wndwId);
		await Promise.all([
			storager.changeObserved(changeOi),
			messenger.changeObserved(changeOi),
		]);
		current.arrangement.deleteWindow(wndwId);
		current.date = new Date();
		await saveCurrent();
	}, `windowRemoved with id: ${wndwId}`);
}

async function windowsRearranged(e: CustomEvent): Promise<void> {
	await mutex.dispatch(async () => {
		assertRunning();

		const arrangementUpdate: Arrangement = e.detail;
		return updateCurrent(arrangementUpdate);
	}, "windowsRearranged");
}

async function updateCurrent(update: Arrangement | ArrangementStore): Promise<void> {
	// helper function: only used when already <isRunning> and <mutex> locked
	if (update instanceof Arrangement)
		update = new ArrangementStore(update);
	current = mergeArrangementStores(current, update);
	await saveCurrent();
}

async function saveCurrent(): Promise<void> {
	// helper function: only used when already <isRunning> and <mutex> locked
	return storager.saveArrangementStore("$current", current, 1);
}

function appUnexpectedlyDisconnected(e: CustomEvent): void {
	const connectionError: browser.runtime.Port["error"] = e.detail;
	browser.tabs.query({ currentWindow: true, active: true }).then(tabs =>
		browser.tabs.executeScript(
			tabs[0].id,
			{ code: `alert("App stopped: ${connectionError}");` }
		)
	)
	stopMain();
}


async function extensionEnabled(): Promise<void> {
	await mutex.dispatch(async () => {
		browser.runtime.onStartup.addListener(browserStarted);
		await doStartMain();
	}, "extensionEnabled");
}

async function browserStarted(): Promise<void> {
	const loadPreviousOnStartupSetting = "settings_loadPreviousOnStartup";
		// TODO: replace using SETTING.LOAD_PREVIOUS_ON_STARTUP

	await mutex.dispatch(async () => {
		assertRunning();

		let autoLoadPrevious: boolean = true;
		const gettingItem = await browser.storage.local.get(loadPreviousOnStartupSetting);
		if (gettingItem.hasOwnProperty(loadPreviousOnStartupSetting))
			autoLoadPrevious = gettingItem[loadPreviousOnStartupSetting] as boolean;

		if (autoLoadPrevious)
			await tryDoLoadFromMemory("$previous");
	}, "browserStarted");
}

export async function startMain(): Promise<void> {
	await mutex.dispatch(async () => {
		await doStartMain();
	}, "startMain");
}

async function doStartMain(): Promise<void> {
	// helper function: only used when already <mutex> locked
	assertNotRunning();
	changeRunningState(RunningState.STARTING);

	try {
		const allWindows = await browser.windows.getAll(preFilterInteresting);
		const allWindowIds = (await allWindows.asyncFilter(isInteresting)).map(w => w.id);
		const allWindowOi = new ObserveInfo<CommonIdType>().add(allWindowIds);

		messenger.onEvent.addEventListener("unexpectedDisconnection", appUnexpectedlyDisconnected);
		messenger.onEvent.addEventListener("arrangementChanged", windowsRearranged);
		browser.windows.onCreated.addListener(windowCreated);
		browser.windows.onRemoved.addListener(windowRemoved);

		await storager.start();
		messenger.startConnection();

		await storager.changeObserved(allWindowOi);
		const arrangement = await messenger.changeObserved(allWindowOi);
		current = new ArrangementStore(arrangement);

		await storager.copyArrangementStore("$current", "$previous").catch(() => {});
		await storager.saveArrangementStore("$current", current, 1);

		backupTimerIds.push(window.setInterval(() => storager.copyArrangementStore("$current", "$backupLong", 0, 1), backupTimeInterval));
	}
	catch (error) {
		doStopMain();
		changeRunningState(RunningState.NOT_RUNNING);
		throw error;
	}

	changeRunningState(RunningState.RUNNING);
}

export async function stopMain(): Promise<void> {
	await mutex.dispatch(async () => {
		if (warnOnError(assertRunning))
			return;

		changeRunningState(RunningState.STOPPING);

		doStopMain();

		changeRunningState(RunningState.NOT_RUNNING);
	}, "stopMain");
}

function doStopMain(): void {
	// helper function: only used when already <isRunning> and <mutex> locked
	if (storager.isRunning())
		storager.stop();
	if (messenger.isRunning())
		messenger.stopConnection();

	messenger.onEvent.removeEventListener("unexpectedDisconnection", appUnexpectedlyDisconnected);
	messenger.onEvent.removeEventListener("arrangementChanged", windowsRearranged);
	browser.windows.onCreated.removeListener(windowCreated);
	browser.windows.onRemoved.removeListener(windowRemoved);

	for (let timerId of backupTimerIds) {
		window.clearInterval(timerId);
	}
	backupTimerIds = [];
}

export async function switchMain(): Promise<void> {
	if (isRunning == RunningState.NOT_RUNNING)
		await startMain();
	else if (isRunning == RunningState.RUNNING)
		await stopMain();
}


export async function loadFromMemory(name: string, index?: number): Promise<Arrangement> {
	return mutex.dispatch(async () => {
		assertRunning();

		return doLoadFromMemory(name, index);
	}, "loadFromMemory");
}

async function tryDoLoadFromMemory(name: string, index?: number): Promise<Arrangement> {
	// helper function: only used when already <isRunning> and <mutex> locked
	let order: ArrangementStore;
	try {
		order = await storager.loadArrangementStore(name, index);
	}
	catch (error) {
		return;
	}

	return doLoadOrder(order);
}

async function doLoadFromMemory(name: string, index?: number): Promise<Arrangement> {
	// helper function: only used when already <isRunning> and <mutex> locked
	const order = await storager.loadArrangementStore(name, index);
	return doLoadOrder(order);
}

async function doLoadOrder(order: ArrangementStore): Promise<Arrangement> {
	// helper function: only used when already <isRunning> and <mutex> locked
	const moveNewWindowsToTopSetting = "settings_moveNewWindowsToTop";
	// TODO: replace using SETTING.MOVE_NEW_WINDOWS_TO_TOP

	let moveToTop = false;
	const gettingItem = await browser.storage.local.get(moveNewWindowsToTopSetting);
	if (gettingItem.hasOwnProperty(moveNewWindowsToTopSetting))
		moveToTop = gettingItem[moveNewWindowsToTopSetting] as boolean;

	order.arrangement.windows.normalize(moveToTop);
	order.arrangement.groups.normalize(current.arrangement.groups.getMinIndex());

	let changed: Arrangement;
	await Promise.all([
		storager.saveArrangementStore("$auxiliary", current, 1),
		(async() => {
			changed = await messenger.setArrangement(order.arrangement);
		})(),
	])
	await updateCurrent(changed);
	return changed;
}

export async function saveToMemory(name: string, maxSize?: number): Promise<void> {
	await mutex.dispatch<void>(async () => {
		assertRunning();

		await storager.saveArrangementStore(name, current, maxSize);
	}, "saveToMemory");
}

export async function copyInMemory(source: string, destination: string, index?: number, maxSize?: number): Promise<void> {
	// does not have to be <isRunning> to be possible (look at the source at storager.copyArrangementStore)
	await mutex.dispatch<void>(async () => {
		await storager.copyArrangementStore(source, destination, index, maxSize);
	}, "copyInMemory")
}

export async function copyArrayInMemory(source: string, destination: string): Promise<void> {
	// does not have to be <isRunning> to be possible (look at the source at storager.copyArrangementStore)
	await mutex.dispatch<void>(async () => {
		await storager.copyArrangementStoreArray(source, destination);
	}, "copyArrayInMemory")
}

export async function deleteFromMemory(name: string, index?: number): Promise<void> {
	// does not have to be <isRunning> to be possible (look at the source at storager.copyArrangementStore)
	await mutex.dispatch<void>(async () => {
		await storager.deleteArrangementStore(name, index);
	}, "deleteFromMemory");
}

export async function deleteArrayFromMemory(name: string): Promise<void> {
	// does not have to be <isRunning> to be possible (look at the source at storager.copyArrangementStore)
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
	await allWindowIds.asyncForEach(async id => { pairs.push([id, await browser.sessions.getWindowValue(id, storager.CustomIdName) as UidType]); });
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

export function showCurrent(): ArrangementStore {
	return current;
}


extensionEnabled();
