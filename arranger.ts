type handleType = string

declare namespace browser.windowsExt {
	function getNative(id: number): Promise<{handle: handleType}>;
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
	let observedIdMapper: ObservedIdMapper<CommonIdType, handleType>;

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
			console.log(this); // TODO: delete
		}
	}

	interface ResponseMessage extends Message {
		status: string;
	}

	async function sendMessage(type: "changeObserved", value: ObserveInfo<handleType>): Promise<EscribedArrangement<handleType>>;
	async function sendMessage(type: "getArrangement", value: string | handleType[]): Promise<EscribedArrangement<handleType>>;
	async function sendMessage(type: "setArrangement", value: EscribedArrangement<handleType>): Promise<EscribedArrangement<handleType>>;
	// async function sendMessage(type: "updateArrangement", value: any): Promise<EscribedArrangement>; // TODO: czy na pewno any? (popatrz w źródło aplikacji)
	async function sendMessage(type: string, value: any): Promise<any> {
		return new Promise(function (resolve, reject) {
			let messageId = messageIdCounter++;
			port.onMessage.addListener(function callback(response: ResponseMessage) {
				if (response.source === "browser" && response.id === messageId && response.type === "response") {
					port.onMessage.removeListener(callback);
					console.log(response); // TODO: delete
					if (response.status === "OK" && "value" in response) {
						resolve(response.value);
					}
				}
			});
			port.postMessage(new Message("browser", messageId, type, value));
		});
	}

	async function changeObserved(observeInfo: ObserveInfo<CommonIdType>): Promise<Arrangement> {
		let newObserveInfo: ObserveInfo<handleType> = await observedIdMapper.changeObserved(observeInfo,
			async id => (await browser.windowsExt.getNative(id)).handle);
			// async id => {let { handle } = await browser.windowsExt.getNative(id); return handle});
		
		newObserveInfo.deleteFromObserved = newObserveInfo.deleteFromObserved.filter(x => x !== undefined);
		newObserveInfo.addToObserved = newObserveInfo.addToObserved.filter(x => x !== undefined);

		return Arrangement.parseEscribed(await sendMessage("changeObserved", newObserveInfo) as EscribedArrangement<handleType>,
			"handle", (customId: handleType) => observedIdMapper.getCommonId(customId)).arrangement; // to samo co: observedIdMapper.getCommonId.bind(observedIdMapper)
	}

	async function getArrangement(idArray: CommonIdType[]): Promise<Arrangement> {
		let filterHandles = true;
		if (idArray === undefined) {
			filterHandles = false;
		}
		
		let value: string | handleType[];
		if (filterHandles) {
			let handleArray: handleType[] = [];
			for (let id of idArray) {
				// TODO: szukanie nie tylko w już observed
				let handle: handleType = observedIdMapper.getCustomId(id);
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
		return Arrangement.parseEscribed(await sendMessage("getArrangement", value), "handle", observedIdMapper.getCommonId.bind(observedIdMapper)).arrangement;
		// TODO: error handling
	}

	async function setArrangement(arrangement: Arrangement): Promise<Arrangement> {
		// TODO: szukanie nie tylko w już observed
		const escribedArrangement: EscribedArrangement<handleType> =
			(await arrangement.toEscribed("handle", async (id: CommonIdType) => observedIdMapper.getCustomId(id))).escribedArrangement; //observedIdMapper.asyncGetCustomId.bind(observedIdMapper)
		// TODO: error handling
		const responseEscribedArrangement: EscribedArrangement<handleType> = await sendMessage("setArrangement", escribedArrangement);
		// TODO: error handling
		// TODO: szukanie nie tylko w już observed
		return Arrangement.parseEscribed(responseEscribedArrangement, "handle", observedIdMapper.getCommonId.bind(observedIdMapper)).arrangement;
		// TODO: error handling
	}

	// TODO: function updateArrangement
	// async function updateArrangement(arrangement: Arrangement): Promise<Arrangement> {
	// }

	let onArrangementChanged = new EventTarget();
	function handleMessageFromApp(message: ResponseMessage) {
		if (message.status === "OK" && message.type === "arrangementChanged") {
			const value = Arrangement.parseEscribed(message.value, "handle", observedIdMapper.getCommonId.bind(observedIdMapper));
			const event = new CustomEvent(message.type, { detail: value });
			console.log(message); // TODO: delete
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
			observedIdMapper = new ObservedIdMapper();
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
