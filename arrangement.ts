type CommonIdType = number;
type CustomIdNameType = string;

class Possition {
	inDefaultGroup: boolean;
	group: any;
	index: any;
	constructor(inDefaultGroup, group, index) {
		this.inDefaultGroup = inDefaultGroup;
		this.group = group;
		this.index = index;
	}

	moveToTop(): Possition {
		return new Possition(this.inDefaultGroup, this.group, 0);
	}

	static cast(position): Possition {
		return new Possition(position.inDefaultGroup, position.group, position.index);
	}
}

type EscribedArrangement<CustomIdType> = Array<{position: Possition}>; //[customIdName: CustomIdNameType]: CustomIdType, 

class Arrangement extends Map<CommonIdType, Possition> {
	async toEscribed<CustomIdType>(customIdName: CustomIdNameType, customIdMaker: CustomIdMaker<CommonIdType, CustomIdType>)
	:	Promise<{escribedArrangement: EscribedArrangement<CustomIdType>, idsFailedConversion: Map<CommonIdType, Possition>}> {
		let escribedArrangement = [] as EscribedArrangement<CustomIdType>;
		let idsFailedConversion = new Map<CommonIdType, Possition>();

		for (let idPos of this) {
			let id = idPos[0];
			let customId: CustomIdType = await customIdMaker(id).catch(() => undefined);
			if (customId !== undefined) {
				escribedArrangement.push({ [customIdName]: customId, position: idPos[1] });
			}
		}

		return {escribedArrangement, idsFailedConversion};
	}

	static parseEscribed<CustomIdType>(escribedArrangement: EscribedArrangement<CustomIdType>, customIdName: CustomIdNameType,
	commonIdMaker: CommonIdMaker<CommonIdType, CustomIdType>): {arrangement: Arrangement, idsFailedConversion: Map<CustomIdType, Possition>} {
		let arrangement = new Arrangement();
		let idsFailedConversion = new Map<CustomIdType, Possition>();

		for (let posWindow of escribedArrangement) {
			let position = posWindow.position;
			position = Possition.cast(position);
			const customId: CustomIdType = posWindow[customIdName];
			let commonId: CommonIdType = commonIdMaker(customId);
			if (commonId !== undefined) {
				arrangement.set(commonId, position);
			}
			else {
				idsFailedConversion.set(customId, position);
			}
		}

		return {arrangement, idsFailedConversion};
	}
}

// TODO: type-safe Arrangement With Failed Conversion
// class ArrangementWithFailedConversion extends Arrangement {
// 	customIdsFailedConversion: Map<CustomIdType, Position>;
// }

function mergeArrangements(arr1: Arrangement, arr2: Arrangement): Arrangement {
	return new Arrangement(function*() { yield* arr1; yield* arr2; }());
}