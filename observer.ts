class ObserveInfo {
	public deleteFromObserved: (number | string)[] = [];
	public addToObserved: (number | string)[] = [];

	constructor(oi?: ObserveInfo) {
		if (oi !== undefined) {
			this.deleteFromObserved = Array.from(oi.deleteFromObserved);
			this.addToObserved = Array.from(oi.addToObserved);
		}
	}

	add(ids: Array<number | string> | number | string) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}
		this.addToObserved.push(...ids);
		return this;
	}

	delete(ids: Array<number | string> | number | string) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}
		this.deleteFromObserved.push(...ids);
		return this;
	}
}

type CustomIdMaker = (commonId: number) => Promise<string>;
type CommonIdMaker = (customId: string) => number;

interface Array<T> {
	/**
	* Performs the specified action for each element in an array in an asynchronous way.
	* @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
	* @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
	*/
	asyncForEach(callbackfn: (value: T, index: number, array: T[]) => Promise<void>, thisArg?: any): Promise<void>;
}

if (!Array.prototype.asyncForEach) {
	Array.prototype.asyncForEach = async function (callback, thisArg) {
		for (var i = 0; i < this.length; ++i) {
			await callback.call(thisArg, this[i], i, this);
		}
	};
}

class Observer {
	private observed = new Map<number, string>(); // from ids to customIds
	private observedInverse = new Map<string, number>(); // from customIds to ids

	async changeObserved(observeInfo: ObserveInfo,
	customIdMakerDel: CustomIdMaker = this.asyncGetCustomId, //.bind(this),
	customIdMakerAdd: CustomIdMaker = this.asyncGetCustomId, //.bind(this),
	commonIdMaker: CommonIdMaker = this.getCommonId) //.bind(this))
	: Promise<ObserveInfo> {

		customIdMakerDel = customIdMakerDel.bind(this);
		customIdMakerAdd = customIdMakerAdd.bind(this);
		commonIdMaker = commonIdMaker.bind(this);

		let newObserveInfo = new ObserveInfo(observeInfo);
		await newObserveInfo.deleteFromObserved.asyncForEach(async (commonId: number, index, array) => {
			let customId: string = await customIdMakerDel(commonId).catch(() => undefined); // TODO: why would you ever use a custom one?
			if (customId === undefined) {
				array[index] = undefined;
			}
			else {
				array[index] = customId;
				this.observed.delete(commonId);
				this.observedInverse.delete(customId);
			}
		});
		// newObserveInfo.deleteFromObserved = newObserveInfo.deleteFromObserved.filter(x => x !== undefined);

		await newObserveInfo.addToObserved.asyncForEach(async (commonId: number, index, array) => {
			let customId: string = await customIdMakerAdd(commonId).catch(() => undefined);
			if (customId === undefined) {
				array[index] = undefined;
			}
			else {
				array[index] = customId;
				this.observed.set(commonId, customId);
				this.observedInverse.set(customId, commonId);
			}
		});
		// newObserveInfo.addToObserved = newObserveInfo.addToObserved.filter(x => x !== undefined);

		return newObserveInfo;
	}

	async asyncGetCustomId(commonId: number): Promise<string> {
		return this.getCustomId(commonId);
	}

	getCustomId(commonId: number): string {
		return this.observed.get(commonId);
	}

	getCommonId(customId: string): number {
		return this.observedInverse.get(customId);
	}
}