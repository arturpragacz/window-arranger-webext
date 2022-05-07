"use strict";


/******************************************************************************
** Constants
**/

const DEFAULT_LANGUAGE = "en";

const SETTINGS_PREFIX = "settings_";

const SETTING = {
	// "DEFAULT_WINDOW_GROUP_NAME": "defaultWindowGroupName",
	"GO_TO_CONSOLE_IN_POPUP": "goToConsoleInPopup",
	"MOVE_NEW_WINDOWS_TO_TOP": "moveNewWindowsToTop",
	"LOAD_PREVIOUS_ON_STARTUP": "loadPreviousOnStartup"
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
** Settings
**/

var settings = {};

settings.getStorePrefix = function () {
	return SETTINGS_PREFIX;
};

/**
** Private Methods
**/

settings._getSettingElements = function () {
	return {
		// [Setting.DEFAULT_WINDOW_GROUP_NAME]: settings._getSettingElement(Setting.SHOW_ICON_BADGE),
		[SETTING.GO_TO_CONSOLE_IN_POPUP]: settings._getSettingElementFromKey(SETTING.GO_TO_CONSOLE_IN_POPUP),
		[SETTING.MOVE_NEW_WINDOWS_TO_TOP]: settings._getSettingElementFromKey(SETTING.MOVE_NEW_WINDOWS_TO_TOP),
		[SETTING.LOAD_PREVIOUS_ON_STARTUP]: settings._getSettingElementFromKey(SETTING.LOAD_PREVIOUS_ON_STARTUP)
	};
};

settings._getSettingElementFromKey = function (settingKey) {
	return document.querySelector(`[data-setting=${settingKey}]`);
};

settings._getSettingKeyFromElement = function (settingElement) {
	let settingKey = settingElement.getAttribute("data-setting");
	return settingKey;
}

settings._getSettingValueFromElement = function (settingElement) {
	let settingType, settingValue;

	settingType = settingElement.getAttribute("type");

	switch (settingType) {
	case "checkbox":
		settingValue = settingElement.checked;
		break;
	default:
		settingValue = settingElement.value;
	}

	return settingValue;
}

settings._getSettingForm = function () {
	return document.querySelector("form");
};

settings._setDefaultValues = function (newSettingValues) {
	const settingValues = {
		"goToConsoleInPopup": false,
		"moveNewWindowsToTop": false,
		"loadPreviousOnStartup": true
	}
	for (const k in newSettingValues) {
		settingValues[k] = newSettingValues[k];
	}
	return settingValues;
};

settings._getSettingValues = async function () {
	let settingKeys = Object.keys(settings._settingElements);
	let settingStoreKeys = settingKeys.map(key => settings.getStorePrefix() + key);
	let settingStoreValues = await browser.storage.local.get(settingStoreKeys);
	let settingStoreValuesArray = Object.entries(settingStoreValues);
	let settingValuesArray = settingStoreValuesArray.map(([key, val]) => [key.slice(settings.getStorePrefix().length), val]);
	let settingValues = Object.fromEntries(settingValuesArray);
	return settings._setDefaultValues(settingValues);
};

settings._renderContents = function () {
	document.body.setAttribute("dir", settings._scriptDirection);
	helpers.insertI18nContentIntoDocument(document);

	settings._renderSettingsPanel();
};

settings._renderSettingsPanel = function () {
	let elements = settings._settingElements;

	// elements.defaultWindowGroupName.value = settings._settingValues.defaultWindowGroupName;
	elements.goToConsoleInPopup.checked = settings._settingValues.goToConsoleInPopup;
	elements.moveNewWindowsToTop.checked = settings._settingValues.moveNewWindowsToTop;
	elements.loadPreviousOnStartup.checked = settings._settingValues.loadPreviousOnStartup;

	// if (settings._settingValues.timer < 2000) {
	// 	settings._renderTimerTooLowNotice();
	// }

	if (settings._languageSupported === false) {
		settings._renderLocaleNotice();
	}
};

// settings._renderTimerTooLowNotice = function () {
	// let timerTooLowNoticeElement = document.getElementById("notice-timer-too-low");
	// timerTooLowNoticeElement.setAttribute("class", "notice notice-warning");
// };

// settings._hideTimerTooLowNotice = function () {
	// let timerTooLowNoticeElement = document.getElementById("notice-timer-too-low");
	// timerTooLowNoticeElement.setAttribute("class", "notice notice-warning hidden");
// };

settings._renderLocaleNotice = function () {
	let localeNoticeElement = document.getElementById("notice-locale");
	localeNoticeElement.classList.remove("hidden");
};

settings._registerEventListeners = function() {
	settings._registerSettingsEventListeners();
	settings._registerMiscellaneousEventListeners();
};

settings._registerSettingsEventListeners = function () {
	let elements = settings._settingElements;

	// elements.defaultWindowGroupName.addEventListener("keyup", settings._onSettingChanged);
	elements.goToConsoleInPopup.addEventListener("change", settings._onSettingChanged);
	elements.moveNewWindowsToTop.addEventListener("change", settings._onSettingChanged);
	elements.loadPreviousOnStartup.addEventListener("change", settings._onSettingChanged);

	let form = settings._settingForm;
	form.addEventListener("submit", settings._onFormSubmit);
};

settings._registerMiscellaneousEventListeners = function () {
	// let timerTooLowButtonElement, helpTranslateButtonElement;

	// timerTooLowButtonElement = document.getElementById("button-timer-too-low");
	// helpTranslateButtonElement = document.getElementById("button-help-translate");

	// timerTooLowButtonElement.addEventListener("click", settings._onDisableTimerTooLow);
	// helpTranslateButtonElement.addEventListener("click", settings._onHelpTranslate);

	// timerTooLowButtonElement.addEventListener("keydown", function (event) {
	// 	let enterOrSpaceKeyPressed = helpers.enterOrSpaceKeyPressed(event);

	// 	if (enterOrSpaceKeyPressed) {
	// 		settings._onDisableTimerTooLow();
	// 	}
	// });

	// helpTranslateButtonElement.addEventListener("keydown", function (event) {
	// 	let enterOrSpaceKeyPressed = helpers.enterOrSpaceKeyPressed(event);

	// 	if (enterOrSpaceKeyPressed) {
	// 		settings._onHelpTranslate();
	// 	}
	// });
};

settings._saveSetting = async function (settingKey) {
	let settingValue = settings._getSettingValueFromKeyByStoredElement(settingKey);

	// if (settingKey === Setting.DEFAULT_WINDOW_GROUP_NAME) {
	// }

	if (settingValue !== settings._settingValues[settingKey]) {
		let settingStoreKey = settings.getStorePrefix() + settingKey;
		await browser.storage.local.set({
			[settingStoreKey]: settingValue
		});
		settings._settingValues[settingKey] = settingValue;
	}
};

settings._getSettingValueFromKeyByStoredElement = function (settingKey) {
	let settingElement = settings._settingElements[settingKey];
	let settingValue = settings._getSettingValueFromElement(settingElement);

	return settingValue;
}


/**
** Event Handlers
**/

settings._onDocumentLoaded = function () {
	(async function () {
		settings._requestedLanguage = helpers.determineRequestedLanguage();
		settings._language = helpers.determineFinalLanguage();
		settings._languageSupported = helpers.isLanguageSupported(settings._requestedLanguage);
		settings._scriptDirection = helpers.determineScriptDirection(settings._language);

		settings._settingElements = settings._getSettingElements();
		settings._settingForm = settings._getSettingForm();
		settings._settingValues = await settings._getSettingValues();

		settings._renderContents();
		settings._registerEventListeners();
	})();
};

settings._onSettingChanged = function ({target}) {
	// let settingKey = settings._getSettingKeyFromElement(target);
	// let settingValue = settings._getSettingValueFromElement(target);

	// if (settingKey === Setting.TIMER) { // timer too low
	// 	if (settingValue < 2000) {
	// 			settings._renderTimerTooLowNotice();
	// 	} else {
	// 			settings._hideTimerTooLowNotice();
	// 	}
	// }
};

settings._onFormSubmit = function (event) {
	event.preventDefault();

	for (const key of Object.keys(settings._settingElements))
		settings._saveSetting(key);
};

// settings._onDisableTimerTooLow = function () {
// 	let changeEvent = new Event("change");

// 	settings._settingElements.timer.value = 2000;
// 	settings._settingElements.timer.dispatchEvent(changeEvent);
// };

// settings._onHelpTranslate = function () {
// 	browser.tabs.create({
// 		"url": "https://extension.pragacz.com/"
// 	});
// };

/**
** Initializations
**/

document.addEventListener("DOMContentLoaded", settings._onDocumentLoaded);
