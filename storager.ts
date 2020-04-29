type uidType = string

interface EscribedArrangementStore {
	arrangement: EscribedArrangement<uidType>;
	date: Date | string;
}

class ArrangementStore {
	public arrangement: Arrangement;
	public date: Date;
	constructor(arrangement: Arrangement, date = new Date()) {
		this.arrangement = arrangement;
		this.date = date;
	}

	async toEscribed(customIdName: CustomIdNameType, customIdMaker: CustomIdMaker<CommonIdType, uidType>): Promise<EscribedArrangementStore> {
		let escribedArrangementStore = {} as EscribedArrangementStore;

		escribedArrangementStore.date = this.date;
		escribedArrangementStore.arrangement = (await this.arrangement.toEscribed(customIdName, customIdMaker)).escribedArrangement;
		//TODO: error handling

		return escribedArrangementStore;
	}

	static parseEscribed(escribedArrangementStore: EscribedArrangementStore, customIdName: CustomIdNameType,
	commonIdMaker: CommonIdMaker<CommonIdType, uidType>): ArrangementStore {

		const date = new Date(escribedArrangementStore.date);
		const arrangement = Arrangement.parseEscribed(escribedArrangementStore.arrangement, customIdName, commonIdMaker).arrangement;
		// TODO: error handling

		return new ArrangementStore(arrangement, date);
	}
}

function mergeArrangementStores(arrSt1: ArrangementStore, arrSt2: ArrangementStore): ArrangementStore {
	return new ArrangementStore(mergeArrangements(arrSt1.arrangement, arrSt2.arrangement), arrSt1.date > arrSt2.date ? arrSt1.date : arrSt2.date);
}

interface Storager {
	showWindowCounter: () => number;
	changeObserved: (observeInfo: ObserveInfo<CommonIdType>) => Promise<void>;
	saveArrangementStore: (name: string, arrangementStore: ArrangementStore, maxSize?: number) => Promise<void>;
	loadArrangementStore: (name: string, index?: number) => Promise<ArrangementStore>;
	copyArrangementStore: (source: string, destination: string, index?: number, maxSize?: number) => Promise<void>;
	copyArrangementStoreArray: (source: string, destination: string) => Promise<void>;
	deleteArrangementStore: (name: string, index?: number) => Promise<void>;
	deleteArrangementStoreArray: (name: string) => Promise<void>;
	start: () => Promise<void>;
	stop: () => void;
}

var storager = {} as Storager;

