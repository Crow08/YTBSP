# YouTube Better Startpage (YTBSP)

[![version](https://img.shields.io/github/package-json/v/Crow08/ytbsp.svg)](/package.json)
[![dependencies](https://img.shields.io/librariesio/github/Crow08/ytbsp.svg)](/package.json)
[![Known Vulnerabilities](https://snyk.io/test/github/Crow08/YTBSP/badge.svg)](https://snyk.io/test/github/Crow08/YTBSP)
[![license](https://img.shields.io/github/license/Crow08/ytbsp.svg)](/LICENSE.md)

**Script Summary:** Gets the old subscription grid on the YouTube start page back.

## Features
It replaces the new start page of YouTube with one it generates on its own which has the same style of showing your subscriptions as the old start page of YouTube had. (Remember, back in 2010 when YouTube had stars to rate videos and actually cared about whom you're subscribed to.)
On the new start page, all your subscriptions will be listed with up to 50 of their most recent videos.

Videos you have watched are automatically marked as watched and you can choose to hide videos you've seen or remove them manually. As a result, you have a compact and tidy list of only the videos you have not yet seen from all your subscriptions.

Information on watched and removed videos are saved in local browser storage or can be stored remotely via Google Drive.
If data is stored remotely the script will be synced between all browsers and machines. For the synchronisation when used with local storage there is a simple import and export function.

YTBSP doesn't replace the start page and can be toggled to reveal the original start page. Additionally, it can be toggled on many other youtube pages, for example, while watching a video.

## Permissions and OAuth2
The script requires permissions and has to be authorized via OAuth2. Please log in with the same account you use for YouTube. For this, you have to allow popups temporarily for the first time you execute the script and once after you delete your browser cache.  
Permissions the script requires:  
* **youtube.readonly:**  
    read-only access to your youtube account for reading out the channels you're subscribed to.
* **drive.appdata (optional):**  
    permission to read and write app data on your Google Drive storage for synchronisation of the script between computers or browsers. (Allows only access to files created by this script.)

## Misc
Something I might add: This script is network and CPU intensive. If you have a huge amount of subscriptions it might lag while loading.
