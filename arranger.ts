class Possition {
	inDefaultGroup: boolean;
	group: any;
	index: any;
	constructor(inDefaultGroup, group, index) {
		this.inDefaultGroup = inDefaultGroup;
		this.group = group;
		this.index = index;
	}

	moveToTop() {
		return new Possition(this.inDefaultGroup, this.group, 0);
	}
}

type EscribedArrangement = Array<{position: Possition}>; //[customIdName: CustomIdNameType]: CustomIdType, 

class Arrangement extends Map<CommonIdType, Possition> {
	async toEscribed(customIdName: CustomIdNameType, customIdMaker: CustomIdMaker): Promise<EscribedArrangement> {
		let escribedArrangement = [] as EscribedArrangement;

		for (let posId of this) {
			let id = posId[0];
			let customId: CustomIdType = await customIdMaker(id).catch(() => undefined);
			if (customId !== undefined) {
				escribedArrangement.push({ [customIdName]: customId, position: posId[1] });
			}
		}

		return escribedArrangement;
	}

	static parseEscribed(escribedArrangement: EscribedArrangement, customIdName: CustomIdNameType,
	commonIdMaker: CommonIdMaker): Arrangement {

		let arrangement = new Arrangement();

		for (let posWindow of escribedArrangement) {
			Object.setPrototypeOf(posWindow.position, Possition.prototype);
			const customId: CustomIdType = posWindow[customIdName];
			let commonId: CommonIdType = commonIdMaker(customId);
			if (commonId !== undefined) {
				arrangement.set(commonId, posWindow.position);
			}
			else {
				if (arrangement['customIdsFailedConversion'] === undefined)
					arrangement['customIdsFailedConversion'] = new Map();
				arrangement['customIdsFailedConversion'].set(customId, posWindow.position);
			}
		}

		return arrangement;
	}
}

// TODO: type-safe Arrangement With Failed Conversion
// class ArrangementWithFailedConversion extends Arrangement {
// 	customIdsFailedConversion: Map<CustomIdType, Position>;
// }

function mergeArrangements(arr1: Arrangement, arr2: Arrangement): Arrangement {
	return new Arrangement(function*() { yield* arr1; yield* arr2; }());
}

declare namespace browser.windowsExt {
	function getNative(id: number): Promise<{handle: string}>;
}

interface Arranger {
	changeObserved: (observeInfo: ObserveInfo<CommonIdType>) => Promise<Arrangement>;
	getArrangement: (idArray: CommonIdType[]) => Promise<Arrangement>;
	setArrangement: (arrangement: Arrangement) => Promise<Arrangement>;
	onArrangementChanged: EventTarget;
	startConnection: () => void;
	stopConnection: () => void;
}

var arranger = {} as Arranger;

