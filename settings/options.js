"use strict";


/******************************************************************************
** Constants
**/

const DEFAULT_LANGUAGE = "en";

const SETTINGS_PREFIX = "settings_";

const SETTING = {
	"DEFAULT_WINDOW_GROUP_NAME": "defaultWindowGroupName",
	"GO_TO_CONSOLE_IN_POPUP": "goToConsoleInPopup"
};


/******************************************************************************
** Helpers
**/

var helpers = {};

/**
** Public Methods
**/

helpers.insertI18nContentIntoDocument = function (document) {
	let i18nElements = document.querySelectorAll("[data-i18n-content]");

	i18nElements.forEach(function (i18nElement) {
		let i18nMessageName = i18nElement.getAttribute("data-i18n-content");
		i18nElement.innerText = browser.i18n.getMessage(i18nMessageName);
	});
};

helpers.isLanguageSupported = function (language) {
	let languageSupported, supportedLanguages;

	languageSupported = false;

	supportedLanguages = [
		"en", "pl"
	];

	for (let supportedLanguage of supportedLanguages) {
		if (language.search(supportedLanguage) !== -1) {
			languageSupported = true;
		}
	}

	return languageSupported;
};

helpers.determineRequestedLanguage = function () {
	return browser.i18n.getUILanguage();
};

helpers.determineFinalLanguage = function () {
	let requestedLanguage = helpers.determineRequestedLanguage();

	if (helpers.isLanguageSupported(requestedLanguage))
		return requestedLanguage;
	else
		return DEFAULT_LANGUAGE;
};

helpers.determineScriptDirection = function (language) {
	let rightToLeftLanguages, scriptDirection;

	rightToLeftLanguages = [];

	if (rightToLeftLanguages.indexOf(language) === -1) {
		scriptDirection = "ltr";
	} else {
		scriptDirection = "rtl";
	}

	return scriptDirection;
};

helpers.enterOrSpaceKeyPressed = function (event) {
	if (!event.isComposing && event.keyCode !== 229) {
		return event.keyCode === 13 || event.keyCode === 32;
	}

	return false;
};


/******************************************************************************
** Options
**/

var options = {};

options.getStorePrefix = function () {
	return SETTINGS_PREFIX;
};

/**
** Private Methods
**/

options._getOptionElements = function () {
	return {
		// [Setting.DEFAULT_WINDOW_GROUP_NAME]: options._getOptionElement(Setting.SHOW_ICON_BADGE),
		[SETTING.GO_TO_CONSOLE_IN_POPUP]: options._getOptionElementFromKey(SETTING.GO_TO_CONSOLE_IN_POPUP)
	};
};

options._getOptionElementFromKey = function (optionKey) {
	return document.querySelector(`[data-option=${optionKey}]`);
};

options._getOptionKeyFromElement = function (optionElement) {
	let optionKey = optionElement.getAttribute("data-option");
	return optionKey;
}

options._getOptionValueFromElement = function (optionElement) {
	let optionType, optionValue;

	optionType = optionElement.getAttribute("type");

	switch (optionType) {
	case "checkbox":
		optionValue = optionElement.checked;
		break;
	default:
		optionValue = optionElement.value;
	}

	return optionValue;
}

options._getOptionForm = function () {
	return document.querySelector("form");
};

options._getOptionValues = async function () {
	let optionKeys = Object.keys(options._optionElements);
	let optionStoreKeys = optionKeys.map(key => options.getStorePrefix() + key);
	let optionStoreValues = await browser.storage.local.get(optionStoreKeys);
	let optionStoreValuesArray = Object.entries(optionStoreValues);
	let optionValuesArray = optionStoreValuesArray.map(([key, val]) => [key.slice(options.getStorePrefix().length), val]);
	let optionValues = Object.fromEntries(optionValuesArray);
	return optionValues;
};

options._renderContents = function () {
	document.body.setAttribute("dir", options._scriptDirection);
	helpers.insertI18nContentIntoDocument(document);

	options._renderOptionsPanel();
};

options._renderOptionsPanel = function () {
	let elements = options._optionElements;

	// elements.defaultWindowGroupName.value = options._optionValues.defaultWindowGroupName;
	elements.goToConsoleInPopup.checked = options._optionValues.goToConsoleInPopup;

	// if (options._optionValues.timer < 2000) {
	// 	options._renderTimerTooLowNotice();
	// }

	if (options._languageSupported === false) {
		options._renderLocaleNotice();
	}
};

