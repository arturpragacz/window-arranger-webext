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

type EscribedArrangement = Array<{position: Possition}>; //[customIdName: string]: any, 

class Arrangement extends Map<number, Possition> {
	async toEscribed(customIdName: string, customIdMaker: CustomIdMaker): Promise<EscribedArrangement> {
		let escribedArrangement = [] as EscribedArrangement;

		for (let posId of this) {
			let id = posId[0];
			let customId: string = await customIdMaker(id).catch(() => undefined);
			if (customId != undefined) {
				escribedArrangement.push({ [customIdName]: customId, position: posId[1] });
			}
		}

		return escribedArrangement;
	}

	static parseEscribed(escribedArrangement: EscribedArrangement, customIdName: string,
	commonIdMaker: CommonIdMaker): Arrangement {

		let arrangement = new Arrangement();

		for (let posWindow of escribedArrangement) {
			Object.setPrototypeOf(posWindow.position, Possition.prototype);
			const customId: string = posWindow[customIdName];
			let commonId: number = commonIdMaker(customId);
			if (commonId != undefined) {
				arrangement.set(commonId, posWindow.position);
			}
			else {
				if (arrangement['customIdsFailedConversion'] == undefined)
					arrangement['customIdsFailedConversion'] = new Map();
				arrangement['customIdsFailedConversion'].set(customId, posWindow.position);
			}
		}

		return arrangement;
	}
}

// class ArrangementWithFailedConversion extends Arrangement {
// 	customIdsFailedConversion: Map<string, Position>;
// }

declare namespace browser.windowsExt {
	function getNative(id: number): Promise<{handle: string}>;
}

(function(w) {

	let appName = "window_arranger";
	let port: browser.runtime.Port;
	let runningConnection = false;
	let messageIdCounter = 1;
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

	async function sendMessage(type: "changeObserved", value: ObserveInfo): Promise<EscribedArrangement>;
	async function sendMessage(type: "getArrangement", value: string | string[]): Promise<EscribedArrangement>;
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

  async function changeObserved(observeInfo: ObserveInfo): Promise<Arrangement> {
		let newObserveInfo: ObserveInfo = await observer.changeObserved(observeInfo, undefined,
			async id => (await browser.windowsExt.getNative(id)).handle);
			// async id => {let { handle } = await browser.windowsExt.getNative(id); return handle});
		
		newObserveInfo.deleteFromObserved = newObserveInfo.deleteFromObserved.filter(x => x != undefined);
		newObserveInfo.addToObserved = newObserveInfo.addToObserved.filter(x => x != undefined);

		return Arrangement.parseEscribed(await sendMessage("changeObserved", newObserveInfo) as EscribedArrangement,
			"handle", (customId: string) => observer.getCommonId(customId));
	}

  async function getArrangement(idArray: number[]): Promise<Arrangement> {
		let filterHandles = true;
		if (idArray === undefined) {
			filterHandles = false;
		}
		
		let value: string | string[];
		if (filterHandles) {
			let handleArray: string[] = [];
			for (let id of idArray) {
				// TODO: szukanie nie tylko w już observed
				let handle: string = observer.getCustomId(id);
				if (handle != undefined) {
					handleArray.push(handle);
				}
			}
			value = handleArray;
		}
		else {
			value = "all";
		}

		// TODO: szukanie nie tylko w już observed
		return Arrangement.parseEscribed(await sendMessage("getArrangement", value), "handle", observer.getCommonId);
	}

	async function setArrangement(arrangement: Arrangement): Promise<Arrangement> {
		// TODO: szukanie nie tylko w już observed
		const escribedArrangement: EscribedArrangement =
			await arrangement.toEscribed("handle", async (id: number) => observer.getCustomId(id)); //observer.asyncGetCustomId
		const responseEscribedArrangement: EscribedArrangement = await sendMessage("setArrangement", escribedArrangement);
		// TODO: szukanie nie tylko w już observed
		return Arrangement.parseEscribed(responseEscribedArrangement, "handle", observer.getCommonId);
	}

	// TODO:
	// async function updateArrangement(arrangement: Arrangement): Promise<Arrangement> {
	// }

	let onArrangementChanged = new EventTarget();
	function handleMessageFromApp(message: ResponseMessage) {
		console.log(message);
		if (message.status === "OK" && message.type === "arrangementChanged") {
			let event = new CustomEvent(message.type, message.value);
			onArrangementChanged.dispatchEvent(event);
		}
	}

	function startConnection() {
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

	function stopConnection() {
		if (runningConnection) {
			port.disconnect();
			runningConnection = false;
		}
		else
			console.log("No running connection!");
	}

	w['arranger'] = {
		changeObserved,
		getArrangement,
		setArrangement,
		onArrangementChanged,
		startConnection,
		stopConnection,//TODO usuń sendmessage
		sendMessage,
	}
})(window);
