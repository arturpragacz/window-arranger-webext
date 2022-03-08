import { ObserveInfo, CustomIdMaker, CommonIdMaker, ObservedIdMapper } from "./observeInfo.js"
import { CommonIdType, SerializableArrangement, Arrangement, mergeArrangements } from "./arrangement.js"

export type UidType = string
export const CustomIdName = "uid";
type CustomIdName = typeof CustomIdName;

interface UidArrangementStore {
	arrangement: SerializableArrangement<CustomIdName, UidType>;
	date: Date | string;
}

export class ArrangementStore {
	public arrangement: Arrangement;
	public date: Date;
	constructor(arrangement: Arrangement, date = new Date()) {
		this.arrangement = arrangement;
		this.date = date;
	}

	toUid(customIdMaker: CustomIdMaker<CommonIdType, UidType>): UidArrangementStore {
		const date = this.date;
		const {serializableArrangement: arrangement, idsFailedConversion} = this.arrangement.serialize(CustomIdName, customIdMaker);
		if (idsFailedConversion.size > 0)
			console.warn(idsFailedConversion);

		let uidArrangementStore: UidArrangementStore = {arrangement, date};

		return uidArrangementStore;
	}

	static fromUid(uidArrangementStore: UidArrangementStore, commonIdMaker: CommonIdMaker<CommonIdType, UidType>): ArrangementStore {
		const date = new Date(uidArrangementStore.date);
		const {arrangement, idsFailedConversion} = Arrangement.deserialize(uidArrangementStore.arrangement, CustomIdName, commonIdMaker);
		if (idsFailedConversion.size > 0)
			console.warn(idsFailedConversion);

		return new ArrangementStore(arrangement, date);
	}
}

export function mergeArrangementStores(arrSt1: ArrangementStore, arrSt2: ArrangementStore): ArrangementStore {
	return new ArrangementStore(mergeArrangements(arrSt1.arrangement, arrSt2.arrangement), arrSt1.date > arrSt2.date ? arrSt1.date : arrSt2.date);
}


let running = false;
let windowCounter: number;
let observedIdMapper: ObservedIdMapper<CommonIdType, UidType>;
const STORAGE_PREFIX = "as_"
const DEFAULT_MAX_SIZE = 10

export function showWindowCounter(): number {
	return windowCounter;
}

function getNextUid(): {uid: UidType, save: Promise<void>} {
	let uid = (windowCounter++).toString();
	let save = browser.storage.local.set({windowCounter});
	return {uid, save};
}

async function getWindowUid(id: number): Promise<UidType> {
	let uid = await browser.sessions.getWindowValue(id, CustomIdName) as UidType;
	if (uid === undefined) {
		let save: Promise<void>;
		({uid, save} = getNextUid());
		console.debug("Granting uid: ", uid, " to a window with id: ", id);
		await Promise.all([
			save,
			browser.sessions.setWindowValue(id, CustomIdName, uid.toString()),
		]);
	}
	return uid;
}

export async function changeObserved(observeInfo: ObserveInfo<CommonIdType>): Promise<void> {
	let newObserveInfo: ObserveInfo<UidType> = await observedIdMapper.changeObserved(observeInfo, getWindowUid);
}

export async function saveArrangementStore(name: string, arrangementStore: ArrangementStore, maxSize?: number): Promise<void> {
	name = STORAGE_PREFIX + name;

	let uidArrangementStoreJSONArray: string[] = [];
	const gettingItem = await browser.storage.local.get(name);
	if (gettingItem.hasOwnProperty(name))
		uidArrangementStoreJSONArray = gettingItem[name] as string[];

	const getCustomId: (commonId: CommonIdType) => UidType = observedIdMapper.getCustomId.bind(observedIdMapper);
	const uidArrangementStore = arrangementStore.toUid(getCustomId);

	const uidArrangementStoreJSON = JSON.stringify(uidArrangementStore);

	uidArrangementStoreJSONArray.unshift(uidArrangementStoreJSON);
	if (maxSize === undefined)
		maxSize = DEFAULT_MAX_SIZE;
	uidArrangementStoreJSONArray = uidArrangementStoreJSONArray.slice(0, maxSize);

	await browser.storage.local.set({ [name]: uidArrangementStoreJSONArray });
}

