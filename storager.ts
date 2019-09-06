
interface EscribedArrangementStore {
	arrangement: EscribedArrangement;
	date: Date | string;
}

class ArrangementStore {
	public arrangement: Arrangement;
	public date: Date;
	constructor(arrangement: Arrangement, date = new Date()) {
		this.arrangement = arrangement;
		this.date = date;
	}

	async toEscribed(customIdName: string, customIdMaker: CustomIdMaker): Promise<EscribedArrangementStore> {
		let escribedArrangementStore = {} as EscribedArrangementStore;

		escribedArrangementStore.date = this.date;
		escribedArrangementStore.arrangement = await this.arrangement.toEscribed(customIdName, customIdMaker);

		return escribedArrangementStore;
	}

	static parseEscribed(escribedArrangementStore: EscribedArrangementStore, customIdName: string,
	commonIdMaker: CommonIdMaker): ArrangementStore {

		const date = new Date(escribedArrangementStore.date);
		const arrangement = Arrangement.parseEscribed(escribedArrangementStore.arrangement, customIdName, commonIdMaker);

		return new ArrangementStore(arrangement, date);
	}
}

function mergeArrangementStores(arrSt1: ArrangementStore, arrSt2: ArrangementStore): ArrangementStore {
	return new ArrangementStore(mergeArrangements(arrSt1.arrangement, arrSt2.arrangement), arrSt2.date);
}

interface Storager {
	changeObserved: (observeInfo: ObserveInfo) => Promise<void>;
	saveArrangementStore: (name: string, arrangementStore: ArrangementStore) => Promise<void>;
	loadArrangementStore: (name: string) => Promise<ArrangementStore>;
	copyArrangementStore: (oldName: string, newName: string) => Promise<void>;
	start: () => Promise<void>;
	stop: () => void;
}

var storager = {} as Storager;

// TODO: przerobić na klasę?
(function(storager) {

	let running = false;
	let windowCounter: number;
	let observer: Observer;

	function getNextUid(): {uid: string, save: Promise<void>} {
		let uid = (windowCounter++).toString();
		let save = browser.storage.local.set({windowCounter});
		return {uid, save};
	}

	async function getWindowUid(id: number): Promise<string> {
		let uid = await browser.sessions.getWindowValue(id, "uid") as string;
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
	
	async function changeObserved(observeInfo: ObserveInfo): Promise<void> {
		let newObserveInfo: ObserveInfo = await observer.changeObserved(observeInfo, undefined, getWindowUid);
	}
	
	async function saveArrangementStore(name: string, arrangementStore: ArrangementStore): Promise<void> {
		name = 'as' + name;
		// TODO: szukanie nie tylko w już observed
		const escribedArrangementStore =
			await arrangementStore.toEscribed("uid", async (id: number) => observer.getCustomId(id)); //observer.asyncGetCustomId.bind(observer)
			                                      // async (id: number) => getWindowUid(id));
		const escribedArrangementStoreJSON = JSON.stringify(escribedArrangementStore);
		await browser.storage.local.set({ [name]: escribedArrangementStoreJSON });
	}

	async function loadArrangementStore(name: string): Promise<ArrangementStore> {
		name = 'as' + name;

		const gettingItem = await browser.storage.local.get(name);
		if (!gettingItem.hasOwnProperty(name))
			throw "No such Arrangement Store!";

		const escribedArrangementStoreJSON = gettingItem[name] as string;
		if (escribedArrangementStoreJSON === undefined) {
			// throw 'No Arrangement Store!';
			return undefined;
		}
		else {
			const escribedArrangementStore = JSON.parse(escribedArrangementStoreJSON) as EscribedArrangementStore;
			// TODO: szukanie nie tylko w już observed???
			return ArrangementStore.parseEscribed(escribedArrangementStore, "uid", observer.getCommonId.bind(observer));
		}
	}

	async function copyArrangementStore(source: string, destination: string): Promise<void> {
		source = 'as' + source;
		destination = 'as' + destination;

		const gettingItem = await browser.storage.local.get(source);
		if (!gettingItem.hasOwnProperty(source))
			throw "No such Arrangement Store!";

		const escribedArrangementStoreJSON = gettingItem[source] as string;
		await browser.storage.local.set({ [destination]: escribedArrangementStoreJSON });
	}

	// async function saveArrangementStorePrefix(arrangementStore: ArrangementStore): Promise<void> {
	// 	// TODO: lepsza wersja zoptymalizowana (wszystkie properties w osobnych polach)
	// 	await saveArrangementStore(currentArrangementStore, "$current");
	// }

	// async function loadArrangementStorePrefix(name: string): Promise<ArrangementStore> {
	// 	// TODO: lepsza wersja zoptymalizowana (wszystkie properties w osobnych polach)
	// 	return loadArrangementStore("$current");
	// }

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
			observer = new Observer();
		}
		else
			console.log("Storager already running!");
	}

	function stop() {
		if (running) {
			running = false;
		}
		else
			console.log("No running Storager!");
	}

	storager.changeObserved = changeObserved;
	storager.saveArrangementStore = saveArrangementStore;
	storager.loadArrangementStore = loadArrangementStore;
	storager.copyArrangementStore = copyArrangementStore;
	storager.start = start;
	storager.stop = stop;

})(storager);

