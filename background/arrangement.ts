import { CustomIdMaker, CommonIdMaker } from "./observeInfo.js"

export type CommonIdType = number;
export type CustomIdNameType = string;

export class Possition {
	group: any;
	index: any;
	constructor(group, index) {
		this.group = group;
		this.index = index;
	}

	moveToTop(): Possition {
		return new Possition(this.group, 0);
	}

	static copy(position: Possition): Possition {
		return new Possition(position.group, position.index);
	}
}

type CustomIdAndPosition<CustomIdName extends string, CustomIdType> = Record<CustomIdName, CustomIdType> & { position: Possition };
export type CustomIdArrangement<CustomIdName extends string, CustomIdType> = Array<CustomIdAndPosition<CustomIdName, CustomIdType>>;

export class Arrangement extends Map<CommonIdType, Possition> {
	toCustomId<CustomIdName extends CustomIdNameType, CustomIdType>(customIdName: CustomIdName, customIdMaker: CustomIdMaker<CommonIdType, CustomIdType>)
	:	{ customIdArrangement: CustomIdArrangement<CustomIdName, CustomIdType>, idsFailedConversion: Map<CommonIdType, Possition> } {
		let customIdArrangement: CustomIdArrangement<CustomIdName, CustomIdType> = [];
		let idsFailedConversion = new Map<CommonIdType, Possition>();

		for (let idPos of this) {
			let position = idPos[1];
			position = Possition.copy(position);

			const commonId = idPos[0];
			const customId: CustomIdType = customIdMaker(commonId);

			if (customId !== undefined) {
				let customIdAndPosition = {} as CustomIdAndPosition<CustomIdName, CustomIdType>;
				customIdAndPosition.position = position;
				let customIdRecord: Record<CustomIdName, CustomIdType> = customIdAndPosition;
				customIdRecord[customIdName] = customId;
				customIdArrangement.push(customIdAndPosition);
			}
			else {
				idsFailedConversion.set(commonId, position);
			}
		}

		return {customIdArrangement, idsFailedConversion};
	}

	static fromCustomId<CustomIdName extends CustomIdNameType, CustomIdType>(customIdArrangement: CustomIdArrangement<CustomIdName, CustomIdType>, customIdName: CustomIdName,
	commonIdMaker: CommonIdMaker<CommonIdType, CustomIdType>): { arrangement: Arrangement, idsFailedConversion: Map<CustomIdType, Possition> } {
		let arrangement = new Arrangement();
		let idsFailedConversion = new Map<CustomIdType, Possition>();

		for (let posWindow of customIdArrangement) {
			let position = posWindow.position;
			position = Possition.copy(position);

			const customId = posWindow[customIdName];
			const commonId: CommonIdType = commonIdMaker(customId);

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

export function mergeArrangements(arr1: Arrangement, arr2: Arrangement): Arrangement {
	return new Arrangement(function*() { yield* arr1; yield* arr2; }());
}