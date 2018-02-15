# YouTube Better Start Page (YTBSP)
YTSB provides an alternative start page to YouTube, that allows you to view and manage your subscription uploads in an organized way.

### Organized start page to view and manage your subscription videos
![YTBSP Teaser](https://raw.githubusercontent.com/Crow08/YTBSP/update_description/docs/overview.PNG)
### Remove videos from the list or automatically hide already seen ones
![YTBSP Teaser](https://raw.githubusercontent.com/Crow08/YTBSP/update_description/docs/remove.PNG)
gif that removes a video
### Settings are automatically synchronized via cloud
![YTBSP Teaser](https://raw.githubusercontent.com/Crow08/YTBSP/update_description/docs/sync.png)
### The old start page is still there, just toggle it back!
![YTBSP Teaser](https://raw.githubusercontent.com/Crow08/YTBSP/update_description/docs/toggle.PNG)
gif that toggles start page

ALTERNATIVE: Feature real via gif

## History
Remember back in 2010 when there where no drones, Bitcoins or fancy electric cars?  
Not even Twitch was around at that time!  
Well, not everything is better today.   
Some things changed for the worse and the YouTube start page is one of those.   
YouTube decided to redo the entire start page, but many users thought the new design is confusing and harder to navigate.  
Inevitably some revolutionists took on the challenge to bring the good old start page back using plug-ins or scripts.  
Unfortunately over the years YouTube changed their API quite a lot and the support for the custom scripts dwindled, and the old start page slowly fell into oblivion.  
But for me it is impossible to live with the unorganized chaos of the new start page.  
So i fixed the script privately time after time when it became incompatible again.  
I even added additional features and finally rewrote the script entirely for performance and code quality reasons.  
Me and my friends have been using the script for many years now and on request i decided to bring it to the public, sharing the enhanced experience it provides.  
That being said, have fun with the script, hopefully it works for you as well as it does for me.  
I am open for suggestions, but keep in mind that i develop the script mostly for myself and probably can't fix every compatibility problem.

## Supported Browsers
Currently only Chrome is supported on which the script is written and tested.  
Other browsers might work as well, just give it a try!

## Permissions
The script requires permissions and has to be authorized via OAuth2. Please log in with the same account you use for YouTube. For this, you have to allow popups temporarily for the first time you execute the script and once after you delete your browser cache.  
Permissions the script requires:  
* **youtube.readonly:**  
    read-only access to your youtube account for reading out the channels you're subscribed to.
* **drive.appdata (optional):**  
    permission to read and write app data on your Google Drive storage for synchronisation of the script between computers or browsers. (Allows only access to files created by this script.)


## Installation

### Install Tampermonkey
YTBSP is a userscript. To run the userscript you need the browser extension Tampermonkey (link).
[![YTBSP Teaser](https://raw.githubusercontent.com/Crow08/YTBSP/update_description/docs/tampermonkey.PNG)](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en)

### Go to the Tampermonkey Dashboard

### Add a new userscript

### Paste YTSB
Paste the code from YTSP into your new userscript, replacing all previous contents.
Don't forget to hit the save button!

### Enjoy!
When you go to youtube.com the new start page will load automatically!

## Misc
Something I might add: This script is network and CPU intensive. If you have a huge amount of subscriptions it might lag while loading.


## Known Issues