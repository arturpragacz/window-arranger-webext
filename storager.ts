
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

(function(w) {

	let windowCounter: number;
	let observer = new Observer();

	async function init(): Promise<void> {
		await Promise.all([
			(async() => {
				let windowCounter = (await browser.storage.local.get("windowCounter")).windowCounter;
				if (windowCounter === undefined) {
					windowCounter = 1;
					await browser.storage.local.set({windowCounter});
				}
			})(),
			
			(async() => {
				let orderFromMemory; //TODO
			})()
		])
	}

	function getNextUid(): {uid: string, save: Promise<void>} {
		let uid = (windowCounter++).toString();
		let save = browser.storage.local.set({windowCounter});
		return {uid, save};
	}

	async function getWindowUid(id: number): Promise<string> {
		let uid = await browser.sessions.getWindowValue(id, "uid") as string;
		if (uid == undefined) {
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
	
	async function saveArrangementStore(arrangementStore: ArrangementStore, name: string) {
		// TODO: szukanie nie tylko w już observed
		const escribedArrangementStore =
			await arrangementStore.toEscribed("uid", async (id: number) => observer.getCustomId(id)); //observer.asyncGetCustomId
			                                      // async (id: number) => getWindowUid(id));
		const escribedArrangementStoreJSON = JSON.stringify(escribedArrangementStore);
		await browser.storage.local.set({name: escribedArrangementStoreJSON});
	}

	async function loadArrangementStore(name: string): Promise<ArrangementStore> {
		const escribedArrangementStoreJSON = (await browser.storage.local.get(name)).name as string;
		if (escribedArrangementStoreJSON == undefined) {
			// throw 'No Arrangement Store!';
			return undefined;
		}
		else {
			const escribedArrangementStore = JSON.parse(escribedArrangementStoreJSON) as EscribedArrangementStore;
			// TODO: szukanie nie tylko w już observed???
			return ArrangementStore.parseEscribed(escribedArrangementStore, "uid", observer.getCommonId);
		}
	}

	w['storage'] = {
		init,
		changeObserved,
		saveArrangementStore,
		loadArrangementStore,
	}
})(window);