export async function loadArrangementStore(name: string, index?: number): Promise<ArrangementStore> {
	name = STORAGE_PREFIX + name;

	const gettingItem = await browser.storage.local.get(name);
	if (!gettingItem.hasOwnProperty(name))
		throw new Error("loadArrangementStore: No such Arrangement Store!");
	const uidArrangementStoreJSONArray = gettingItem[name] as string[];

	if (index === undefined)
		index = 0;

	const uidArrangementStoreJSON = uidArrangementStoreJSONArray[index];
	if (uidArrangementStoreJSON === undefined)
		throw new Error("loadArrangementStore: No such Arrangement Store Index!");
	const uidArrangementStore = JSON.parse(uidArrangementStoreJSON) as UidArrangementStore;

	return ArrangementStore.fromUid(uidArrangementStore, observedIdMapper.getCommonId.bind(observedIdMapper));
}

export async function copyArrangementStore(source: string, destination: string, index?: number, maxSize?: number): Promise<void> {
	source = STORAGE_PREFIX + source;
	destination = STORAGE_PREFIX + destination;

	let gettingItem = await browser.storage.local.get(source);
	if (!gettingItem.hasOwnProperty(source))
		throw new Error("copyArrangementStore: No such Arrangement Store!");
	let uidArrangementStoreJSONArray = gettingItem[source] as string[];

	if (index === undefined)
		index = 0;

	const uidArrangementStoreJSON = uidArrangementStoreJSONArray[index];
	if (uidArrangementStoreJSON === undefined)
		throw new Error("loadArrangementStore: No such Arrangement Store Index!");

	uidArrangementStoreJSONArray = [];
	gettingItem = await browser.storage.local.get(destination);
	if (gettingItem.hasOwnProperty(destination))
		uidArrangementStoreJSONArray = gettingItem[destination] as string[];

	uidArrangementStoreJSONArray.unshift(uidArrangementStoreJSON);
	if (maxSize === undefined)
		maxSize = DEFAULT_MAX_SIZE;
	uidArrangementStoreJSONArray = uidArrangementStoreJSONArray.slice(0, maxSize);

	await browser.storage.local.set({ [destination]: uidArrangementStoreJSONArray });
}

export async function copyArrangementStoreArray(source: string, destination: string): Promise<void> {
	source = "as_" + source;
	destination = "as_" + destination;

	const gettingItem = await browser.storage.local.get(source);
	if (!gettingItem.hasOwnProperty(source))
		throw new Error("copyArrangementStore: No such Arrangement Store!");
	const uidArrangementStoreJSONArray = gettingItem[source] as string[];

	await browser.storage.local.set({ [destination]: uidArrangementStoreJSONArray });
}

export async function deleteArrangementStore(name: string, index?: number): Promise<void> {
	name = STORAGE_PREFIX + name;

	const gettingItem = await browser.storage.local.get(name);
	if (!gettingItem.hasOwnProperty(name))
		throw new Error("copyArrangementStore: No such Arrangement Store!");
	let uidArrangementStoreJSONArray = gettingItem[name] as string[];

	if (index === undefined)
		index = 0;

	if (uidArrangementStoreJSONArray[index] === undefined)
		throw new Error("loadArrangementStore: No such Arrangement Store Index!");
	uidArrangementStoreJSONArray.splice(index, 1);

	await browser.storage.local.set({ [name]: uidArrangementStoreJSONArray });
}

export async function deleteArrangementStoreArray(name: string): Promise<void> {
	name = STORAGE_PREFIX + name;
	await browser.storage.local.remove(name);
}

export async function start(): Promise<void> {
	if (!running) {
		windowCounter = (await browser.storage.local.get("windowCounter")).windowCounter as number;
		if (windowCounter === undefined) {
			windowCounter = 1;
			await browser.storage.local.set({ windowCounter });
		}
		running = true;
		observedIdMapper = new ObservedIdMapper();
	}
	else
		console.warn("Storager already running!");
}

export function stop(): void {
	if (running) {
		running = false;
	}
	else
		console.warn("No running Storager!");
}

export function isRunning(): boolean {
	return running;
}
