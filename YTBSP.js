// ==UserScript==
// @name         YouTube Better Startpage D-edition
// @description  Spotilghts all subscriptions in an oranized fashion on the Startpage of YouTube.
// @version      1.3.0
// @namespace    ytbsp
// @include      http://*youtube.com*
// @include      https://*youtube.com*
// @require      https://apis.google.com/js/api.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.slim.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.18.1/moment.min.js
// @grant        none
// ==/UserScript==
/**
 * The MIT License
 *
 * Copyright (c) 2015-2018 (Crow08)
 * Copyright (c) 2014 (dzre)
 * Copyright (c) 2011-2013 Marco D. Pfeiffer (Nemo64)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
var moment = this.moment;

var GoogleAuth;

(function(unsafeWindow) {
    // Config:
    const LOADSIMSUBCOUNT = 10; 		// DEFAULT: 10 (Range: 1 - 50) (higher numbers result into slower loading of single items but overall faster laoding).
    const ITEMSPERROW = 9; 				// DEFAULT: 9.
    const MAXITEMSPERSUB = 36; 			// DEFAULT: 36 (Range: 1 - 50) (should be dividable by ITEMSPERROW).
    const SCREENLOADTHREADSHOLD = 500; 	// DEFAULT: 500.
    const ENLARGETIMEOUT = 500;         // DEFAULT: 500 (in ms).
	const TIMETOMARKASSEEN = 10			// DEFAILT: 10 (in ms).

    // OAuth
    const CLIENTID = '281397662073-jv0iupog9cdb0eopi3gu6ce543v0jo65.apps.googleusercontent.com';
    const DISCOVERYDOCS = ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'];
    const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

    // Slectors:
    const YT_STARTPAGE_BODY = "#page-manager.ytd-app";
    const YT_VIDEOTITLE = "#info-contents > ytd-video-primary-info-renderer > div:last-child";
    const YT_CHANNELLINK = "#owner-name > a";
	const YT_CONTENT = "#content";

    const MA_TOOLBAR = "#info-contents > ytd-video-primary-info-renderer > div";

	//initialisation of chache-variables
	var cache = null;
	var corruptCache = false;
	var hideSeen = false;
	var hideSubs = false;

	// Get Cache from localStorage and set config.
	cache = localStorage.getItem("YTBSP");
	corruptCache = localStorage.getItem("YTBSPcorruptcache") === "1"; // DEFAULT: false.
	// If last save process was inerrupted: try to load backup.
	if(corruptCache) {
		console.warn("cache corruption detected!");
		console.warn("restoring old cache...");
		cache = localStorage.getItem("YTBSPbackup");
	}

	// Parse the config.
	hideSeen = localStorage.getItem("YTBSPhideSeen") === "1"; // DEFAULT: false.
	hideSubs = localStorage.getItem("YTBSPhide") === "1"; // DEFAULT: false.

	// If we have a cache parse it.
	if(cache === null || cache === "") {
		cache = [];
	} else {
		try {
			cache = JSON.parse(cache);
		} catch(e) {
			console.error("Error parsing cache!");
			cache = [];
		}
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Start OAuth Stuff

	gapi.load('client:auth2', initClient);

	// OAuth init
	function initClient() {
		// Initialize the gapi.client object, which app uses to make API requests.
		gapi.client.init({
			'clientId': CLIENTID,
			'discoveryDocs': DISCOVERYDOCS,
			'scope': SCOPE
		}).then(function() {
			GoogleAuth = gapi.auth2.getAuthInstance();
			// Handle initial sign-in state. (Determine if user is already signed in.)
			setSigninStatus();
		}, function(reason) {
			//console.log(reason); // Error!
		});
	}

	// OAuth signin.
	function setSigninStatus() {
		var user = GoogleAuth.currentUser.get();
		var isAuthorized = user.hasGrantedScopes(SCOPE);
		if(isAuthorized) {
			requestSubs();
		} else {
			GoogleAuth.signIn().then(
				function() {
					// Signin successful then start loading subs.
					requestSubs();
				},
				function(error) {
					// Display popup-blocked message.
					if(error.error == "popup_blocked_by_browser") {
						alert('please allow popups for this page and reload!');
					}
				}
			);
		}
	}

	// Prepare request properties.
	function createResource(properties) {
		var resource = [];
		var normalizedProps = properties;
		for(var p in properties) {
			var value = properties[p];
			if(p && p.substr(-2, 2) == '[]') {
				var adjustedName = p.replace('[]', '');
				if(value) {
					normalizedProps[adjustedName] = value.split(',');
				}
				delete normalizedProps[p];
			}
		}
		for(var p2 in normalizedProps) {
			// Leave properties that don't have values out of inserted resource.
			if(normalizedProps.hasOwnProperty(p2) && normalizedProps[p2]) {
				var propArray = p2.split('.');
				var ref = resource;
				for(var pa = 0; pa < propArray.length; pa++) {
					var key = propArray[pa];
					if(pa == propArray.length - 1) {
						ref[key] = normalizedProps[p2];
					} else {
						ref = ref[key] = ref[key] || {};
					}
				}
			}
		}
		return resource;
	}

	// Prevent unnecessary request parameters.
	function removeEmptyParams(params) {
		for(var p in params) {
			if(!params[p] || params[p] == 'undefined') {
				delete params[p];
			}
		}
		return params;
	}

	// Build proper OAuth request.
	function buildApiRequest(callback, requestMethod, path, params, properties) {
		params = removeEmptyParams(params);
		var request;
		if(properties) {
			var resource = createResource(properties);
			request = gapi.client.request({
				'body': resource,
				'method': requestMethod,
				'path': path,
				'params': params
			});
		} else {
			request = gapi.client.request({
				'method': requestMethod,
				'path': path,
				'params': params
			});
		}
		request.execute(callback);
	}

	// End OAuth Stuff.
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////

	var loadingSubs = 1; // 0: all subs loaded.
	var loadingVids = 1; // 0: all vids loaded.

	var subs = []; // Main Sub array contains all subs and in extension all videos.

	// Gets subs from api. (Called after successful OAuth-login.)
	function requestSubs() {
		buildApiRequest(
			processRequestSubs,
			'GET',
			'/youtube/v3/subscriptions',
			{
				'mine': 'true',
				'part': 'snippet',
				'maxResults': LOADSIMSUBCOUNT,
				'fields': 'items(snippet(resourceId/channelId,title)),nextPageToken,pageInfo,prevPageToken'
			});
	}

	// Parses api results into subs and requests recursively more subpages if needed.
	function processRequestSubs(response) {
		// If Request was denied retry login.
		if(response.hasOwnProperty("error")) {
			console.error("OAuth failed! retrying...");
			GoogleAuth.disconnect();
			setSigninStatus();
			return;
		}
		// If there is another page of subs request it.
		if(response.nextPageToken !== undefined && response.nextPageToken !== null) {
			loadingSubs++;
			buildApiRequest(
				processRequestSubs,
				'GET',
				'/youtube/v3/subscriptions',
				{
					'mine': 'true',
					'part': 'snippet',
					'maxResults': LOADSIMSUBCOUNT,
					'pageToken': response.nextPageToken,
					'fields': 'items(snippet(resourceId/channelId,title)),nextPageToken,pageInfo,prevPageToken'
				});
		}
		// Create subs from the api response.
		response.items.forEach(function(item) {
			subs.push(new Subscription(item.snippet));
		});
		loadingSubs--;
		// All subs loaded.
		if(loadingSubs === 0) {
			$(".ytbsp-loader","#ytbsp-ls").hide();
			$("#ytbsp-refresh","#ytbsp-ls").show();
			loadingVids--;
			// All vids loaded. (In case async loading of videos is faster.)
			if(loadingVids === 0) {
				saveList();
			}
		}
	}

	// Variables for inView check.
	var lastScroll = Date.now(); // The last time the page was moved or resized.
	var screenTop = 0;
	var screenBottom = screenTop + window.innerHeight;

	// Start page is YTBSP.
	var isNative = false;

	// Universal loader as resource.
	const LOADER = '<div class="ytbsp-loader"></div>';

	// Let's build the new site:

	// Create an div for us.
	var maindiv = document.createElement("div");
	maindiv.id = "YTBSP";
	var headerHtml = '<span id="ytbsp-ls">' + LOADER + '<div id="ytbsp-refresh" class="ytbsp-func">&#x27F3;</div></span>' +
		'<span class="ytbsp-func toggleytbsp">toggle YTBSP</span> ' +
		'<span class="ytbsp-func removeAllVideos">remove all videos</span>' +
		'<span class="ytbsp-func resetAllVideos">reset all videos</span> ' +
		'<span class="ytbsp-func backup">backup video info</span>' +
		'<label for="hideSeenCb" class="ytbsp-func hideSeen">'+
		'<input id="hideSeenCb" type="checkbox" ' + (hideSeen ? 'checked="checked" ' : '') +'/>Hide seen videos' +
		'</label>' +
		'<label for="hideSubsCb" class="ytbsp-func hide">' +
		'<input id="hideSubsCb" type="checkbox" ' + (hideSubs ? '' : 'checked="checked" ') + '/>Show empty' +
		'</label>';

	maindiv.innerHTML = '<div id="ytbsp-header">' + headerHtml + '</div>' +
		'<ul id="ytbsp-subs"></ul>' +
		'<div id="ytbsp-modal-darken">' +
		'<div id="ytbsp-modal">' +
		'<div id="ytbsp-modal-content"></div>' +
		'</div>' +
		'</div>';

	// Save a reference for the subList.
	var subList = $("#ytbsp-subs", maindiv);

	// Set functions affecting all subs:
	// Set click event for refresh button, updating all videos for all subs.
	function updateAllSubs(){
		$(".ytbsp-loader","#ytbsp-ls").show();
		$("#ytbsp-refresh","#ytbsp-ls").hide();
        setTimeout(function() {
            loadingVids++;
            subs.forEach(function(sub, i) {
                subs[i].updateVideos();
            });
            $(".ytbsp-loader","#ytbsp-ls").hide();
            $("#ytbsp-refresh","#ytbsp-ls").show();
            loadingVids--;
            // All vids loaded. (In case async loading of videos is faster.)
            if(loadingVids === 0) {
                saveList();
            }
        }, 0);
	}
	$(".ytbsp-func#ytbsp-refresh", maindiv).click(updateAllSubs);

    function shownative() {
        $(YT_STARTPAGE_BODY).show();
        subList.hide();
	}

    function hidenative() {
        $(YT_STARTPAGE_BODY).hide();
        subList.show();
	}
    // Now set click event for the toggle native button.
	function toggleytbsp() {
		isNative = !isNative;
		if(isNative){
            shownative();
        }else{
            hidenative();
        }
	}
	$(".ytbsp-func.toggleytbsp", maindiv).click(toggleytbsp);

	// Remove all videos button.
	function removeAllVideos() {
		if(!confirm("delete all videos?")) {
			return;
		}
		$(".ytbsp-loader","#ytbsp-ls").show();
		$("#ytbsp-refresh","#ytbsp-ls").hide();
		setTimeout(function() {
			var toRebuild = [];
			subs.forEach(function(sub, i) {
				sub.videos.forEach(function(vid, j) {
					if(!subs[i].videos[j].isRemoved()) {
						subs[i].videos[j].remove();
						toRebuild.push(i);
					}
				});
			});
			toRebuild.forEach(function(i) {
				subs[i].buildList();
			});
			saveList();
			$(".ytbsp-loader","#ytbsp-ls").hide();
			$("#ytbsp-refresh","#ytbsp-ls").show();
		}, 0);
	}
	$(".ytbsp-func.removeAllVideos", maindiv).click(removeAllVideos);

	// Reset videos button.
	function resetAllVideos() {
		if(!confirm("reset all videos?")) {
			return;
		}
		$(".ytbsp-loader","#ytbsp-ls").show();
		$("#ytbsp-refresh","#ytbsp-ls").hide();
		setTimeout(function() {
			var toRebuild = [];
			subs.forEach(function(sub, i) {
				sub.videos.forEach(function(vid, j) {
					if(subs[i].videos[j].isRemoved() || subs[i].videos[j].isSeen()) {
						subs[i].videos[j].reset();
						toRebuild.push(i);
					}
				});
			});
			toRebuild.forEach(function(i) {
				subs[i].buildList();
			});
			saveList();
			$(".ytbsp-loader","#ytbsp-ls").hide();
			$("#ytbsp-refresh","#ytbsp-ls").show();
		}, 0);
	}
	$(".ytbsp-func.resetAllVideos", maindiv).click(resetAllVideos);

	// Hide seen videos buttons.
	function hideSeenVideos() {
		localStorage.setItem("YTBSPhideSeen", hideSeen ? "0" : "1");
		hideSeen = !hideSeen;
		subs.forEach(function(sub, i) {
			subs[i].buildList();
		});
		$("input.ytbsp-func.hideSeen", maindiv).prop("checked", hideSeen);
	}
	$("#hideSeenCb", maindiv).change(hideSeenVideos);

	// Hide empty subscriptions button.
	function hideSubsFunc() {
		localStorage.setItem("YTBSPhide", hideSubs ? "0" : "1");
		hideSubs = !hideSubs;
		subs.forEach(function(sub, i) {
			subs[i].handleVisablility();
		});
		$("input.ytbsp-func.hide", maindiv).prop("checked", !hideSubs);
	}
	$("#hideSubsCb", maindiv).change(hideSubsFunc);

	// Open backup dialog.
	function openBackupDialog() {
		if($(".ytbsp-loader","#ytbsp-ls").is(':visible')) {
			alert("Not so fast. Let it load the sub list first.");
			return;
		}

		var content = document.createElement("div");

		var header = document.createElement("h1");
		header.textContent = "Backup video information";
		content.appendChild(header);

		var text = document.createElement("p");
		text.innerHTML = "This Feature allows you to save which videos you have seen and removed and import them again on another browser/computer" +
			" or just to make save you don't loose these informations over night.";
		content.appendChild(text);

		header = document.createElement("h1");
		header.textContent = "How do I do this?";
		content.appendChild(header);

		text = document.createElement("p");
		text.innerHTML = "Just copy the content of the following textbox and save it somewhere.<br />" +
			"To import it again copy it into the textbox and press import data.<br />" +
			"Note that this information will be merged with the already existing one so you can savely import old/multible backups. " +
			"Importing backups can only mark video's as seen or remove them. Not the other way around.";
		content.appendChild(text);

		var exportArea = document.createElement("textarea");
		exportArea.id = "export-import-textarea";
		exportArea.textContent = localStorage.getItem("YTBSP");
		content.appendChild(exportArea);

		var bottom = document.createElement("div");
		bottom.id = "bottom-div";
		bottom.innerHTML = '<input type="submit" class="close-modal" value="close" />' +
			'<input type="submit" class="save-import close-modal" value="import data" />';
		content.appendChild(bottom);

		$(".save-import", bottom).click(function() {
			localStorage.setItem("YTBSP", document.getElementById("export-import-textarea").value);
			setTimeout(function() {
				location.reload();
			}, 500);
		});

		$(".close-modal", bottom).click(function() {
			closeModal();
		});

		openModal(content);
	}
	$(".ytbsp-func.backup", maindiv).click(openBackupDialog);

	// Show backup dialog modal
	function openModal(content) {
		var innerModal = document.getElementById("ytbsp-modal-content");
		var modal = document.getElementById("ytbsp-modal-darken");
		if(!innerModal || !modal) throw new Error("Modal disapeared");
		innerModal.innerHTML = "";
		innerModal.appendChild(content);
		modal.style.display = "block";
		setTimeout(function() {
			modal.style.opacity = "1";
		}, 0);
	}

	// Hide backup dialog modal
	function closeModal() {
		var modal = document.getElementById("ytbsp-modal-darken");
		if(modal) {
			modal.style.display = "none";
			modal.style.opacity = "0";
		}
	}

	/////////////////////////////////////
	// SUBSCRIPTION Object constructor //
	/////////////////////////////////////

	function Subscription(snippet) {

		this.videos = [];
		this.name = snippet.title;
		this.id = snippet.resourceId.channelId;

		// Now build the overview.
		this.row = document.createElement("li");
		this.row.className = "ytbsp-subscription";

		// Create content.
		this.row.innerHTML = '<div class="ytbsp-subinfo">' +
			'<div class="right"><span class="ytbsp-func removeall">remove all</span> <span class="ytbsp-func reset">reset all</span>' +
			' <span class="ytbsp-func allseen">mark all as seen</span>' +
			' <span class="ytbsp-func showmore">show more</span></div>' +
			'<div class="ytbsp-loaderph">' + LOADER + '</div><h3 class="ytbsp-subtitle"><a href="/channel/' + this.id + '"></a></h3>' +
			'</div><ul class="ytbsp-subvids"></ul>';

		// Save some references.
		this.videoList = $(".ytbsp-subvids", this.row)[0];
		this.titleObj = $(".ytbsp-subtitle a", this.row)[0];

		// Put content in place.
		this.titleObj.textContent = this.name;
		subList.append(this.row);

		// Get videos for sub from api.
		this.updateVideos();

		var self = this;

		// Function to remove all videos.
		function removeAll() {
			self.videos.forEach(function(video, i) {
				self.videos[i].remove();
			});
			self.buildList();
			saveList();
		}
		$(".ytbsp-func.removeall", this.row).click(removeAll);

		// Function to reset all videos.
		function resetAll() {
			self.videos.forEach(function(video, i) {
				self.videos[i].reset();
			});
			self.buildList();
			saveList();
		}
		$(".ytbsp-func.reset", this.row).click(resetAll);

		// Function to see all.
		function seeAll() {
			self.videos.forEach(function(video, i) {
				self.videos[i].see();
			});
			self.buildList();
			saveList();

		}
		$(".ytbsp-func.allseen", this.row).click(seeAll);

		// Function to show more.
		function showMore() {
            self.showall = !self.showall;
			if(self.showall) {
				$("span.ytbsp-func.showmore", self.row).text("show less");
			} else {
				$("span.ytbsp-func.showmore", self.row).text("show more");
			}
			self.buildList();
		}
		$("span.ytbsp-func.showmore", this.row).click(showMore);
	}
	Subscription.prototype = {

		showall: false,
		needsUpdate: false,
		isInView: false,

		updateVideos: function(){
			loadingVids++;
			this.showLoader();
			
			buildApiRequest(
				processRequestVids,
				'GET',
				'/youtube/v3/playlistItems',
				{
					'maxResults': MAXITEMSPERSUB,
					'part': 'snippet',
					'fields': 'items(snippet(publishedAt,resourceId/videoId,thumbnails(maxres,medium),title)),nextPageToken,pageInfo,prevPageToken',
					'playlistId': this.id.replace(/^UC/, 'UU')
				}
			);
			
			var self = this;

			function processRequestVids(response) {
				self.videos = [];
				// If videos for sub are in cache find them.
				var cacheSub = $.grep(cache, function(subs) {
					return subs.id == self.id;
				});
				var cacheVideos = [];
				if(cacheSub.length == 1) {
					cacheVideos = cacheSub[0].videos;
				}
				
				response.items.forEach(function(video) {
					var thumb;
					var thumb_large;
					var title;
					var upload;
					var pubDate;
					var vid;
					var seen;
					var removed;

					try {
						thumb = video.snippet.thumbnails.medium.url;
					} catch(e) {}
					try {
						thumb_large = video.snippet.thumbnails.maxres.url;
					} catch(e) {}
					try {
						title = video.snippet.title;
					} catch(e) {}
					try {
						upload = moment(video.snippet.publishedAt).fromNow();
					} catch(e) {}
					try {
						pubDate = moment(video.snippet.publishedAt).format('YYYY-MM-DD HH:mm:ss');
					} catch(e) {}
					try {
						vid = video.snippet.resourceId.videoId;
					} catch(e) {}

					// Merge cache info if available.				
					var cacheVideo = $.grep(cacheVideos, function(cVideo) {
						return cVideo.vid == vid;
					});
					if(cacheVideo.length == 1) {
						try {
							seen = cacheVideo[0].seen;
						} catch(e) {}
						try {
							removed = cacheVideo[0].removed;
						} catch(e) {}
					}

					var infos = {
						vid: vid,
						title: title,
						thumb: thumb ? thumb : "",
						thumb_large: thumb_large ? thumb_large : "",
						uploaded: upload ? upload : "missing upload time",
						pubDate: pubDate ? pubDate : "missing upload time",
						seen: seen ? seen : false,
						removed: removed ? removed : false
					};
					self.videos.push(new Video(infos));
				});
				// Rebuild the list.
				self.buildList();
				self.removeLoader();

				loadingVids--;
				// All vids loaded.
				if(loadingVids === 0) {
					saveList();
				}
			}
		},

		// (Re-)Build the list of videos.
		buildList: function() {

			var self = this;

			var alreadyIn = $(".ytbsp-video-item", this.videoList, true);
			var visableItems = 0;
			var limit = this.showall ? MAXITEMSPERSUB : ITEMSPERROW;
			// Now loop through the videos.
			this.videos.forEach(function(video, i) {

				// If that video is removed search for it and remove it when found.
				if(video.isRemoved() || (hideSeen && video.isSeen())) {
					var thumbNode = $("#YTBSPthumb_" + video.vid, this.videoList, true)[0];
					var index = alreadyIn.index(thumbNode);
					if(thumbNode && index !== -1) {
						thumbNode.parentNode.removeChild(thumbNode);
						alreadyIn.splice(index, 1);
					}

					// if this video isn't removed and we are still in the search of new ones
				} else if(visableItems < limit) {
					var thumb = alreadyIn[visableItems];
					// If Video is already in the list, update it.
					if(thumb && thumb.id.substr(11) === video.vid) {
						this.videos[i].updateThumb(this.inView());
						// If the thumb in this position isn't the right one.
					} else {
						// Create new thumb for video.
						this.videos[i].createThumb(this.inView());
						// Register some events from this thumb.
						$(".ytbsp-seemarker", this.videos[i].thumbLi).click(function() {
							self.videos[i].toggleSeen();
							self.buildList();
							saveList();
						});
						$(".ytbsp-x", this.videos[i].thumbLi).click(function() {
							self.videos[i].remove();
							self.buildList();
							saveList();
						});
						// Insert new thumb.
						if(visableItems < alreadyIn.length) {
							this.videoList.insertBefore(this.videos[i].thumbLi, alreadyIn[visableItems]);
							alreadyIn.splice(visableItems, 0, this.videos[i].thumbLi);

						} else {
							this.videoList.append(this.videos[i].thumbLi);
							alreadyIn.push(this.videos[i].thumbLi);
						}
					}
					++visableItems;
				}
			}, this);

			// Remove overstanding items.
			for(var i = visableItems, ilen = alreadyIn.length; i < ilen; ++i) {
				this.videoList.removeChild(alreadyIn[i]);
			}

			// Handly visability.
			this.isEmpty = visableItems <= 0;
			this.handleVisablility();
		},

		// Hides subscription if needed.
		handleVisablility: function() {
			this.row.style.display = this.isEmpty && hideSubs ? "none" : "";
			updateSubsInView();
		},

		// Displays the Loader.
		showLoader: function(){
			var loadph = $(".ytbsp-loaderph", this.row);
			var loader = $(".ytbsp-loader", this.row);
			if(loadph && loader) {
				loader.css("opacity", "1");
				loader.css("display", "block");
				loadph.css("width", "16px");
			}
		},

		// Removes the Loader.
		removeLoader: function() {
			var loadph = $(".ytbsp-loaderph", this.row);
			var loader = $(".ytbsp-loader", this.row);
			if(loadph && loader) {
				loader.css("opacity", "0");
				setTimeout(function() {
					loader.css("display", "none");
					loadph.css("width", "0px");
				}, 200);
			}
		},

		// Cecks if the subscription is within the threadshold of the view.
		inView: function() {

			if(this.lastViewCheck === lastScroll) {
				return this.isInView;
			}
			this.lastViewCheck = lastScroll;
			var offsetTop = this.videoList ? this.videoList.offsetTop : 0;

            this.isInView = (this.videoList &&
				offsetTop - SCREENLOADTHREADSHOLD < screenBottom &&
				offsetTop + SCREENLOADTHREADSHOLD > screenTop
			);
			return this.isInView;
		},

		// Returns an object that can be saved as json.
		getSaveable: function() {
			var saveable = {
				videos: [],
				id: this.id
			};
			this.videos.forEach(function(video) {
				saveable.videos.push(video.getSaveable());
			});
			return saveable;
		}
	};


	//////////////////////////////
	// VIDEO Object Constructor //
	//////////////////////////////

	function Video(infos) {
		this.vid = infos.vid;
		this.addInfos(infos);
		this.thumbLi = document.createElement("li");
	}

	var timeouts = {};

	Video.prototype = {
		vid: undefined,
		title: "",
		thumb: "",
		thumb_large: "",
		duration: "0:00",
		uploaded: "",
		pubDate: "",
		clicks: "",

		seen: false,
		removed: false,

		thumbItem: null,
		thumblargeItem: null,
		durationItem: null,
		clicksItem: null,
		uploadItem: null,
		titleItem: null,


		addInfos: function(infos) {
			// Set given informations.
			if(infos.hasOwnProperty('title')) {
				this.title = infos.title !== "" ? infos.title : this.title;
			}
			if(infos.hasOwnProperty('thumb')) {
				this.thumb = infos.thumb !== "" ? infos.thumb : this.thumb;
			}
			if(infos.hasOwnProperty('thumb_large')) {
				this.thumb_large = infos.thumb_large !== "" ? infos.thumb_large : this.thumb_large;
			}
			if(infos.hasOwnProperty('duration')) {
				this.duration = infos.duration !== "0:00" ? infos.duration : this.duration;
			}
			if(infos.hasOwnProperty('uploaded')) {
				this.uploaded = infos.uploaded !== "" ? infos.uploaded : this.uploaded;
			}
			if(infos.hasOwnProperty('pubDate')) {
				this.pubDate = infos.pubDate !== "" ? infos.pubDate : this.pubDate;
			}
			if(infos.hasOwnProperty('clicks')) {
				this.clicks = infos.clicks !== "" ? infos.clicks : this.clicks;
			}
			if(infos.hasOwnProperty('seen')) {
				this.seen = infos.seen !== false ? infos.seen : this.seen;
			}
			if(infos.hasOwnProperty('removed')) {
				this.removed = infos.removed !== false ? infos.removed : this.removed;
			}
		},

		isRemoved: function() {
			return this.removed;
		},

		remove: function() {
			if(this.removed) {
				return;
			}
			this.removed = true;
		},

		unremove: function() {
			if(!this.removed) {
				return;
			}
			this.removed = false;
		},

		isSeen: function() {
			return this.seen;
		},

		toggleSeen: function() {
			if(this.seen) {
				this.unsee();
			} else {
				this.see();
			}
		},

		see: function() {
			if(this.seen) {
				return;
			}
			this.seen = true;
			this.updateThumb(true);
		},

		unsee: function() {
			if(!this.seen) {
				return;
			}
			this.seen = false;
			this.updateThumb(true);
		},

		reset: function() {
			this.unsee();
			this.unremove();
		},

		createThumb: function(inView) {
			var self = this;
			if(this.duration == "0:00") {
				buildApiRequest(
					function(response) {
                        var duration;
                        var viewCount;
						try {
							duration = moment.duration(response.items[0].contentDetails.duration);
						} catch(e) {}
						try {
							viewCount = response.items[0].statistics.viewCount + " Views";
						} catch(e) {}
                        var time;
						if(duration.hours() === 0) {
							try {
								time = moment(duration.minutes() + ':' + duration.seconds(), 'm:s').format('mm:ss');
							} catch(e) {}
						} else {
							try {
								time = moment(duration.hours() + ':' + duration.minutes() + ':' + duration.seconds(), 'h:m:s').format('HH:mm:ss');
							} catch(e) {}
						}
						self.duration = time;
						self.clicks = viewCount;

						self.updateThumb(inView);
					},
					'GET',
					'/youtube/v3/videos',
					{
						'part': 'contentDetails,statistics',
						'fields': 'items(contentDetails/duration,statistics/viewCount)',
						'id': self.vid
					}
				);
			}

			this.thumbLi.id = "YTBSPthumb_" + this.vid;
			this.thumbLi.className = "ytbsp-video-item";
			this.thumbLi.innerHTML = '<div class="ytbsp-clip" data-vid=' + this.vid + '>' +
				'<div class="ytbsp-x">X</div>' +
				'<img class="ytbsp-thumb" />' +
				'<ytd-thumbnail-overlay-time-status-renderer></ytd-thumbnail-overlay-time-status-renderer>' +
				'<input type="hidden" class="ytbsp-thumb-large-url" />' +
				'</div>' +
                '<a class="ytbsp-title" href="/watch?v=' + this.vid + '" data-vid=' + this.vid + '></a>' +
				'<p class="ytbsp-seemarker' + (this.isSeen() ? ' seen">already seen' : '">mark as seen') + '</p>' +
				'<p class="ytbsp-views"/>' +
                '<p class="ytbsp-uploaded"/>';

            $(".ytbsp-clip, .ytbsp-title", this.thumbLi).click(function(event){
                if(event.target.classList.contains("ytbsp-x")){
					return;
                }
                event.preventDefault();
                openVideoWithSPF($(this).attr('data-vid'));
            });

			function enlarge(){
				if ($(".ytbsp-x:hover", this).length !== 0) {
					return;
			   }
				if(!(self.vid.replace('-', '$') in timeouts)){
					timeouts[self.vid.replace('-', '$')] = -1;
				}
				var thumb = this.parentElement;
                var clip = this;
				if(timeouts[self.vid.replace('-', '$')] == -1){
					timeouts[self.vid.replace('-', '$')] = setTimeout(function(){
						var img = clip.querySelectorAll('.ytbsp-thumb')[0];
						var title = thumb.querySelectorAll('.ytbsp-title')[0];
						var infos = thumb.querySelectorAll('p');
						img.src= clip.querySelectorAll('.ytbsp-thumb-large-url')[0].value;
						img.classList.add('ytbsp-thumb-large');
						title.classList.add('ytbsp-title-large');
						clip.classList.add('ytbsp-clip-large');
						for (var i = 0; i < infos.length; ++i) {
							infos[i].style.display='none';
						}
					}, ENLARGETIMEOUT);
				}
			}
			$(".ytbsp-clip", this.thumbLi).mouseover(enlarge);

			function enlargecancel(){
				allowenlarge=true;
				if(self.vid.replace('-', '$') in timeouts && timeouts[self.vid.replace('-', '$')] > 0){
					clearTimeout(timeouts[self.vid.replace('-', '$')]);
				}
				timeouts[self.vid.replace('-', '$')] = -1;
                var thumb = this;
                var clip = this.querySelectorAll(".ytbsp-clip")[0];
				var img = clip.querySelectorAll('.ytbsp-thumb')[0];
				var title = thumb.querySelectorAll('.ytbsp-title')[0];
				var infos = thumb.querySelectorAll('p');
				img.classList.remove('ytbsp-thumb-large');
				title.classList.remove('ytbsp-title-large');
				clip.classList.remove('ytbsp-clip-large');
				for (var i = 0; i < infos.length; ++i) {
					infos[i].style.display='';
				}
			}

			$(this.thumbLi).mouseleave(enlargecancel);

			function enlargecanclex(){
				if(self.vid.replace('-', '$') in timeouts){
					clearTimeout(timeouts[self.vid.replace('-', '$')]);
					timeouts[self.vid.replace('-', '$')] = -2;
				}
			}
			$(".ytbsp-x", this.thumbLi).mouseover(enlargecanclex);

			function enlargeresume(){
				var that = $(".ytbsp-clip:hover", this.parentElement.parentElement)[0];
				if (that != 'undefined') {
					timeouts[self.vid.replace('-', '$')] = setTimeout(function(){
						var img = that.querySelectorAll('.ytbsp-thumb')[0];
						var title = that.parentElement.querySelectorAll('.ytbsp-title')[0];
						var infos = that.parentElement.querySelectorAll('p');
						img.src= that.querySelectorAll('.ytbsp-thumb-large-url')[0].value;
						img.classList.add('ytbsp-thumb-large');
						title.classList.add('ytbsp-title-large');
						that.classList.add('ytbsp-clip-large');
						for (var i = 0; i < infos.length; ++i) {
							infos[i].style.display='none';
						}
					}, ENLARGETIMEOUT);
			   }
			}

			$(".ytbsp-x", this.thumbLi).mouseleave(enlargeresume);

			// Save information elements.
			this.thumbItem = $(".ytbsp-thumb", this.thumbLi)[0];
			this.thumblargeItem = $(".ytbsp-thumb-large-url", this.thumbLi)[0];
			this.durationItem = $("div.ytbsp-clip > ytd-thumbnail-overlay-time-status-renderer > span", this.thumbLi)[0];
			this.clicksItem = $(".ytbsp-views", this.thumbLi)[0];
			this.uploadItem = $(".ytbsp-uploaded", this.thumbLi)[0];
			this.titleItem = $("a.ytbsp-title", this.thumbLi)[0];
			this.updateThumb(inView);
		},

		updateThumb: function(inView) {
			if(!this.thumbItem) {
				return;
			}
			if(inView || this.thumbItem.src) {
				this.thumbItem.src = this.thumb;
			} else {
				this.thumbItem.setAttribute('data-src', this.thumb);
			}
			this.thumblargeItem.value = this.thumb_large ? this.thumb_large : this.thumb;
			this.durationItem.textContent = this.duration;
			this.clicksItem.textContent = this.clicks;
			this.uploadItem.textContent = this.uploaded;
			this.titleItem.textContent = this.title;
			this.titleItem.title = this.title;

			var marker = $(".ytbsp-seemarker", this.thumbLi);
			if(this.seen) {
				marker.text("already seen");
				marker.addClass("seen");
			} else {
				marker.text("mark as seen");
				marker.removeClass("seen");
			}

		},

		getSaveable: function() {
			return {
				vid: this.vid,
				seen: this.seen,
				removed: this.removed
			};
		}
	};

	function saveList() {
		var saveObj = [];
		subs.forEach(function(sub) {
			saveObj.push(sub.getSaveable());
		});
		localStorage.setItem("YTBSPcorruptcache", 1);
		var newcache = JSON.stringify(saveObj);
		localStorage.setItem("YTBSP", newcache);
		var oldcache = cache;
		cache = localStorage.getItem("YTBSP");
		if(newcache === cache) {
			localStorage.setItem("YTBSPcorruptcache", 0);
			localStorage.setItem("YTBSPbackup", newcache);
		} else {
			cache = oldcache
			console.log("cache save error!");
		}
		newcache = null;
		oldcache = null;
	}

	// Now we just need to generate a stylesheet

	// Startpage_body display: none is defined via stylesheet to not fash up when loaded.
	// (When loaded this rule has to be removed, to prevent feedpages from loadig with display: none)
    var loading_body_style = YT_STARTPAGE_BODY + ' { background: transparent; display:none; }';
	var startpage_body_style = YT_STARTPAGE_BODY + ' { margin-top: -30px; margin-left: 120px; background: transparent; }';
    var video_body_style = YT_STARTPAGE_BODY + ' { background: transparent; margin-top: -10px; }';
    var search_body_style = YT_STARTPAGE_BODY + ' { background: transparent; margin-top: -50px; }';
    var default_body_style = YT_STARTPAGE_BODY + ' { background: transparent; }';
	function setYTStyleSheet(body_style){
        $("#ytbsp-yt-css").remove();
        var css = document.createElement("style");
        css.type = "text/css";
        css.id="ytbsp-yt-css";
		css.innerHTML = body_style;

		document.head.appendChild(css);
	}

	function addYTBSPStyleSheet() {
		var css = document.createElement("style");
		css.type = "text/css";
		css.id="ytbsp-css";

		// check if we got a dark design
		var color = getComputedStyle(document.body).backgroundColor.match(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
		var color2 = getComputedStyle(document.documentElement).backgroundColor.match(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
		var dark = document.documentElement.getAttribute("dark");
		dark = dark || (color && (parseInt(color[1]) + parseInt(color[2]) + parseInt(color[3])) < 384) ||
			(color2 && (parseInt(color2[1]) + parseInt(color2[2]) + parseInt(color2[3])) < 384);

		var stdFontColor = dark ? "#e1e1e1" : "#111111";
		var subtextColor = dark ? "#BDBDBD" : "#141414";
		var stdBorderColor = dark ? "#2c2c2c" : "#e2e2e2";
		var altBorderColor = dark ? "#737373" : "#737373";
		var stdBgColor = dark ? "#141414" : "#F9F9F9";
		var altBgColor = dark ? "#252525" : "#f5f5f5";


		css.innerHTML =
			// header
			'#ytbsp-header { margin: 20px 9px; white-space: nowrap; display:flex; }' +
			'#YTBSP input { vertical-align: text-top; }' +

			// overall list
			'#ytbsp-subs { overflow: visible; margin: -30px 0 0 -30px; padding: 31px 0px 10px 30px; width: 1180px; box-shadow: none; ' +
			'list-style-type: none;}' +
			'.ytbsp-subscription { border: 1px solid ' + stdBorderColor + '; padding: 0 4px; margin-top: -1px; }' +
			'.ytbsp-subvids { padding: 0px; margin: 10px 0; -webkit-transition: height 5s; -moz-transition: height 5s; -o-transition: height 5s; }' +
			'.ytbsp-video-item { display: inline-block; width: 122px; height: 152px; padding: 0 4px; overflow: visible; vertical-align: top; }' +
			'.ytbsp-video-item a { display: block; height: 2.3em; line-height: 1.2em; overflow: hidden; color: ' + stdFontColor + '; }' +
			'.ytbsp-video-item p { color: ' + subtextColor + '; margin: 3px; }' +
			'.ytbsp-subinfo { height: 25px; margin: 4px 4px 3px; }' +
			'#YTBSP .right { float: right; }' +
			'.ytbsp-subtitle a { color: ' + stdFontColor + '; padding-top: 6px; position: absolute;}' +
			'#YTBSP {margin-left: 240px; margin-top: 60px; zoom: 1.2;}' +
			'#ytbsp-subs .ytbsp-title-large{ width: 316px; left: -103px; position: relative; z-index: 1; background: ' + altBgColor + '; text-align: center;' +
			'border-width: 0px 3px 3px 3px; border-style: solid; border-color: ' + altBorderColor + '; padding: 2px; top: -2px;}' +

			// image part
			'.ytbsp-clip { position: relative; width: 124px; height: 70px; border: none; cursor: pointer;}' +
			'.ytbsp-clip-large { z-index: 1; width: 320px; height: 180px; top: -45px; left: -100px; margin-bottom: -40px; border: none; }' +
			'.ytbsp-video-item .ytbsp-x { position: absolute; z-index: 2; top: 2px; right: 2px; opacity: 0.6; width: 14px; height: 14px; ' +
			'line-height: 14px; text-align: center; background-color: #000; color: #fff; font-size: 12px; font-weight: bold; ' +
			'border-radius: 3px; -moz-border-radius: 3px; display: none; cursor: pointer;}' +
			'.ytbsp-video-item:hover .ytbsp-x { display: block; }' +
			'.ytbsp-x:hover { opacity: 1; }' +
			'.ytbsp-thumb { display: block; position: absolute; height: 68px;  width: 121px; border: 1px solid rgb(115, 115, 114); }' +
			'.ytbsp-thumb-large { width: 320px; height: 180px; border: 3px solid ' + altBorderColor + '; top: -3px; left: -3px;}' +

			// infos
			'.ytbsp-seemarker { background-color: ' + altBgColor + '; color: ' + stdFontColor + '; border-radius: 1px;  padding: 1px 0px; ' +
			'text-align: center; opacity: 0.6; border: 1px solid ' + stdBorderColor + '; cursor: pointer}' +
			'.ytbsp-seemarker:hover { opacity: 1; }' +
			'.ytbsp-seemarker:active { opacity: 0.4; }' +
			'.ytbsp-seemarker.seen { opacity: 1; }' +
			'.ytbsp-seemarker.seen:hover { opacity: 0.6; }' +

			// functionbuttons
			'#YTBSP .ytbsp-func { color: ' + subtextColor + '; cursor: pointer; display: inline-block; border: 1px solid ' + stdBorderColor + '; z-index: 1;' +
			'background-color: ' + altBgColor + '; padding: 1px 10px; margin: 0px 2px; opacity: 0.6;}' +
			'#YTBSP .ytbsp-func:hover { opacity: 1; }' +
			'#YTBSP .ytbsp-func:active { opacity: 0.4; }' +
			'#YTBSP .ytbsp-func input{ vertical-align: middle; margin: -2px 5px -1px 0px;}' +

			// loader
			'.ytbsp-loaderph { float: left; width: 16px; height: 16px; margin-right: 5px; ' +
			'-webkit-transition: width 0.4s; -moz-transition: width 0.4s; -o-transition: width 0.4s; }' +
			'#ytbsp-ls { margin-left: -10px; width: 21px; margin-right: 1px;}' +
			'#YTBSP #ytbsp-refresh {display: none; padding: 1px 3px;}' +
			'.ytbsp-loader { border: 3px solid #bbb; border-top: 3px solid #555; border-left: 3px solid #bbb; border-bottom: 3px solid #555; ' +
			'border-radius: 50%; width: 10px; height: 10px; animation: spin 1s linear infinite; -webkit-transition: opacity 0.3s; ' +
			'-moz-transition: opacity 0.3s; -o-transition: opacity 0.3s;}' +
			'@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }}' +

			// modal
			'#ytbsp-modal-darken { position: fixed; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,.4); z-index: 3;' +
			'-webkit-transition: opacity .2s; -moz-transition: opacity .2s; -o-transition: opacity .2s; opacity: 0; overflow: auto; display: none; }' +
			'#ytbsp-modal { margin: 0 auto; width: 600px; min-height: 20px; margin-top: 30px; padding: 5px; background: ' + altBgColor + '; ' +
			' position: sticky; top: 60px; -moz-border-radius: 3px; border-radius: 3px; box-shadow: 0 5px 20px rgba(0,0,0,.4); }' +
			'#ytbsp-modal textarea { width: 595px; height: 400px; resize: none; margin: 20px 0; }' +
			'#ytbsp-modal #bottom-div { display: inline-block; width: 100%; }' +
			'#ytbsp-modal-content p, h1 {color:' + stdFontColor + '}' +
			'.close-modal { float: right }';

		document.head.appendChild(css);
	}

	// Because of the extreme ammount of thumbs they shouldn't be downloaded all at once (data-src instead of src)
	// since 2012.6-1 also the entire update only starts as soon as you scroll to it
	// The solution is: only download those on the screen

	// now we need an scroll event
	// also if the window is resized it should be triggered
	var scrollTimeout = null;
	var moved = false;
	function checkEvent() {
		if(scrollTimeout === null) {
			scrollTimeout = setTimeout(function() {
				updateSubsInView();
				if(moved) {
					moved = false;
					checkEvent();
				}
			}, 100);
		} else {
			moved = true;
		}
	}
	window.addEventListener("scroll", checkEvent, false);
	window.addEventListener("resize", checkEvent, false);

	function updateSubsInView() {
		lastScroll = Date.now();
		screenTop = document.body.scrollTop || document.documentElement.scrollTop;
		screenBottom = screenTop + window.innerHeight;
		// check subs which has to be updated
		subs.forEach(function(sub) {
			if(sub.inView()) {
				// get all images that don't have a src but have an data-src
				$("img[data-src]", sub.videoList).each(function() {
					$(this).get(0).src = $(this).get(0).getAttribute("data-src");
					$(this).get(0).removeAttribute("data-src");
				});
			}
		});
		scrollTimeout = null;
	}
    setYTStyleSheet(loading_body_style);

    function handlePageChange(){
        // forces some images to reload...
        window.dispatchEvent(new Event('resize'));
        // If we are on the startpage (or feed pages).
        if(/^(\/?|((\/feed\/)(trending|subscriptions|history)\/?))?$/i.test(location.pathname)) {
            setYTStyleSheet(startpage_body_style);
		} else if(/^\/?watch$/.test(location.pathname)) {
            setYTStyleSheet(video_body_style);
            watchpage();
        }else if (/^\/?results$/.test(location.pathname)){
            setYTStyleSheet(search_body_style);
		}else{
            setYTStyleSheet(default_body_style);
        }
        if(location.pathname.length > 1) {
            shownative();
            isNative=true;
        }else{
            hidenative();
            isNative=false;
        }
    }
    function injectYTBSP(){
        $(YT_CONTENT).prepend(maindiv);
        addYTBSPStyleSheet();
        $(window).scrollTop(0);
    }

    function setHrefObserver(){
        var oldHref = document.location.href;
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (oldHref != document.location.href) {
                    oldHref = document.location.href;
                    handlePageChange();
                }

                if ($('#YTBSP').length === 0 && $(YT_CONTENT).length!==0){
                    injectYTBSP();
                }
            });
        });
        observer.observe(document.querySelector("body"), {childList: true, subtree: true});
    }

    // Hide MA Toolbar.
	function hideMAToolbar(){
		var css = document.createElement("style");
		css.type = "text/css";
		css.innerHTML = MA_TOOLBAR + '{display: none;}' +
			YT_VIDEOTITLE + ' {display: block;}';
		document.head.appendChild(css);
	}

    function watchpage(){
        hideMAToolbar();
		// Mark as seen after at least 10 secounds.
        setTimeout(function() {
            var vid = location.href.match(/v=([^&]{11})/)[1];
            if(vid) {
                var sid = $(YT_CHANNELLINK).attr('href').match(/\/channel\/([^&]*)/)[1];
                subs.forEach(function(sub, i) {
                    if(sub.id == sid) {
                        sub.videos.forEach(function(video, j) {
                            if(video.vid == vid) {
                                subs[i].videos[j].see();
                                subs[i].buildList();
                                saveList();
                            }
                        });
                    }
                });
            }
        }, TIMETOMARKASSEEN * 1000);
	}

    function openVideoWithSPF(vid){
        var ytdApp = document.querySelector('ytd-app');
        ytdApp.fire("yt-navigate", {
            endpoint: {
                watchEndpoint: {
                    videoId:vid
                },
                webNavigationEndpointData: {
                    url:"/watch?v="+vid,
                    webPageType:"WATCH"
                }
            }
        });
    }
	// Old page is loaded.
	$( document ).ready(function() {
        // Insert new page.
        if($(YT_CONTENT).length!==0){
            injectYTBSP();
        }
        $(YT_STARTPAGE_BODY).hide();
        setHrefObserver();
		handlePageChange();
	});
})(window.unsafeWindow || window);