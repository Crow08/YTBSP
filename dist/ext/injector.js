/* global chrome*/
const s0 = document.createElement("script");
s0.async = false;
s0.src = chrome.extension.getURL("lib/jquery.min.js");
(document.head || document.documentElement).prepend(s0);
const s1 = document.createElement("script");
s1.async = false;
s1.src = chrome.extension.getURL("lib/moment.min.js");
s0.parentNode.insertBefore(s1, s0.nextSibling);
const s2 = document.createElement("script");
s2.async = false;
s2.src = chrome.extension.getURL("ytbsp.user.js");
s1.parentNode.insertBefore(s2, s1.nextSibling);