// TODO: przerobić na klasę?
(function(arranger) {

	let appName = "window_arranger";
	let port: browser.runtime.Port;
	let runningConnection = false;
	let messageIdCounter: number;
	let observer: Observer;

	class Message {
		source: string;
		id: number;
		type: string;
		value: any;
		constructor(source, id, type, value) {
			this.source = source;
			this.id = id;
			this.type = type;
			this.value = value;
		}
	}

	interface ResponseMessage extends Message {
		status: string;
	}

	async function sendMessage(type: "changeObserved", value: ObserveInfo<CustomIdType>): Promise<EscribedArrangement>;
	async function sendMessage(type: "getArrangement", value: string | CustomIdType[]): Promise<EscribedArrangement>;
	async function sendMessage(type: "setArrangement", value: EscribedArrangement): Promise<EscribedArrangement>;
	// async function sendMessage(type: "updateArrangement", value: any): Promise<EscribedArrangement>; // TODO: czy na pewno any? (popatrz w źródło aplikacji)
	async function sendMessage(type: string, value: any): Promise<any> {
		return new Promise(function (resolve, reject) {
			let messageId = messageIdCounter++;
			port.onMessage.addListener(function callback(response: ResponseMessage) {
				if (response.source === "browser" && response.id === messageId && response.type === "response") {
					port.onMessage.removeListener(callback);
					if (response.status === "OK" && "value" in response) {
						resolve(response.value);
					}
				}
			});
			port.postMessage(new Message("browser", messageId, type, value));
		});
	}

  async function changeObserved(observeInfo: ObserveInfo<CommonIdType>): Promise<Arrangement> {
		let newObserveInfo: ObserveInfo<CustomIdType> = await observer.changeObserved(observeInfo, undefined,
			async id => (await browser.windowsExt.getNative(id)).handle);
			// async id => {let { handle } = await browser.windowsExt.getNative(id); return handle});
		
		newObserveInfo.deleteFromObserved = newObserveInfo.deleteFromObserved.filter(x => x !== undefined);
		newObserveInfo.addToObserved = newObserveInfo.addToObserved.filter(x => x !== undefined);

		return Arrangement.parseEscribed(await sendMessage("changeObserved", newObserveInfo) as EscribedArrangement,
			"handle", (customId: CustomIdType) => observer.getCommonId(customId)); // to samo co: observer.getCommonId.bind(observer)
	}

  async function getArrangement(idArray: CommonIdType[]): Promise<Arrangement> {
		let filterHandles = true;
		if (idArray === undefined) {
			filterHandles = false;
		}
		
		let value: string | CustomIdType[];
		if (filterHandles) {
			let handleArray: CustomIdType[] = [];
			for (let id of idArray) {
				// TODO: szukanie nie tylko w już observed
				let handle: CustomIdType = observer.getCustomId(id);
				if (handle !== undefined) {
					handleArray.push(handle);
				}
			}
			value = handleArray;
		}
		else {
			value = "all";
		}

		// TODO: szukanie nie tylko w już observed
		return Arrangement.parseEscribed(await sendMessage("getArrangement", value), "handle", observer.getCommonId.bind(observer));
	}

	async function setArrangement(arrangement: Arrangement): Promise<Arrangement> {
		// TODO: szukanie nie tylko w już observed
		const escribedArrangement: EscribedArrangement =
			await arrangement.toEscribed("handle", async (id: CommonIdType) => observer.getCustomId(id)); //observer.asyncGetCustomId.bind(observer)
		const responseEscribedArrangement: EscribedArrangement = await sendMessage("setArrangement", escribedArrangement);
		// TODO: szukanie nie tylko w już observed
		return Arrangement.parseEscribed(responseEscribedArrangement, "handle", observer.getCommonId.bind(observer));
	}

	// TODO:
	// async function updateArrangement(arrangement: Arrangement): Promise<Arrangement> {
	// }

	let onArrangementChanged = new EventTarget();
	function handleMessageFromApp(message: ResponseMessage) {
		if (message.status === "OK" && message.type === "arrangementChanged") {
			const value = Arrangement.parseEscribed(message.value, "handle", observer.getCommonId.bind(observer));
			const event = new CustomEvent(message.type, { detail: value });
			onArrangementChanged.dispatchEvent(event);
		}
	}

	function startConnection(): void {
		if (!runningConnection) {
			port = browser.runtime.connectNative(appName);
			port.onMessage.addListener((message: ResponseMessage) => {
				if (message.source === "app") {
					handleMessageFromApp(message);
				}
			});
			runningConnection = true;
			messageIdCounter = 1;
			observer = new Observer();
		}
		else
			console.log("Connection already running!");
	}

	function stopConnection(): void {
		if (runningConnection) {
			port.disconnect();
			runningConnection = false;
		}
		else
			console.log("No running connection!");
	}

	arranger.changeObserved = changeObserved;
	arranger.getArrangement = getArrangement;
	arranger.setArrangement = setArrangement;
	arranger.onArrangementChanged = onArrangementChanged;
	arranger.startConnection = startConnection;
	arranger.stopConnection = stopConnection;

})(arranger);
