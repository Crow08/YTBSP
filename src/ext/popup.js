// Copyright (c) 2014 The Chromium Authors. All rights reserved.

/* global chrome*/

/**
 * Get the current URL.
 *
 * @param {function(string)} callback called when the URL of the current tab is found.
 * @returns {void}
 */
function getCurrentTabUrl(callback) {

    /*
     * Query filter to be passed to chrome.tabs.query - see
     * https://developer.chrome.com/extensions/tabs#method-query
     */
    const queryInfo = {
        "active": true,
        "currentWindow": true
    };

    chrome.tabs.query(queryInfo, (tabs) => {

        /*
        * The chrome.tabs.query invokes a callback with a list of tabs that match the
        * query. When the popup is opened, there is certainly a window and at least
        * one tab, so we can safely assume that |tabs| is a non-empty array.
        * A window can only have one active tab at a time, so the array consists of
        * exactly one tab.
        */
        const tab = tabs[0];

        /*
         * A tab is a plain object that provides information about the tab.
         * See https://developer.chrome.com/extensions/tabs#type-Tab
         */
        const url = tab.url;

        /*
         * The tab.url is only available if the "activeTab" permission is declared.
         * If you want to see the URL of other tabs (e.g. after removing active:true
         * from |queryInfo|), then the "tabs" permission is required to see their
         * "url" properties.
         */
        console.assert("string" === typeof url, "tab.url should be a string");

        callback(url);
    });

    /*
     * Most methods of the Chrome extension APIs are asynchronous. This means that
     * you CANNOT do something like this:
     *
     * var url;
     * chrome.tabs.query(queryInfo, (tabs) => {
     *   url = tabs[0].url;
     * });
     * alert(url); // Shows "undefined", because chrome.tabs.query is async.
     */
}