// TODO: przerobić na klasę?
(function(storager) {

	let running = false;
	let windowCounter: number;
	let observedIdMapper: ObservedIdMapper<CommonIdType, uidType>;
	const STORAGE_PREFIX = "as_"
	const DEFAULT_MAX_SIZE = 10

	function showWindowCounter(): number {
		return windowCounter;
	}

	function getNextUid(): {uid: uidType, save: Promise<void>} {
		let uid = (windowCounter++).toString();
		let save = browser.storage.local.set({windowCounter});
		return {uid, save};
	}

	async function getWindowUid(id: number): Promise<uidType> {
		let uid = await browser.sessions.getWindowValue(id, "uid") as uidType;
		if (uid === undefined) {
			let save: Promise<void>;
			({uid, save} = getNextUid());
			await Promise.all([
				save,
				browser.sessions.setWindowValue(id, "uid", uid.toString()),
			]);
		}
		return uid;
	}
	
	async function changeObserved(observeInfo: ObserveInfo<CommonIdType>): Promise<void> {
		let newObserveInfo: ObserveInfo<uidType> = await observedIdMapper.changeObserved(observeInfo, getWindowUid);
	}
	
	async function saveArrangementStore(name: string, arrangementStore: ArrangementStore, maxSize?: number): Promise<void> {
		name = STORAGE_PREFIX + name;

		let escribedArrangementStoreJSONArray: string[] = [];
		const gettingItem = await browser.storage.local.get(name);
		if (gettingItem.hasOwnProperty(name))
			escribedArrangementStoreJSONArray = gettingItem[name] as string[];

		// TODO: szukanie nie tylko w już observed
		const escribedArrangementStore =
			await arrangementStore.toEscribed("uid", async (id: CommonIdType) => observedIdMapper.getCustomId(id)); //observedIdMapper.asyncGetCustomId.bind(observedIdMapper)
																						// async (id: number) => getWindowUid(id));
		//TODO: error handling
		const escribedArrangementStoreJSON = JSON.stringify(escribedArrangementStore);

		escribedArrangementStoreJSONArray.unshift(escribedArrangementStoreJSON);
		if (maxSize === undefined)
			maxSize = DEFAULT_MAX_SIZE;
		escribedArrangementStoreJSONArray = escribedArrangementStoreJSONArray.slice(0, maxSize);

		await browser.storage.local.set({ [name]: escribedArrangementStoreJSONArray });
	}

	async function loadArrangementStore(name: string, index?: number): Promise<ArrangementStore> {
		name = STORAGE_PREFIX + name;

		const gettingItem = await browser.storage.local.get(name);
		if (!gettingItem.hasOwnProperty(name))
			throw "loadArrangementStore: No such Arrangement Store!";
		const escribedArrangementStoreJSONArray = gettingItem[name] as string[];

		if (index === undefined)
			index = 0;
		
		const escribedArrangementStoreJSON = escribedArrangementStoreJSONArray[index];
		if (escribedArrangementStoreJSON === undefined)
			throw "loadArrangementStore: No such Arrangement Store Index!";
		const escribedArrangementStore = JSON.parse(escribedArrangementStoreJSON) as EscribedArrangementStore;
		// TODO: szukanie nie tylko w już observed???
		return ArrangementStore.parseEscribed(escribedArrangementStore, "uid", observedIdMapper.getCommonId.bind(observedIdMapper));
	}

	async function copyArrangementStore(source: string, destination: string, index?: number, maxSize?: number): Promise<void> {
		source = STORAGE_PREFIX + source;
		destination = STORAGE_PREFIX + destination;

		let gettingItem = await browser.storage.local.get(source);
		if (!gettingItem.hasOwnProperty(source))
			throw "copyArrangementStore: No such Arrangement Store!";
		let escribedArrangementStoreJSONArray = gettingItem[source] as string[];

		if (index === undefined)
			index = 0;
		
		const escribedArrangementStoreJSON = escribedArrangementStoreJSONArray[index];
		if (escribedArrangementStoreJSON === undefined)
			throw "loadArrangementStore: No such Arrangement Store Index!";

		escribedArrangementStoreJSONArray = [];
		gettingItem = await browser.storage.local.get(destination);
		if (gettingItem.hasOwnProperty(destination))
			escribedArrangementStoreJSONArray = gettingItem[destination] as string[];

		escribedArrangementStoreJSONArray.unshift(escribedArrangementStoreJSON);
		if (maxSize === undefined)
			maxSize = DEFAULT_MAX_SIZE;
		escribedArrangementStoreJSONArray = escribedArrangementStoreJSONArray.slice(0, maxSize);

		await browser.storage.local.set({ [destination]: escribedArrangementStoreJSONArray });
	}

	async function copyArrangementStoreArray(source: string, destination: string): Promise<void> {
		source = 'as_' + source;
		destination = 'as_' + destination;

		const gettingItem = await browser.storage.local.get(source);
		if (!gettingItem.hasOwnProperty(source))
			throw "copyArrangementStore: No such Arrangement Store!";
		const escribedArrangementStoreJSONArray = gettingItem[source] as string[];

		await browser.storage.local.set({ [destination]: escribedArrangementStoreJSONArray });
	}

	async function deleteArrangementStore(name: string, index?: number): Promise<void> {
		name = STORAGE_PREFIX + name;

		const gettingItem = await browser.storage.local.get(name);
		if (!gettingItem.hasOwnProperty(name))
			// throw "copyArrangementStore: No such Arrangement Store!";
			return;
		let escribedArrangementStoreJSONArray = gettingItem[name] as string[];

		if (index === undefined)
			index = 0;

		if (escribedArrangementStoreJSONArray[index] === undefined)
			// throw "loadArrangementStore: No such Arrangement Store Index!";
			return;
		escribedArrangementStoreJSONArray.splice(index, 1);

		await browser.storage.local.set({ [name]: escribedArrangementStoreJSONArray });
	}

	async function deleteArrangementStoreArray(name: string): Promise<void> {
		name = STORAGE_PREFIX + name;
		await browser.storage.local.remove(name);
	}

	async function start(): Promise<void> {
		if (!running) {
			await Promise.all([
				(async() => {
					windowCounter = (await browser.storage.local.get("windowCounter")).windowCounter as number;
					if (windowCounter === undefined) {
						windowCounter = 1;
						await browser.storage.local.set({ windowCounter });
					}
				})(),
				
				(async() => {
					let orderFromMemory; // chyba niepotrzebne
				})()
			]);
			running = true;
			observedIdMapper = new ObservedIdMapper();
		}
		else
			console.log("Storager already running!");
	}

	function stop(): void {
		if (running) {
			running = false;
		}
		else
			console.log("No running Storager!");
	}

	storager.showWindowCounter = showWindowCounter;
	storager.changeObserved = changeObserved;
	storager.saveArrangementStore = saveArrangementStore;
	storager.loadArrangementStore = loadArrangementStore;
	storager.copyArrangementStore = copyArrangementStore;
	storager.copyArrangementStoreArray = copyArrangementStoreArray;
	storager.deleteArrangementStore = deleteArrangementStore;
	storager.deleteArrangementStoreArray = deleteArrangementStoreArray;
	storager.start = start;
	storager.stop = stop;

})(storager);

