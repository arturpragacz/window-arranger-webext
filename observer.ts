
type CommonIdType = number;
type CustomIdType = string;
type IdType = CommonIdType | CustomIdType;

class ObserveInfo<T extends IdType> {
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

type CustomIdMaker = (commonId: CommonIdType) => Promise<CustomIdType>;
type CommonIdMaker = (customId: CustomIdType) => CommonIdType;

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

class Observer {
	private observed = new Map<CommonIdType, CustomIdType>(); // from ids to customIds
	private observedInverse = new Map<CustomIdType, CommonIdType>(); // from customIds to ids

	async changeObserved(observeInfo: ObserveInfo<CommonIdType>,
	customIdMakerDel: CustomIdMaker = this.asyncGetCustomId, //.bind(this),
	customIdMakerAdd: CustomIdMaker = this.asyncGetCustomId, //.bind(this),
	commonIdMaker: CommonIdMaker = this.getCommonId) //.bind(this))
	: Promise<ObserveInfo<CustomIdType>> {

		customIdMakerDel = customIdMakerDel.bind(this);
		customIdMakerAdd = customIdMakerAdd.bind(this);
		commonIdMaker = commonIdMaker.bind(this);

		let newObserveInfo = new ObserveInfo(observeInfo);
		await newObserveInfo.deleteFromObserved.asyncForEach(async (commonId: CommonIdType, index, array) => {
			let customId: CustomIdType = await customIdMakerDel(commonId).catch(() => undefined); // TODO: why would you ever use a custom one?
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

		await newObserveInfo.addToObserved.asyncForEach(async (commonId: CommonIdType, index, array) => {
			let customId: CustomIdType = await customIdMakerAdd(commonId).catch(() => undefined);
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

	async asyncGetCustomId(commonId: CommonIdType): Promise<CustomIdType> {
		return this.getCustomId(commonId);
	}

	getCustomId(commonId: CommonIdType): CustomIdType {
		return this.observed.get(commonId);
	}

	getCommonId(customId: CustomIdType): CommonIdType {
		return this.observedInverse.get(customId);
	}
}