(function(w) {

	let windowCounter;

	async function init() {
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

	function getNextUid() {
		let uid = (windowCounter++).toString();
		let save = browser.storage.local.set({windowCounter});
		return {uid, save};
	}

	async function getWindowUid(id) {
		let uid = await browser.sessions.getWindowValue(id, "uid");
		if (uid == undefined) {
			let save;
			({uid, save} = getNextUid());
			await Promise.all([
				save,
				browser.sessions.setWindowValue(id, "uid", uid.toString()),
			]);
		}
		return uid;
	}
	
	class ArrangementStore {
		arrangement: Arrangement;
		date: Date;
		constructor(arrangement: Arrangement, date = new Date()) {
			this.arrangement = arrangement;
			this.date = date;
		}

		static fromJSON(JSONedArrangementStore: string): ArrangementStore {
			let arrangement = JSON.parse(JSONedArrangementStore);
			arrangement.date = new Date(arrangement.date);
			// TODO: ewentualnie przekonwertować też Arrangement from JSON (ale działa bez teraz, bo same proste properties)
			Object.setPrototypeOf(arrangement, ArrangementStore.prototype);
			return arrangement;
		}
	}

	async function saveArrangement(arrangement: Arrangement, name: string) {
		let JSONedArrangementStore = JSON.stringify(new ArrangementStore(arrangement));
		await browser.storage.local.set({name: JSONedArrangementStore});
	}

	async function loadArrangement(name: string): Promise<Arrangement> {
		let JSONedArrangementStore = (await browser.storage.local.get(name))[name] as string;
		if (JSONedArrangementStore == undefined) {
			return undefined;
		}
		else {
			return ArrangementStore.fromJSON(JSONedArrangementStore).arrangement;
		}
		
	}

	w['storage'] = {
		init,
		saveArrangement,
		loadArrangement,
	}
})(window);