// options._renderTimerTooLowNotice = function () {
	// let timerTooLowNoticeElement = document.getElementById("notice-timer-too-low");
	// timerTooLowNoticeElement.setAttribute("class", "notice notice-warning");
// };

// options._hideTimerTooLowNotice = function () {
	// let timerTooLowNoticeElement = document.getElementById("notice-timer-too-low");
	// timerTooLowNoticeElement.setAttribute("class", "notice notice-warning hidden");
// };

options._renderLocaleNotice = function () {
	let localeNoticeElement = document.getElementById("notice-locale");
	localeNoticeElement.setAttribute("class", "notice notice-default notice-secondary");
};

options._registerEventListeners = function() {
	options._registerOptionsEventListeners();
	options._registerMiscellaneousEventListeners();
};

options._registerOptionsEventListeners = function () {
	let elements = options._optionElements;

	// elements.defaultWindowGroupName.addEventListener("keyup", options._onOptionChanged);
	elements.goToConsoleInPopup.addEventListener("change", options._onOptionChanged);

	let form = options._optionForm;
	form.addEventListener("submit", options._onFormSubmit);
};

options._registerMiscellaneousEventListeners = function () {
	// let timerTooLowButtonElement, helpTranslateButtonElement;

	// timerTooLowButtonElement = document.getElementById("button-timer-too-low");
	// helpTranslateButtonElement = document.getElementById("button-help-translate");

	// timerTooLowButtonElement.addEventListener("click", options._onDisableTimerTooLow);
	// helpTranslateButtonElement.addEventListener("click", options._onHelpTranslate);

	// timerTooLowButtonElement.addEventListener("keydown", function (event) {
	// 	let enterOrSpaceKeyPressed = helpers.enterOrSpaceKeyPressed(event);

	// 	if (enterOrSpaceKeyPressed) {
	// 		options._onDisableTimerTooLow();
	// 	}
	// });

	// helpTranslateButtonElement.addEventListener("keydown", function (event) {
	// 	let enterOrSpaceKeyPressed = helpers.enterOrSpaceKeyPressed(event);

	// 	if (enterOrSpaceKeyPressed) {
	// 		options._onHelpTranslate();
	// 	}
	// });
};

options._saveOption = async function (optionKey) {
	let optionValue = options._getOptionValueFromKeyByStoredElement(optionKey);

	// if (optionKey === Setting.DEFAULT_WINDOW_GROUP_NAME) {
	// }

	if (optionValue !== options._optionValues[optionKey]) {
		let optionStoreKey = options.getStorePrefix() + optionKey;
		await browser.storage.local.set({
			[optionStoreKey]: optionValue
		});
		options._optionValues[optionKey] = optionValue;
	}
};

options._getOptionValueFromKeyByStoredElement = function (optionKey) {
	let optionElement = options._optionElements[optionKey];
	let optionValue = options._getOptionValueFromElement(optionElement);

	return optionValue;
}


/**
** Event Handlers
**/

options._onDocumentLoaded = function () {
	(async function () {
		options._requestedLanguage = helpers.determineRequestedLanguage();
		options._language = helpers.determineFinalLanguage();
		options._languageSupported = helpers.isLanguageSupported(options._requestedLanguage);
		options._scriptDirection = helpers.determineScriptDirection(options._language);

		options._optionElements = options._getOptionElements();
		options._optionForm = options._getOptionForm();
		options._optionValues = await options._getOptionValues();

		options._renderContents();
		options._registerEventListeners();
	})();
};

options._onOptionChanged = function ({target}) {
	// let optionKey = options._getOptionKeyFromElement(target);
	// let optionValue = options._getOptionValueFromElement(target);

	// if (optionKey === Setting.TIMER) { // timer too low
	// 	if (optionValue < 2000) {
	// 			options._renderTimerTooLowNotice();
	// 	} else {
	// 			options._hideTimerTooLowNotice();
	// 	}
	// }
};

options._onFormSubmit = function (event) {
	event.preventDefault();

	for (const key of Object.keys(options._optionElements))
		options._saveOption(key);
};

// options._onDisableTimerTooLow = function () {
// 	let changeEvent = new Event("change");

// 	options._optionElements.timer.value = 2000;
// 	options._optionElements.timer.dispatchEvent(changeEvent);
// };

// options._onHelpTranslate = function () {
// 	browser.tabs.create({
// 		"url": "https://extension.pragacz.com/"
// 	});
// };

/**
** Initializations
**/

document.addEventListener("DOMContentLoaded", options._onDocumentLoaded);
