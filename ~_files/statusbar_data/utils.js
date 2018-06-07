/* Copyright (c) 2018 Andy McDonald. All rights reserved. */

/*jshint esversion: 6 */ // MODULE: add module: true
/* global browser, chrome, moment */

// ---------------------------------------------------------
// BEGIN NON-MODULE BOILERPLATE 
(() => {
"use strict";
// END NON-MODULE BOILERPLATE 
// ---------------------------------------------------------

const _platform = (() => {
	// ---------------------------------------------------------
	let _apiRoot = null;

	if (typeof(browser) !== 'undefined' && typeof(browser.runtime) !== 'undefined')
		_apiRoot = browser;
	else if (typeof(chrome) !== 'undefined' && typeof(chrome.runtime) !== 'undefined')
		_apiRoot = chrome;
	else
		throw new Error("Platform not supported");

	// ---------------------------------------------------------
	const _notifyUser = (title, message, moreInfoMessage, iconUrl, moreInfoUrl) =>
	{
		if (typeof(_apiRoot.notifications) === 'undefined')
			throw new Error('Platform does not support notifications'); // Edge
		
		_apiRoot.notifications.create('foxclocks', {
			type: "basic",
			title,
			message: `${message}\n\n${moreInfoMessage}`,
			iconUrl,
		}, () => {/* do nothing */} );

		_apiRoot.notifications.onClicked.addListener((notificationId, buttonIndex) => _apiRoot.tabs.create( {url: moreInfoUrl} ));
	};

	//---------------------------------------------------------
	const _getApplicationName = () =>
	{
		const protocol = new URL(_apiRoot.runtime.getURL('')).protocol;
		let appName = null;
		
		// tried everything else to detect Opera: chrome.webstore, opr, opr.addons, opr.sidebarAction etc
		//
		if (protocol === 'chrome-extension:')
			appName = window.navigator.userAgent.includes(' OPR/') ? 'Opera' : 'Chrome';
		else if (protocol === 'moz-extension:')
			appName =  'Firefox';
		else if (protocol === 'ms-browser-extension:')
			appName =  'Edge';

		return appName;
	};

	// ---------------------------------------------------------
	const _openOptionsPage = (/* ignoring arguments for now */) => 
	{
		if (typeof(_apiRoot.runtime.openOptionsPage) === 'function')
		{
			_apiRoot.runtime.openOptionsPage();
		}
		else
		{
			// Edge only. Also, never seems to find a pre-existing options window
			//
			const url = _apiRoot.runtime.getURL('html/options.html');

			_apiRoot.tabs.query( { windowType: "normal", url: url + '*' }, tabs => {

				if (tabs !== null && tabs.length > 0)
					_apiRoot.tabs.update(tabs[0].id, { active: true });
				else
					_apiRoot.tabs.create( {url: url} );
			});
		}
	};

	// ---------------------------------------------------------
	return {
		getExtensionVersion() { return _apiRoot.runtime.getManifest().version; },
		getExtensionDefaultLocale() { return _apiRoot.runtime.getManifest().default_locale; },
		injectedMediaQueriesOk() { return _getApplicationName() !== 'Firefox'; },
		
		notifyUser: _notifyUser,
		getApplicationName: _getApplicationName,
		getI18nMessage: _apiRoot.i18n.getMessage,
		getUILanguage: _apiRoot.i18n.getUILanguage,
		sendMessage: _apiRoot.runtime.sendMessage,
		getExtensionUrl: _apiRoot.runtime.getURL,
		openOptionsPage: _openOptionsPage,
		storage: _apiRoot.storage,
		onMessage: _apiRoot.runtime.onMessage,
		tabs: _apiRoot.tabs
	};
})();
	
//---------------------------------------------------------
const _extend = (...args) =>
{
	let deep = false;
	
	if (typeof(args[0]) === 'boolean')
	{
		deep = true;
		args.shift();
	}

	const target = args.shift();
	
	args.forEach(currObj => {

		for (const propName in currObj)
		{
			if (currObj.hasOwnProperty(propName))
			{
				const propVal = currObj[propName];
				target[propName] = deep && propVal === Object(propVal) ? JSON.parse(JSON.stringify(propVal)) : propVal;
			}
		}
	});

	return target;
};

// ---------------------------------------------------------
const tmp_defaults_watchlist_item_settings = {
/*	tz_id: null,
	name: null,
	coords: { lat_decimal: 0.0, long_decimal: 0.0 }, */
	show_in: ['statusbar'],
	statusbar: {
		show_flag: true /*, time_format: null, bold: null, italic: null, underline: null, colour: null */
	}
};
const tmp_urls_extension_home = 'https://foxclocks.org';
const tmp_storage_local = ['tz_db_last_update_check', 'previous_run_version', 'tz_db', 'locale'];
const tmp_storage_sync = ['watchlist', 'global_time_format', 'statusbar', 'config_override'];

const _CONFIG = {
	storage_local: _platform.storage.sync ? tmp_storage_local : tmp_storage_local.concat(tmp_storage_sync),
	storage_sync: _platform.storage.sync ? tmp_storage_sync : [],
	on_installed: {open_options: false, open_web_url: true },
	on_updated: {open_options: false, open_web_url: true },
	tz_db_update_check_interval_millis: 6048e5, // 1 week
	time_update_interval_millis: 500,
	transition_format: { date: 'YYYY-MMM-DD (ddd)', time: 'HH:mm' },
	log_level: 1, // warn
	
	defaults: {
		watchlist_item_settings: tmp_defaults_watchlist_item_settings,
		moment_locale: 'en',

		statusbar: { enabled: 'true', vertical_position: 'bottom', text_alignment: 'right' },
		global_time_format: _platform.getI18nMessage("o_standard_time_formats").split('|')[0],
		watchlist: [
			_extend(true, { tz_id: 'Europe/London', name: _platform.getI18nMessage("location_London") }, tmp_defaults_watchlist_item_settings),
			_extend(true, { tz_id: 'America/New_York', name: _platform.getI18nMessage("location_New_York") }, tmp_defaults_watchlist_item_settings),
			_extend(true, { tz_id: 'Asia/Hong_Kong', name: _platform.getI18nMessage("location_Hong_Kong") }, tmp_defaults_watchlist_item_settings)
		]
	},

	urls: {
		extension_help: `${tmp_urls_extension_home}/extension-help`,
		extension_installed: `${tmp_urls_extension_home}/extension-installed`,
		extension_updated: `${tmp_urls_extension_home}/extension-updated`,
		tz_db: `${tmp_urls_extension_home}/time-zone-database`,
		tz_db_update_check: `${tmp_urls_extension_home}/data/tz-db-update-check.cgi`
	},
	
	debug: {
		// test_tz_db_update_check: true,
		// test_previous_run_version: null,
		// test_previous_run_version: "1.0",
		// test_force_notify_tz_db_updated: true,
		// test_log_level: 3
	}
};

//---------------------------------------------------------
var _console = (() => {
	
	const _getLevel = () => _CONFIG.debug.test_log_level || _CONFIG.log_level;
	
	return {
		debug: (...args) => { if (_getLevel() >= 3) console.debug.apply(console, args); },
		info: (...args) => { if (_getLevel() >= 2) console.info.apply(console, args); },
		log: (...args) => { if (_getLevel() >= 2) console.log.apply(console, args); },
		warn: (...args) => { if (_getLevel() >= 1) console.warn.apply(console, args); },
		error: (...args) => { if (_getLevel() >= 0) console.error.apply(console, args); }
	};
	
})();

// ---------------------------------------------------------
const _localizeHtml = context =>
{
	if (typeof(jQuery) === 'undefined')
		throw new Error('jQuery undefined');
	
	jQuery('[data-i18n-content]', context).each((index, item) => {
		const el = jQuery(item);
		el.text(_platform.getI18nMessage(el.attr('data-i18n-content')));
	});
	
	jQuery('[data-i18n-placeholder]', context).each((index, item) => {
		const el = jQuery(item);
		el.attr("placeholder", _platform.getI18nMessage(el.attr('data-i18n-placeholder')));
	});
};

// ---------------------------------------------------------
const _getZoneTransitionIndex = (zone, dateEpoch) =>
{
	let transitionIndex = null;

	if (typeof(zone.transitions) !== 'undefined')
	{
		const transitions = zone.transitions;
		const transitionsLength = transitions.length;

		for (let i = 0; i < transitionsLength; i++)
		{
			// The transition immediately before the first 'future' transition.
			// transitionIndex will be -1 at the start of the first transition, which
			// we consider to be in the previous transition (hence >= )
			//
			if (transitions[i].epoch >= dateEpoch)
			{
				transitionIndex = i - 1;
				break;
			}
		}

		// No future transitions - use most recent
		//
		if (transitionIndex === null)
			transitionIndex = transitionsLength - 1;
	}

	return transitionIndex; // can be null (no transitions for zone), or -1
};

// ---------------------------------------------------------
const _getZoneOffsetMins = (zone, dateEpoch) =>
{
	let offsetMins = null;

	if (typeof(zone.transitions) !== 'undefined')
	{
		const transitionIndex = _getZoneTransitionIndex(zone, dateEpoch);

		if (transitionIndex !== null && transitionIndex !== -1)
			offsetMins = zone.transitions[transitionIndex].offset_mins;
	}
	else if (typeof(zone.fixed) !== 'undefined')
	{
		offsetMins = zone.fixed.offset_mins;
	}

	return offsetMins;
};

// ---------------------------------------------------------
let _moment_init = false;
const _getFormattedTime = (zone, dateEpoch, timeFormat) =>
{
	if (typeof(moment) === 'undefined')
		throw new Error('moment undefined');

	if (_moment_init === false)
	{
		moment.locale([_platform.getUILanguage(), _CONFIG.defaults.moment_locale]);
		_moment_init = true;
	}
	
	if (typeof(zone) === 'undefined' || zone === null)
		return moment(dateEpoch).format(timeFormat);

	const offsetMins = _getZoneOffsetMins(zone, dateEpoch);

	return offsetMins !== null ? moment(dateEpoch).utcOffset(offsetMins).format(timeFormat) : null;
};

//---------------------------------------------------------
const _createStoragePromise = (storageArea, storageFunctionName, data) => 
{
	return new Promise((resolve, reject) => {
	
		if (data.length === 0)
			resolve(null);
		else
			_platform.storage[storageArea][storageFunctionName](data, storageItems => resolve(typeof(storageItems) === 'undefined' ? data : storageItems));
	});
};

// ---------------------------------------------------------
const _setStorage = (data, storageArea) =>
{
	if (storageArea === 'local')
		return _createStoragePromise('local', 'set', data);

	if (storageArea === 'sync')
		return _createStoragePromise('sync', 'set', data);

	const tmpStorage = {local: {}, sync: {}};
	const nameArray = Object.keys(data);

	for (const currName of nameArray)
	{
		if (_CONFIG.storage_local.includes(currName))
			tmpStorage.local[currName] = data[currName];
		else if (_CONFIG.storage_sync.includes(currName))
			tmpStorage.sync[currName] = data[currName];
		else
			throw new Error(`Default storage area not defined for "${currName}"`);
	}

	let asyncEvents = [];

	if (Object.getOwnPropertyNames(tmpStorage.local).length > 0)
		asyncEvents.push(_createStoragePromise('local', 'set', tmpStorage.local));

	if (Object.getOwnPropertyNames(tmpStorage.sync).length > 0)
		asyncEvents.push(_createStoragePromise('sync', 'set', tmpStorage.sync));

	return Promise.all(asyncEvents).then(() => _extend(true, tmpStorage.local, tmpStorage.sync));
};

// ---------------------------------------------------------
const _getOrRemoveStorage = (getOrRemove, nameArray, storageArea) =>
{
	if (storageArea === 'local')
		return _createStoragePromise('local', getOrRemove, nameArray);

	if (storageArea === 'sync')
		return _createStoragePromise('sync', getOrRemove, nameArray);

	const tmpStorage = {local: [], sync: []};

	for (const currName of nameArray)
	{
		if (_CONFIG.storage_local.includes(currName))
			tmpStorage.local.push(currName);
		else if (_CONFIG.storage_sync.includes(currName))
			tmpStorage.sync.push(currName);
		else
			throw new Error(`Default storage area not defined for "${currName}"`);
	}

	return Promise.all([
		_createStoragePromise('local', getOrRemove, tmpStorage.local),
		_createStoragePromise('sync', getOrRemove, tmpStorage.sync)
	])
	
	.then(arr => {

		let retObj = {};

		for (let i=0; i < arr.length; i++)
		{
			if (arr[i] !== null)
				retObj = _extend(true, retObj, arr[i]);
		}

		return retObj;
	});
};

// ---------------------------------------------------------
const _getStorage = (nameArray, storageArea) => _getOrRemoveStorage('get', nameArray, storageArea);
const _removeStorage = (nameArray, storageArea) => _getOrRemoveStorage('remove', nameArray, storageArea);

// ---------------------------------------------------------
const _onStorageChanged =
{
	addListener(callback) { _platform.storage.onChanged.addListener(callback); },
	removeListener(callback) { _platform.storage.onChanged.removeListener(callback); }
};

// ---------------------------------------------------------
const _getZonesForWatchlist = (watchlist, watchlistZones) =>
{
	const newWatchlistZones = {};
	const missingZones = {};

	for (let i=0; i < watchlist.length; i++)
	{
		const tz_id = watchlist[i].tz_id;

		if (watchlistZones.hasOwnProperty(tz_id))
			newWatchlistZones[tz_id] = _extend(true, {}, watchlistZones[tz_id]);
		else
			missingZones[tz_id] = null;
	}

	if (Object.getOwnPropertyNames(missingZones).length > 0)
	{
		return _getStorage(['tz_db'])
		.then(storageItems => {
			const zoneIds = Object.keys(missingZones);

			for (const zoneId of zoneIds)
			{
				newWatchlistZones[zoneId] = _extend(true, {}, storageItems.tz_db.zones[zoneId]);
			}

			return newWatchlistZones;
		});
	}
	else
	{
		return Promise.resolve(newWatchlistZones);
	}
};

//---------------------------------------------------------
const _parseUrlSearch = search =>
{
	const SEARCH_REGEX = /([^?=&]+)(=([^&]*))?/g;
	const retStruct = {};
	let matchArray = null;

	while ((matchArray = SEARCH_REGEX.exec(search)) !== null)
	{
		const currName = decodeURIComponent(matchArray[1]);
		const currVal = decodeURIComponent(matchArray[3]);

		if (retStruct.hasOwnProperty(currName) === false)
			retStruct[currName] = [];

		retStruct[currName].push(currVal);
	}

	return retStruct;
};

// ---------------------------------------------------------
window.foxclocks = {}; // MODULE: remove
window.foxclocks.utils = /* export default */ _extend({}, _platform, { // MODULE: restore export 
	
	console: _console,
	
	getConfig: configName => _CONFIG.hasOwnProperty(configName) ? _CONFIG[configName] : null,
	setConfig: config => _extend(true, _CONFIG, config),

	onStorageChanged: _onStorageChanged,
	setStorage: _setStorage,
	getStorage: _getStorage,
	removeStorage: _removeStorage,

	localizeHtml: _localizeHtml,
	getZonesForWatchlist: _getZonesForWatchlist,
	getZoneTransitionIndex: _getZoneTransitionIndex,
	getFormattedTime: _getFormattedTime,
	
	parseUrlSearch: _parseUrlSearch,
	extend: _extend
});

// ---------------------------------------------------------
// BEGIN NON-MODULE BOILERPLATE 
})();
// END NON-MODULE BOILERPLATE 
// ---------------------------------------------------------