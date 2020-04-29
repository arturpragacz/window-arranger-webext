class ObserveInfo<T> {
	public deleteFromObserved: T[] = [];
	public addToObserved: T[] = [];

	constructor(oi?: ObserveInfo<T>) {
		if (oi !== undefined) {
			this.deleteFromObserved = Array.from(oi.deleteFromObserved);
			this.addToObserved = Array.from(oi.addToObserved);
		}
	}

	add(ids: Array<T> | T) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}
		this.addToObserved.push(...ids);
		return this;
	}

	delete(ids: Array<T> | T) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}
		this.deleteFromObserved.push(...ids);
		return this;
	}
}

type CustomIdMaker<ObserveCommonIdType, ObserveCustomIdType> = (commonId: ObserveCommonIdType) => Promise<ObserveCustomIdType>;
type CommonIdMaker<ObserveCommonIdType, ObserveCustomIdType> = (customId: ObserveCustomIdType) => ObserveCommonIdType;

interface Array<T> {
	/**
	* Performs the specified action for each element in an array in an asynchronous way.
	* @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
	* @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
	*/
	asyncForEach(callbackfn: (value: T, index: number, array: T[]) => Promise<void>, thisArg?: any): Promise<void>;
	/**
	* Returns the elements of an array that meet the condition specified in an asynchronous callback function.
	* @param callbackfn A function that accepts up to three arguments. The filter method calls the callbackfn function one time for each element in the array.
	* @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
	*/
	asyncFilter(callbackfn: (value: T, index: number, array: ReadonlyArray<T>) => Promise<unknown>, thisArg?: any): Promise<T[]>;    /**
	/**
	* Calls a defined asynchronous callback function on each element of an array, and returns an array that contains the results.
	* @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
	* @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
	*/
	asyncMap<U>(callbackfn: (value: T, index: number, array: T[]) => Promise<U>, thisArg?: any): Promise<U[]>;
}

if (!Array.prototype.asyncForEach) {
	Array.prototype.asyncForEach = async function (callback, thisArg) {
		for (var i = 0; i < this.length; ++i) {
			await callback.call(thisArg, this[i], i, this);
		}
	};
}

if (!Array.prototype.asyncFilter) {
	Array.prototype.asyncFilter = async function (callback, thisArg) {
		const filtered = [];
		for (var i = 0; i < this.length; ++i) {
			if (await callback.call(thisArg, this[i], i, this))
				filtered.push(this[i]);
		}
		return filtered;
	};
}

if (!Array.prototype.asyncMap) {
	Array.prototype.asyncMap = async function (callback, thisArg) {
		const mapped = [];
		for (var i = 0; i < this.length; ++i) {
			mapped.push(await callback.call(thisArg, this[i], i, this));
		}
		return mapped;
	};
}

class ObservedIdMapper<ObserveCommonIdType, ObserveCustomIdType> {
	private observed = new Map<ObserveCommonIdType, ObserveCustomIdType>(); // from ids to customIds
	private observedInverse = new Map<ObserveCustomIdType, ObserveCommonIdType>(); // from customIds to ids

	async changeObserved(observeInfo: ObserveInfo<ObserveCommonIdType>,
	customIdMaker: CustomIdMaker<ObserveCommonIdType, ObserveCustomIdType>,
	) : Promise<ObserveInfo<ObserveCustomIdType>> {

		let newObserveInfo = new ObserveInfo(observeInfo);
		await newObserveInfo.deleteFromObserved.asyncForEach(async (commonId: ObserveCommonIdType, index, array) => {
			let customId: ObserveCustomIdType = this.getCustomId(commonId);
			if (customId === undefined) {
				array[index] = undefined;
			}
			else {
				(array[index] as any) = customId; // HACK!
				this.observed.delete(commonId);
				this.observedInverse.delete(customId);
			}
		});
		// newObserveInfo.deleteFromObserved = newObserveInfo.deleteFromObserved.filter(x => x !== undefined);

		await newObserveInfo.addToObserved.asyncForEach(async (commonId: ObserveCommonIdType, index, array) => {
			let customId: ObserveCustomIdType = await customIdMaker(commonId).catch(() => undefined);
			if (customId === undefined) {
				array[index] = undefined;
			}
			else {
				(array[index] as any) = customId; // HACK!
				this.observed.set(commonId, customId);
				this.observedInverse.set(customId, commonId);
			}
		});
		// newObserveInfo.addToObserved = newObserveInfo.addToObserved.filter(x => x !== undefined);

		return newObserveInfo as any; // HACK!
	}

	getCustomId(commonId: ObserveCommonIdType): ObserveCustomIdType {
		return this.observed.get(commonId);
	}

	getCommonId(customId: ObserveCustomIdType): ObserveCommonIdType {
		return this.observedInverse.get(customId);
	}
}