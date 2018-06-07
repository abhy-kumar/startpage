/* Copyright (c) 2018 Andy McDonald. All rights reserved. */

/*jshint esversion: 6 */ // MODULE: add module: true

// ---------------------------------------------------------
// BEGIN NON-MODULE BOILERPLATE
(() => {
"use strict";

const utils = window.foxclocks.utils; // import utils from './utils.js';
// END NON-MODULE BOILERPLATE 
// ---------------------------------------------------------

// ---------------------------------------------------------
let _eClockTimes = null;
let _setClocksIntervalId = null;

const _data = {};

// ---------------------------------------------------------
const _start = recreate =>
{
	if (document.readyState === 'loading') // can be called before document ready
		return;
	
	if (recreate)
		_eClockTimes = null;
	
	if (document.hidden === false)
	{
		if (_eClockTimes === null)
			_eClockTimes = _createClocks(_data.watchlist, _data.watchlist_zones);
	
		if (_setClocksIntervalId === null)
		{
			_setClocksIntervalId = window.setInterval(
				() => _setClockTimes(_eClockTimes, _data.watchlist, _data.watchlist_zones, _data.global_time_format),
				utils.getConfig('time_update_interval_millis'));
		}
		
		_setClockTimes(_eClockTimes, _data.watchlist, _data.watchlist_zones, _data.global_time_format);
	}
	else if (_setClocksIntervalId !== null)
	{
		window.clearInterval(_setClocksIntervalId);
		_setClocksIntervalId = null;
	}
};

// ---------------------------------------------------------
const _createClocks = (watchlist, watchlist_zones) =>
{
	const body = $('body');

	body.find('span.clock').remove();

	let clockIndex = 0;
	for (let i=0; i < watchlist.length; i++)
	{
		const item = watchlist[i];

		if ($.inArray('statusbar', item.show_in) === -1)
			continue;

		const itemZone = watchlist_zones[item.tz_id];
		const eClock = $(`<span class="clock" id="statusbar-clock-${clockIndex++}">`);

		if (item.statusbar.show_flag && typeof(itemZone.country_code) === 'string')
			eClock.append($('<img />', {src: `/images/flags/${itemZone.country_code.toLowerCase()}.png`} ) );

		if (item.statusbar.bold === true)
			eClock.addClass('bold');

		if (item.statusbar.italic === true)
			eClock.addClass('italic');

		if (item.statusbar.underline === true)
			eClock.addClass('underline');
		
		if (item.statusbar.colour)
			eClock.css('color', item.statusbar.colour);
		
		eClock.append($('<span class="time"/>').data('watchlist-index', i)).appendTo(body);
	}

	return body.find("span.time");
};

//---------------------------------------------------------
const _setAlignment = text_alignment =>
{
	$('html').css('text-align', text_alignment);
};

// ---------------------------------------------------------
const _setClockTimes = ($clockTimes, watchlist, watchlist_zones, global_time_format) =>
{
	if ($clockTimes === null)
		return;

	const nowEpoch = new Date().getTime();

	for (let i = 0, len = $clockTimes.length; i < len; i++)
	{
		const eClockTime = $clockTimes[i];
		const item = watchlist[i];
		const itemZone = watchlist_zones[item.tz_id];

		const timeFormat = typeof(item.statusbar.time_format) === 'string' ? item.statusbar.time_format : global_time_format;
		const formattedTime = utils.getFormattedTime(itemZone, nowEpoch, timeFormat);

		eClockTime.innerText = item.name !== '' ? `${item.name}: ${formattedTime}` : formattedTime;
	}
};

//---------------------------------------------------------
const _init = () =>
{
	const urlParams = utils.parseUrlSearch(window.location.search);
	if (!urlParams.hasOwnProperty('origin') || !urlParams.origin[0])
		throw new Error('No origin specified in URL');
	
	$('html').addClass(utils.getApplicationName());

	const docReadyPromise = new Promise((resolve, reject) => {

		$(() => {
			const origin = urlParams.origin[0];

			$('body')
			.on('mousedown', e => e.preventDefault()) // prevent text being selected
			.on('dblclick', e => utils.sendMessage({action: "open_options"}))
			.on('click', 'span.clock', e => {

				const item = _data.watchlist[$(e.currentTarget).find('span.time').data('watchlist-index')];
				const itemZone = _data.watchlist_zones[item.tz_id];

				window.parent.postMessage({'clockclick.statusbar.foxclocks': {pageX: e.pageX, pageY: e.pageY, item, itemZone}}, origin);
			});

			$('#closer').on('click', e => window.parent.postMessage({'closerclick.statusbar.foxclocks': true}, origin));

			resolve();
		});
	});

	utils.getStorage(['watchlist', 'tz_db', 'global_time_format', 'statusbar'])
	
	.then(storageItems => {

		_data.watchlist = storageItems.watchlist;
		_data.global_time_format = storageItems.global_time_format;
		_data.statusbar = storageItems.statusbar;

		// NB: potentially before document ready
		//
		_setAlignment(_data.statusbar.text_alignment);
		utils.onStorageChanged.addListener(_update);
		document.addEventListener("visibilitychange", _start);
		
		return storageItems.tz_db.zones;
	})
	.then(zones => utils.getZonesForWatchlist(_data.watchlist, zones))
	.then(watchlist_zones => {
		_data.watchlist_zones = watchlist_zones;
		docReadyPromise.then(_start);
	});
};

// ---------------------------------------------------------
const _update = (changes, namespace) =>
{
	if (typeof(changes.watchlist) !== 'undefined')
		_data.watchlist = changes.watchlist.newValue;

	if (typeof(changes.global_time_format) !== 'undefined')
	{
		_data.global_time_format = changes.global_time_format.newValue;
		_start(); // sets clock times if document is visible
	}
	
	if (typeof(changes.statusbar) !== 'undefined')
	{
		_data.statusbar = changes.statusbar.newValue;
		_setAlignment(_data.statusbar.text_alignment);
	}

	if (typeof(changes.watchlist) !== 'undefined' || typeof(changes.tz_db) !== 'undefined')
	{
		const zones = typeof(changes.tz_db) !== 'undefined' ? changes.tz_db.newValue.zones : _data.watchlist_zones;
		
		utils.getZonesForWatchlist(_data.watchlist, zones)
		.then(watchlist_zones => {
			_data.watchlist_zones = watchlist_zones;
			_start(true);
		});
	}
};

// ---------------------------------------------------------
// ENTRYPOINT
// ---------------------------------------------------------
_init(); // no need to see if background is initialized - already checked in content.js

// ---------------------------------------------------------
// BEGIN NON-MODULE BOILERPLATE 
})();
// END NON-MODULE BOILERPLATE 
// ---------------------------------------------------------