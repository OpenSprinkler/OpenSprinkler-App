/*global $, Windows, MSApp, navigator, chrome, FastClick, StatusBar, networkinterface, links */
var isIEMobile = /IEMobile/.test(navigator.userAgent),
    isAndroid = /Android|\bSilk\b/.test(navigator.userAgent),
    isiOS = /iP(ad|hone|od)/.test(navigator.userAgent),
    isFireFoxOS = /^.*?\Mobile\b.*?\Firefox\b.*?$/m.test(navigator.userAgent),
    isWinApp = /MSAppHost/.test(navigator.userAgent),
    isBB10 = /BB10/.test(navigator.userAgent),
    isIE = /MSIE (\d+)\.\d+;/.exec(navigator.userAgent) || false,
    isOSXApp = isOSXApp || false,
    isChromeApp = typeof chrome === "object" && typeof chrome.storage === "object",
    isFileCapable = !isiOS && !isAndroid && !isIEMobile && !isOSXApp && !isFireFoxOS  && !isWinApp && !isBB10 && window.FileReader,
    // Small wrapper to handle Chrome vs localStorage usage
    storage = {
        get: function(query,callback) {
            callback = callback || function(){};

            if (isChromeApp) {
                chrome.storage.local.get(query,callback);
            } else {
                var data = {},
                    i;

                if (typeof query === "object") {
                    for (i in query) {
                        if (query.hasOwnProperty(i)) {
                            data[query[i]] = localStorage.getItem(query[i]);
                        }
                    }
                } else if (typeof query === "string") {
                    data[query] = localStorage.getItem(query);
                }

                callback(data);
            }
        },
        set: function(query,callback) {
            callback = callback || function(){};

            if (isChromeApp) {
                chrome.storage.local.set(query,callback);
            } else {
                var i;
                if (typeof query === "object") {
                    for (i in query) {
                        if (query.hasOwnProperty(i)) {
                            localStorage.setItem(i,query[i]);
                        }
                    }
                }

                callback(true);
            }
        },
        remove: function(query,callback) {
            callback = callback || function(){};

            if (isChromeApp) {
                chrome.storage.local.remove(query,callback);
            } else {
                var i;

                if (typeof query === "object") {
                    for (i in query) {
                        if (query.hasOwnProperty(i)) {
                            localStorage.removeItem(query[i]);
                        }
                    }
                } else if (typeof query === "string") {
                    localStorage.removeItem(query);
                }

                callback(true);
            }
        }
    },
    retryCount = 3,
    controller = {},
    switching = false,
    curr_183, curr_ip, curr_prefix, curr_auth, curr_pw, curr_wa, curr_auth_user, curr_auth_pw, curr_local, language, deviceip, interval_id, timeout_id, errorTimeout, weatherKeyFail;

// Redirect jQuery Mobile DOM manipulation to prevent error
if (isWinApp) {
    // Add link to privacy statement
    var settingsPane = Windows.UI.ApplicationSettings.SettingsPane.getForCurrentView();

    settingsPane.addEventListener("commandsrequested", function(eventArgs) {
        var applicationCommands = eventArgs.request.applicationCommands;
        var privacyCommand = new Windows.UI.ApplicationSettings.SettingsCommand("privacy", "Privacy Policy", function(){
            window.open("https://albahra.com/journal/privacy-policy");
        });
        applicationCommands.append(privacyCommand);
    });

    // Cache the old domManip function.
    $.fn.oldDomManIp = $.fn.domManip;
    // Override the domManip function with a call to the cached domManip function wrapped in a MSapp.execUnsafeLocalFunction call.
    $.fn.domManip = function (args, callback, allowIntersection) {
        var that = this;
        return MSApp.execUnsafeLocalFunction(function () {
            return that.oldDomManIp(args, callback, allowIntersection);
        });
    };
}

$(document)
.ready(initApp)
.one("deviceready", function() {
    try {
        //Change the status bar to match the headers
        StatusBar.overlaysWebView(false);
        StatusBar.styleLightContent();
        StatusBar.backgroundColorByHexString("#1D1D1D");
    } catch (err) {}

    // Hide the splash screen
    setTimeout(function(){
        try {
            navigator.splashscreen.hide();
        } catch(err) {}
    },500);

    // Check if device is on a local network
    checkAutoScan();

    // For Android, Blackberry and Windows Phone devices catch the back button and redirect it
    $.mobile.document.on("backbutton",function(){
        if (isIEMobile && $.mobile.document.data("iabOpen")) {
            return false;
        }
        goBack();
        return false;
    });
})
.one("mobileinit", function(){
    //After jQuery mobile is loaded set intial configuration
    $.mobile.defaultPageTransition = "fade";
    $.mobile.hoverDelay = 0;
    $.mobile.activeBtnClass = "activeButton";
    if (isChromeApp) {
        $.mobile.hashListeningEnabled = false;
    }

    //Change history method for Chrome Packaged Apps
    if (isChromeApp) {
        $.mobile.document.on("click",".ui-toolbar-back-btn",function(){
            goBack();
            return false;
        });
    }

    if (!isOSXApp) {
        $.mobile.document.on("click",".iab",function(){
            var button = $(this),
                iab = window.open(this.href,"_blank","location=no,enableViewportScale="+(button.hasClass("iabNoScale") ? "no" : "yes")+",toolbarposition=top,closebuttoncaption="+(button.hasClass("iabNoScale") ? _("Back") : _("Done")));

            if (isIEMobile) {
                $.mobile.document.data("iabOpen",true);
                iab.addEventListener("exit",function(){
                    $.mobile.document.removeData("iabOpen");
                });
            }

            setTimeout(function(){
                button.removeClass("ui-btn-active");
            },100);
            return false;
        });
    }

    // Correctly handle popup events and prevent history navigation on custom selectmenu popup
    $.mobile.document.on("click",".ui-select .ui-btn",function(){
        var button = $(this),
            id = button.attr("id").replace("-button","-listbox"),
            popup = $("#"+id),
            screen = $("#"+id+"-screen");

        popup.popup({
            history: false,
            "positionTo": button
        }).popup("open");

        button.off("click").on("click",function(){
            popup.popup("open");
        });

        screen.off("click").on("click",function(){
            popup.popup("close");
        });

        return false;
    });

    // Bind event handler to open panel when swiping right
    $.mobile.document.on("swiperight",".ui-page",function() {
        if ($(".ui-page-active").jqmData("panel") !== "open" && !$(".ui-page-active .ui-popup-active").length && $(".ui-page-active").attr("id") !== "preview") {
            open_panel();
        }
    });
})
.one("pagebeforechange", function(event) {
    // Let the framework know we're going to handle the first load
    event.preventDefault();

    // Bind the event handler for subsequent pagebeforechange requests
    $.mobile.document.on("pagebeforechange",function(e,data){
        var page = data.toPage,
            currPage = $(".ui-page-active"),
            hash;

        // Pagebeforechange event triggers twice (before and after) and this check ensures we get the before state
        if (typeof data.toPage !== "string") {
            return;
        }

        hash = $.mobile.path.parseUrl(page).hash;

        if (hash === "#"+currPage.attr("id")) {
            if (hash === "#programs" || hash === "#site-control") {
                // Cancel page load when navigating to the same page
                e.preventDefault();

                // Allow pages to navigate back by adjusting active index in history
                $.mobile.navigate.history.activeIndex--;

                // Remove the current page from the DOM
                currPage.remove();

                // Change to page without any animation or history change
                changePage(hash,{
                    transition: "none",
                    showLoadMsg: false,
                    showBack: data.options.showBack
                });
            }
            return;
        }

        // Animations are patchy if the page isn't scrolled to the top. This scrolls the page before the animation fires off
        if (data.options.role !== "popup" && !$(".ui-popup-active").length) {
            $.mobile.silentScroll(0);
        }

        // Cycle through page possbilities and call their init functions
        if (hash === "#programs") {
            get_programs(data.options.programToExpand);
        } else if (hash === "#addprogram") {
            add_program(data.options.copyID);
        } else if (hash === "#status") {
            get_status();
            $(hash).one("pageshow",refresh_status);
        } else if (hash === "#manual") {
            get_manual();
        } else if (hash === "#about") {
            show_about();
        } else if (hash === "#runonce") {
            get_runonce();
        } else if (hash === "#os-options") {
            show_options();
        } else if (hash === "#preview") {
            get_preview();
        } else if (hash === "#logs") {
            get_logs();
        } else if (hash === "#start") {
            checkAutoScan();
            if (!data.options.showStart) {
                if ($.isEmptyObject(controller)) {
                    changePage("#site-control",{"showBack": false});
                }
                return false;
            }
        } else if (hash === "#os-stations") {
            show_stations();
        } else if (hash === "#site-control") {
            show_sites(data.options.showBack);
        } else if (hash === "#weather_settings") {
            show_weather_settings();
        } else if (hash === "#addnew") {
            show_addnew();
            return false;
        } else if (hash === "#localization") {
            languageSelect();
            return false;
        } else if (hash === "#debugWU") {
            debugWU();
            return false;
        } else if (hash === "#raindelay") {
            showSingleDurationInput({
                data: 0,
                title: _("Change Rain Delay"),
                callback: raindelay,
                label: _("Duration (in hours)"),
                maximum: 96,
                updateOnChange: false,
                helptext: _("Enable manual rain delay by entering a value into the input below. To turn off a currently enabled rain delay use a value of 0.")
            });
            return false;
        } else if (hash === "#site-select") {
            show_site_select();
            return false;
        } else if (hash === "#sprinklers") {
            $(hash).one("pagebeforeshow",function(){
                if (!data.options.firstLoad) {
                    //Reset status bar to loading while an update is done
                    showLoading("#footer-running");
                    setTimeout(function(){
                        refresh_status();
                    },1000);
                } else {
                    check_status();
                }
            });
        }
    });

    //On initial load check if a valid site exists for auto connect
    check_configured(true);

    //Attach FastClick handler
    FastClick.attach(document.body);

    // Initialize external panel
    $("#sprinklers-settings").enhanceWithin().panel().removeClass("hidden");
})
// Handle OS resume event triggered by PhoneGap
.on("resume",function(){
    var page = $(".ui-page-active").attr("id"),
        func = function(){};

    // Check if device is still on a local network
    checkAutoScan();

    // If we don't have a current device IP set, there is nothing else to update
    if (curr_ip === undefined) {
        return;
    }

    // Indicate the weather and device status are being updated
    showLoading("#weather,#footer-running");

    if (page === "status") {
        // Update the status page
        func = function(){
            page.trigger("datarefresh");
        };
    } else if (page === "sprinklers") {
        // Update device status bar on main page
        func = check_status;
    }

    update_controller(function(){
        func();
        update_weather();
    },network_fail);
})
.on("pause",function(){
    //Remove any status timers that may be running
    removeTimers();
})
.on("pageshow",function(e){
    var newpage = "#"+e.target.id,
        $newpage = $(newpage);

    // Fix issues between jQuery Mobile and FastClick
    fixInputClick($newpage);

    if (newpage === "#sprinklers" || newpage === "#status" || newpage === "#os-stations") {
        // Update the page every 10 seconds
        var refreshInterval = setInterval(refresh_status,5000);
        $newpage.one("pagehide",function(){
            clearInterval(refreshInterval);
        });
    }
})
.on("popupafteropen",function(){
    if ($(".ui-overlay-b:not(.ui-screen-hidden)").length) {
        try {
            StatusBar.backgroundColorByHexString("#202020");
        } catch (err) {}
    }
})
.on("popupafterclose",function(){
    try {
        StatusBar.backgroundColorByHexString("#1D1D1D");
    } catch (err) {}
})
.on("pagehide","#start",removeTimers)
.on("popupbeforeposition","#localization",check_curr_lang);

//Set AJAX timeout
if (!curr_local) {
    $.ajaxSetup({
        timeout: 6000
    });
}

function initApp() {
    //Update the language on the page using the browser's locale
    update_lang();

    // Fix CSS for IE Mobile (Windows Phone 8)
    if (isIEMobile) {
        insertStyle(".ui-toolbar-back-btn{display:none!important}ul{list-style: none !important;}@media(max-width:940px){.wicon{margin:-10px -10px -15px -15px !important}#forecast .wicon{position:relative;left:37.5px;margin:0 auto !important}}");
    }

    // Fix style for IE 9
    if (isIE && isIE[1] === "9") {
        insertStyle(".input_with_buttons button{zoom:1!important}");
    }

    // Fix CSS for Chrome Web Store apps
    if (isChromeApp) {
        insertStyle("html,body{overflow-y:scroll}");
    }

    // Prevent caching of AJAX requests on Android and Windows Phone devices
    if (isAndroid) {
        // Hide the back button for Android (all devices have back button)
        insertStyle(".ui-toolbar-back-btn{display:none!important}");

        $(this).ajaxStart(function(){
            try {
                navigator.app.clearCache();
            } catch (err) {}
        });
    } else if (isFireFoxOS) {
        // Allow cross domain AJAX requests in FireFox OS
        $.ajaxSetup({
          xhrFields: {
            mozSystem: true
          }
        });
    } else {
        $.ajaxSetup({
            "cache": false
        });
    }

    //Update site based on selector
    $("#site-selector").on("change",function(){
        update_site($(this).val());
    });

    //Bind start page buttons
    $("#auto-scan").find("a").on("click",function(){
        start_scan();
        return false;
    });

    //Bind open panel button
    $("#sprinklers").on("datarefresh",check_status).find("div[data-role='header'] > .ui-btn-left").on("click",function(){
        open_panel();
        return false;
    });

    //Bind stop all stations button
    $("#stop-all").on("click",function(){
        areYouSure(_("Are you sure you want to stop all stations?"), "", function() {
            $.mobile.loading("show");
            send_to_os("/cv?pw=&rsn=1").done(function(){
                $.mobile.loading("hide");
                showLoading("#footer-running");
                setTimeout(function(){
                    $.when(
                        update_controller_settings(),
                        update_controller_status()
                    ).then(check_status);
                }, 1000);
                showerror(_("All stations have been stopped"));
            });
        });
    });

    //When app isn't using cordova.js, check network status now
    if (isChromeApp || isOSXApp) {
        checkAutoScan();
    }
}

// Handle main switches for manual mode and enable
function flipSwitched() {
    if (switching) {
        return;
    }

    //Find out what the switch was changed to
    var flip = $(this),
        id = flip.attr("id"),
        changedTo = flip.is(":checked"),
        method = (id === "mmm") ? "mm" : id,
        defer;

    if (changedTo) {
        defer = send_to_os("/cv?pw=&"+method+"=1");
    } else {
        defer = send_to_os("/cv?pw=&"+method+"=0");
    }

    $.when(defer).then(function(){
        update_controller_settings();
        update_controller_status();
        if (id === "mmm") {
            $("#mm_list .green").removeClass("green");
        }
        check_status();
    },
    function(){
        switching = true;
        setTimeout(function(){
            switching = false;
        },200);
        flip.prop("checked",!changedTo).flipswitch("refresh");
    });
}

// Wrapper function to communicate with OpenSprinkler
function send_to_os(dest,type) {
    // Inject password into the request
    dest = dest.replace("pw=","pw="+encodeURIComponent(curr_pw));
    type = type || "text";

    var obj = {
        url: curr_prefix+curr_ip+dest,
        type: "GET",
        dataType: type,
        retry: {times: retryCount, statusCodes:[0,408,500]}
    },
    defer;

    if (curr_auth) {
        $.extend(obj,{
            beforeSend: function(xhr) { xhr.setRequestHeader("Authorization", "Basic " + btoa(curr_auth_user + ":" + curr_auth_pw)); }
        });
    }

    if (curr_183) {
        $.extend(obj,{
            cache: "true"
        });
    }

    defer = $.ajaxQueue(obj).then(
        function(data){
            // In case the data type was incorrect, attempt to fix. If fix not possible, return string
            if (typeof data === "string") {
                try {
                    data = $.parseJSON(data);
                } catch(e) {
                    return data;
                }
            }

            // Don't need to handle this situation for OSPi or firmware below 2.1.0
            if (typeof data !== "object" || typeof data.result !== "number") {
                return data;
            }

            // Return as successful
            if (data.result === 1) {
                return data;

            // Handle incorrect password
            } else if (data.result === 2) {
                showerror(_("Check device password and try again."));

                // Tell subsequent handlers this request has failed (use 401 to prevent retry)
                return $.Deferred().reject({"status":401});

            // Handle page not found by triggering fail
            } else if (data.result === 32) {

                return $.Deferred().reject({"status":401});
            }

            // Only show error messages on setting change requests
            if (/\/(?:cv|cs|cr|cp|uwa|dp|co|cl|cu|up|cm)/.exec(dest)) {
                if (data.result === 2) {
                    showerror(_("Check device password and try again."));
                } else if (data.result === 48) {
                    showerror(_("The selected station is already running or is scheduled to run."));
                } else {
                    showerror(_("Please check input and try again."));
                }

                // Tell subsequent handlers this request has failed
                return $.Deferred().reject(data);
            }

        },
        function(e){
            if ((e.statusText==="timeout" || e.status===0) && /\/(?:cv|cs|cr|cp|uwa|dp|co|cl|cu|cm)/.exec(dest)) {
                // Handle the connection timing out but only show error on setting change
                showerror(_("Connection timed-out. Please try again."));
            } else if (e.status===401) {
                //Handle unauthorized requests
                showerror(_("Check device password and try again."));
            }
            return;
        }
    );

    return defer;
}

function network_fail(){
    change_status(0,"red","<p class='running-text center'>"+_("Network Error")+"</p>",function(){
        showLoading("#weather,#footer-running");
        refresh_status();
        update_weather();
    });
    hide_weather();
}

// Gather new controller information and load home page
function newload() {
    var name = $("#site-selector").val(),
        loading = "<div class='logo'></div><h1 style='padding-top:5px'>"+_("Connecting to")+" "+name+"</h1><p class='cancel tight center inline-icon'><span class='btn-no-border ui-btn ui-icon-delete ui-btn-icon-notext'></span>Cancel</p>";

    $.mobile.loading("show", {
        html: curr_local ? "<h1>"+_("Loading")+"</h1>" : loading,
        textVisible: true,
        theme: "b"
    });

    $(".ui-loader").css({
        "box-shadow": "none",
        "margin-top": "-4em"
    }).find(".cancel").one("click",function(){
        $.ajaxQueue.clear();
        changePage("#site-control",{"showBack": false});
    });

    //Empty object which will store device data
    controller = {};

    //Clear the current queued AJAX requests (used for previous controller connection)
    $.ajaxQueue.clear();

    update_controller(
        function(){
            var log_button = $("#log_button"),
                manual_mode = $(".manual_mode"),
                weatherAdjust = $(".weatherAdjust"),
                change_password = $(".change_password");

            $.mobile.loading("hide");
            check_status();
            update_weather();

            // Hide manual mode from the app for Arduino firmware 2.1.0+
            if (checkOSVersion(210)) {
                manual_mode.hide();
                weatherAdjust.css("display","");
            } else {
                manual_mode.css("display","");
                weatherAdjust.hide();
            }

            // Hide log viewer button on home page if not supported
            if (checkOSVersion(206) || checkOSPiVersion("1.9")) {
                log_button.css("display","");
            } else {
                log_button.hide();
            }

            // Hide change password feature for unsupported devices
            if (isOSPi() || checkOSVersion(208)) {
                change_password.css("display","");
            } else {
                change_password.hide();
            }

            // Show site name instead of default Information bar
            if (!curr_local) {
                $("#info-list").find("li[data-role='list-divider']").text(name);
                document.title = "OpenSprinkler - "+name;
            } else {
                $("#info-list").find("li[data-role='list-divider']").text(_("Information"));
            }

            // Check if automatic rain delay plugin is enabled on OSPi devices
            checkWeatherPlugin();

            goHome();
        },
        function(){
            $.ajaxQueue.clear();
            controller = {};

            if (!curr_local) {
                changePage("#site-control",{"showBack": false});
            } else {
                storage.remove(["sites"],function(){
                    window.location.reload();
                });
            }
        }
    );
}

// Update controller information
function update_controller(callback,fail) {
    callback = callback || function(){};
    fail = fail || function(){};

    $.when(
        update_controller_programs(),
        update_controller_stations(),
        update_controller_options(),
        update_controller_status(),
        update_controller_settings()
    ).then(callback,fail);
}

function update_controller_programs(callback) {
    callback = callback || function(){};

    if (curr_183 === true) {
        return send_to_os("/gp?d=0").done(function(programs){
            var vars = programs.match(/(nprogs|nboards|mnp)=[\w|\d|.\"]+/g),
                progs = /pd=\[\];(.*);/.exec(programs),
                newdata = {}, tmp, prog;

            for (var i=0; i<vars.length; i++) {
                if (vars[i] === "") {
                    continue;
                }
                tmp = vars[i].split("=");
                newdata[tmp[0]] = parseInt(tmp[1]);
            }

            newdata.pd = [];
            if (progs !== null) {
                progs = progs[1].split(";");
                for (i=0; i<progs.length; i++) {
                    prog = progs[i].split("=");
                    prog = prog[1].replace("[", "");
                    prog = prog.replace("]", "");
                    newdata.pd[i] = parseIntArray(prog.split(","));
                }
            }

            controller.programs = newdata;
            callback();
        });
    } else {
        return send_to_os("/jp?pw=","json").done(function(programs){
            controller.programs = programs;
            callback();
        });
    }
}

function update_controller_stations(callback) {
    callback = callback || function(){};

    if (curr_183 === true) {
        return send_to_os("/vs").done(function(stations){
            var names = /snames=\[(.*?)\];/.exec(stations),
                masop = stations.match(/(?:masop|mo)\s?[=|:]\s?\[(.*?)\]/);

            names = names[1].split(",");
            names.pop();

            for (var i=0; i<names.length; i++) {
                names[i] = names[i].replace(/'/g,"");
            }

            masop = parseIntArray(masop[1].split(","));

            controller.stations = {
                "snames": names,
                "masop": masop,
                "maxlen": names.length
            };
            callback();
        });
    } else {
        return send_to_os("/jn?pw=","json").done(function(stations){
            controller.stations = stations;
            callback();
        });
    }
}

function update_controller_options(callback) {
    callback = callback || function(){};

    if (curr_183 === true) {
        return send_to_os("/vo").done(function(options){
            var isOSPi = options.match(/var sd\s*=/),
                vars = {}, tmp, i, o;

            if (isOSPi) {
                var varsRegex = /(tz|htp|htp2|nbrd|seq|sdt|mas|mton|mtoff|urs|rst|wl|ipas)\s?[=|:]\s?([\w|\d|.\"]+)/gm,
                    name;

                while ((tmp = varsRegex.exec(options)) !== null) {
                    name = tmp[1].replace("nbrd","ext").replace("mtoff","mtof");
                    vars[name] = +tmp[2];
                }
                vars.ext--;
                vars.fwv = "1.8.3-ospi";
            } else {
                var keyIndex = {1:"tz",2:"ntp",12:"hp0",13:"hp1",14:"ar",15:"ext",16:"seq",17:"sdt",18:"mas",19:"mton",20:"mtof",21:"urs",22:"rso",23:"wl",25:"ipas",26:"devid"};
                tmp = /var opts=\[(.*)\];/.exec(options);
                tmp = tmp[1].replace(/"/g,"").split(",");

                for (i=0; i<tmp.length-1; i=i+4) {
                    o = +tmp[i+3];
                    if ($.inArray(o,[1,2,12,13,14,15,16,17,18,19,20,21,22,23,25,26]) !== -1) {
                        vars[keyIndex[o]] = +tmp[i+2];
                    }
                }
                vars.fwv = 183;
            }
            controller.options = vars;
            callback();
        });
    } else {
        return send_to_os("/jo?pw=","json").done(function(options){
            controller.options = options;
            callback();
        });
    }
}

function update_controller_status(callback) {
    callback = callback || function(){};

    if (curr_183 === true) {
        return send_to_os("/sn0").then(
            function(status){
                var tmp = status.toString().match(/\d+/);

                tmp = parseIntArray(tmp[0].split(""));

                controller.status = tmp;
                callback();
            },
            function(){
                controller.status = [];
            });
    } else {
        return send_to_os("/js?pw=","json").then(
            function(status){
                controller.status = status.sn;
                callback();
            },
            function(){
                controller.status = [];
            });
    }
}

function update_controller_settings(callback) {
    callback = callback || function(){};

    if (curr_183 === true) {
        return send_to_os("").then(
            function(settings){
                var varsRegex = /(ver|devt|nbrd|tz|en|rd|rs|mm|rdst|urs)\s?[=|:]\s?([\w|\d|.\"]+)/gm,
                    loc = settings.match(/loc\s?[=|:]\s?[\"|'](.*)[\"|']/),
                    lrun = settings.match(/lrun=\[(.*)\]/),
                    ps = settings.match(/ps=\[(.*)\];/),
                    vars = {}, tmp, i;

                ps = ps[1].split("],[");
                for (i = ps.length - 1; i >= 0; i--) {
                    ps[i] = parseIntArray(ps[i].replace(/\[|\]/g,"").split(","));
                }

                while ((tmp = varsRegex.exec(settings)) !== null) {
                    vars[tmp[1]] = +tmp[2];
                }

                vars.loc = loc[1];
                vars.ps = ps;
                vars.lrun = parseIntArray(lrun[1].split(","));

                controller.settings = vars;
            },
            function(){
                if (controller.settings && controller.stations) {
                    var ps = [], i;
                    for (i=0; i<controller.stations.maxlen; i++) {
                        ps.push([0,0]);
                    }
                    controller.settings.ps = ps;
                }
            });
    } else {
        return send_to_os("/jc?pw=","json").then(
            function(settings){
                if (typeof settings.lrun === "undefined") {
                    settings.lrun = [0,0,0,0];
                }
                controller.settings = settings;
                callback();
            },
            function(){
                if (controller.settings && controller.stations) {
                    var ps = [], i;
                    for (i=0; i<controller.stations.maxlen; i++) {
                        ps.push([0,0]);
                    }
                    controller.settings.ps = ps;
                }
            });
    }
}

// Multisite functions
function check_configured(firstLoad) {
    storage.get(["sites","current_site"],function(data){
        var sites = data.sites,
            current = data.current_site,
            names;

        try {
            sites = JSON.parse(sites) || {};
        } catch(e) {
            sites = {};
        }

        names = Object.keys(sites);

        if (!names.length) {
            if (firstLoad) {
                changePage("#start",{
                    showStart: true
                });
            }
            return;
        }

        if (current === null || !(current in sites)) {
            $.mobile.loading("hide");
            changePage("#site-control",{"showBack": false});
            return;
        }

        update_site_list(names,current);

        curr_ip = sites[current].os_ip;
        curr_pw = sites[current].os_pw;

        if (typeof sites[current].ssl !== "undefined" && sites[current].ssl === "1") {
            curr_prefix = "https://";
        } else {
            curr_prefix = "http://";
        }

        if (typeof sites[current].auth_user !== "undefined" && typeof sites[current].auth_pw !== "undefined") {
            curr_auth = true;
            curr_auth_user = sites[current].auth_user;
            curr_auth_pw = sites[current].auth_pw;
        } else {
            curr_auth = false;
        }

        if (sites[current].is183) {
            curr_183 = true;
        } else {
            curr_183 = false;
        }

        newload();
    });
}

// Add a new site
function submit_newuser(ssl,useAuth) {
    document.activeElement.blur();
    $.mobile.loading("show");

    var ip = $.mobile.path.parseUrl($("#os_ip").val()).hrefNoHash.replace(/https?:\/\//,""),
        success = function(data,sites){
            $.mobile.loading("hide");
            var is183;

            if ((typeof data === "string" && data.match(/var (en|sd)\s*=/)) || (typeof data.fwv === "number" && data.fwv === 203)) {
                is183 = true;
            }

            if (data.fwv !== undefined || is183 === true) {
                var name = $("#os_name").val();

                if (name === "") {
                    name = "Site "+(Object.keys(sites).length+1);
                }

                sites[name] = {};
                sites[name].os_ip = curr_ip = ip;
                sites[name].os_pw = curr_pw = $("#os_pw").val();

                if (ssl) {
                    sites[name].ssl = "1";
                    curr_prefix = "https://";
                } else {
                    curr_prefix = "http://";
                }

                if (useAuth) {
                    sites[name].auth_user = $("#os_auth_user").val();
                    sites[name].auth_pw = $("#os_auth_pw").val();
                    curr_auth = true;
                    curr_auth_user = sites[name].auth_user;
                    curr_auth_pw = sites[name].auth_pw;
                } else {
                    curr_auth = false;
                }

                if (is183 === true) {
                    sites[name].is183 = "1";
                    curr_183 = true;
                }

                $("#os_name,#os_ip,#os_pw,#os_auth_user,#os_auth_pw").val("");
                storage.set({
                    "sites": JSON.stringify(sites),
                    "current_site": name
                },function(){
                    update_site_list(Object.keys(sites),name);
                    newload();
                });
            } else {
                showerror(_("Check IP/Port and try again."));
            }
        },
        fail = function (x){
            if (!useAuth && x.status === 401) {
                getAuth();
                return;
            }
            if (ssl) {
                $.mobile.loading("hide");
                showerror(_("Check IP/Port and try again."));
            } else {
                submit_newuser(true);
            }
        },
        getAuth = function(){
            if ($("#addnew-auth").length) {
                submit_newuser(ssl,true);
            } else {
                showAuth();
            }
        },
        showAuth = function(){
            $.mobile.loading("hide");
            var html = $("<div class='ui-content' id='addnew-auth'>" +
                    "<form method='post' novalidate>" +
                        "<p class='center smaller'>"+_("Authorization Required")+"</p>" +
                        "<label for='os_auth_user'>"+_("Username:")+"</label>" +
                        "<input autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' type='text' name='os_auth_user' id='os_auth_user'>" +
                        "<label for='os_auth_pw'>"+_("Password:")+"</label>" +
                        "<input type='password' name='os_auth_pw' id='os_auth_pw'>" +
                        "<input type='submit' value='"+_("Submit")+"'>" +
                    "</form>" +
                "</div>").enhanceWithin();

            html.on("submit","form",function(){
                submit_newuser(ssl,true);
                return false;
            });

            $("#addnew-content").hide();
            $("#addnew").append(html).popup("reposition",{positionTo:"window"});
        },
        prefix;

    if (!ip) {
        showerror(_("An IP address is required to continue."));
        return;
    }

    if (useAuth !== true && $("#os_useauth").is(":checked")) {
        getAuth();
        return;
    }

    if ($("#os_usessl").is(":checked") === true) {
        ssl = true;
    }

    if (ssl) {
        prefix = "https://";
    } else {
        prefix = "http://";
    }

    if (useAuth) {
        $("#addnew-auth").hide();
        $("#addnew-content").show();
        $("#addnew").popup("reposition",{positionTo:"window"});
    }

    //Submit form data to the server
    $.ajax({
        url: prefix+ip+"/jo?pw="+$("#os_pw").val(),
        type: "GET",
        dataType: "json",
        timeout: 3000,
        global: false,
        beforeSend: function(xhr) {
            if (useAuth) {
                xhr.setRequestHeader("Authorization", "Basic " + btoa($("#os_auth_user").val() + ":" + $("#os_auth_pw").val()));
            }
        },
        error: function(x){
            if (!useAuth && x.status === 401) {
                getAuth();
                return;
            }
            $.ajax({
                url: prefix+ip,
                type: "GET",
                dataType: "text",
                timeout: 3000,
                global: false,
                cache: true,
                beforeSend: function(xhr) {
                    if (useAuth) {
                        xhr.setRequestHeader("Authorization", "Basic " + btoa($("#os_auth_user").val() + ":" + $("#os_auth_pw").val()));
                    }
                },
                success: function(reply){
                    storage.get("sites",function(data){
                        var sites = (data.sites === undefined || data.sites === null) ? {} : JSON.parse(data.sites);
                        success(reply,sites);
                    });
                },
                error: fail
            });
        },
        success: function(reply){
            storage.get("sites",function(data){
                var sites = (data.sites === undefined || data.sites === null) ? {} : JSON.parse(data.sites);
                success(reply,sites);
            });
        }
    });
}

function show_site_select(list) {
    $("#site-select").popup("destroy").remove();

    var popup = $("<div data-role='popup' id='site-select' data-theme='a' data-overlay-theme='b'>" +
            "<div data-role='header' data-theme='b'>" +
                "<h1>"+_("Select Site")+"</h1>" +
            "</div>" +
            "<div class='ui-content'>" +
                "<ul data-role='none' class='ui-listview ui-corner-all ui-shadow'>" +
                "</ul>" +
            "</div>" +
        "</div>");

    if (list) {
        popup.find("ul").html(list);
    }

    popup.one("popupafterclose",function(){
        $(this).popup("destroy").remove();
    }).popup({
        history: false,
        "positionTo": "window"
    }).enhanceWithin().popup("open");
}

function show_addnew(autoIP,closeOld) {
    $("#addnew").popup("destroy").remove();

    var isAuto = (autoIP) ? true : false,
        addnew = $("<div data-role='popup' id='addnew' data-theme='a'>"+
            "<div data-role='header' data-theme='b'>"+
                "<h1>"+_("New Device")+"</h1>" +
            "</div>" +
            "<div class='ui-content' id='addnew-content'>" +
                "<form method='post' novalidate>" +
                    ((isAuto) ? "" : "<p class='center smaller'>"+_("Note: The name is used to identify the OpenSprinkler within the app. OpenSprinkler IP can be either an IP or hostname. You can also specify a port by using IP:Port")+"</p>") +
                    "<label for='os_name'>"+_("Open Sprinkler Name:")+"</label>" +
                    "<input autocorrect='off' spellcheck='false' type='text' name='os_name' id='os_name' placeholder='Home'>" +
                    ((isAuto) ? "" : "<label for='os_ip'>"+_("Open Sprinkler IP:")+"</label>") +
                    "<input "+((isAuto) ? "data-role='none' style='display:none' " : "")+"autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' type='url' pattern='' name='os_ip' id='os_ip' value='"+((isAuto) ? autoIP : "")+"' placeholder='home.dyndns.org'>" +
                    "<label for='os_pw'>"+_("Open Sprinkler Password:")+"</label>" +
                    "<input type='password' name='os_pw' id='os_pw' value=''>" +
                    ((isAuto) ? "" : "<div data-theme='a' data-mini='true' data-role='collapsible'><h4>Advanced</h4><fieldset data-role='controlgroup' data-type='horizontal' data-mini='true' class='center'>" +
                        "<input type='checkbox' name='os_useauth' id='os_useauth'>" +
                        "<label for='os_useauth'>"+_("Use Auth")+"</label>" +
                        "<input type='checkbox' name='os_usessl' id='os_usessl'>" +
                        "<label for='os_usessl'>"+_("Use SSL")+"</label>" +
                    "</fieldset></div>") +
                    "<input type='submit' data-theme='b' value='"+_("Submit")+"'>" +
                "</form>" +
            "</div>" +
        "</div>");

    addnew.find("form").on("submit",function(){
        submit_newuser();
        return false;
    });

    addnew.one("popupafterclose",function(){
        $(this).popup("destroy").remove();
    }).popup({
        history: false,
        "positionTo": "window"
    }).enhanceWithin();

    if (closeOld) {
        $(".ui-popup-active").children().first().one("popupafterclose",function(){
            addnew.popup("open");
        }).popup("close");
    } else {
        addnew.popup("open");
    }

    fixInputClick(addnew);

    addnew.find(".ui-collapsible-heading-toggle").on("click",function(){
        var open = $(this).parents(".ui-collapsible").hasClass("ui-collapsible-collapsed"),
            page = $.mobile.pageContainer.pagecontainer("getActivePage"),
            height = parseInt(page.css("min-height"));

        if (open) {
            page.css("min-height",(height+65)+"px");
        } else {
            page.css("min-height",(height-65)+"px");
        }

        addnew.popup("reposition",{positionTo:"window"});
    });
}

function show_sites(showBack) {
    var page = $("<div data-role='page' id='site-control'>" +
            "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false' data-hide-during-focus=''>" +
                "<a role='button' href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                "<h3>"+_("Manage Sites")+"</h3>" +
                "<button id='site-add' data-icon='plus' class='ui-btn-right'>"+_("Add")+"</button>" +
            "</div>" +
            "<div class='ui-content'>" +
            "</div>" +
            "<div data-role='popup' id='addsite' data-theme='b'>" +
                "<ul data-role='listview'>" +
                    "<li data-icon='false'><a href='#' id='site-add-scan'>"+_("Scan For Device")+"</a></li>" +
                    "<li data-icon='false'><a href='#' id='site-add-manual'>"+_("Manually Add Device")+"</a></li>" +
                "</ul>" +
            "</div>" +
        "</div>"),
        popup = page.find("#addsite"),
        addButton = page.find("#site-add"),
        sites, total;

    popup.popup({
        history: false,
        positionTo: addButton
    }).enhanceWithin();

    addButton.on("click",function(){
        if (typeof deviceip === "undefined") {
            show_addnew();
        } else {
            popup.popup("open").popup("reposition",{
                "positionTo": "#site-add"
            });
        }
    });

    popup.find("#site-add-scan").on("click",function(){
        popup.popup("close");
        start_scan();
        return false;
    });

    popup.find("#site-add-manual").on("click",function(){
        show_addnew(false,true);
        return false;
    });

    page.one("pagehide",function(){
        page.remove();
    });

    storage.get(["sites","current_site"],function(data){
        if (data.sites === undefined || data.sites === null) {
            changePage("#start",{
                showStart: true
            });
        } else {
            var list = "<div data-role='collapsible-set'>";

            sites = JSON.parse(data.sites);
            total = Object.keys(sites).length;

            if (!total || showBack === false || !(data.current_site in sites)) {
                page.one("pagebeforeshow",function(){
                    page.find(".ui-btn-left").hide();
                });

                document.title = "OpenSprinkler";
            }

            $.each(sites,function(a,b){
                var c = a.replace(/ /g,"_");
                list += "<fieldset "+((total === 1) ? "data-collapsed='false'" : "")+" id='site-"+c+"' data-role='collapsible'>";
                list += "<legend>"+a+"</legend>";
                list += "<a data-role='button' class='connectnow' data-site='"+a+"' href='#'>"+_("Connect Now")+"</a>";
                list += "<form data-site='"+c+"' novalidate>";
                list += "<label for='cnm-"+c+"'>"+_("Change Name")+"</label><input id='cnm-"+c+"' type='text' placeholder='"+a+"'>";
                list += "<label for='cip-"+c+"'>"+_("Change IP")+"</label><input id='cip-"+c+"' type='url' placeholder='"+b.os_ip+"' autocomplete='off' autocorrect='off' autocapitalize='off' pattern='' spellcheck='false'>";
                list += "<label for='cpw-"+c+"'>"+_("Change Password")+"</label><input id='cpw-"+c+"' type='password'>";
                list += "<input type='submit' value='"+_("Save Changes to")+" "+a+"'></form>";
                list += "<a data-role='button' class='deletesite' data-site='"+a+"' href='#' data-theme='b'>"+_("Delete")+" "+a+"</a>";
                list += "</fieldset>";
            });

            list = $(list+"</div>");

            list.find(".connectnow").on("click",function(){
                update_site($(this).data("site"));
                return false;
            });

            list.find("form").on("submit",function(){
                change_site($(this).data("site"));
                return false;
            });

            list.find(".deletesite").on("click",function(){
                delete_site($(this).data("site"));
                return false;
            });

            page.find(".ui-content").html(list.enhanceWithin());
        }
    });

    $("#site-control").remove();
    page.appendTo("body");
}

function delete_site(site) {
    areYouSure(_("Are you sure you want to delete")+" '"+site+"'?","",function(){
        storage.get(["sites","current_site"],function(data){
            var sites = (data.sites === undefined || data.sites === null) ? {} : JSON.parse(data.sites);

            delete sites[site];
            storage.set({"sites":JSON.stringify(sites)},function(){
                update_site_list(Object.keys(sites),data.current_site);
                if ($.isEmptyObject(sites)) {
                    changePage("#start",{
                        showStart: true
                    });
                    return false;
                }
                changePage("#site-control",{showLoadMsg: false});
                showerror(_("Site deleted successfully"));
                return false;
            });
        });
    });
}

// Modify site IP and/or password
function change_site(site) {
    storage.get(["sites","current_site"],function(data){
        var sites = (data.sites === undefined || data.sites === null) ? {} : JSON.parse(data.sites),
            ip = $("#cip-"+site).val(),
            pw = $("#cpw-"+site).val(),
            nm = $("#cnm-"+site).val(),
            rename;

        site = site.replace(/_/g," ");
        rename = (nm !== "" && nm !== site);

        if (ip !== "") {
            sites[site].os_ip = ip;
        }
        if (pw !== "") {
            sites[site].os_pw = pw;
        }
        if (rename) {
            sites[nm] = sites[site];
            delete sites[site];
            site = nm;
            storage.set({"current_site":site});
            update_site_list(Object.keys(sites),site);
        }

        storage.set({"sites":JSON.stringify(sites)});

        showerror(_("Site updated successfully"));

        if (site === data.current_site) {
            if (pw !== "") {
                curr_pw = pw;
            }
            if (ip !== "") {
                check_configured();
            }
        }

        if (rename) {
            changePage("#site-control");
        }
    });
}

// Update the panel list of sites
function update_site_list(names,current) {
    var list = "",
        select = $("#site-selector");

    $.each(names,function(a,b){
        list += "<option "+(b===current ? "selected ":"")+"value='"+b+"'>"+b+"</option>";
    });

    select.html(list);
    if (select.parent().parent().hasClass("ui-select")) {
        select.selectmenu("refresh");
    }
}

// Change the current site
function update_site(newsite) {
    storage.get("sites",function(data){
        var sites = (data.sites === undefined || data.sites === null) ? {} : JSON.parse(data.sites);
        if (newsite in sites) {
            storage.set({"current_site":newsite},check_configured);
        }
    });
}

// Automatic device detection functions
function checkAutoScan() {
    var finishCheck = function(){
        if (ip === undefined) {
            resetStartMenu();
            return;
        }

        var chk = parseIntArray(ip.split("."));

        // Check if the IP is on a private network, if not don't enable automatic scanning
        if (!(chk[0] === 10 || (chk[0] === 172 && chk[1] > 17 && chk[1] < 32) || (chk[0] === 192 && chk[1] === 168))) {
            resetStartMenu();
            return;
        }

        //Change main menu items to reflect ability to automatically scan
        var auto = $("#auto-scan"),
            next = auto.next();

        next.removeClass("ui-first-child").find("a.ui-btn").text(_("Manually Add Device"));
        auto.show();

        deviceip = ip;
    },
    ip;

    try {
        if (isChromeApp) {
            chrome.system.network.getNetworkInterfaces(function(data){
                var i;
                for (i in data) {
                    if (data.hasOwnProperty(i)) {
                        if (/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(data[i].address)) {
                            ip = data[i].address;
                        }
                    }
                }

                finishCheck();
            });
        } else {
            // Request the device's IP address
            networkinterface.getIPAddress(function(data){
                ip = data;
                finishCheck();
            });
        }
    } catch (err) {
        resetStartMenu();
        return;
    }
}

function resetStartMenu() {
    // Change main menu to reflect manual controller entry
    var auto = $("#auto-scan"),
        next = auto.next();

    deviceip = undefined;

    next.addClass("ui-first-child").find("a.ui-btn").text(_("Add Controller"));
    auto.hide();
}

function start_scan(port,type) {
    // type represents the OpenSprinkler model as defined below
    // 0 - OpenSprinkler using firmware 2.0+
    // 1 - OpenSprinkler Pi using 1.9+
    // 2 - OpenSprinkler using firmware 1.8.3
    // 3 - OpenSprinkler Pi using 1.8.3

    var ip = deviceip.split("."),
        scanprogress = 1,
        devicesfound = 0,
        newlist = "",
        suffix = "",
        oldips = [],
        isCanceled = false,
        i, url, notfound, found, baseip, check_scan_status, scanning, dtype, text;

    type = type || 0;
    port = (typeof port === "number") ? port : 80;

    storage.get("sites",function(data){
        var oldsites = (data.sites === undefined || data.sites === null) ? {} : JSON.parse(data.sites),
            i;

        for (i in oldsites) {
            if (oldsites.hasOwnProperty(i)) {
                oldips.push(oldsites[i].os_ip);
            }
        }
    });

    notfound = function(){
        scanprogress++;
    };

    found = function (reply) {
        scanprogress++;
        var ip = $.mobile.path.parseUrl(this.url).authority,
            fwv, tmp;

        if ($.inArray(ip,oldips) !== -1) {
            return;
        }

        if (this.dataType === "text") {
            tmp = reply.match(/var\s*ver=(\d+)/);
            if (!tmp) {
                return;
            }
            fwv = tmp[1];
        } else {
            if (!reply.hasOwnProperty("fwv")) {
                return;
            }
            fwv = reply.fwv;
        }

        devicesfound++;

        newlist += "<li><a class='ui-btn ui-btn-icon-right ui-icon-carat-r' href='#' data-ip='"+ip+"'>"+ip+"<p>"+_("Firmware")+": "+getOSVersion(fwv)+"</p></a></li>";
    };

    // Check if scanning is complete
    check_scan_status = function() {
        if (isCanceled === true) {
            $.mobile.loading("hide");
            clearInterval(scanning);
            return false;
        }

        if (scanprogress === 245) {
            $.mobile.loading("hide");
            clearInterval(scanning);
            if (!devicesfound) {
                if (type === 0) {
                    start_scan(8080,1);

                } else if (type === 1) {
                    start_scan(80,2);

                } else if (type === 2) {
                    start_scan(8080,3);

                } else {
                    showerror(_("No new devices were detected on your network"));
                }
            } else {
                newlist = $(newlist);

                newlist.find("a").on("click",function(){
                    add_found($(this).data("ip"));
                    return false;
                });

                show_site_select(newlist);
            }
        }
    };

    ip.pop();
    baseip = ip.join(".");

    if (type === 0) {
        text = _("Scanning for OpenSprinkler");
    } else if (type === 1) {
        text = _("Scanning for OpenSprinkler Pi");
    } else if (type === 2) {
        text = _("Scanning for OpenSprinkler (1.8.3)");
    } else if (type === 3) {
        text = _("Scanning for OpenSprinkler Pi (1.8.3)");
    }

    $.mobile.loading("show", {
        html: "<h1>"+text+"</h1><p class='cancel tight center inline-icon'><span class='btn-no-border ui-btn ui-icon-delete ui-btn-icon-notext'></span>Cancel</p>",
        textVisible: true,
        theme: "b"
    });

    $(".ui-loader").find(".cancel").one("click",function(){
        isCanceled = true;
    });

    // Start scan
    for (i = 1; i<=244; i++) {
        ip = baseip+"."+i;
        if (type < 2) {
            suffix = "/jo";
            dtype = "json";
        } else {
            dtype = "text";
        }
        url = "http://"+ip+((port && port !== 80) ? ":"+port : "")+suffix;
        $.ajax({
            url: url,
            type: "GET",
            dataType: dtype,
            timeout: 3000,
            global: false,
            error: notfound,
            success: found
        });
    }
    scanning = setInterval(check_scan_status,200);
}

// Show popup for new device after populating device IP with selected result
function add_found(ip) {
    $("#site-select").one("popupafterclose", function(){
        show_addnew(ip);
    }).popup("close");
}

// Weather functions
function show_weather_settings() {
    var page = $("<div data-role='page' id='weather_settings'>" +
        "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false' data-hide-during-focus=''>" +
            "<a href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
            "<h3>"+_("Weather Settings")+"</h3>" +
            "<a href='#' class='ui-btn-right wsubmit'>"+_("Submit")+"</a>" +
        "</div>" +
        "<div class='ui-content' role='main'>" +
            "<ul data-role='listview' data-inset='true'>" +
                "<li>" +
                    "<label for='weather_provider'>"+_("Weather Provider")+"</label>" +
                    "<select data-mini='true' id='weather_provider'>" +
                        "<option value='yahoo' "+(curr_wa.weather_provider === "yahoo" ? "selected" : "")+">"+_("Yahoo!")+"</option>" +
                        "<option value='wunderground' "+(curr_wa.weather_provider === "wunderground" ? "selected" : "")+">"+_("Wunderground")+"</option>" +
                    "</select>" +
                    "<label "+(curr_wa.weather_provider === "wunderground" ? "" : "style='display:none' ")+"for='wapikey'>"+_("Wunderground API Key")+"</label><input "+(curr_wa.weather_provider === "wunderground" ? "" : "style='display:none' ")+"data-mini='true' type='text' id='wapikey' value='"+curr_wa.wapikey+"'>" +
                "</li>" +
            "</ul>" +
            "<ul data-role='listview' data-inset='true'> " +
                "<li>" +
                    "<p class='rain-desc'>"+_("When automatic rain delay is enabled, the weather will be checked for rain every hour. If the weather reports any condition suggesting rain, a rain delay is automatically issued using the below set delay duration.")+"</p>" +
                        "<div class='ui-field-contain'>" +
                            "<label for='auto_delay'>"+_("Auto Rain Delay")+"</label>" +
                            "<input type='checkbox' data-on-text='On' data-off-text='Off' data-role='flipswitch' name='auto_delay' id='auto_delay' "+(curr_wa.auto_delay === "on" ? "checked" : "")+">" +
                        "</div>" +
                        "<div class='ui-field-contain duration-input'>" +
                            "<label for='delay_duration'>"+_("Delay Duration")+"</label>" +
                            "<button id='delay_duration' data-mini='true' value='"+(curr_wa.delay_duration*3600)+"'>"+dhms2str(sec2dhms(curr_wa.delay_duration*3600))+"</button>" +
                        "</div>" +
                "</li>" +
            "</ul>" +
            "<a class='wsubmit' href='#' data-role='button' data-theme='b' type='submit'>"+_("Submit")+"</a>" +
        "</div>" +
    "</div>");

    //Handle provider select change on weather settings
    page.find("#weather_provider").on("change",function(){
        var val = $(this).val();
        if (val === "wunderground") {
            page.find("#wapikey,label[for='wapikey']").show("fast");
            page.find("#wapikey").parent(".ui-input-text").css("border-style","solid");
        } else {
            page.find("#wapikey,label[for='wapikey']").hide("fast");
            page.find("#wapikey").parent(".ui-input-text").css("border-style","none");
        }
    });

    page.find(".wsubmit").on("click",function(){
        submit_weather_settings();
        return false;
    });

    page.find("#delay_duration").on("click",function(){
        var dur = $(this),
            name = page.find("label[for='"+dur.attr("id")+"']").text();

        showDurationBox({
            seconds: dur.val(),
            title: name,
            callback: function(result){
                dur.val(result);
                dur.text(dhms2str(sec2dhms(result)));
            },
            maximum: 345600,
            granularity:2
        });
    });

    page.one({
        pagehide: function(){
            page.remove();
        },
        pagebeforeshow: function() {
            if (curr_wa.weather_provider !== "wunderground") {
                page.find("#wapikey").parent(".ui-input-text").css("border-style","none");
            }
        }
    });
    $("#weather_settings").remove();
    page.appendTo("body");
}

function submit_weather_settings() {
    var url = "/uwa?auto_delay="+($("#auto_delay").is(":checked") ? "on" : "off")+"&delay_duration="+parseInt($("#delay_duration").val()/3600)+"&weather_provider="+$("#weather_provider").val()+"&wapikey="+$("#wapikey").val();

    $.mobile.loading("show");

    send_to_os(url).then(
        function(){
            $.mobile.document.one("pageshow",function(){
                showerror(_("Weather settings have been saved"));
            });
            goBack();
            checkWeatherPlugin();
        },
        function(){
            showerror(_("Weather settings were not saved. Please try again."));
        }
    );
}

function convert_temp(temp,region) {
    if (region === "United States" || region === "Bermuda" || region === "Palau") {
        temp = temp+"&#176;F";
    } else {
        temp = parseInt(Math.round((temp-32)*(5/9)))+"&#176;C";
    }
    return temp;
}

function hide_weather() {
    $("#weather-list").animate({
        "margin-left": "-1000px"
    },1000,function(){
        $(this).hide();
    });
}

function update_weather() {
    if (typeof controller.settings.wtkey !== "undefined" && controller.settings.wtkey !== "") {
        update_wunderground_weather(controller.settings.wtkey);
        return;
    }

    storage.get(["provider","wapikey"],function(data){
        if (controller.settings.loc === "") {
            hide_weather();
            return;
        }

        showLoading("#weather");

        if (data.provider === "wunderground" && data.wapikey) {
            update_wunderground_weather(data.wapikey);
        } else {
            update_yahoo_weather();
        }
    });
}

function weather_update_failed(x,t,m) {
    if (m.url && (m.url.search("yahooapis.com") !== -1 || m.url.search("api.wunderground.com") !== -1)) {
        hide_weather();
        return;
    }
}

function update_yahoo_weather() {
    $.ajax({
        url: "https://query.yahooapis.com/v1/public/yql?q=select%20woeid%20from%20geo.placefinder%20where%20text=%22"+encodeURIComponent(controller.settings.loc)+"%22&format=json",
        dataType: isChromeApp ? "json" : "jsonp",
        contentType: "application/json; charset=utf-8",
        success: function(woeid){
            if (woeid.query.results === null) {
                hide_weather();
                return;
            }

            var wid;

            if (typeof woeid.query.results.Result.woeid === "string") {
                wid = woeid.query.results.Result.woeid;
            } else {
                wid = woeid.query.results.Result[0].woeid;
            }

            $.ajax({
                url: "https://query.yahooapis.com/v1/public/yql?q=select%20item%2Ctitle%2Clocation%20from%20weather.forecast%20where%20woeid%3D%22"+wid+"%22&format=json",
                dataType: isChromeApp ? "json" : "jsonp",
                contentType: "application/json; charset=utf-8",
                success: function(data){
                    // Hide the weather if no data is returned
                    if (data.query.results.channel.item.title === "City not found") {
                        hide_weather();
                        return;
                    }
                    var now = data.query.results.channel.item.condition,
                        title = data.query.results.channel.title,
                        loc = /Yahoo! Weather - (.*)/.exec(title),
                        region = data.query.results.channel.location.country;

                    $("#weather")
                        .html("<div title='"+now.text+"' class='wicon cond"+now.code+"'></div><span>"+convert_temp(now.temp,region)+"</span><br><span class='location'>"+loc[1]+"</span>")
                        .on("click",show_forecast);

                    $("#weather-list").animate({
                        "margin-left": "0"
                    },1000).show();

                    update_yahoo_forecast(data.query.results.channel.item.forecast,loc[1],region,now);

                    $.mobile.document.trigger("weatherUpdateComplete");
                }
            }).retry({times:retryCount, statusCodes: [0]}).fail(weather_update_failed);
        }
    }).retry({times:retryCount, statusCodes: [0]}).fail(weather_update_failed);
}

function update_yahoo_forecast(data,loc,region,now) {
    var list = "<li data-role='list-divider' data-theme='a' class='center'>"+loc+"</li>",
        i;

    list += "<li data-icon='false' class='center'><div title='"+now.text+"' class='wicon cond"+now.code+"'></div><span data-translate='Now'>"+_("Now")+"</span><br><span>"+convert_temp(now.temp,region)+"</span></li>";

    for (i=0;i < data.length; i++) {
        list += "<li data-icon='false' class='center'><span>"+data[i].date+"</span><br><div title='"+data[i].text+"' class='wicon cond"+data[i].code+"'></div><span data-translate='"+data[i].day+"'>"+_(data[i].day)+"</span><br><span data-translate='Low'>"+_("Low")+"</span><span>: "+convert_temp(data[i].low,region)+"  </span><span data-translate='High'>"+_("High")+"</span><span>: "+convert_temp(data[i].high,region)+"</span></li>";
    }

    var forecast = $("#forecast_list");
    forecast.html(list).enhanceWithin();
    if (forecast.hasClass("ui-listview")) {
        forecast.listview("refresh");
    }
}

function update_wunderground_weather(wapikey) {
    $.ajax({
        url: "https://api.wunderground.com/api/"+wapikey+"/conditions/forecast/lang:EN/q/"+encodeURIComponent(controller.settings.loc)+".json",
        dataType: isChromeApp ? "json" : "jsonp",
        contentType: "application/json; charset=utf-8",
        success: function(data) {
            var code, temp;

            if (typeof data.response.error === "object" && data.response.error.type === "keynotfound") {
                weatherKeyFail = true;
                update_yahoo_weather();
                return;
            } else {
                weatherKeyFail = false;
            }

            if (data.current_observation.icon_url.indexOf("nt_") !== -1) {
                code = "nt_"+data.current_observation.icon;
            } else {
                code = data.current_observation.icon;
            }

            var ww_forecast = {
                "condition": {
                    "text": data.current_observation.weather,
                    "code": code,
                    "temp_c": data.current_observation.temp_c,
                    "temp_f": data.current_observation.temp_f,
                    "date": data.current_observation.observation_time,
                    "precip_today_in": data.current_observation.precip_today_in,
                    "precip_today_metric": data.current_observation.precip_today_metric,
                    "type": "wunderground"
                },
                "location": data.current_observation.display_location.full,
                "region": data.current_observation.display_location.country_iso3166,
                simpleforecast: {}
            };

            $.each(data.forecast.simpleforecast.forecastday,function(k,attr) {
                 ww_forecast.simpleforecast[k] = attr;
            });

            if (ww_forecast.region === "US" || ww_forecast.region === "BM" || ww_forecast.region === "PW") {
                temp = Math.round(ww_forecast.condition.temp_f)+"&#176;F";
            } else {
                temp = ww_forecast.condition.temp_c+"&#176;C";
            }

            $("#weather")
                .html("<div title='"+ww_forecast.condition.text+"' class='wicon cond"+code+"'></div><span>"+temp+"</span><br><span class='location'>"+ww_forecast.location+"</span>")
                .on("click",show_forecast);

            $("#weather-list").animate({
                "margin-left": "0"
            },1000).show();

            update_wunderground_forecast(ww_forecast);

            $.mobile.document.trigger("weatherUpdateComplete");
        }
    }).retry({times:retryCount, statusCodes: [0]}).fail(weather_update_failed);
}

function update_wunderground_forecast(data) {
    var temp, precip;

    if (data.region === "US" || data.region === "BM" || data.region === "PW") {
        temp = data.condition.temp_f+"&#176;F";
        precip = data.condition.precip_today_in+" in";
    } else {
        temp = data.condition.temp_c+"&#176;C";
        precip = data.condition.precip_today_metric+" mm";
    }

    var list = "<li data-role='list-divider' data-theme='a' class='center'>"+data.location+"</li>";
    list += "<li data-icon='false' class='center'><div title='"+data.condition.text+"' class='wicon cond"+data.condition.code+"'></div><span data-translate='Now'>"+_("Now")+"</span><br><span>"+temp+"</span><br><span data-translate='Precip'>"+_("Precip")+"</span><span>: "+precip+"</span></li>";
    $.each(data.simpleforecast, function(k,attr) {
        var precip;

        if (data.region === "US" || data.region === "BM" || data.region === "PW") {
            precip = attr.qpf_allday["in"];
            if (precip === null) {
                precip = 0;
            }
            list += "<li data-icon='false' class='center'><span>"+attr.date.monthname_short+" "+attr.date.day+"</span><br><div title='"+attr.conditions+"' class='wicon cond"+attr.icon+"'></div><span data-translate='"+attr.date.weekday_short+"'>"+_(attr.date.weekday_short)+"</span><br><span data-translate='Low'>"+_("Low")+"</span><span>: "+attr.low.fahrenheit+"&#176;F  </span><span data-translate='High'>"+_("High")+"</span><span>: "+attr.high.fahrenheit+"&#176;F</span><br><span data-translate='Precip'>"+_("Precip")+"</span><span>: "+precip+" in</span></li>";
        } else {
            precip = attr.qpf_allday.mm;
            if (precip === null) {
                precip = 0;
            }
            list += "<li data-icon='false' class='center'><span>"+attr.date.monthname_short+" "+attr.date.day+"</span><br><div title='"+attr.conditions+"' class='wicon cond"+attr.icon+"'></div><span data-translate='"+attr.date.weekday_short+"'>"+_(attr.date.weekday_short)+"</span><br><span data-translate='Low'>"+_("Low")+"</span><span>: "+attr.low.celsius+"&#176;C  </span><span data-translate='High'>"+_("High")+"</span><span>: "+attr.high.celsius+"&#176;C</span><br><span data-translate='Precip'>"+_("Precip")+"</span><span>: "+precip+" mm</span></li>";
        }
    });

    var forecast = $("#forecast_list");
    forecast.html(list).enhanceWithin();
    if (forecast.hasClass("ui-listview")) {
        forecast.listview("refresh");
    }
}

function show_forecast() {
    var page = $("#forecast");
    page.find("div[data-role='header'] > .ui-btn-right").on("click",function(){
        $.mobile.loading("show");
        $.mobile.document.one("weatherUpdateComplete",function(){
            $.mobile.loading("hide");
        });
        update_weather();
    });
    page.one("pagehide",function(){
        page.find("div[data-role='header'] > .ui-btn-right").off("click");
    });
    changePage("#forecast");
    return false;
}

function resolveLocation(loc,callback) {
    // Looks up the location and shows a list possible matches for selection
    // Returns the selection to the callback
    $("#location-list").popup("destroy").remove();

    callback = callback || function(){};

    if (!loc || loc === "") {
        callback(false);
        return;
    }

    $.ajax({
        url: "https://autocomplete.wunderground.com/aq?format=json&h=0&query="+encodeURIComponent(loc),
        dataType: isChromeApp ? "json" : "jsonp",
        jsonp: "cb"
    }).retry({times:retryCount, statusCodes: [0]}).done(function(data){
        data = data.RESULTS;

        if (data.length === 0) {
            callback(false);
            return;
        } else if (data.length === 1) {
            callback(data[0].name);
            return;
        }

        var items = "";

        for (var i=0; i<data.length; i++) {
            if (data[i].type !== "city" || !data[i].tz) {
                continue;
            }

            items += "<li><a>"+data[i].name+"</a></li>";
        }

        if (items === "") {
            callback(false);
            return;
        }

        var popup = $("<div data-role='popup' id='location-list' data-theme='a' data-overlay-theme='b'>" +
                "<div data-role='header' data-theme='b'>" +
                    "<h1>"+_("Select City")+"</h1>" +
                "</div>" +
                "<div class='ui-content'>" +
                    "<ul data-role='listview'>" +
                        items +
                    "</ul>" +
                "</div>" +
            "</div>"),
            dataSent = false;

        popup.appendTo("body").on("click","a",function(){
            popup.popup("close");
            callback(this.textContent);
            dataSent = true;
        }).one("popupafterclose",function(){
            popup.popup("destroy").remove();
            if (dataSent === false) {
                callback(false);
            }
        }).popup({
            history: false,
            positionTo: "window"
        }).enhanceWithin().popup("open");
    });
}

function nearbyPWS(lat,lon,callback) {
    // Looks up the location and shows a list possible matches for selection
    // Returns the selection to the callback
    $("#location-list").popup("destroy").remove();
    $.mobile.loading("show");

    callback = callback || function(){};

    if (!lat || !lon) {
        callback(false);
        return;
    }

    $.ajax({
        url: "http://api.wunderground.com/api/"+controller.settings.wtkey+"/geolookup/q/"+encodeURIComponent(lat)+","+encodeURIComponent(lon)+".json",
        dataType: isChromeApp ? "json" : "jsonp"
    }).retry({times:retryCount, statusCodes: [0]}).done(function(data){
        data = data.location.nearby_weather_stations.pws.station;
        var prefix = "";

        if (data.length === 0) {
            callback(false);
            return;
        } else if (data.length === 1) {
            callback(data[0].id);
            return;
        }

        data = encodeURIComponent(JSON.stringify(data));

        if (curr_local) {
            prefix = $.mobile.path.parseUrl($("head").find("script").eq(0).attr("src")).hrefNoHash.slice(0,-10);
        }

        var popup = $("<div data-role='popup' id='location-list' data-theme='a' data-overlay-theme='b'>" +
                "<a href='#' data-rel='back' class='ui-btn ui-btn-b ui-corner-all ui-shadow ui-btn-a ui-icon-delete ui-btn-icon-notext ui-btn-right'>"+_("Close")+"</a>" +
                    "<iframe style='border:none' src='"+prefix+"map.htm' width='100%' height='100%' seamless=''></iframe>" +
            "</div>"),
            iframe = popup.find("iframe"),
            dataSent = false;

        // Wire in listener for communication from iframe
        $(window).off("message onmessage").on("message onmessage", function(e) {
            var data = e.originalEvent.data;
            if (typeof data.PWS !== "undefined") {
                callback(data.PWS);
                dataSent = true;
                popup.popup("destroy").remove();
            } else if (typeof data.loaded !== "undefined" && data.loaded === true) {
                $.mobile.loading("hide");
            }
        });

        iframe.one("load",function(){
            this.contentWindow.postMessage({
                type: "currentLocation",
                payload: {
                    lat: lat,
                    lon: lon
                }
            }, "*");

            this.contentWindow.postMessage({
                type: "pwsData",
                payload: data
            }, "*");
        });

        popup.appendTo("body").one("popupafterclose",function(){
            popup.popup("destroy").remove();
            if (dataSent === false) {
                callback(false);
            }
        }).popup({
            history: false,
            beforeposition: function(){
                popup.css({
                    width: window.innerWidth - 36,
                    height: window.innerHeight - 28
                });
            },
            x: 0,
            y: 0
        }).enhanceWithin().popup("open");
    });
}

function debugWU() {
    if (typeof controller.settings.wtkey !== "string" || controller.settings.wtkey === "") {
        showerror(_("An API key must be provided for Weather Underground"));
        return;
    }

    $.mobile.loading("show");

    $.ajax({
        url: "http://api.wunderground.com/api/"+controller.settings.wtkey+"/yesterday/conditions/q/"+controller.settings.loc+".json",
        dataType: isChromeApp ? "json" : "jsonp"
    }).retry({times:retryCount, statusCodes: [0]}).done(function(data){
        $.mobile.loading("hide");

        if (typeof data.response.error === "object") {
            showerror(_("An invalid API key has been detected"));
            return;
        }

        if (typeof data.history === "object" && typeof data.history.dailysummary) {
            var summary = data.history.dailysummary[0],
                current = data.current_observation,
                popup = $("<div data-role='popup' class='ui-content' data-overlay-theme='b' data-theme='a'>"+
                    "<table class='debugWU'>" +
                        "<tr><td>"+_("Min Humidity")+"</td><td>"+summary.minhumidity+"%</td></tr>" +
                        "<tr><td>"+_("Max Humidity")+"</td><td>"+summary.maxhumidity+"%</td></tr>" +
                        "<tr><td>"+_("Mean Temp")+"</td><td>"+summary.meantempi+"&#176;F</td></tr>" +
                        "<tr><td>"+_("Precip Yesterday")+"</td><td>"+summary.precipi+"\"</td></tr>" +
                        "<tr><td>"+_("Precip Today")+"</td><td>"+current.precip_today_in+"\"</td></tr>" +
                        "<tr><td>"+_("Current % Watering")+"</td><td>"+controller.options.wl+"%</td></tr>" +
                    "</table>" +
                "</div>");

            popup.appendTo("body").one("popupafterclose",function(){
                popup.popup("destroy").remove();
            }).popup({
                history: false,
                positionTo: "window"
            }).enhanceWithin().popup("open");
        } else {
            showerror(_("Weather data cannot be found for your location"));
            return;
        }
    }).fail(function(){
        $.mobile.loading("hide");
        showerror(_("Connection timed-out. Please try again."));
    });
}

function testAPIKey(key,callback) {
    $.ajax({
        url: "https://api.wunderground.com/api/"+key+"/conditions/forecast/lang:EN/q/75252.json",
        dataType: isChromeApp ? "json" : "jsonp"
    }).retry({times:retryCount, statusCodes: [0]}).done(function(data){
        if (typeof data.response.error === "object" && data.response.error.type === "keynotfound") {
            callback(false);
            return;
        }
        callback(true);
    }).fail(function(){
        callback(false);
    });
}

function open_panel() {
    var panel = $("#sprinklers-settings"),
        operation = function(){
            return controller.settings.en === 1 ? _("Disable") : _("Enable");
        };

    panel.panel("option","classes.modal","needsclick ui-panel-dismiss");

    panel.find("a[href='#site-control']").off("click").one("click",function(){
        changeFromPanel("site-control");
        return false;
    });

    panel.find("a[href='#about']").off("click").one("click",function(){
        changeFromPanel("about");
        return false;
    });

    panel.find(".export_config").off("click").on("click",function(){
        getExportMethod();
        return false;
    });

    panel.find(".import_config").off("click").on("click",function(){
        storage.get("backup",function(newdata){
            getImportMethod(newdata.backup);
        });

        return false;
    });

    panel.find(".toggleOperation").on("click",function(){
        var self = $(this),
            toValue = (1-controller.settings.en);

        areYouSure(_("Are you sure you want to")+" "+operation().toLowerCase()+" "+_("operation?"),"",function(){
            send_to_os("/cv?pw=&en="+toValue).done(function(){
                $.when(
                    update_controller_settings(),
                    update_controller_status()
                ).done(function(){
                    check_status();
                    self.find("span:first").html(operation());
                });
            });
        });

        return false;
    }).find("span:first").html(operation());

    panel.find(".reboot-os").off("click").on("click",function(){
        areYouSure(_("Are you sure you want to reboot OpenSprinkler?"), "", function() {
            $.mobile.loading("show");
            send_to_os("/cv?pw=&rbt=1").done(function(){
                $.mobile.loading("hide");
                showerror(_("OpenSprinkler is rebooting now"));
            });
        });
        return false;
    });

    panel.find(".clear-config").off("click").on("click",function(){
        areYouSure(_("Are you sure you want to delete all settings and return to the default settings?"), "", function() {
            storage.remove(["sites","current_site","lang","provider","wapikey","runonce"],function(){
                update_lang();
                changePage("#start",{
                    showStart: true
                });
            });
        });
        return false;
    });

    panel.find(".show-providers").off("click").on("click",function(){
        $("#providers").popup("destroy").remove();

        storage.get(["provider","wapikey"],function(data){
            data.provider = data.provider || "yahoo";

            var popup = $(
                "<div data-role='popup' id='providers' data-theme='a' data-overlay-theme='b'>"+
                    "<div class='ui-content'>"+
                        "<form>"+
                            "<label for='weather_provider'>"+_("Weather Provider")+
                                "<select data-mini='true' id='weather_provider'>"+
                                    "<option value='yahoo'>"+_("Yahoo!")+"</option>"+
                                    "<option "+((data.provider === "wunderground") ? "selected " : "")+"value='wunderground'>"+_("Wunderground")+"</option>"+
                                "</select>"+
                            "</label>"+
                            "<label for='wapikey'>"+_("Wunderground API Key")+"<input data-mini='true' type='text' id='wapikey' value='"+((data.wapikey) ? data.wapikey : "")+"'></label>"+
                            "<input type='submit' value='"+_("Submit")+"'>"+
                        "</form>"+
                    "</div>"+
                "</div>"
            );

            if (data.provider === "yahoo") {
                popup.find("#wapikey").closest("label").hide();
            }

            popup.find("form").on("submit",function(e){
                e.preventDefault();

                var wapikey = $("#wapikey").val(),
                    provider = $("#weather_provider").val();

                if (provider === "wunderground" && wapikey === "") {
                    showerror(_("An API key must be provided for Weather Underground"));
                    return;
                }

                storage.set({
                    "wapikey": wapikey,
                    "provider": provider
                });

                update_weather();

                $("#providers").popup("close");

                return false;
            });

            //Handle provider select change on weather settings
            popup.on("change","#weather_provider",function(){
                var val = $(this).val();
                if (val === "wunderground") {
                    $("#wapikey").closest("label").show();
                } else {
                    $("#wapikey").closest("label").hide();
                }
                popup.popup("reposition",{
                    "positionTo": "window"
                });
            });

            popup.one("popupafterclose",function(){
                document.activeElement.blur();
                this.remove();
            }).popup().enhanceWithin().popup("open");
            return false;
        });
    });

    panel.find(".change_password > a").off("click").on("click",function(){
    // Device password management functions
        var isPi = isOSPi(),
            popup = $("<div data-role='popup' id='changePassword' data-theme='a' data-overlay-theme='b'>"+
                    "<ul data-role='listview' data-inset='true'>" +
                        "<li data-role='list-divider'>"+_("Change Password")+"</li>" +
                        "<li>" +
                            "<form method='post' novalidate>" +
                                "<label for='npw'>"+_("New Password")+":</label>" +
                                "<input type='password' name='npw' id='npw' value=''"+(isPi ? "" : " maxlength='32'")+">" +
                                "<label for='cpw'>"+_("Confirm New Password")+":</label>" +
                                "<input type='password' name='cpw' id='cpw' value=''"+(isPi ? "" : " maxlength='32'")+">" +
                                "<input type='submit' value='"+_("Submit")+"'>" +
                            "</form>" +
                        "</li>" +
                    "</ul>" +
            "</div>");

        popup.find("form").on("submit",function(){
            var npw = popup.find("#npw").val(),
                cpw = popup.find("#cpw").val();

            if (npw !== cpw) {
                showerror(_("The passwords don't match. Please try again."));
                return false;
            }

            if (npw === "") {
                showerror(_("Password cannot be empty"));
                return false;
            }

            if (!isPi && npw.length > 32) {
                showerror(_("Password cannot be longer than 32 characters"));
            }

            $.mobile.loading("show");
            send_to_os("/sp?pw=&npw="+encodeURIComponent(npw)+"&cpw="+encodeURIComponent(cpw),"json").done(function(info){
                var result = info.result;

                if (!result || result > 1) {
                    if (result === 2) {
                        showerror(_("Please check the current device password is correct then try again"));
                    } else {
                        showerror(_("Unable to change password. Please try again."));
                    }
                } else {
                    storage.get(["sites","current_site"],function(data){
                        var sites = JSON.parse(data.sites);

                        sites[data.current_site].os_pw = npw;
                        curr_pw = npw;
                        storage.set({"sites":JSON.stringify(sites)});
                    });
                    $.mobile.loading("hide");
                    popup.popup("close");
                    showerror(_("Password changed successfully"));
                }
            });

            return false;
        });

        popup.one("popupafterclose",function(){
            document.activeElement.blur();
            popup.remove();
        }).popup().enhanceWithin().popup("open");
    });

    panel.find("#downgradeui").off("click").on("click",function(){
        areYouSure(_("Are you sure you want to downgrade the UI?"), "", function(){
            var url = "http://rayshobby.net/scripts/java/svc"+getOSVersion();

            send_to_os("/cu?jsp="+encodeURIComponent(url)+"&pw=").done(function(){
                storage.remove(["sites","current_site","lang","provider","wapikey","runonce"]);
                location.reload();
            });
        });
        return false;
    });

    panel.find("#logout").off("click").on("click",function(){
        areYouSure(_("Are you sure you want to logout?"), "", function(){
            storage.remove(["sites","current_site","lang","provider","wapikey","runonce"],function(){
                location.reload();
            });
        });
        return false;
    });

    panel.one("panelclose",function(){
        panel.find(".export_config,.import_config").off("click");
        $("#en").off("change");
        panel.find(".reboot-os,.clear-config,.show-providers").off("click");
    });

    panel.panel("open");
}

// Device setting management functions
function show_options() {
    var list = "",
        page = $("<div data-role='page' id='os-options'>" +
            "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false' data-hide-during-focus=''>" +
                "<a href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                "<h3>"+_("Edit Options")+"</h3>" +
                "<button data-icon='check' class='ui-btn-right'>"+_("Submit")+"</button>" +
            "</div>" +
            "<div class='ui-content' role='main'>" +
                "<div data-role='collapsibleset' id='os-options-list'>" +
                "</div>" +
            "</div>" +
        "</div>"),
        timezones, algorithm, tz, i;

    page.find("div[data-role='header'] > .ui-btn-right").on("click",submit_options);

    list = "<fieldset data-role='collapsible' data-collapsed='false'><legend>"+_("System")+"</legend>";

    if (typeof controller.options.ntp !== "undefined") {
        list += "<div class='ui-field-contain datetime-input'><label for='datetime'>"+_("Device Time")+"</label><button "+(controller.options.ntp ? "disabled " : "")+"data-mini='true' id='datetime' value='"+(controller.settings.devt + (new Date().getTimezoneOffset()*60))+"'>"+dateToString(new Date(controller.settings.devt*1000)).slice(0,-3)+"</button></div>";
    }

    if (!isOSPi() && typeof controller.options.tz !== "undefined") {
        timezones = ["-12:00","-11:30","-11:00","-10:00","-09:30","-09:00","-08:30","-08:00","-07:00","-06:00","-05:00","-04:30","-04:00","-03:30","-03:00","-02:30","-02:00","+00:00","+01:00","+02:00","+03:00","+03:30","+04:00","+04:30","+05:00","+05:30","+05:45","+06:00","+06:30","+07:00","+08:00","+08:45","+09:00","+09:30","+10:00","+10:30","+11:00","+11:30","+12:00","+12:45","+13:00","+13:45","+14:00"];
        tz = controller.options.tz-48;
        tz = ((tz>=0)?"+":"-")+pad((Math.abs(tz)/4>>0))+":"+((Math.abs(tz)%4)*15/10>>0)+((Math.abs(tz)%4)*15%10);
        list += "<div class='"+(checkOSVersion(210) ? "hidden " : "")+"ui-field-contain'><label for='o1' class='select'>"+_("Timezone")+"</label><select data-mini='true' id='o1'>";
        for (i=0; i<timezones.length; i++) {
            list += "<option "+((timezones[i] === tz) ? "selected" : "")+" value='"+timezones[i]+"'>"+timezones[i]+"</option>";
        }
        list += "</select></div>";
    }

    list += "<div class='ui-field-contain'>" +
        "<label for='loc'>"+_("Location")+"<button data-helptext='"+_("Location can be a zip code, city/state or a weatherunderground personal weather station using the format: pws:ID.")+"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></label>" +
        "<table>" +
            "<tr style='width:100%;vertical-align: top;'>" +
                "<td style='width:100%'><input data-wrapper-class='controlgroup-textinput ui-btn' data-mini='true' type='text' id='loc' value='"+controller.settings.loc+"'></td>" +
                "<td><button class='noselect' data-corners='false' id='lookup-loc' data-mini='true'>"+_("Lookup")+"</button></td>" +
                "<td id='nearbyPWS'><button class='noselect' data-icon='location' data-iconpos='notext' data-mini='true'></button></td>" +
            "</tr>" +
        "</table></div>";

    if (typeof controller.options.ntp !== "undefined") {
        list += "<label for='o2'><input data-mini='true' id='o2' type='checkbox' "+((controller.options.ntp === 1) ? "checked='checked'" : "")+">"+_("NTP Sync")+"</label>";
    }

    if (typeof controller.options.ar !== "undefined") {
        //"<button data-helptext='"+_("Auto reconnect attempts to re-establish a network connection after an outage")+"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>"
        list += "<label for='o14'><input data-mini='true' id='o14' type='checkbox' "+((controller.options.ar === 1) ? "checked='checked'" : "")+">"+_("Auto Reconnect")+"</label>";
    }

    if (typeof controller.options.lg !== "undefined") {
        list += "<label for='lg'><input data-mini='true' id='lg' type='checkbox' "+((controller.options.lg === 1) ? "checked='checked'" : "")+">"+_("Enable Logging")+"</label>";
    }

    list += "</fieldset><fieldset data-role='collapsible'><legend>"+_("Configure Master")+"</legend>";

    if (typeof controller.options.mas !== "undefined") {
        list += "<div class='ui-field-contain'><label for='o18' class='select'>"+_("Master Station")+"</label><select data-mini='true' id='o18'><option value='0'>"+_("None")+"</option>";
        for (i=0; i<controller.stations.snames.length; i++) {
            list += "<option "+(((i+1) === controller.options.mas) ? "selected" : "")+" value='"+(i+1)+"'>"+controller.stations.snames[i]+"</option>";
            if (i === 7) {
                break;
            }
        }
        list += "</select></div>";
    }

    if (typeof controller.options.mton !== "undefined") {
        list += "<div class='ui-field-contain duration-field'><label for='o19'>"+_("Master On Delay")+"</label><button data-mini='true' id='o19' value='"+controller.options.mton+"'>"+controller.options.mton+"s</button></div>";
    }

    if (typeof controller.options.mtof !== "undefined") {
        list += "<div class='ui-field-contain duration-field'><label for='o20'>"+_("Master Off Delay")+"</label><button data-mini='true' id='o20' value='"+controller.options.mtof+"'>"+controller.options.mtof+"s</button></div>";
    }

    list += "</fieldset><fieldset data-role='collapsible'><legend>"+_("Station Handling")+"</legend>";

    if (typeof controller.options.ext !== "undefined") {
        list += "<div class='ui-field-contain duration-field'><label for='o15'>"+_("Expansion Boards")+(controller.options.dexp && controller.options.dexp < 255 ? " ("+controller.options.dexp+" "+_("detected")+")" : "")+"</label><button data-mini='true' id='o15' value='"+controller.options.ext+"'>"+controller.options.ext+" "+_("board(s)")+"</button></div>";
    }

    if (typeof controller.options.sdt !== "undefined") {
        list += "<div class='ui-field-contain duration-field'><label for='o17'>"+_("Station Delay")+"</label><button data-mini='true' id='o17' value='"+controller.options.sdt+"'>"+dhms2str(sec2dhms(controller.options.sdt))+"</button></div>";
    }

    if (typeof controller.options.seq !== "undefined") {
        list += "<label for='o16'><input data-mini='true' id='o16' type='checkbox' "+((controller.options.seq === 1) ? "checked='checked'" : "")+">"+_("Sequential")+"</label>";
    }

    list += "</fieldset><fieldset data-role='collapsible'><legend>"+_("Weather Control")+"</legend>";

    if (typeof controller.settings.wtkey !== "undefined") {
        list += "<div class='ui-field-contain wtkey'><fieldset data-role='controlgroup' data-type='horizontal'><legend for='wtkey'>"+_("Wunderground Key").replace("Wunderground","Wunder&shy;ground")+"<button data-helptext='"+_("Weather Underground requires an API Key which can be obtained from ")+"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></legend><div class='"+(weatherKeyFail === true ? "red " : "")+"ui-input-text controlgroup-textinput ui-btn ui-body-inherit ui-corner-all ui-mini ui-shadow-inset ui-input-has-clear'><input data-role='none' type='text' id='wtkey' value='"+controller.settings.wtkey+"'><a href='#' tabindex='-1' aria-hidden='true' data-helptext='"+_("An invalid API key has been detected.")+"' class='"+(weatherKeyFail === true ? "" : "hidden ")+"ui-input-clear ui-btn ui-icon-alert ui-btn-icon-notext ui-corner-all'></a></div><button class='noselect' data-mini='true' id='verify-api'>"+_("Verify")+"</button></fieldset></div>";
    }

    if (typeof controller.options.uwt !== "undefined") {
        algorithm = [_("Manual"),"Zimmerman"];
        list += "<div class='ui-field-contain'><label for='o31' class='select'>"+_("Weather Adjustment Method")+"<button data-helptext='"+_("Weather adjustment uses Weather Underground data in conjunction with the selected method to adjust the watering percentage.")+"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></label><select "+(controller.settings.wtkey && controller.settings.wtkey !== "" ? "" : "disabled='disabled' ")+"data-mini='true' id='o31'>";
        for (i=0; i<algorithm.length; i++) {
            list += "<option "+((i === controller.options.uwt) ? "selected" : "")+" value='"+i+"'>"+algorithm[i]+"</option>";
        }
        list += "</select></div>";
    }

    if (typeof controller.options.wl !== "undefined") {

        list += "<div class='ui-field-contain duration-field'><label for='o23'>"+_("% Watering")+"<button data-helptext='"+_("The watering percentage scales station run times by the set value. When weather adjustment is used the watering percentage is automatically adjusted.")+"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></label><button "+((controller.options.uwt && controller.options.uwt > 0) ? "disabled='disabled' " : "")+"data-mini='true' id='o23' value='"+controller.options.wl+"'>"+controller.options.wl+"%</button></div>";
    }

    if (typeof controller.options.urs !== "undefined") {
        list += "<label for='o21'><input data-mini='true' id='o21' type='checkbox' "+((controller.options.urs === 1) ? "checked='checked'" : "")+">"+_("Use Rain Sensor")+"</label>";
    }

    if (typeof controller.options.rso !== "undefined") {
        list += "<label for='o22'><input "+(controller.options.urs === 1 ? "" : "data-wrapper-class='hidden' ")+"data-mini='true' id='o22' type='checkbox' "+((controller.options.rso === 1) ? "checked='checked'" : "")+">"+_("Normally Open (Rain Sensor)")+"</label>";
    }

    list += "</fieldset><fieldset data-role='collapsible' data-theme='b'><legend>"+_("Advanced")+"</legend>";

    if (typeof controller.options.hp0 !== "undefined") {
        list += "<div class='ui-field-contain'><label for='o12'>"+_("HTTP Port (restart required)")+"</label><input data-mini='true' type='number' pattern='[0-9]*' id='o12' value='"+(controller.options.hp1*256+controller.options.hp0)+"'></div>";
    }

    if (typeof controller.options.devid !== "undefined") {
        list += "<div class='ui-field-contain'><label for='o26'>"+_("Device ID (restart required)")+"<button data-helptext='"+_("Device ID modifies the last byte of the MAC address.")+"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></label><input data-mini='true' type='number' pattern='[0-9]*' max='255' id='o26' value='"+controller.options.devid+"'></div>";
    }

    if (typeof controller.options.rlp !== "undefined") {
        list += "<div class='ui-field-contain duration-field'><label for='o30'>"+_("Relay Pulse")+"<button data-helptext='"+_("Relay pulsing is used for special situations where rapid pulsing is needed in the output with a range from 1 to 2000 milliseconds. A zero value disables the pulsing option.")+"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></label><button data-mini='true' id='o30' value='"+controller.options.rlp+"'>"+controller.options.rlp+"ms</button></div>";
    }

    if (typeof controller.options.ntp !== "undefined" && checkOSVersion(210)) {
        var ntpIP = [controller.options.ntp1,controller.options.ntp2,controller.options.ntp3,controller.options.ntp4].join(".");
        list += "<div class='"+((controller.options.ntp === 1) ? "" : "hidden ")+"ui-field-contain duration-field'><label for='ntp_addr'>"+_("NTP IP Address")+"</label><button data-mini='true' id='ntp_addr' value='"+ntpIP+"'>"+ntpIP+"</button></div>";
    }

    if (typeof controller.options.dhcp !== "undefined" && checkOSVersion(210)) {
        var ip = [controller.options.ip1,controller.options.ip2,controller.options.ip3,controller.options.ip4].join("."),
            gw = [controller.options.gw1,controller.options.gw2,controller.options.gw3,controller.options.gw4].join(".");

        list += "<div class='"+((controller.options.dhcp === 1) ? "hidden " : "")+"ui-field-contain duration-field'><label for='ip_addr'>"+_("IP Address")+"</label><button data-mini='true' id='ip_addr' value='"+ip+"'>"+ip+"</button></div>";
        list += "<div class='"+((controller.options.dhcp === 1) ? "hidden " : "")+"ui-field-contain duration-field'><label for='gateway'>"+_("Gateway Address")+"</label><button data-mini='true' id='gateway' value='"+gw+"'>"+gw+"</button></div>";
        list += "<label for='o3'><input data-mini='true' id='o3' type='checkbox' "+((controller.options.dhcp === 1) ? "checked='checked'" : "")+">"+_("Use DHCP (restart required)")+"</label>";
    }

    if (typeof controller.options.ipas !== "undefined") {
        list += "<label for='o25'><input data-mini='true' id='o25' type='checkbox' "+((controller.options.ipas === 1) ? "checked='checked'" : "")+">"+_("Ignore Password")+"</label>";
    }

    list += "</fieldset>";

    // Insert options and remove unused groups
    page.find("#os-options-list").html(list).find("fieldset").each(function(a,b){
        var group = $(b);

        if (group.children().length === 1) {
            group.remove();
        }
    });

    page.find("#o3").on("change",function(){
        var button = $(this),
            checked = button.is(":checked"),
            manualInputs = page.find("#ip_addr,#gateway").parents(".ui-field-contain");

        if (checked) {
            manualInputs.addClass("hidden");
        } else {
            manualInputs.removeClass("hidden");
        }
    });

    page.find("#o21").on("change",function(){
        var button = $(this),
            checked = button.is(":checked");

        if (checked) {
            page.find("#o22").parent().removeClass("hidden");
        } else {
            page.find("#o22").parent().addClass("hidden");
        }
    });

    page.find("#nearbyPWS > button").on("click",function(){
        var loc = $("#loc"),
            button = $(this),
            exit = function(){
                $.mobile.loading("hide");
                button.prop("disabled",false);
                return false;
            };

        if (controller.settings.wtkey === "") {
            exit();
        }

        $.mobile.loading("show");
        button.prop("disabled",true);

        try {
            navigator.geolocation.getCurrentPosition(function(position){
                nearbyPWS(position.coords.latitude,position.coords.longitude,function(selected){
                    if (selected === false) {
                        page.find("#o1").parents(".ui-field-contain").removeClass("hidden");
                    } else {
                        if (checkOSVersion(210)) {
                            page.find("#o1").parents(".ui-field-contain").addClass("hidden");
                        }
                        loc.parent().addClass("green");
                        loc.val("pws:"+selected);
                    }
                    exit();
                });
            },function(){
                exit();
            });
        } catch(err) { exit(); }
    });

    page.find("#lookup-loc").on("click",function(){
        var loc = $("#loc"),
            current = loc.val(),
            button = $(this);

        if (/^pws:/.test(current)) {
            showerror(_("When using a personal weather station the location lookup is unavailable."));
            return;
        }

        button.prop("disabled",true);

        resolveLocation(current,function(selected){
            if (selected === false) {
                page.find("#o1").parents(".ui-field-contain").removeClass("hidden");
                showerror(_("Unable to locate using:")+" "+current+". "+_("Please use another value and try again."));
            } else {
                if (checkOSVersion(210)) {
                    page.find("#o1").parents(".ui-field-contain").addClass("hidden");
                }
                selected = selected.replace(/^[0-9]{5}\s-\s/,"");
                loc.parent().addClass("green");
                loc.val(selected);
            }
            button.prop("disabled",false);
        });
    });

    page.find("#verify-api").on("click",function(){
        var key = $("#wtkey"),
            button = $(this);

        button.prop("disabled",true);

        testAPIKey(key.val(),function(result){
            if (result === true) {
                page.find(".wtkey .ui-icon-alert").hide();
                page.find(".wtkey .ui-input-text").removeClass("red").addClass("green");
            } else {
                page.find(".wtkey .ui-icon-alert").removeClass("hidden").show();
                page.find(".wtkey .ui-input-text").removeClass("green").addClass("red");
            }
            button.prop("disabled",false);
        });
    });

    page.find(".help-icon,.wtkey .ui-icon-alert").on("click",function(e){
        e.stopImmediatePropagation();

        var button = $(this),
            text = button.data("helptext"),
            popup;

        if (button.parent().attr("for") === "wtkey") {
            text += "<a class='iab' target='_blank' href='https://opensprinkler.freshdesk.com/support/solutions/articles/5000017485-getting-a-weather-api#article-show-5000017485'>here</a>.";
        }

        popup = $("<div data-role='popup'>" +
            "<p>"+text+"</p>" +
        "</div>");

        popup.one("popupafterclose", function(){
            popup.popup("destroy").remove();
        }).enhanceWithin();

        $(".ui-page-active").append(popup);

        popup.popup({history: false, positionTo: button}).popup("open");

        return false;
    });

    page.find(".duration-field button:not(.help-icon)").on("click",function(){
        var dur = $(this),
            id = dur.attr("id"),
            name = page.find("label[for='"+id+"']").text(),
            helptext = dur.parent().find(".help-icon").data("helptext"),
            max = 240;

        if (id === "ip_addr" || id === "gateway" || id === "ntp_addr") {
            showIPRequest({
                title: name,
                ip: dur.val().split("."),
                callback: function(ip) {
                    dur.val(ip.join(".")).text(ip.join("."));
                }
            });
        } else if (id === "o19") {
            showSingleDurationInput({
                data: dur.val(),
                title: name,
                callback: function(result){
                    dur.val(result).text(result+"s");
                },
                label: _("Seconds"),
                maximum: 60,
                helptext: helptext
            });
        } else if (id === "o30") {
            showSingleDurationInput({
                data: dur.val(),
                title: name,
                callback: function(result){
                    dur.val(result).text(result+"ms");
                },
                label: _("Milliseconds"),
                maximum: 2000,
                helptext: helptext
            });
        } else if (id === "o20") {
            showSingleDurationInput({
                data: dur.val(),
                title: name,
                callback: function(result){
                    dur.val(result).text(result+"s");
                },
                label: _("Seconds"),
                maximum: 60,
                minimum: -60,
                helptext: helptext
            });
        } else if (id === "o15") {
            showSingleDurationInput({
                data: dur.val(),
                title: name,
                callback: function(result){
                    dur.val(result).text(result+" board(s)");
                },
                label: _("Expansion Boards"),
                maximum: 5,
                helptext: helptext
            });
        } else if (id === "o23") {
            showSingleDurationInput({
                data: dur.val(),
                title: name,
                callback: function(result){
                    dur.val(result).text(result+"%");
                },
                label: _("% Watering"),
                maximum: 250,
                helptext: helptext
            });
        } else if (id === "o17") {
            if (checkOSVersion(210)) {
                max = 64800;
            }

            showDurationBox({
                seconds: dur.val(),
                title: name,
                callback: function(result){
                    dur.val(result);
                    dur.text(dhms2str(sec2dhms(result)));
                },
                maximum: max
            });
        }

        return false;
    });

    page.find("#o2").on("change",function(){
        var ntp = $(this).is(":checked");

        // Switch state of device time input based on NTP status
        page.find(".datetime-input button").prop("disabled",ntp);

        // Switch the NTP IP address field when NTP is used
        page.find("#ntp_addr").parents(".ui-field-contain").toggleClass("hidden",!ntp);
    });

    page.find("#o31").on("change",function(){
        // Switch state of water level input based on weather algorithm status
        $("#o23").prop("disabled",(parseInt(this.value) === 0 || $("#wtkey").val() === "" ? false : true));
    });

    page.find("#wtkey").on("change",function(){
        // Hide the invalid key status after change
        if (weatherKeyFail === true) {
            page.find(".wtkey .ui-icon-alert").hide();
            page.find(".wtkey .ui-input-text").removeClass("red");
        }

        // Switch state of weather algorithm input based on API key status
        if (this.value === "") {
            $("#o31").val("0").selectmenu("refresh").selectmenu("disable");
            $("#o23").prop("disabled",false);
        } else {
            $("#o31").selectmenu("enable");
        }
    });

    page.find(".datetime-input").on("click",function(){
        var input = $(this).find("button");

        if (input.prop("disabled")) {
            return;
        }

        // Show date time input popup
        showDateTimeInput(input.val(),function(data){
            input.text(dateToString(data).slice(0,-3)).val(Math.round(data.getTime()/1000));
        });
        return false;
    });

    page.one("pagehide",function(){
        page.remove();
    });

    $("#os-options").remove();
    page.appendTo("body");
}

function submit_options() {
    var opt = {},
        invalid = false,
        isPi = isOSPi(),
        keyNames = {1:"tz",2:"ntp",12:"htp",13:"htp2",14:"ar",15:"nbrd",16:"seq",17:"sdt",18:"mas",19:"mton",20:"mtoff",21:"urs",22:"rst",23:"wl",25:"ipas",30:"rlp","lg":"lg",31:"uwt"},
        key;

    $("#os-options-list").find(":input,button").filter(":not(.noselect)").each(function(a,b){
        var $item = $(b),
            id = $item.attr("id"),
            data = $item.val(),
            ip;

        if (!id || (!data && data!=="")) {
            return true;
        }

        switch (id) {
            case "o1":
                var tz = data.split(":");
                tz[0] = parseInt(tz[0],10);
                tz[1] = parseInt(tz[1],10);
                tz[1]=(tz[1]/15>>0)/4.0;tz[0]=tz[0]+(tz[0]>=0?tz[1]:-tz[1]);
                data = ((tz[0]+12)*4)>>0;
                break;
            case "datetime":
                var dt = new Date(data*1000);
                dt.setMinutes(dt.getMinutes()-dt.getTimezoneOffset());

                opt.tyy = dt.getFullYear();
                opt.tmm = dt.getMonth();
                opt.tdd = dt.getDate();
                opt.thh = dt.getHours();
                opt.tmi = dt.getMinutes();
                opt.ttt = Math.round(dt.getTime()/1000);

                return true;
            case "ip_addr":
                ip = data.split(".");

                opt.o4 = ip[0];
                opt.o5 = ip[1];
                opt.o6 = ip[2];
                opt.o7 = ip[3];

                return true;
            case "gateway":
                ip = data.split(".");

                opt.o8 = ip[0];
                opt.o9 = ip[1];
                opt.o10 = ip[2];
                opt.o11 = ip[3];

                return true;
            case "ntp_addr":
                ip = data.split(".");

                opt.o32 = ip[0];
                opt.o33 = ip[1];
                opt.o34 = ip[2];
                opt.o35 = ip[3];

                return true;
            case "o12":
                if (!isPi) {
                    opt.o12 = data&0xff;
                    opt.o13 = (data>>8)&0xff;
                }
                return true;
            case "o31":
                if (data > 0 && $("#wtkey").val() === "") {
                    showerror(_("Weather Underground API key is required for weather-based control"));
                    invalid = true;
                    return false;
                }
                break;
            case "o2":
            case "o14":
            case "o16":
            case "o21":
            case "o22":
            case "o25":
            case "o30":
            case "lg":
            case "o3":
                data = $item.is(":checked") ? 1 : 0;
                if (!data) {
                    return true;
                }
                break;
        }
        if (isPi) {
            if (id === "loc" || id === "lg") {
                id = "o"+id;
            } else {
                key = /\d+/.exec(id);
                id = "o"+keyNames[key];
            }
        }

        // Because the firmware has a bug regarding spaces, let us replace them out now with a compatible seperator
        if (checkOSVersion(208) === true && id === "loc") {
            data = data.replace(/\s/g,"_");
        }

        opt[id] = data;
    });
    if (invalid) {
        return;
    }
    $.mobile.loading("show");
    send_to_os("/co?pw=&"+$.param(opt)).done(function(){
        $.mobile.document.one("pageshow",function(){
            showerror(_("Settings have been saved"));
        });
        goBack();
        update_controller(update_weather);
    });
}

// Station managament function
function show_stations() {
    var cards = "",
        page = $("<div data-role='page' id='os-stations'>" +
            "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false' data-hide-during-focus=''>" +
                "<a href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                "<h3>"+_("Edit Stations")+"</h3>" +
                "<button data-icon='check' class='submit ui-btn-right'>"+_("Submit")+"</button>" +
            "</div>" +
            "<div class='ui-content' role='main'>" +
            "</div>" +
        "</div>"),
        editButton = "<span style='padding-left:10px' class='btn-no-border ui-btn ui-icon-edit ui-btn-icon-notext'></span>",
        addCard = function(i){
            var station = controller.stations.snames[i];

            // Group card settings visually
            cards += "<div class='ui-corner-all card'>";
            cards += "<div class='ui-body ui-body-a center'>";
            cards += "<p class='tight center inline-icon station-name' id='station_"+i+"'>"+station+editButton+"</p>";

            if (is21 && controller.options.mas !== i+1) {
                cards += "<fieldset data-role='controlgroup' data-type='horizontal' data-mini='true' class='center'>";
                cards += "<legend>"+_("Test Station")+"</legend>";
                cards += "<select><option value='60'>1 min</option><option value='300'>5 mins</option><option value='600'>10 mins</option><option value='900'>15 mins</option><option value='1200'>20 mins</option></select>";
                cards += "<button class='"+(controller.status[i] > 0 || controller.settings.ps[i][0] > 0 ? "red" : "green")+"' id='run_station-"+i+"'>"+(controller.status[i] > 0 || controller.settings.ps[i][0] > 0 ? _("Stop") : _("Start"))+"</button>";
                cards += "</fieldset>";
            }

            if (optCount > 0 && controller.options.mas !== i+1) {
                cards += "<fieldset data-role='controlgroup' data-type='horizontal' data-mini='true' class='center seperate-btn'>";

                if (isMaster) {
                    cards += "<input id='um_"+i+"' type='checkbox' "+((controller.stations.masop[parseInt(i/8)]&(1<<(i%8))) ? "checked='checked'" : "")+"><label for='um_"+i+"'>"+_("Use Master")+"</label>";
                }

                if (hasIR) {
                    cards += "<input id='ir_"+i+"' type='checkbox' "+((controller.stations.ignore_rain[parseInt(i/8)]&(1<<(i%8))) ? "checked='checked'" : "")+"><label for='ir_"+i+"'>"+_("Ignore Rain")+"</label>";
                }

                if (hasAR) {
                    cards += "<input id='ar_"+i+"' type='checkbox' "+((controller.stations.act_relay[parseInt(i/8)]&(1<<(i%8))) ? "checked='checked'" : "")+"><label for='ar_"+i+"'>"+_("Activate Relay")+"</label>";
                }

                if (hasSD) {
                    cards += "<input id='sd_"+i+"' type='checkbox' "+((controller.stations.stn_dis[parseInt(i/8)]&(1<<(i%8))) ? "checked='checked'" : "")+"><label for='sd_"+i+"'>"+_("Disable")+"</label>";
                }

                cards += "</fieldset>";
            }

            // Close current card group
            cards += "</div></div>";
        },
        submit_stations = function() {
            var is208 = (checkOSVersion(208) === true),
                master = {},
                rain = {},
                relay = {},
                disable = {},
                names = {},
                bid, sid, s;

            for(bid=0;bid<controller.settings.nbrd;bid++) {
                if (isMaster) {
                    master["m"+bid] = 0;
                }
                if (hasIR) {
                    rain["i"+bid] = 0;
                }
                if (hasAR) {
                    relay["a"+bid] = 0;
                }
                if (hasSD) {
                    disable["d"+bid] = 0;
                }

                for(s=0;s<8;s++) {
                    sid=bid*8+s;

                    if (isMaster) {
                        master["m"+bid] = (master["m"+bid]) + ((page.find("#um_"+sid).is(":checked") ? 1 : 0) << s);
                    }
                    if (hasIR) {
                        rain["i"+bid] = (rain["i"+bid]) + ((page.find("#ir_"+sid).is(":checked") ? 1 : 0) << s);
                    }
                    if (hasAR) {
                        relay["a"+bid] = (relay["a"+bid]) + ((page.find("#ar_"+sid).is(":checked") ? 1 : 0) << s);
                    }
                    if (hasSD) {
                        disable["d"+bid] = (disable["d"+bid]) + ((page.find("#sd_"+sid).is(":checked") ? 1 : 0) << s);
                    }

                    // Because the firmware has a bug regarding spaces, let us replace them out now with a compatible seperator
                    if (is208) {
                        names["s"+sid] = page.find("#station_"+sid).text().replace(/\s/g,"_");
                    } else {
                        names["s"+sid] = page.find("#station_"+sid).text();
                    }
                }
            }

            $.mobile.loading("show");
            send_to_os("/cs?pw=&"+$.param(names)+(isMaster ? "&"+$.param(master) : "")+(hasIR ? "&"+$.param(rain) : "")+(hasAR ? "&"+$.param(relay) : "")+(hasSD ? "&"+$.param(disable) : "")).done(function(){
                $.mobile.document.one("pageshow",function(){
                    showerror(_("Stations have been updated"));
                });
                goBack();
                update_controller();
            });
        },
        run_station = function(){
            var button = $(this),
                station = button.attr("id").split("-")[1],
                duration = parseInt(button.prev().find("select").val()),
                start = function(){
                    $.mobile.loading("show");

                    send_to_os("/cm?sid="+station+"&en=1&t="+duration+"&pw=","json").done(function(){

                        // Notify user the station test was successful
                        showerror(_("Station test activated"));

                        // Change the start button to a stop button
                        button.removeClass("green").addClass("red").text(_("Stop")).on("click",stop);

                        // Return button back to previous state
                        setTimeout(reset,duration*1000);
                    });
                },
                stop = function(){
                    $.mobile.loading("show");
                    send_to_os("/cm?sid="+station+"&en=0&pw=","json").done(reset);

                    $.mobile.loading("hide");

                    // Prevent start delegate function from being called
                    return false;
                },
                reset = function(){
                    button.removeClass("red").addClass("green").text(_("Start")).off("click");
                };

            if (button.hasClass("green")) {
                start();
            } else {
                stop();
            }
        },
        isMaster = controller.options.mas ? true : false,
        hasIR = (typeof controller.stations.ignore_rain === "object") ? true : false,
        hasAR = (typeof controller.stations.act_relay === "object") ? true : false,
        hasSD = (typeof controller.stations.stn_dis === "object") ? true : false,
        optCount = hasIR + isMaster + hasAR + hasSD,
        is21 = checkOSVersion(210),
        i;

    for (i=0; i<8; i++) {
        addCard(i);
    }

    page.find(".ui-content").html("<div id='os-stations-list' class='card-group center'>"+cards+"</div><button class='submit'>"+_("Submit")+"</button><button data-theme='b' class='reset'>"+_("Reset")+"</button>");

    // When data is refreshed, update the icon status
    page.on("datarefresh",function(){
        page.find("[id^='run_station-']").each(function(){
            var button = $(this),
                i = parseInt(button.attr("id").split("-")[1]);

            if (controller.status[i] > 0 || controller.settings.ps[i][0] > 0) {
                button.removeClass("green").addClass("red").text(_("Stop")).off("click");
            } else {
                button.removeClass("red").addClass("green").text(_("Start")).off("click");
            }
        });
    });

    page.on("click","[id^='run_station-']",run_station);

    page.on("click","[id^='station_']",function(){
        var text = $(this),
            input = $("<input class='center' data-mini='true' maxlength='"+controller.stations.maxlen+"' id='edit_"+text.attr("id")+"' type='text' value='"+text.text()+"'>");

        text.replaceWith(input);
        input.on("blur keyup",function(e){
            if (e.type === "keyup" && e.keyCode !== 13) {
                return;
            }
            text.html(input.val()+editButton);
            input.replaceWith(text);
            input.remove();
        });
        input.focus();
    });

    page.find(".submit").on("click",submit_stations);

    page.find(".reset").on("click",function(){
        page.find("[id^='edit_station_']").each(function(a,b){
            $(b).val("S"+pad(a+1));
        });
        page.find("input[type='checkbox']").each(function(a,b){
            $(b).prop("checked",false).checkboxradio("refresh");
        });
    });

    page.one({
        pagehide: function(){
            page.remove();
        },
        pageshow: function(){
            cards = "";
            for (i; i<controller.stations.snames.length; i++) {
                addCard(i);
            }
            page.find("#os-stations-list").append(cards).enhanceWithin();
        }
    });

    $("#os-stations").remove();
    page.appendTo("body");
}

function isStationDisabled(sid) {
    return (typeof controller.stations.stn_dis === "object" && (controller.stations.stn_dis[parseInt(sid/8)]&(1<<(sid%8))) > 0);
}

// Current status related functions
function get_status() {
    var page = $("<div data-role='page' id='status'>" +
            "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false'>" +
                "<a role='button' href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                "<h3>"+_("Current Status")+"</h3>" +
            "</div>" +
            "<div class='ui-content' role='main'>" +
            "</div>" +
        "</div>"),
        runningTotal = {},
        lastCheck = new Date().getTime(),
        currentDelay = 0,
        updateInterval,
        updateContent = function() {
            var allPnames = [],
                color = "",
                weatherInfo = "",
                list = "";

            // Display the system time
            var header = "<span id='clock-s' class='nobr'>"+dateToString(new Date(controller.settings.devt*1000))+"</span>";

            // For OSPi, show the current device temperature
            if (typeof controller.settings.ct === "string" && controller.settings.ct !== "0.0" && typeof controller.settings.tu === "string") {
                header += " <span>"+controller.settings.ct+"&deg;"+controller.settings.tu+"</span>";
            }

            // Set the time for the header to the device time
            runningTotal.c = controller.settings.devt;

            var master = controller.options.mas,
                ptotal = 0;

            // Determine total count of stations open excluding the master
            var open = {},
                scheduled = 0;

            $.each(controller.status, function (i, stn) {
                if (stn > 0) {
                    open[i] = stn;
                }
            });
            open = Object.keys(open).length;

            if (master && controller.status[master-1]) {
                open--;
            }

            $.each(controller.stations.snames,function(i, station) {
                var info = "";

                // Check if station is master
                if (master === i+1) {
                    station += " ("+_("Master")+")";
                } else if (controller.settings.ps[i][0]) {
                    scheduled++;

                    // If not, get the remaining time for the station
                    var rem=controller.settings.ps[i][1];
                    if (open > 1) {
                        // If concurrent stations, grab the largest time to be used as program time
                        if (rem > ptotal) {
                            ptotal = rem;
                        }
                    } else {
                        // Otherwise, add all of the program times together except for a manual program with a time of 1s
                        if (!(controller.settings.ps[i][0] === 99 && rem === 1)) {
                            ptotal+=rem;
                        }
                    }

                    var pid = controller.settings.ps[i][0],
                        pname = pidname(pid);

                    // If the station is running, add it's remaining time for updates
                    if (controller.status[i] && rem > 0) {
                        runningTotal[i] = rem;
                    }

                    // Save program name to list of all program names
                    allPnames[i] = pname;

                    // Generate status line for station
                    info = "<p class='rem center'>"+((controller.status[i] > 0) ? _("Running")+" "+pname : _("Scheduled")+" "+(controller.settings.ps[i][2] ? _("for")+" "+dateToString(new Date(controller.settings.ps[i][2]*1000)) : pname));
                    if (rem>0) {
                        // Show the remaining time if it's greater than 0
                        info += " <span id='countdown-"+i+"' class='nobr'>(" + sec2hms(rem) + " "+_("remaining")+")</span>";
                    }
                    info += "</p>";
                }

                // If the station is on, give it color green otherwise red
                if (controller.status[i] > 0) {
                    color = "green";
                } else {
                    color = "red";
                }

                // Append the station to the list of stations
                list += "<li class='"+color+(isStationDisabled(i) ? " hidden" : "")+"'><p class='sname center'>"+station+"</p>"+info+"</li>";
            });

            var footer = "";
            var lrdur = controller.settings.lrun[2];

            // If last run duration is given, add it to the footer
            if (lrdur !== 0) {
                var lrpid = controller.settings.lrun[1];
                var pname= pidname(lrpid);

                footer = pname+" "+_("last ran station")+" "+controller.stations.snames[controller.settings.lrun[0]]+" "+_("for")+" "+(lrdur/60>>0)+"m "+(lrdur%60)+"s "+_("on")+" "+dateToString(new Date(controller.settings.lrun[3]*1000));
            }

            // Display header information
            if (ptotal > 1) {
                // If a program is running, show which specific programs and their collective total
                allPnames = getUnique($.grep(allPnames,function(n){return(n);}));
                var numProg = allPnames.length;
                allPnames = allPnames.join(" "+_("and")+" ");
                var pinfo = allPnames+" "+((numProg > 1) ? _("are") : _("is"))+" "+_("running")+" ";

                if (controller.options.seq === 1) {
                    if (currentDelay > 0) {
                        ptotal += (scheduled-1)*controller.options.sdt + currentDelay;
                    } else {
                        ptotal += (scheduled-1)*controller.options.sdt;
                    }
                }

                if (open || (scheduled && currentDelay > 0)) {
                    runningTotal.p = ptotal;
                } else {
                    delete runningTotal.p;
                }

                pinfo += "<br><span id='countdown-p' class='nobr'>("+sec2hms(ptotal)+" "+_("remaining")+")</span>";
                header += "<br>"+pinfo;
            } else if (controller.settings.rd) {
                // Display a rain delay when active
                header +="<br>"+_("Rain delay until")+" "+dateToString(new Date(controller.settings.rdst*1000));
            } else if (controller.options.urs === 1 && controller.settings.rs === 1) {
                // Show rain sensor status when triggered
                header +="<br>"+_("Rain detected");
            }

            if (checkOSVersion(210)) {
                weatherInfo = "<div class='ui-grid-b status-daily'>";
                weatherInfo += "<div class='center ui-block-a'>"+pad(parseInt(controller.settings.sunrise/60)%24)+":"+pad(controller.settings.sunrise%60)+"<br>"+_("Sunrise")+"</div>";
                weatherInfo += "<div class='center ui-block-b'>"+controller.options.wl+"%<br>"+_("Water Level")+"</div>";
                weatherInfo += "<div class='center ui-block-c'>"+pad(parseInt(controller.settings.sunset/60)%24)+":"+pad(controller.settings.sunset%60)+"<br>"+_("Sunset")+"</div>";
                weatherInfo += "</div>";
            }

            page.find(".ui-content").html(
                "<p class='smaller center'>"+ header +"</p>" +
                weatherInfo +
                "<ul data-role='listview' data-inset='true' id='status_list'>"+ list +"</ul>" +
                "<p class='smaller center'>"+ footer +"</p>"
            ).enhanceWithin();
        };

    page.on("datarefresh",updateContent);
    updateContent();

    // Bind delegate handler to stop specific station (supported on firmware 2.1.0+ on Arduino)
    page.on("click","li",function(){
        var el = $(this),
            station = el.index(),
            currentStatus = controller.status[station],
            question;

        if (checkOSVersion(210)) {
            if (currentStatus) {
                question = _("Do you want to stop the selected station?");
            } else {
                if (el.find("span.nobr").length) {
                    question = _("Do you want to unschedule the selected station?");
                } else {
                    return;
                }
            }
            areYouSure(question,controller.stations.snames[station],function(){
                send_to_os("/cm?sid="+station+"&en=0&pw=").done(function(){
                    refresh_status();
                    showerror(_("Station has been stopped"));
                });
            });
        }
    });

    if (checkOSVersion(210)) {
        page.on("click",".ui-block-b",function(){
            var popup = $("<div data-role='popup'>" +
                "<p>"+_("The watering percentage scales station run times by the set value. When weather adjustment is used the watering percentage is automatically adjusted.")+"</p>" +
            "</div>");

            popup.one("popupafterclose", function(){
                popup.popup("destroy").remove();
            }).enhanceWithin();

            $(".ui-page-active").append(popup);

            popup.popup({history: false, positionTo: this}).popup("open");

            return false;
        });
    }

    page.one({
        pagehide: function(){
            clearInterval(updateInterval);
            page.remove();
        },
        pageshow: function(){
            updateInterval = setInterval(function(){
                var now = new Date().getTime(),
                    currPage = $(".ui-page-active").attr("id"),
                    diff = now - lastCheck;

                if (diff > 3000) {
                    if (currPage === "status") {
                        refresh_status();
                    } else {
                        clearInterval(updateInterval);
                    }
                }

                if (currentDelay <= 0) {
                    currentDelay = 0;
                } else {
                    --currentDelay;
                }

                lastCheck = now;
                $.each(runningTotal,function(a,b){
                    if (b <= 0) {
                        refresh_status();
                        delete runningTotal[a];
                        if (a === "p") {
                            if (currPage !== "status") {
                                clearInterval(updateInterval);
                                return;
                            }
                        } else {
                            currentDelay = controller.options.sdt - 1;
                            $("#countdown-"+a).parent("p").empty().parent("li").removeClass("green").addClass("red");
                        }
                    } else {
                        if (a === "c") {
                            ++runningTotal[a];
                            $("#clock-s").text(dateToString(new Date(runningTotal[a]*1000)));
                        } else {
                            --runningTotal[a];
                            $("#countdown-"+a).text("(" + sec2hms(runningTotal[a]) + " "+_("remaining")+")");
                        }
                    }
                });
            },1000);
        }
    });

    page.appendTo("body");
}

function refresh_status() {
    var page = $(".ui-page-active");

    $.when(
        update_controller_status(),
        update_controller_settings(),
        update_controller_options()
    ).then(function(){
        // Notify the current page that the data has refreshed
        page.trigger("datarefresh");
        return;
    },network_fail);
}

function removeTimers() {
    //Remove any status timers that may be running
    if (interval_id !== undefined) {
        clearInterval(interval_id);
    }
    if (timeout_id !== undefined) {
        clearTimeout(timeout_id);
    }
}

// Actually change the status bar
function change_status(seconds,color,line,onclick) {
    var footer = $("#footer-running");

    onclick = onclick || function(){};

    removeTimers();

    if (seconds > 1) {
        update_timer(seconds,controller.options.sdt);
    }

    footer.removeClass().addClass(color).html(line).off("click").on("click",onclick).slideDown();
}

// Update status bar based on device status
function check_status() {
    var open, ptotal, sample, pid, pname, line, match, tmp, i;

    // Handle operation disabled
    if (!controller.settings.en) {
        change_status(0,"red","<p class='running-text center'>"+_("System Disabled")+"</p>",function(){
            areYouSure(_("Do you want to re-enable system operation?"),"",function(){
                showLoading("#footer-running");
                send_to_os("/cv?pw=&en=1").done(function(){
                    update_controller(check_status);
                });
            });
        });
        return;
    }

    // Handle open stations
    open = {};
    for (i=0; i<controller.status.length; i++) {
        if (controller.status[i]) {
            open[i] = controller.status[i];
        }
    }

    if (controller.options.mas) {
        delete open[controller.options.mas-1];
    }

    // Handle more than 1 open station
    if (Object.keys(open).length >= 2) {
        ptotal = 0;

        for (i in open) {
            if (open.hasOwnProperty(i)) {
                tmp = controller.settings.ps[i][1];
                if (tmp > ptotal) {
                    ptotal = tmp;
                }
            }
        }

        sample = Object.keys(open)[0];
        pid    = controller.settings.ps[sample][0];
        pname  = pidname(pid);
        line   = "<div><div class='running-icon'></div><div class='running-text'>";

        line += pname+" "+_("is running on")+" "+Object.keys(open).length+" "+_("stations")+" ";
        if (ptotal > 0) {
            line += "<span id='countdown' class='nobr'>("+sec2hms(ptotal)+" "+_("remaining")+")</span>";
        }
        line += "</div></div>";
        change_status(ptotal,"green",line,function(){
            changePage("#status");
        });
        return;
    }

    // Handle a single station open
    match = false;
    for (i=0; i<controller.stations.snames.length; i++) {
        if (controller.settings.ps[i] && controller.settings.ps[i][0] && controller.status[i] && controller.options.mas !== i+1) {
            match = true;
            pid = controller.settings.ps[i][0];
            pname = pidname(pid);
            line = "<div><div class='running-icon'></div><div class='running-text'>";
            line += pname+" "+_("is running on station")+" <span class='nobr'>"+controller.stations.snames[i]+"</span> ";
            if (controller.settings.ps[i][1] > 0) {
                line += "<span id='countdown' class='nobr'>("+sec2hms(controller.settings.ps[i][1])+" "+_("remaining")+")</span>";
            }
            line += "</div></div>";
            break;
        }
    }

    if (match) {
        change_status(controller.settings.ps[i][1],"green",line,function(){
            changePage("#status");
        });
        return;
    }

    // Handle rain delay enabled
    if (controller.settings.rd) {
        change_status(0,"red","<p class='running-text center'>"+_("Rain delay until")+" "+dateToString(new Date(controller.settings.rdst*1000))+"</p>",function(){
            areYouSure(_("Do you want to turn off rain delay?"),"",function(){
                showLoading("#footer-running");
                send_to_os("/cv?pw=&rd=0").done(function(){
                    update_controller(check_status);
                });
            });
        });
        return;
    }

    // Handle rain sensor triggered
    if (controller.options.urs === 1 && controller.settings.rs === 1) {
        change_status(0,"red","<p class='running-text center'>"+_("Rain detected")+"</p>");
        return;
    }

    // Handle manual mode enabled
    if (controller.settings.mm === 1) {
        change_status(0,"red","<p class='running-text center'>"+_("Manual mode enabled")+"</p>",function(){
            areYouSure(_("Do you want to turn off manual mode?"),"",function(){
                showLoading("#footer-running");
                send_to_os("/cv?pw=&mm=0").done(function(){
                    update_controller(check_status);
                });
            });
        });
        return;
    }

    $("#footer-running").slideUp();
}

// Handle timer update on the home page for the status bar
function update_timer(total,sdelay) {
    var lastCheck = new Date().getTime();
    interval_id = setInterval(function(){
        var now = new Date().getTime();
        var diff = now - lastCheck;
        if (diff > 3000) {
            clearInterval(interval_id);
            showLoading("#footer-running");
            update_controller(check_status);
        }
        lastCheck = now;

        if (total <= 0) {
            clearInterval(interval_id);
            showLoading("#footer-running");
            if (timeout_id !== undefined) {
                clearTimeout(timeout_id);
            }
            timeout_id = setTimeout(function(){
                update_controller(check_status);
            },(sdelay*1000));
        } else {
            --total;
        }
        $("#countdown").text("(" + sec2hms(total) + " "+_("remaining")+")");
    },1000);
}

// Manual control functions
function get_manual() {
    var list = "<li data-role='list-divider' data-theme='a'>"+_("Sprinkler Stations")+"</li>",
        page = $("<div data-role='page' id='manual'>" +
                "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false'>" +
                    "<a href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                    "<h3>"+_("Manual Control")+"</h3>" +
                "</div>" +
                "<div class='ui-content' role='main'>" +
                    "<p class='center'>"+_("With manual mode turned on, tap a station to toggle it.")+"</p>" +
                    "<fieldset data-role='collapsible' data-collapsed='false' data-mini='true'>" +
                        "<legend>"+_("Options")+"</legend>" +
                        "<div class='ui-field-contain'>" +
                            "<label for='mmm'><b>"+_("Manual Mode")+"</b></label>" +
                            "<input type='checkbox' data-on-text='On' data-off-text='Off' data-role='flipswitch' name='mmm' id='mmm'"+(controller.settings.mm ? " checked" : "")+">" +
                        "</div>" +
                        "<p class='rain-desc smaller center' style='padding-top:5px'>"+_("Station timer prevents a station from running indefinitely and will automatically turn it off after the set duration (or when toggled off)")+"</p>" +
                        "<div class='ui-field-contain duration-input'>" +
                            "<label for='auto-off'><b>"+_("Station Timer")+"</b></label><button data-mini='true' name='auto-off' id='auto-off' value='3600'>1h</button>" +
                        "</div>" +
                    "</fieldset>" +
                "</div>" +
            "</div>"),
        check_toggle = function(currPos){
            update_controller_status().done(function(){
                var item = listitems.eq(currPos).find("a");

                if (controller.options.mas) {
                    if (controller.status[controller.options.mas-1]) {
                        listitems.eq(controller.options.mas-1).addClass("green");
                    } else {
                        listitems.eq(controller.options.mas-1).removeClass("green");
                    }
                }

                item.text(controller.stations.snames[currPos]);

                if (controller.status[currPos]) {
                    item.removeClass("yellow").addClass("green");
                } else {
                    item.removeClass("green yellow");
                }
            });
        },
        toggle = function(){
            if (!controller.settings.mm) {
                showerror(_("Manual mode is not enabled. Please enable manual mode then try again."));
                return false;
            }

            var anchor = $(this),
                item = anchor.closest("li"),
                currPos = listitems.index(item),
                sid = currPos+1,
                dur = autoOff.val();

            if (anchor.hasClass("yellow")) {
                return false;
            }

            if (controller.status[currPos]) {
                if (checkOSPiVersion("2.1")) {
                    dest = "/sn?sid="+sid+"&set_to=0&pw=";
                } else {
                    dest = "/sn"+sid+"=0";
                }
            } else {
                if (checkOSPiVersion("2.1")) {
                    dest = "/sn?sid="+sid+"&set_to=1&set_time="+dur+"&pw=";
                } else {
                    dest = "/sn"+sid+"=1&t="+dur;
                }
            }

            anchor.removeClass("green").addClass("yellow");
            anchor.html("<p class='ui-icon ui-icon-loading mini-load'></p>");

            send_to_os(dest).always(
                function(){
                    // The device usually replies before the station has actually toggled. Delay in order to wait for the station's to toggle.
                    setTimeout(check_toggle,1000,currPos);
                }
            );

            return false;
        },
        autoOff = page.find("#auto-off"),
        dest, mmlist, listitems;

    $.each(controller.stations.snames,function (i,station) {
        if (controller.options.mas === i+1) {
            list += "<li data-icon='false' class='center"+(isStationDisabled(i) ? " hidden" : "")+((controller.status[i]) ? " green" : "")+"'>"+station+" ("+_("Master")+")</li>";
        } else {
            list += "<li data-icon='false'><a class='mm_station center"+(isStationDisabled(i) ? " hidden" : "")+((controller.status[i]) ? " green" : "")+"'>"+station+"</a></li>";
        }
    });

    mmlist = $("<ul data-role='listview' data-inset='true' id='mm_list'>"+list+"</ul>");
    listitems = mmlist.children("li").slice(1);
    mmlist.find(".mm_station").on("vclick",toggle);
    page.find(".ui-content").append(mmlist);

    autoOff.on("click",function(){
        var dur = $(this),
            name = page.find("label[for='"+dur.attr("id")+"']").text();

        showDurationBox({
            seconds: dur.val(),
            title: name,
            callback: function(result){
                dur.val(result);
                dur.text(dhms2str(sec2dhms(result)));
                storage.set({"autoOff":result});
            },
            maximum: 32768
        });

        return false;
    });
    page.find("#mmm").flipswitch().on("change",flipSwitched);
    storage.get("autoOff",function(data){
        if (!data.autoOff) {
            return;
        }
        autoOff.val(data.autoOff);
        autoOff.text(dhms2str(sec2dhms(data.autoOff)));
    });

    page.one("pagehide",function(){
        page.remove();
    });

    $("#manual").remove();
    page.appendTo("body");
}

// Runonce functions
function get_runonce() {
    var list = "<p class='center'>"+_("Zero value excludes the station from the run-once program.")+"</p>",
        runonce = $("<div data-role='page' id='runonce'>" +
            "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false'>" +
                "<a href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                "<h3>"+_("Run-Once")+"</h3>" +
                "<button data-icon='check' class='ui-btn-right'>"+_("Submit")+"</button>" +
            "</div>" +
            "<div class='ui-content' role='main' id='runonce_list'>" +
            "</div>" +
        "</div>"),
        updateLastRun = function(data) {
            rprogs.l = data;
            $("<option value='l' selected='selected'>"+_("Last Used Program")+"</option>").insertAfter(runonce.find("#rprog").find("option[value='t']"));
            fill_runonce(data);
        },
        reset_runonce = function() {
            runonce.find("[id^='zone-']").val(0).text("0s").removeClass("green");
            return false;
        },
        fill_runonce = function(data) {
            runonce.find("[id^='zone-']").each(function(a,b){
                if (controller.options.mas === a+1) {
                    return;
                }

                var ele = $(b);
                ele.val(data[a]).text(dhms2str(sec2dhms(data[a])));
                if (data[a] > 0) {
                    ele.addClass("green");
                } else {
                    ele.removeClass("green");
                }
            });
        },
        i, quickPick, progs, rprogs, z, program, name;

    runonce.find("div[data-role='header'] > .ui-btn-right").on("click",submit_runonce);

    progs = [];
    if (controller.programs.pd.length) {
        for (z=0; z < controller.programs.pd.length; z++) {
            program = read_program(controller.programs.pd[z]);
            var prog = [];

            if (checkOSVersion(210)) {
                prog = program.stations;
            } else {
                var set_stations = program.stations.split("");
                for (i=0;i<controller.stations.snames.length;i++) {
                    prog.push((parseInt(set_stations[i])) ? program.duration : 0);
                }
            }

            progs.push(prog);
        }
    }
    rprogs = progs;

    quickPick = "<select data-mini='true' name='rprog' id='rprog'><option value='t'>"+_("Test All Stations")+"</option><option value='s' selected='selected'>"+_("Quick Programs")+"</option>";
    for (i=0; i<progs.length; i++) {
        if (checkOSVersion(210)) {
            name = controller.programs.pd[i][5];
        } else {
            name = _("Program")+" "+(i+1);
        }
        quickPick += "<option value='"+i+"'>"+name+"</option>";
    }
    quickPick += "</select>";
    list += quickPick+"<form>";
    $.each(controller.stations.snames,function(i, station) {
        if (controller.options.mas === i+1) {
            list += "<div class='ui-field-contain duration-input"+(isStationDisabled(i) ? " hidden" : "")+"'><label for='zone-"+i+"'>"+station+":</label><button disabled='true' data-mini='true' name='zone-"+i+"' id='zone-"+i+"' value='0'>Master</button></div>";
        } else {
            list += "<div class='ui-field-contain duration-input"+(isStationDisabled(i) ? " hidden" : "")+"'><label for='zone-"+i+"'>"+station+":</label><button data-mini='true' name='zone-"+i+"' id='zone-"+i+"' value='0'>0s</button></div>";
        }
    });

    list += "</form><a class='ui-btn ui-corner-all ui-shadow rsubmit' href='#'>"+_("Submit")+"</a><a class='ui-btn ui-btn-b ui-corner-all ui-shadow rreset' href='#'>"+_("Reset")+"</a>";

    runonce.find(".ui-content").html(list);

    if (typeof controller.settings.rodur === "object") {
        var total = 0;

        for (i=0; i<controller.settings.rodur.length; i++) {
            total += controller.settings.rodur[i];
        }

        if (total !== 0) {
            updateLastRun(controller.settings.rodur);
        }
    } else {
        storage.get("runonce",function(data){
            data = data.runonce;
            if (data) {
                data = JSON.parse(data);
                updateLastRun(data);
            }
        });
    }

    runonce.find("#rprog").on("change",function(){
        var prog = $(this).val();
        if (prog === "s") {
            reset_runonce();
            return;
        } else if (prog === "t") {
            fill_runonce(Array.apply(null, Array(controller.stations.snames.length)).map(function(){return 60;}));
            return;
        }
        if (typeof rprogs[prog] === "undefined") {
            return;
        }
        fill_runonce(rprogs[prog]);
    });

    runonce.on("click",".rsubmit",submit_runonce).on("click",".rreset",reset_runonce);

    runonce.find("[id^='zone-']").on("click",function(){
        var dur = $(this),
            name = runonce.find("label[for='"+dur.attr("id")+"']").text().slice(0,-1);

        showDurationBox({
            seconds: dur.val(),
            title: name,
            callback: function(result){
                dur.val(result);
                dur.text(dhms2str(sec2dhms(result)));
                if (result > 0) {
                    dur.addClass("green");
                } else {
                    dur.removeClass("green");
                }
            },
            maximum: 65535
        });

        return false;
    });

    runonce.one("pagehide",function(){
        runonce.remove();
    });

    $("#runonce").remove();
    runonce.appendTo("body");
}

function submit_runonce(runonce) {
    if (!(runonce instanceof Array)) {
        runonce = [];
        $("#runonce").find("[id^='zone-']").each(function(a,b){
            runonce.push(parseInt($(b).val()) || 0);
        });
        runonce.push(0);
    }

    var submit = function(){
            $.mobile.loading("show");
            storage.set({"runonce":JSON.stringify(runonce)});
            send_to_os("/cr?pw=&t="+JSON.stringify(runonce)).done(function(){
                $.mobile.loading("hide");
                $.mobile.document.one("pageshow",function(){
                    showerror(_("Run-once program has been scheduled"));
                });
                update_controller_status();
                update_controller_settings();
                goBack();
            });
        },
        isOn = isRunning();

    if (isOn !== -1) {
        areYouSure(_("Do you want to stop the currently running program?"), pidname(controller.settings.ps[isOn][0]), function(){
            $.mobile.loading("show");
            stopStations(submit);
        });
    } else {
        submit();
    }
}

// Preview functions
function get_preview() {
    var now = new Date(controller.settings.devt*1000),
        date = now.toISOString().slice(0,10),
        page = $("<div data-role='page' id='preview'>" +
            "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false'>" +
                "<a href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                "<h3>"+_("Program Preview")+"</h3>" +
            "</div>" +
            "<div class='ui-content' role='main'>" +
                "<div id='preview_header' class='input_with_buttons'>" +
                    "<button class='preview-minus ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
                    "<input class='center' type='date' name='preview_date' id='preview_date' value='"+date+"'>" +
                    "<button class='preview-plus ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
                "</div>" +
                "<div id='timeline'></div>" +
                "<div data-role='controlgroup' data-type='horizontal' id='timeline-navigation'>" +
                    "<a class='ui-btn ui-corner-all ui-icon-plus ui-btn-icon-notext btn-no-border' title='"+_("Zoom in")+"'></a>" +
                    "<a class='ui-btn ui-corner-all ui-icon-minus ui-btn-icon-notext btn-no-border' title='"+_("Zoom out")+"'></a>" +
                    "<a class='ui-btn ui-corner-all ui-icon-carat-l ui-btn-icon-notext btn-no-border' title='"+_("Move left")+"'></a>" +
                    "<a class='ui-btn ui-corner-all ui-icon-carat-r ui-btn-icon-notext btn-no-border' title='"+_("Move right")+"'></a>" +
                "</div>" +
            "</div>" +
        "</div>"),
        navi = page.find("#timeline-navigation"),
        is21 = checkOSVersion(210),
        preview_data, process_programs, check_match, check_match183, check_match21, run_sched, time_to_text, changeday, render, day;

    date = date.split("-");
    day = new Date(date[0],date[1]-1,date[2]);

    process_programs = function (month,day,year) {
        preview_data = [];
        var devday = Math.floor(controller.settings.devt/(60*60*24)),
            simminutes = 0,
            simt = Date.UTC(year,month-1,day,0,0,0,0),
            simday = (simt/1000/3600/24)>>0,
            st_array = new Array(controller.settings.nbrd*8),
            pid_array = new Array(controller.settings.nbrd*8),
            et_array = new Array(controller.settings.nbrd*8),
            last_stop_time = 0,
            busy, match_found, prog;

        for(var sid=0;sid<controller.settings.nbrd;sid++) {
            st_array[sid]=0;pid_array[sid]=0;et_array[sid]=0;
        }
        do {
            busy=0;
            match_found=0;
            for(var pid=0;pid<controller.programs.pd.length;pid++) {
                prog=controller.programs.pd[pid];
                if(check_match(prog,simminutes,simt,simday,devday)) {
                    for(sid=0;sid<controller.settings.nbrd*8;sid++) {
                        var bid=sid>>3;var s=sid%8;
                        if (controller.options.mas===(sid+1)) {
                            continue; // skip master station
                        }
                        if (is21) {
                            if (controller.stations.stn_dis[bid]&(1<<s)) {
                                continue; // skip disabled stations
                            }
                            if(prog[4][sid] && !et_array[sid]) {  // skip if water time is zero, or station is already scheduled
                                if(prog[0]&0x02 && ((controller.options.uwt > 0 && simday === devday) || controller.options.uwt === 0)) {  // use weather scaling bit on
                                    et_array[sid]=prog[4][sid] * controller.options.wl/100>>0;
                                } else {
                                  et_array[sid]=prog[4][sid];
                                }
                                if (et_array[sid]) {  // after weather scaling, we maybe getting 0 water time
                                  pid_array[sid]=pid+1;
                                  match_found=1;
                                }
                            }
                        } else {
                            if(prog[7+bid]&(1<<s)) {
                                et_array[sid]=prog[6] * controller.options.wl/100>>0;
                                pid_array[sid]=pid+1;
                                match_found=1;
                            }
                        }
                    }
              }
            }
            if(match_found) {
                var acctime=simminutes*60;
                if (is21 && controller.options.seq) {
                    if (last_stop_time > acctime) {
                        acctime = last_stop_time + controller.options.sdt;
                    }
                }
                if(controller.options.seq) {
                    for(sid=0;sid<controller.settings.nbrd*8;sid++) {
                        if(!et_array[sid] || st_array[sid]) {
                            continue;
                        }
                        st_array[sid]=acctime;acctime+=et_array[sid];
                        et_array[sid]=acctime;acctime+=controller.options.sdt;
                        busy=1;
                    }
                } else {
                    for(sid=0;sid<controller.settings.nbrd*8;sid++) {
                        if(!et_array[sid] || st_array[sid]) {
                            continue;
                        }
                        st_array[sid]=acctime;
                        et_array[sid]=acctime+et_array[sid];
                        busy=1;
                    }
                }
            }
            if (busy) {
                if (is21) {
                    last_stop_time=run_sched(simminutes*60,st_array,pid_array,et_array,simt);
                    simminutes++;
                    for(sid=0;sid<controller.settings.nbrd*8;sid++) {
                        st_array[sid]=0;pid_array[sid]=0;et_array[sid]=0;
                    }
                } else {
                    var endminutes=run_sched(simminutes*60,st_array,pid_array,et_array,simt)/60>>0;
                    if (controller.options.seq&&simminutes!==endminutes) {
                        simminutes=endminutes;
                    } else {
                        simminutes++;
                    }
                    for(sid=0;sid<controller.settings.nbrd*8;sid++) {
                        st_array[sid]=0;pid_array[sid]=0;et_array[sid]=0;
                    }
                }
            } else {
                simminutes++;
            }
        } while(simminutes<24*60);
    };

    run_sched = function (simseconds,st_array,pid_array,et_array,simt) {
        var endtime=simseconds;
        for(var sid=0;sid<controller.settings.nbrd*8;sid++) {
            if(pid_array[sid]) {
                if(controller.options.seq===1) {
                    if((controller.options.mas>0)&&(controller.options.mas!==sid+1)&&(controller.stations.masop[sid>>3]&(1<<(sid%8)))) {
                        preview_data.push({
                            "start": (st_array[sid]+controller.options.mton),
                            "end": (et_array[sid]+controller.options.mtof),
                            "content":"",
                            "className":"master",
                            "shortname":"M",
                            "group":"Master"
                        });
                    }
                    time_to_text(sid,st_array[sid],pid_array[sid],et_array[sid],simt);
                    endtime=et_array[sid];
                } else {
                    time_to_text(sid,simseconds,pid_array[sid],et_array[sid],simt);
                    if((controller.options.mas>0)&&(controller.options.mas!==sid+1)&&(controller.stations.masop[sid>>3]&(1<<(sid%8)))) {
                        endtime=(endtime>et_array[sid])?endtime:et_array[sid];
                    }
                }
            }
        }
        if(controller.options.seq===0&&controller.options.mas>0) {
            preview_data.push({
                "start": simseconds,
                "end": endtime,
                "content":"",
                "className":"master",
                "shortname":"M",
                "group":"Master"
            });
        }
        return endtime;
    };

    time_to_text = function (sid,start,pid,end,simt) {
        var className = "program-"+((pid+3)%4),
            pname = "P"+pid;

        if (((controller.settings.rd!==0)&&(simt+start+(controller.options.tz-48)*900<=controller.settings.rdst*1000) || controller.options.urs === 1 && controller.settings.rs === 1) && (typeof controller.stations.ignore_rain === "object" && (controller.stations.ignore_rain[parseInt(sid/8)]&(1<<(sid%8))) === 0)) {
            className="delayed";
        }

        if (checkOSVersion(210)) {
            pname = controller.programs.pd[pid-1][5];
        }

        preview_data.push({
            "start": start,
            "end": end,
            "className":className,
            "content":pname,
            "pid": pid-1,
            "shortname":"S"+(sid+1),
            "group": controller.stations.snames[sid]
        });
    };

    check_match = function(prog,simminutes,simt,simday,devday) {
        if (is21) {
            return check_match21(prog,simminutes,simt,simday,devday);
        } else {
            return check_match183(prog,simminutes,simt,simday,devday);
        }
    };

    check_match183 = function(prog,simminutes,simt,simday,devday) {
        if(prog[0]===0) {
            return 0;
        }
        if ((prog[1]&0x80)&&(prog[2]>1)) {
            var dn=prog[2],
                drem=prog[1]&0x7f;
            if((simday%dn)!==((devday+drem)%dn)) {
                return 0;
            }
        } else {
            var date = new Date(simt);
            var wd=(date.getUTCDay()+6)%7;
            if((prog[1]&(1<<wd))===0) {
                return 0;
            }
            var dt=date.getUTCDate();
            if((prog[1]&0x80)&&(prog[2]===0)) {
                if((dt%2)!==0) {
                    return 0;
                }
            }
            if((prog[1]&0x80)&&(prog[2]===1)) {
                if(dt===31 || (dt===29 && date.getUTCMonth()===1) || (dt%2)!==1) {
                    return 0;
                }
            }
        }
        if(simminutes<prog[3] || simminutes>prog[4]) {
            return 0;
        }
        if(prog[5]===0) {
            return 0;
        }
        if(((simminutes-prog[3])/prog[5]>>0)*prog[5] === (simminutes-prog[3])) {
            return 1;
        }
        return 0;
    };

    check_match21 = function(prog,simminutes,simt,simday,devday) {
        var en = prog[0]&0x01,
            oddeven = (prog[0]>>2)&0x03,
            type = (prog[0]>>4)&0x03,
            sttype = (prog[0]>>6)&0x01,
            date = new Date(simt),
            i;

        if (!en) {
            return 0;
        }

        if (type===3) {
            // Interval program
            var dn=prog[2],
                drem=prog[1];

            if((simday%dn)!==((devday+drem)%dn)) {
                return 0;
            }
        } else if (type===0) {
            // Weekly program
            var wd=(date.getUTCDay()+6)%7;
            if((prog[1]&(1<<wd))===0) {
                return 0;
            }
        } else {
            return 0;
        }

        // odd/even restrictions
        if (oddeven) {
            var dt=date.getUTCDate();
            if(oddeven===2) {
                // even restrict
                if((dt%2)!==0) {
                    return 0;
                }
            }
            if(oddeven===1) { // odd restrict
                if(dt===31 || (dt===29 && date.getUTCMonth()===1) || (dt%2)!==1) {
                    return 0;
                }
            }
        }

        // Start time matching
        if (sttype===0) {
            // Repeating program
            var start = prog[3][0],
                repeat= prog[3][1],
                cycle = prog[3][2];

            if(simminutes<start) {
                return 0;
            }

            if(!repeat) {
                // Single run program
                return (simminutes===start)?1:0;
            }

            if(!cycle) {
                // if this is a multi-run, cycle time must be > 0
                return 0;
            }

            var c = (simminutes-start)/cycle>>0;  // >>0 rounds to the nearest integer
            if((c*cycle === (simminutes-start)) && (c<=repeat)) {
                return 1;
            }
        } else {
            // Set start time program
            var sttimes = prog[3];
            for(i=0;i<4;i++) {
                // fixme: 4 should be using the mnst (max_start_times) JSON variable
                if(simminutes === sttimes[i]) {
                    return 1;
                }
            }
        }
        return 0;
    };

    changeday = function (dir) {
        day.setDate(day.getDate() + dir);

        var m = pad(day.getMonth()+1),
            d = pad(day.getDate()),
            y = day.getFullYear();

        date = [y,m,d];
        page.find("#preview_date").val(date.join("-"));
        render();
    };

    render = function() {
        process_programs(date[1],date[2],date[0]);

        navi.hide();

        if (!preview_data.length) {
            page.find("#timeline").html("<p align='center'>"+_("No stations set to run on this day.")+"</p>");
            return;
        }
        var shortnames = [];
        $.each(preview_data, function(){
            this.start = new Date(date[0],date[1]-1,date[2],0,0,this.start);
            this.end = new Date(date[0],date[1]-1,date[2],0,0,this.end);
            shortnames[this.group] = this.shortname;
        });
        var options = {
            "width":  "100%",
            "editable": false,
            "axisOnTop": true,
            "eventMargin": 10,
            "eventMarginAxis": 0,
            "min": new Date(date[0],date[1]-1,date[2],0),
            "max": new Date(date[0],date[1]-1,date[2],24),
            "selectable": true,
            "showMajorLabels": false,
            "zoomMax": 1000 * 60 * 60 * 24,
            "zoomMin": 1000 * 60 * 60,
            "groupsChangeable": false,
            "showNavigation": false,
            "groupsOrder": "none",
            "groupMinHeight": 20
        };

        var timeline = new links.Timeline(page.find("#timeline")[0],options),
            currentTime = new Date(now);

        currentTime.setMinutes(currentTime.getMinutes()+currentTime.getTimezoneOffset());

        timeline.setCurrentTime(currentTime);
        links.events.addListener(timeline, "select", function(){
            var sel = timeline.getSelection();

            if (sel.length) {
                if (typeof sel[0].row !== "undefined") {
                    changePage("#programs",{
                        "programToExpand": parseInt(timeline.getItem(sel[0].row).pid)
                    });
                }
            }
        });

        $.mobile.window.off("resize").on("resize",function(){
            timeline.redraw();
        });

        timeline.draw(preview_data);

        if ($.mobile.window.width() <= 480) {
            var currRange = timeline.getVisibleChartRange();
            if ((currRange.end.getTime() - currRange.start.getTime()) > 6000000) {
                timeline.setVisibleChartRange(currRange.start,new Date(currRange.start.getTime()+6000000));
            }
        }

        page.find(".timeline-groups-text").each(function(a,b){
            var stn = $(b);
            var name = shortnames[stn.text()];
            stn.attr("data-shortname",name);
        });

        page.find(".timeline-groups-axis").children().first().html("<div class='timeline-axis-text center dayofweek' data-shortname='"+getDayName(day,"short")+"'>"+getDayName(day)+"</div>");

        if (isAndroid) {
            navi.find(".ui-icon-plus").off("click").on("click",function(){
                timeline.zoom(0.4);
                return false;
            });
            navi.find(".ui-icon-minus").off("click").on("click",function(){
                timeline.zoom(-0.4);
                return false;
            });
            navi.find(".ui-icon-carat-l").off("click").on("click",function(){
                timeline.move(-0.2);
                return false;
            });
            navi.find(".ui-icon-carat-r").off("click").on("click",function(){
                timeline.move(0.2);
                return false;
            });
            navi.show();
        }
    };

    page.find("#preview_date").on("change",function(){
        date = this.value.split("-");
        day = new Date(date[0],date[1]-1,date[2]);
        render();
    });

    holdButton(page.find(".preview-plus"),function(){
        changeday(1);
    });
    holdButton(page.find(".preview-minus"),function(){
        changeday(-1);
    });

    page.one({
        pagehide: function(){
            $.mobile.window.off("resize");
            page.remove();
        },
        pageshow: render
    });

    $("#preview").remove();
    page.appendTo("body");
}

// Logging functions
function get_logs() {
    var now = new Date(controller.settings.devt*1000),
        isNarrow = $.mobile.window.width() < 640 ? true : false,
        logs = $("<div data-role='page' id='logs'>" +
            "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false' data-hide-during-focus=''>" +
                "<a href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                "<h3>"+_("Logs")+"</h3>" +
                "<a href='#' data-icon='refresh' class='ui-btn-right'>"+_("Refresh")+"</a>" +
            "</div>" +
            "<div class='ui-content' role='main'>" +
                "<fieldset data-role='controlgroup' data-type='horizontal' data-mini='true' class='log_type'>" +
                    "<input data-mini='true' type='radio' name='log_type' id='log_graph' value='graph' "+(isNarrow ? "" : "checked='checked'")+">" +
                    "<label for='log_graph'>"+_("Graph")+"</label>" +
                    "<input data-mini='true' type='radio' name='log_type' id='log_table' value='table' "+(!isNarrow ? "" : "checked='checked'")+">" +
                    "<label for='log_table'>"+_("Table")+"</label>" +
                "</fieldset>" +
                "<div id='placeholder'></div>" +
                "<div id='zones'>" +
                "</div>" +
                "<fieldset data-role='collapsible' data-mini='true' id='log_options' class='center'>" +
                    "<legend>"+_("Options")+"</legend>" +
                    "<fieldset data-role='controlgroup' data-type='horizontal' id='graph_sort'>" +
                      "<p class='tight'>"+_("Grouping:")+"</p>" +
                      "<input data-mini='true' type='radio' name='g' id='radio-choice-d' value='n' checked='checked'>" +
                      "<label for='radio-choice-d'>"+_("None")+"</label>" +
                      "<input data-mini='true' type='radio' name='g' id='radio-choice-a' value='h'>" +
                      "<label for='radio-choice-a'>"+_("Hour")+"</label>" +
                      "<input data-mini='true' type='radio' name='g' id='radio-choice-b' value='d'>" +
                      "<label for='radio-choice-b'>"+_("DOW")+"</label>" +
                      "<input data-mini='true' type='radio' name='g' id='radio-choice-c' value='m'>" +
                      "<label for='radio-choice-c'>"+_("Month")+"</label>" +
                    "</fieldset>" +
                    "<fieldset data-role='controlgroup' data-type='horizontal' id='table_sort'>" +
                      "<p class='tight'>"+_("Grouping:")+"</p>" +
                      "<input data-mini='true' type='radio' name='table-group' id='table-sort-day' value='day' checked='checked'>" +
                      "<label for='table-sort-day'>"+_("Day")+"</label>" +
                      "<input data-mini='true' type='radio' name='table-group' id='table-sort-station' value='station'>" +
                      "<label for='table-sort-station'>"+_("Station")+"</label>" +
                    "</fieldset>" +
                    "<div class='ui-field-contain'>" +
                        "<label for='log_start'>"+_("Start:")+"</label>" +
                        "<input data-mini='true' type='date' id='log_start' value='"+(new Date(now.getTime() - 604800000).toISOString().slice(0,10))+"'>" +
                        "<label for='log_end'>"+_("End:")+"</label>" +
                        "<input data-mini='true' type='date' id='log_end' value='"+(now.toISOString().slice(0,10))+"'>" +
                    "</div>" +
                    "<a data-role='button' data-icon='action' class='export_logs' href='#' data-mini='true'>"+_("Export")+"</a>" +
                    (isOSPi() || checkOSVersion(210) ? "<a data-role='button' class='red clear_logs' href='#' data-mini='true' data-icon='alert'>"+_("Clear Logs")+"</a>" : "") +
                "</fieldset>" +
                "<div id='logs_list' class='center'>" +
                "</div>" +
            "</div>" +
        "</div>"),
        placeholder = logs.find("#placeholder"),
        logs_list = logs.find("#logs_list"),
        zones = logs.find("#zones"),
        graph_sort = logs.find("#graph_sort"),
        table_sort = logs.find("#table_sort"),
        log_options = logs.find("#log_options"),
        data = [],
        stations = $.merge($.merge([],controller.stations.snames),[_("Rain Sensor"),_("Rain Delay")]),
        seriesChange = function() {
            var grouping = logs.find("input:radio[name='g']:checked").val(),
                pData = [],
                sortedData, options, plot;

            placeholder.empty();

            sortedData = sortData("graph",grouping);

            zones.find("td[zone_num]:not('.unchecked')").each(function() {
                var key = $(this).attr("zone_num");
                if (!sortedData[key].length) {
                    sortedData[key]=[[0,0]];
                }
                if (key && sortedData[key]) {
                    pData.push({
                        data:sortedData[key],
                        label:$(this).attr("name"),
                        color:parseInt(key),
                        bars: {
                            order:key,
                            show: true,
                            barWidth: ((grouping === "h") || (grouping === "m") || (grouping === "d") ? 0.1 : 60*60*1000)
                        }
                    });
                }
            });

            // Plot the data
            if (grouping==="h") {
                options = {
                    grid: { hoverable: true },
                    yaxis: {min: 0, tickFormatter: function(val, axis) { return val < axis.max ? Math.round(val*100)/100 : "min";} },
                    xaxis: { min: 0, max: 23, tickDecimals: 0, tickSize: 1 }
                };
            } else if (grouping==="d") {
                options = {
                    grid: { hoverable: true },
                    yaxis: {min: 0, tickFormatter: function(val, axis) { return val < axis.max ? Math.round(val*100)/100 : "min";} },
                    xaxis: { tickDecimals: 0, min: 0, max: 6,
                    tickFormatter: function(v) { var dow=[_("Sun"),_("Mon"),_("Tue"),_("Wed"),_("Thr"),_("Fri"),_("Sat")]; return dow[v]; } }
                };
            } else if (grouping==="m") {
                options = {
                    grid: { hoverable: true },
                    yaxis: {min: 0, tickFormatter: function(val, axis) { return val < axis.max ? Math.round(val*100)/100 : "min";} },
                    xaxis: { tickDecimals: 0, min: 0, max: 11, tickSize: 1,
                    tickFormatter: function(v) { var mon=[_("Jan"),_("Feb"),_("Mar"),_("Apr"),_("May"),_("Jun"),_("Jul"),_("Aug"),_("Sep"),_("Oct"),_("Nov"),_("Dec")]; return mon[v]; } }
                };
            } else if (grouping==="n") {
                options = {
                    grid: { hoverable: true },
                    yaxis: {min: 0, tickFormatter: function(val, axis) { return val < axis.max ? Math.round(val*100)/100 : "min";} },
                    xaxis: { mode: "time", timeformat: "%b %d %H:%M", min:sortedData.min.getTime()-43200000, max:sortedData.max.getTime()+43200000}
                };
            }

            plot = $.plot(placeholder, pData, options);
        },
        sortData = function(type,grouping) {
            var sortedData = [],
                max, min;

            if (type === "graph") {
                switch (grouping) {
                    case "h":
                        for (i=0; i<stations.length; i++) {
                            sortedData[i] = [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0],[12,0],[13,0],[14,0],[15,0],[16,0],[17,0],[18,0],[19,0],[20,0],[21,0],[22,0],[23,0]];
                        }
                        break;
                    case "m":
                        for (i=0; i<stations.length; i++) {
                            sortedData[i] = [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0]];
                        }
                        break;
                    case "d":
                        for (i=0; i<stations.length; i++) {
                            sortedData[i] = [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]];
                        }
                        break;
                    case "n":
                        for (i=0; i<stations.length; i++) {
                            sortedData[i] = [];
                        }
                        break;
                }
            } else {
                if (grouping === "station") {
                    for (i=0; i<stations.length; i++) {
                        sortedData[i] = [];
                    }
                }
            }

            $.each(data,function(a,b){
                var stamp = parseInt(b[3] * 1000),
                    station = b[1],
                    date = new Date(stamp),
                    utc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),  date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()),
                    duration = parseInt(b[2]/60),
                    key;

                if (typeof station === "string") {
                    if (station === "rs") {
                        station = stations.length - 2;
                    } else if (station === "rd") {
                        station = stations.length - 1;
                    }
                } else if (typeof station === "number" && station>stations.length-2) {
                    return;
                }

                if (type === "graph") {
                    switch (grouping) {
                        case "h":
                            key = date.getUTCHours();
                            break;
                        case "m":
                            key = date.getUTCMonth() + 1;
                            break;
                        case "d":
                            key = date.getUTCDay();
                            break;
                        case "n":
                            sortedData[station].push([stamp,duration]);
                            break;
                    }

                    if (grouping !== "n" && duration > 0) {
                        sortedData[station][key][1] += duration;
                    }

                    if (min === undefined || min > date) {
                        min = date;
                    }
                    if (max === undefined || max < date) {
                        max = new Date(date.getTime() + (duration*100*1000)+1);
                    }
                } else {
                    switch (grouping) {
                        case "station":
                            sortedData[station].push([utc.getTime(),dhms2str(sec2dhms(parseInt(b[2])))]);
                            break;
                        case "day":
                            var day = Math.floor(date.getTime() / 1000 / 60 / 60 / 24),
                                item = [utc.getTime(),dhms2str(sec2dhms(parseInt(b[2]))),station];

                            if (typeof sortedData[day] !== "object") {
                                sortedData[day] = [item];
                            } else {
                                sortedData[day].push(item);
                            }

                            break;
                    }
                }
            });
            if (type === "graph") {
                sortedData.min = min;
                sortedData.max = max;
            }

            return sortedData;
        },
        toggleZone = function() {
            var zone = $(this);
            if (zone.hasClass("legendColorBox")) {
                zone.find("div div").toggleClass("hideZone");
                zone.next().toggleClass("unchecked");
            } else if (zone.hasClass("legendLabel")) {
                zone.prev().find("div div").toggleClass("hideZone");
                zone.toggleClass("unchecked");
            }
            seriesChange();
        },
        showArrows = function() {
            var height = zones.height(),
                sleft = zones.scrollLeft(),
                right = $("#graphScrollRight"),
                left = $("#graphScrollLeft");

            if (sleft > 13) {
                left.show().css("margin-top",(height/2)-12.5);
            } else {
                left.hide();
            }
            var total = zones.find("table").width(), container = zones.width();
            if ((total-container) > 0 && sleft < ((total-container) - 13)) {
                right.show().css({
                    "margin-top":(height/2)-12.5,
                    "left":container + ((logs.width() - container) / 2) - 18
                });
            } else {
                right.hide();
            }
        },
        success = function(items){
            if (typeof items !== "object" || items.length < 1 || (items.result && items.result === 32)) {
                $.mobile.loading("hide");
                reset_logs_page();
                return;
            }

            data = items;
            updateView();

            exportObj(".export_logs",data);

            $.mobile.loading("hide");
        },
        updateView = function() {
            $("#tooltip").remove();
            if ($("#log_graph").prop("checked")) {
                prepGraph();
            } else {
                prepTable();
            }
        },
        prepGraph = function() {
            if (data.length < 1) {
                reset_logs_page();
                return;
            }

            logs_list.empty().hide();
            var state = ($.mobile.window.height() > 680) ? "expand" : "collapse";
            setTimeout(function(){log_options.collapsible(state);},100);
            placeholder.empty();
            placeholder.show();
            var freshLoad = zones.find("table").length;
            zones.show();
            graph_sort.show();
            table_sort.hide();
            if (!freshLoad) {
                var output = "<div class='ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border' id='graphScrollLeft'></div><div class='ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border' id='graphScrollRight'></div><table class='smaller'><tbody><tr>";
                for (i=0; i<stations.length; i++) {
                    output += "<td class='legendColorBox'><div><div></div></div></td><td id='z"+i+"' zone_num="+i+" name='"+stations[i] + "' class='legendLabel'>"+stations[i]+"</td>";
                }
                output += "</tr></tbody></table>";
                zones.empty().append(output).enhanceWithin();
                zones.find("td").on("click",toggleZone);
                zones.find("#graphScrollLeft,#graphScrollRight").on("click",function(){
                    var dir = ($(this).attr("id") === "graphScrollRight") ? "+=" : "-=",
                        w = zones.width();
                    zones.animate({scrollLeft: dir+w});
                });
            }
            seriesChange();
            i = 0;
            if (!freshLoad) {
                zones.find("td.legendColorBox div div").each(function(a,b){
                    var border = $(placeholder.find(".legendColorBox div div").get(i)).css("border");
                    //Firefox and IE fix
                    if (border === "") {
                        border = $(placeholder.find(".legendColorBox div div").get(i)).attr("style").split(";");
                        $.each(border,function(a,b){
                            var c = b.split(":");
                            if (c[0] === "border") {
                                border = c[1];
                                return false;
                            }
                        });
                    }
                    $(b).css("border",border);
                    i++;
                });
                showArrows();
            }
        },
        prepTable = function(){
            if (data.length < 1) {
                reset_logs_page();
                return;
            }

            placeholder.empty().hide();
            zones.hide();
            graph_sort.hide();
            table_sort.show();
            logs_list.show();

            var grouping = logs.find("input:radio[name='table-group']:checked").val(),
                table_header = "<table><thead><tr><th data-priority='1'>"+_("Runtime")+"</th><th data-priority='2'>"+(grouping === "station" ? _("Date/Time") : _("Time")+"</th><th>"+_("Station"))+"</th></tr></thead><tbody>",
                html = "<div data-role='collapsible-set' data-inset='true' data-theme='b' data-collapsed-icon='arrow-d' data-expanded-icon='arrow-u'>",
                sortedData = sortData("table",grouping),
                groupArray = [],
                i = 0,
                group, ct, k;

            for (group in sortedData) {
                if (sortedData.hasOwnProperty(group)) {
                    ct=sortedData[group].length;
                    if (ct === 0) {
                        continue;
                    }
                    groupArray[i] = "<div data-role='collapsible' data-collapsed='true'><h2><div class='ui-btn-up-c ui-btn-corner-all custom-count-pos'>"+ct+" "+((ct === 1) ? _("run") : _("runs"))+"</div>"+(grouping === "station" ? stations[group] : dateToString(new Date(group*1000*60*60*24)).slice(0,-9))+"</h2>"+table_header;
                    for (k=0; k<sortedData[group].length; k++) {
                        var date = new Date(sortedData[group][k][0]);
                        groupArray[i] += "<tr><td>"+sortedData[group][k][1]+"</td><td>"+(grouping === "station" ? dateToString(date,false) : pad(date.getHours())+":"+pad(date.getMinutes())+":"+pad(date.getSeconds())+"</td><td>"+stations[sortedData[group][k][2]])+"</td></tr>";
                    }
                    groupArray[i] += "</tbody></table></div>";

                    i++;
                }
            }

            if (grouping === "day") {
                groupArray.reverse();
            }

            log_options.collapsible("collapse");
            logs_list.html(html+groupArray.join("")+"</div>").enhanceWithin();
            fixInputClick(logs_list);
        },
        reset_logs_page = function() {
            placeholder.empty().hide();
            log_options.collapsible("expand");
            zones.empty().hide();
            graph_sort.hide();
            table_sort.hide();
            logs_list.show().html(_("No entries found in the selected date range"));
        },
        fail = function(){
            $.mobile.loading("hide");
            reset_logs_page();
        },
        dates = function() {
            var sDate = $("#log_start").val().split("-"),
                eDate = $("#log_end").val().split("-");
            return {
                start: new Date(sDate[0],sDate[1]-1,sDate[2]),
                end: new Date(eDate[0],eDate[1]-1,eDate[2])
            };
        },
        parms = function() {
            return "start=" + (dates().start.getTime() / 1000) + "&end=" + ((dates().end.getTime() / 1000) + 86340);
        },
        requestData = function() {
            var endtime = dates().end.getTime() / 1000,
                starttime = dates().start.getTime() / 1000;

            if (endtime < starttime) {
                fail();
                showerror(_("Start time cannot be greater than end time"));
                return;
            }

            var delay = 0;
            $.mobile.loading("show");

            if ((endtime - starttime) > 31540000) {
                showerror(_("The requested time span exceeds the maxiumum of 1 year and has been adjusted"),3500);
                var nDate = dates().start;
                nDate.setFullYear(nDate.getFullYear() + 1);
                $("#log_end").val(nDate.getFullYear() + "-" + pad(nDate.getMonth()+1) + "-" + pad(nDate.getDate()));
                delay = 500;
            }

            setTimeout(function(){
                send_to_os("/jl?pw=&"+parms(),"json").then(success,fail);
            },delay);
        },
        logtimeout, hovertimeout, i;

    logs.find("input").blur();

    //Update left/right arrows when zones are scrolled on log page
    zones.scroll(showArrows);

    $.mobile.window.resize(function(){
        if (logs.find("#log_graph").is(":checked") && placeholder.is(":visible")) {
            showArrows();
            seriesChange();
        }
    });

    // Bind clear logs button
    logs.find(".clear_logs").on("click",function(){
        areYouSure(_("Are you sure you want to clear ALL your log data?"), "", function() {
            var url = isOSPi() ? "/cl?pw=" : "/dl?pw=&day=all";
            $.mobile.loading("show");
            send_to_os(url).done(function(){
                requestData();
                showerror(_("Logs have been cleared"));
            });
        });
        return false;
    });


    //Automatically update the log viewer when changing the date range
    if (isiOS) {
        logs.find("#log_start,#log_end").on("blur",requestData);
    } else {
        logs.find("#log_start,#log_end").change(function(){
            clearTimeout(logtimeout);
            logtimeout = setTimeout(requestData,1000);
        });
    }

    //Automatically update log viewer when switching graphing method
    graph_sort.find("input[name='g']").change(function(){
        seriesChange();
    });

    //Automatically update log viewer when switching table sort
    table_sort.find("input[name='table-group']").change(function(){
        prepTable();
    });

    //Bind refresh button
    logs.find("div[data-role='header'] > .ui-btn-right").on("click",requestData);

    //Bind view change buttons
    logs.find("input:radio[name='log_type']").change(updateView);

    //Show tooltip (station name) when point is clicked on the graph
    placeholder.on("plothover",function(e,p,item) {
        $("#tooltip").remove();
        clearTimeout(hovertimeout);
        if (item) {
            hovertimeout = setTimeout(function(){showTooltip(item.pageX, item.pageY, item.series.label, item.series.color);}, 100);
        }
    });

    logs.one({
        pagehide: function(){
            $("#tooltip").remove();
            $.mobile.window.off("resize");
            logs.remove();
        },
        pageshow: requestData
    });

    $("#logs").remove();
    logs.appendTo("body");
}

// Program management functions
function get_programs(pid) {
    var programs = $("<div data-role='page' id='programs'>" +
            "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false' data-hide-during-focus=''>" +
                "<a href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                "<h3>"+_("Programs")+"</h3>" +
                "<a href='#addprogram' data-icon='plus' class='ui-btn-right'>"+_("Add")+"</a>" +
            "</div>" +
            "<div class='ui-content' role='main' id='programs_list'>" +
                make_all_programs() +
            "</div>" +
        "</div>");

    programs.find("[id^=program-]").on({
        collapsiblecollapse: function(){
            $(this).find(".ui-collapsible-content").empty();
        },
        collapsibleexpand: function(){
            expandProgram($(this));
        }
    });

    if (checkOSVersion(210)) {
        programs.find(".move-up").removeClass("hidden").on("click",function(){
            var group = $(this).parents("fieldset"),
                pid = parseInt(group.attr("id").split("-")[1]);

            $.mobile.loading("show");

            send_to_os("/up?pw=&pid="+pid).done(function(){
                update_controller_programs(function(){
                    $.mobile.loading("hide");
                    changePage("#programs",{
                        updatePrograms:true,
                        showLoadMsg:false
                    });
                });
            });

            return false;
        });
    }

    programs.find(".program-copy").on("click",function(){
        var copyID = parseInt($(this).parents("fieldset").attr("id").split("-")[1]);

        changePage("#addprogram",{
            copyID: copyID
        });

        return false;
    });

    programs
    .one("pagehide",function(){
        programs.remove();
    })
    .one("pagebeforeshow",function(){
        update_program_header();

        if (typeof pid !== "number" && controller.programs.pd.length === 1) {
            pid = 0;
        }

        if (typeof pid === "number") {
            programs.find("fieldset[data-collapsed='false']").collapsible("collapse");
            $("#program-"+pid).collapsible("expand");
        }
    });

    $("#programs").remove();
    programs.appendTo("body");
}

function expandProgram(program) {
    var id = parseInt(program.attr("id").split("-")[1]);

    program.find(".ui-collapsible-content").html(make_program(id)).enhanceWithin();

    program.find("[id^='submit-']").on("click",function(){
        submit_program(id);
        return false;
    });

    program.find("[id^='delete-']").on("click",function(){
        delete_program(id);
        return false;
    });

    program.find("[id^='run-']").on("click",function(){
        var runonce = [];

        if (checkOSVersion(210)) {
            runonce = controller.programs.pd[id][4];
        } else {
            var durr = parseInt($("#duration-"+id).val()),
                stations = $("[id^='station_'][id$='-"+id+"']");

            $.each(stations,function(a,b){
                if ($(b).is(":checked")) {
                    runonce.push(durr);
                } else {
                    runonce.push(0);
                }
            });
        }
        runonce.push(0);
        submit_runonce(runonce);
        return false;
    });
}

// Translate program array into easier to use data
function read_program(program) {
    if (checkOSVersion(210)) {
        return read_program21(program);
    } else {
        return read_program183(program);
    }
}

function read_program183(program) {
    var days0 = program[1],
        days1 = program[2],
        even = false,
        odd = false,
        interval = false,
        days = "",
        stations = "",
        newdata = {};

    newdata.en = program[0];
    for (var n=0; n < controller.programs.nboards; n++) {
        var bits = program[7+n];
        for (var s=0; s < 8; s++) {
            stations += (bits&(1<<s)) ? "1" : "0";
        }
    }
    newdata.stations = stations;
    newdata.duration = program[6];

    newdata.start = program[3];
    newdata.end = program[4];
    newdata.interval = program[5];

    if((days0&0x80)&&(days1>1)){
        //This is an interval program
        days=[days1,days0&0x7f];
        interval = true;
    } else {
        //This is a weekly program
        for(var d=0;d<7;d++) {
            if (days0&(1<<d)) {
                days += "1";
            } else {
                days += "0";
            }
        }
        if((days0&0x80)&&(days1===0)) {even = true;}
        if((days0&0x80)&&(days1===1)) {odd = true;}
    }

    newdata.days = days;
    newdata.is_even = even;
    newdata.is_odd = odd;
    newdata.is_interval = interval;

    return newdata;
}

// Read program for OpenSprinkler 2.1+
function read_program21(program) {
    var days0 = program[1],
        days1 = program[2],
        restrict = ((program[0]>>2)&0x03),
        type = ((program[0]>>4)&0x03),
        start_type = ((program[0]>>6)&0x01),
        days = "",
        newdata = {
            repeat: 0,
            interval: 0
        };

    newdata.en = (program[0]>>0)&1;
    newdata.weather = (program[0]>>1)&1;
    newdata.is_even = (restrict === 2) ? true : false;
    newdata.is_odd = (restrict === 1) ? true : false;
    newdata.is_interval = (type === 3) ? true : false;
    newdata.stations = program[4];
    newdata.name = program[5];

    if (start_type === 0) {
        newdata.start = program[3][0];
        newdata.repeat = program[3][1];
        newdata.interval = program[3][2];
    } else if (start_type === 1) {
        newdata.start = program[3];
    }

    if(type === 3){
        //This is an interval program
        days=[days1,days0];
    } else if (type === 0) {
        //This is a weekly program
        for(var d=0;d<7;d++) {
            if (days0&(1<<d)) {
                days += "1";
            } else {
                days += "0";
            }
        }
    }

    newdata.days = days;
    return newdata;
}

// Translate program ID to it's name
function pidname(pid) {
    var pname = _("Program")+" "+pid;

    if(pid===255||pid===99) {
        pname=_("Manual program");
    } else if(pid===254||pid===98) {
        pname=_("Run-once program");
    } else if (checkOSVersion(210) && pid <= controller.programs.pd.length) {
        pname = controller.programs.pd[pid-1][5];
    }

    return pname;
}

// Check each program and change the background color to red if disabled
function update_program_header() {
    $("#programs_list").find("[id^=program-]").each(function(a,b){
        var item = $(b),
            heading = item.find(".ui-collapsible-heading-toggle"),
            en = checkOSVersion(210) ? (controller.programs.pd[a][0])&0x01 : controller.programs.pd[a][0];

        if (en) {
            heading.removeClass("red");
        } else {
            heading.addClass("red");
        }
    });
}

//Make the list of all programs
function make_all_programs() {
    if (controller.programs.pd.length === 0) {
        return "<p class='center'>"+_("You have no programs currently added. Tap the Add button on the top right corner to get started.")+"</p>";
    }
    var list = "<p class='center'>"+_("Click any program below to expand/edit. Be sure to save changes.")+"</p><div data-role='collapsible-set'>",
        name;

    for (var i = 0; i < controller.programs.pd.length; i++) {
        name = _("Program")+" "+(i+1);
        if (checkOSVersion(210)) {
            name = controller.programs.pd[i][5];
        }
        list += "<fieldset id='program-"+i+"' data-role='collapsible'><h3><a "+(i>0 ? "" : "style='visibility:hidden' ")+"class='hidden ui-btn ui-btn-icon-notext ui-icon-arrow-u ui-btn-corner-all move-up'></a><a class='ui-btn ui-btn-corner-all program-copy'>"+_("copy")+"</a><span class='program-name'>"+name+"</span></h3>";
        list += "</fieldset>";
    }
    return list+"</div>";
}

function make_program(n,isCopy) {
    if (checkOSVersion(210)) {
        return make_program21(n,isCopy);
    } else {
        return make_program183(n,isCopy);
    }
}

function make_program183(n,isCopy) {
    var week = [_("Monday"),_("Tuesday"),_("Wednesday"),_("Thursday"),_("Friday"),_("Saturday"),_("Sunday")],
        list = "",
        id = isCopy ? "new" : n,
        days, i, j, set_stations, program, page;

    if (n === "new") {
        program = {"en":0,"weather":0,"is_interval":0,"is_even":0,"is_odd":0,"duration":0,"interval":0,"start":0,"end":0,"days":[0,0]};
    } else {
        program = read_program(controller.programs.pd[n]);
    }

    if (typeof program.days === "string") {
        days = program.days.split("");
        for(i=days.length;i--;) {
            days[i] = days[i]|0;
        }
    } else {
        days = [0,0,0,0,0,0,0];
    }
    if (typeof program.stations !== "undefined") {
        set_stations = program.stations.split("");
        for(i=set_stations.length-1;i>=0;i--) {
            set_stations[i] = set_stations[i]|0;
        }
    }
    list += "<label for='en-"+id+"'><input data-mini='true' type='checkbox' "+((program.en || n==="new") ? "checked='checked'" : "")+" name='en-"+id+"' id='en-"+id+"'>"+_("Enabled")+"</label>";
    list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
    list += "<input data-mini='true' type='radio' name='rad_days-"+id+"' id='days_week-"+id+"' value='days_week-"+id+"' "+((program.is_interval) ? "" : "checked='checked'")+"><label for='days_week-"+id+"'>"+_("Weekly")+"</label>";
    list += "<input data-mini='true' type='radio' name='rad_days-"+id+"' id='days_n-"+id+"' value='days_n-"+id+"' "+((program.is_interval) ? "checked='checked'" : "")+"><label for='days_n-"+id+"'>"+_("Interval")+"</label>";
    list += "</fieldset><div id='input_days_week-"+id+"' "+((program.is_interval) ? "style='display:none'" : "")+">";

    list += "<div class='center'><p class='tight'>"+_("Restrictions")+"</p><select data-inline='true' data-iconpos='left' data-mini='true' id='days_rst-"+id+"'>";
    list += "<option value='none' "+((!program.is_even && !program.is_odd) ? "selected='selected'" : "")+">"+_("None")+"</option>";
    list += "<option value='odd' "+((!program.is_even && program.is_odd) ? "selected='selected'" : "")+">"+_("Odd Days")+"</option>";
    list += "<option value='even' "+((!program.is_odd && program.is_even) ? "selected='selected'" : "")+">"+_("Even Days")+"</option>";
    list += "</select></div>";

    list += "<div class='center'><p class='tight'>"+_("Days of the Week")+"</p><select "+($.mobile.window.width() > 560 ? "data-inline='true' " : "")+"data-iconpos='left' data-mini='true' multiple='multiple' data-native-menu='false' id='d-"+id+"'><option>"+_("Choose day(s)")+"</option>";
    for (j=0; j<week.length; j++) {
        list += "<option "+((!program.is_interval && days[j]) ? "selected='selected'" : "")+" value='"+j+"'>"+week[j]+"</option>";
    }
    list += "</select></div></div>";

    list += "<div "+((program.is_interval) ? "" : "style='display:none'")+" id='input_days_n-"+id+"' class='ui-grid-a'>";
    list += "<div class='ui-block-a'><label class='center' for='every-"+id+"'>"+_("Interval (Days)")+"</label><input data-wrapper-class='pad_buttons' data-mini='true' type='number' name='every-"+id+"' pattern='[0-9]*' id='every-"+id+"' value='"+program.days[0]+"'></div>";
    list += "<div class='ui-block-b'><label class='center' for='starting-"+id+"'>"+_("Starting In")+"</label><input data-wrapper-class='pad_buttons' data-mini='true' type='number' name='starting-"+id+"' pattern='[0-9]*' id='starting-"+id+"' value='"+program.days[1]+"'></div>";
    list += "</div>";

    list += "<fieldset data-role='controlgroup'><legend>"+_("Stations:")+"</legend>";

    for (j=0; j<controller.stations.snames.length; j++) {
        list += "<label for='station_"+j+"-"+id+"'><input "+(isStationDisabled(j) ? "data-wrapper-class='hidden' " : "")+"data-mini='true' type='checkbox' "+(((typeof set_stations !== "undefined") && set_stations[j]) ? "checked='checked'" : "")+" name='station_"+j+"-"+id+"' id='station_"+j+"-"+id+"'>"+controller.stations.snames[j]+"</label>";
    }

    list += "</fieldset>";
    list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
    list += "<a class='ui-btn ui-mini' name='s_checkall-"+id+"' id='s_checkall-"+id+"'>"+_("Check All")+"</a>";
    list += "<a class='ui-btn ui-mini' name='s_uncheckall-"+id+"' id='s_uncheckall-"+id+"'>"+_("Uncheck All")+"</a>";
    list += "</fieldset>";

    list += "<div class='ui-grid-a'>";
    list += "<div class='ui-block-a'><label class='center' for='start-"+id+"'>"+_("Start Time")+"</label><input data-wrapper-class='pad_buttons' data-mini='true' type='time' name='start-"+id+"' id='start-"+id+"' value='"+pad(parseInt(program.start/60)%24)+":"+pad(program.start%60)+"'></div>";
    list += "<div class='ui-block-b'><label class='center' for='end-"+id+"'>"+_("End Time")+"</label><input data-wrapper-class='pad_buttons' data-mini='true' type='time' name='end-"+id+"' id='end-"+id+"' value='"+pad(parseInt(program.end/60)%24)+":"+pad(program.end%60)+"'></div>";
    list += "</div>";

    list += "<div class='ui-grid-a'>";
    list += "<div class='ui-block-a'><label class='pad_buttons center' for='duration-"+id+"'>"+_("Station Duration")+"</label><button class='pad_buttons' data-mini='true' name='duration-"+id+"' id='duration-"+id+"' value='"+program.duration+"'>"+dhms2str(sec2dhms(program.duration))+"</button></div>";
    list += "<div class='ui-block-b'><label class='pad_buttons center' for='interval-"+id+"'>"+_("Program Interval")+"</label><button class='pad_buttons' data-mini='true' name='interval-"+id+"' id='interval-"+id+"' value='"+program.interval*60+"'>"+dhms2str(sec2dhms(program.interval*60))+"</button></div>";
    list += "</div>";

    if (isCopy === true || n === "new") {
        list += "<input data-mini='true' data-icon='check' type='submit' data-theme='b' name='submit-"+id+"' id='submit-"+id+"' value='"+_("Save New Program")+"'>";
    } else {
        list += "<button data-mini='true' data-icon='check' data-theme='b' name='submit-"+id+"' id='submit-"+id+"'>"+_("Save Changes to Program")+" "+(n + 1)+"</button>";
        list += "<button data-mini='true' data-icon='arrow-r' name='run-"+id+"' id='run-"+id+"'>"+_("Run Program")+" "+(n + 1)+"</button>";
        list += "<button data-mini='true' data-icon='delete' class='red bold' data-theme='b' name='delete-"+id+"' id='delete-"+id+"'>"+_("Delete Program")+" "+(n + 1)+"</button>";
    }

    page = $(list);

    page.find("input[name^='rad_days']").on("change",function(){
        var type = $(this).val().split("-")[0],
            old;

        type = type.split("_")[1];
        if (type === "n") {
            old = "week";
        } else {
            old = "n";
        }
        $("#input_days_"+type+"-"+id).show();
        $("#input_days_"+old+"-"+id).hide();
    });

    page.find("[id^='duration-'],[id^='interval-']").on("click",function(){
        var dur = $(this),
            isInterval = dur.attr("id").match("interval") ? 1 : 0,
            name = page.find("label[for='"+dur.attr("id")+"']").text();

        showDurationBox({
            seconds: dur.val(),
            title: name,
            callback: function(result){
                dur.val(result);
                dur.text(dhms2str(sec2dhms(result)));
            },
            maximum: isInterval ? 86340 : 65535,
            granularity: isInterval
        });
        return false;
    });

    page.find("[id^='s_checkall-']").on("click",function(){
        page.find("[id^='station_'][id$='-"+id+"']").prop("checked",true).checkboxradio("refresh");
        return false;
    });

    page.find("[id^='s_uncheckall-']").on("click",function(){
        page.find("[id^='station_'][id$='-"+id+"']").prop("checked",false).checkboxradio("refresh");
        return false;
    });

    fixInputClick(page);

    return page;
}

function make_program21(n,isCopy) {
    var week = [_("Monday"),_("Tuesday"),_("Wednesday"),_("Thursday"),_("Friday"),_("Saturday"),_("Sunday")],
        list = "",
        id = isCopy ? "new" : n,
        days, i, j, program, page, times, time;

    if (n === "new") {
        program = {"name":"","en":0,"weather":0,"is_interval":0,"is_even":0,"is_odd":0,"interval":0,"start":0,"days":[0,0],"repeat":0,"stations":[]};
    } else {
        program = read_program(controller.programs.pd[n]);
    }

    if (typeof program.days === "string") {
        days = program.days.split("");
        for(i=days.length;i--;) {
            days[i] = days[i]|0;
        }
    } else {
        days = [0,0,0,0,0,0,0];
    }

    if (typeof program.start === "object") {
        times = program.start;
    } else {
        times = [program.start,-1,-1,-1];
    }

    // Group basic settings visually
    list += "<div style='margin-top:5px' class='ui-corner-all'>";
    list += "<div class='ui-bar ui-bar-a'><h3>"+_("Basic Settings")+"</h3></div>";
    list += "<div class='ui-body ui-body-a center'>";

    // Progran name
    list += "<label for='name-"+id+"'>"+_("Program Name")+"</label><input data-mini='true' type='text' name='name-"+id+"' id='name-"+id+"' maxlength='"+controller.programs.pnsize+"' placeholder='"+_("Program")+" "+(controller.programs.pd.length+1)+"' value='"+program.name+"'>";

    // Program enable/disable flag
    list += "<label for='en-"+id+"'><input data-mini='true' type='checkbox' "+((program.en || n==="new") ? "checked='checked'" : "")+" name='en-"+id+"' id='en-"+id+"'>"+_("Enabled")+"</label>";

    // Program weather control flag
    list += "<label for='uwt-"+id+"'><input data-mini='true' type='checkbox' "+((program.weather) ? "checked='checked'" : "")+" name='uwt-"+id+"' id='uwt-"+id+"'>"+_("Use Weather Adjustment")+"</label>";

    // Show start time menu
    list += "<label class='center' for='start_1-"+id+"'>"+_("Start Time")+"</label><input data-mini='true' type='time' name='start_1-"+id+"' id='start_1-"+id+"' value='"+pad(parseInt(times[0]/60)%24)+":"+pad(times[0]%60)+"'>";

    // Close basic settings group
    list += "</div></div></div></div>";

    // Group all program type options visually
    list += "<div style='margin-top:10px' class='ui-corner-all'>";
    list += "<div class='ui-bar ui-bar-a'><h3>"+_("Program Type")+"</h3></div>";
    list += "<div class='ui-body ui-body-a'>";

    // Controlgroup to handle program type (weekly/interval)
    list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
    list += "<input data-mini='true' type='radio' name='rad_days-"+id+"' id='days_week-"+id+"' value='days_week-"+id+"' "+((program.is_interval) ? "" : "checked='checked'")+"><label for='days_week-"+id+"'>"+_("Weekly")+"</label>";
    list += "<input data-mini='true' type='radio' name='rad_days-"+id+"' id='days_n-"+id+"' value='days_n-"+id+"' "+((program.is_interval) ? "checked='checked'" : "")+"><label for='days_n-"+id+"'>"+_("Interval")+"</label>";
    list += "</fieldset>";

    // Show weekly program options
    list += "<div id='input_days_week-"+id+"' "+((program.is_interval) ? "style='display:none'" : "")+">";
    list += "<div class='center'><p class='tight'>"+_("Days of the Week")+"</p><select "+($.mobile.window.width() > 560 ? "data-inline='true' " : "")+"data-iconpos='left' data-mini='true' multiple='multiple' data-native-menu='false' id='d-"+id+"'><option>"+_("Choose day(s)")+"</option>";
    for (j=0; j<week.length; j++) {
        list += "<option "+((!program.is_interval && days[j]) ? "selected='selected'" : "")+" value='"+j+"'>"+week[j]+"</option>";
    }
    list += "</select></div></div>";

    // Show interval program options
    list += "<div "+((program.is_interval) ? "" : "style='display:none'")+" id='input_days_n-"+id+"' class='ui-grid-a'>";
    list += "<div class='ui-block-a'><label class='center' for='every-"+id+"'>"+_("Interval (Days)")+"</label><input data-wrapper-class='pad_buttons' data-mini='true' type='number' name='every-"+id+"' pattern='[0-9]*' id='every-"+id+"' value='"+program.days[0]+"'></div>";
    list += "<div class='ui-block-b'><label class='center' for='starting-"+id+"'>"+_("Starting In")+"</label><input data-wrapper-class='pad_buttons' data-mini='true' type='number' name='starting-"+id+"' pattern='[0-9]*' id='starting-"+id+"' value='"+program.days[1]+"'></div>";
    list += "</div>";

    // Show restriction options
    list += "<div class='center'><p class='tight'>"+_("Restrictions")+"</p><select data-inline='true' data-iconpos='left' data-mini='true' id='days_rst-"+id+"'>";
    list += "<option value='none' "+((!program.is_even && !program.is_odd) ? "selected='selected'" : "")+">"+_("None")+"</option>";
    list += "<option value='odd' "+((!program.is_even && program.is_odd) ? "selected='selected'" : "")+">"+_("Odd Days")+"</option>";
    list += "<option value='even' "+((!program.is_odd && program.is_even) ? "selected='selected'" : "")+">"+_("Even Days")+"</option>";
    list += "</select></div>";

    // Close program type group
    list += "</div></div>";

    // Group all stations visually
    list += "<div style='margin-top:10px' class='ui-corner-all'>";
    list += "<div class='ui-bar ui-bar-a'><h3>"+_("Stations")+"</h3></div>";
    list += "<div class='ui-body ui-body-a'>";

    // Show station duration inputs
    for (j=0; j<controller.stations.snames.length; j++) {
        if (controller.options.mas === j+1) {
            list += "<div class='ui-field-contain duration-input"+(isStationDisabled(j) ? " hidden" : "")+"'><label for='station_"+j+"-"+id+"'>"+controller.stations.snames[j]+":</label><button disabled='true' data-mini='true' name='station_"+j+"-"+id+"' id='station_"+j+"-"+id+"' value='0'>Master</button></div>";
        } else {
            time = program.stations[j] || 0;
            list += "<div class='ui-field-contain duration-input"+(isStationDisabled(j) ? " hidden" : "")+"'><label for='station_"+j+"-"+id+"'>"+controller.stations.snames[j]+":</label><button "+(time>0 ? "class='green' " : "")+"data-mini='true' name='station_"+j+"-"+id+"' id='station_"+j+"-"+id+"' value='"+time+"'>"+dhms2str(sec2dhms(time))+"</button></div>";
        }
    }

    // Close station group
    list += "</div></div>";

    // Group all start time options visually
    list += "<div style='margin-top:10px' class='ui-corner-all'>";
    list += "<div class='ui-bar ui-bar-a'><h3>"+_("Additional Start Times")+"</h3></div>";
    list += "<div class='ui-body ui-body-a'>";

    // Controlgroup to handle start time type (repeating or set times)
    list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
    list += "<input data-mini='true' type='radio' name='stype-"+id+"' id='stype_repeat-"+id+"' value='stype_repeat-"+id+"' "+((typeof program.start === "object") ? "" : "checked='checked'")+"><label for='stype_repeat-"+id+"'>"+_("Repeating")+"</label>";
    list += "<input data-mini='true' type='radio' name='stype-"+id+"' id='stype_set-"+id+"' value='stype_set-"+id+"' "+((typeof program.start === "object") ? "checked='checked'" : "")+"><label for='stype_set-"+id+"'>"+_("Fixed")+"</label>";
    list += "</fieldset>";

    // Show repeating start time options
    list += "<div "+((typeof program.start === "object") ? "style='display:none'" : "")+" id='input_stype_repeat-"+id+"'>";
    list += "<div class='ui-grid-a'>";
    list += "<div class='ui-block-a'><label class='pad_buttons center' for='interval-"+id+"'>"+_("Repeat Every")+"</label><button class='pad_buttons' data-mini='true' name='interval-"+id+"' id='interval-"+id+"' value='"+program.interval*60+"'>"+dhms2str(sec2dhms(program.interval*60))+"</button></div>";
    list += "<div class='ui-block-b'><label class='pad_buttons center' for='repeat-"+id+"'>"+_("Repeat Count")+"</label><button class='pad_buttons' data-mini='true' name='repeat-"+id+"' id='repeat-"+id+"' value='"+program.repeat+"'>"+program.repeat+"</button></div>";
    list += "</div></div>";

    // Show set times options
    list +="<table style='width:100%;"+((typeof program.start === "object") ? "" : "display:none")+"' id='input_stype_set-"+id+"'><tr><th class='center'>"+_("Enable")+"</th><th>"+_("Start Time")+"</th></tr>";
    for (j=1; j<4; j++) {
        list += "<tr><td data-role='controlgroup' data-type='horizontal' class='use_master center'><label for='ust_"+(j+1)+"'><input id='ust_"+(j+1)+"' type='checkbox' "+((times[j] === -1) ? "" : "checked='checked'")+"></label></td>";
        list += "<td><input data-mini='true' type='time' name='start_"+(j+1)+"-"+id+"' id='start_"+(j+1)+"-"+id+"' value='"+pad(parseInt(times[j]/60)%24)+":"+pad(times[j]%60)+"'></td></tr>";
    }

    list += "</table>";

    // Close start time type group
    list += "</div></div>";

    // Show save, run and delete buttons
    if (isCopy === true || n === "new") {
        list += "<button data-mini='true' data-icon='check' data-theme='b' id='submit-"+id+"'>"+_("Save New Program")+"</button>";
    } else {
        list += "<button data-mini='true' data-icon='check' data-theme='b' id='submit-"+id+"'>"+_("Save Changes to")+" <span class='program-name'>"+program.name+"</span></button>";
        list += "<button data-mini='true' data-icon='arrow-r' id='run-"+id+"'>"+_("Run")+" <span class='program-name'>"+program.name+"</span></button>";
        list += "<button data-mini='true' data-icon='delete' class='bold red' data-theme='b' id='delete-"+id+"'>"+_("Delete")+" <span class='program-name'>"+program.name+"</span></button>";
    }

    // Take HTML string and convert to jQuery object
    page = $(list);

    // When controlgroup buttons are toggled change relevant options
    page.find("input[name^='rad_days'],input[name^='stype']").on("change",function(){
        var input = $(this).val().split("-")[0].split("_");

        $("[id^='input_"+input[0]+"_']").hide();
        $("#input_"+input[0]+"_"+input[1]+"-"+id).show();
    });

    // Handle interval duration input
    page.find("[id^='interval-']").on("click",function(){
        var dur = $(this),
            name = page.find("label[for='"+dur.attr("id")+"']").text();

        showDurationBox({
            seconds: dur.val(),
            title: name,
            callback: function(result){
                dur.val(result);
                dur.text(dhms2str(sec2dhms(result)));
            },
            maximum: 86340,
            granularity: 1,
            preventCompression: true
        });
        return false;
    });

    // Handle repeat count button
    page.find("[id^='repeat-']").on("click",function(){
        var dur = $(this),
            name = page.find("label[for='"+dur.attr("id")+"']").text();

        showSingleDurationInput({
            data: dur.val(),
            title: name,
            label: _("Repeat Count"),
            callback: function(result){
                dur.val(result).text(result);
            },
            maximum: 1440
        });

        return false;
    });

    // Handle all station duration inputs
    page.find("[id^=station_]").on("click",function(){
        var dur = $(this),
            name = controller.stations.snames[dur.attr("id").split("_")[1].split("-")[0]];

        showDurationBox({
            seconds: dur.val(),
            title: name,
            callback: function(result){
                dur.val(result);
                dur.text(dhms2str(sec2dhms(result)));
                if (result > 0) {
                    dur.addClass("green");
                } else {
                    dur.removeClass("green");
                }
            },
            maximum: 65535
        });

        return false;
    });

    page.on("mousewheel","input[type='time']",function(){
        if ($(this).is(":focus")) {
            return false;
        }
    });

    fixInputClick(page);

    return page;
}

function add_program(copyID) {
    copyID = (copyID >= 0) ? copyID : "new";

    var addprogram = $("<div data-role='page' id='addprogram'>" +
                "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false' data-hide-during-focus=''>" +
                    "<h3>"+_("Add Program")+"</h3>" +
                    "<a href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                    "<button data-icon='check' class='ui-btn-right'>"+_("Submit")+"</button>" +
                "</div>" +
                "<div class='ui-content' role='main' id='newprogram'>" +
                    "<fieldset id='program-new'>" +
                    "</fieldset>" +
                "</div>" +
            "</div>");

    addprogram.find("#program-new").html(make_program(copyID,true));

    addprogram.find("div[data-role='header'] > .ui-btn-right, [id^='submit-']").on("click",function(){
        submit_program("new");
        return false;
    });

    addprogram.one("pagehide",function() {
        addprogram.remove();
    });

    $("#addprogram").remove();
    addprogram.appendTo("body");
}

function delete_program(id) {
    areYouSure(_("Are you sure you want to delete program")+" "+(parseInt(id)+1)+"?", "", function() {
        $.mobile.loading("show");
        send_to_os("/dp?pw=&pid="+id).done(function(){
            $.mobile.loading("hide");
            update_controller_programs(function(){
                changePage("#programs",{
                    updatePrograms: true,
                    showLoadMsg:false
                });
                showerror(_("Program")+" "+(parseInt(id)+1)+" "+_("deleted"));
            });
        });
    });
}

function submit_program(id) {
    if (checkOSVersion(210)) {
        submit_program21(id);
    } else {
        submit_program183(id);
    }
}

function submit_program183(id) {
    var program = [],
        days=[0,0],
        station_selected=0,
        en = ($("#en-"+id).is(":checked")) ? 1 : 0,
        daysin, i, s;

    program[0] = en;

    if($("#days_week-"+id).is(":checked")) {
        daysin = $("#d-"+id).val();
        daysin = (daysin === null) ? [] : parseIntArray(daysin);
        for(i=0;i<7;i++) {if($.inArray(i,daysin) !== -1) {days[0] |= (1<<i); }}
        if (days[0] === 0) {
            showerror(_("Error: You have not selected any days of the week."));
            return;
        }
        if($("#days_rst-"+id).val() === "odd") {days[0]|=0x80; days[1]=1;}
        else if($("#days_rst-"+id).val() === "even") {days[0]|=0x80; days[1]=0;}
    } else if($("#days_n-"+id).is(":checked")) {
        days[1]=parseInt($("#every-"+id).val(),10);
        if(!(days[1]>=2&&days[1]<=128)) {showerror(_("Error: Interval days must be between 2 and 128."));return;}
        days[0]=parseInt($("#starting-"+id).val(),10);
        if(!(days[0]>=0&&days[0]<days[1])) {showerror(_("Error: Starting in days wrong."));return;}
        days[0]|=0x80;
    }
    program[1] = days[0];
    program[2] = days[1];

    var start = $("#start-"+id).val().split(":");
    program[3] = parseInt(start[0])*60+parseInt(start[1]);
    var end = $("#end-"+id).val().split(":");
    program[4] = parseInt(end[0])*60+parseInt(end[1]);

    if(program[3]>program[4]) {showerror(_("Error: Start time must be prior to end time."));return;}

    program[5] = parseInt($("#interval-"+id).val()/60);

    var sel = $("[id^=station_][id$=-"+id+"]"),
        total = sel.length,
        nboards = total / 8;

    program[6] = parseInt($("#duration-"+id).val());
    var stations=[0],bid, sid;
    for(bid=0;bid<nboards;bid++) {
        stations[bid]=0;
        for(s=0;s<8;s++) {
            sid=bid*8+s;
            if($("#station_"+sid+"-"+id).is(":checked")) {
                stations[bid] |= 1<<s; station_selected=1;
            }
        }
    }
    program = JSON.stringify(program.concat(stations));

    if(station_selected===0) {showerror(_("Error: You have not selected any stations."));return;}
    $.mobile.loading("show");
    if (id === "new") {
        send_to_os("/cp?pw=&pid=-1&v="+program).done(function(){
            $.mobile.loading("hide");
            update_controller_programs(function(){
                $.mobile.document.one("pageshow",function(){
                    showerror(_("Program added successfully"));
                });
                goBack();
            });
        });
    } else {
        send_to_os("/cp?pw=&pid="+id+"&v="+program).done(function(){
            $.mobile.loading("hide");
            update_controller_programs(function(){
                update_program_header();
            });
            showerror(_("Program has been updated"));
        });
    }
}

function submit_program21(id) {
    var program = [],
        days=[0,0],
        start = [0,0,0,0],
        station_selected=0,
        en = ($("#en-"+id).is(":checked")) ? 1 : 0,
        weather = ($("#uwt-"+id).is(":checked")) ? 1 : 0,
        j = 0,
        daysin, i, name, url;

    // Set enable/disable bit for program
    j |= (en<<0);

    // Set use weather flag
    j |= (weather<<1);

    // Set restriction flag
    if($("#days_rst-"+id).val() === "odd") {
        j |= (1<<2);
    } else if($("#days_rst-"+id).val() === "even") {
        j |= (2<<2);
    }

    // Set program type
    if ($("#days_n-"+id).is(":checked")) {
        j |= (3<<4);
        days[1]=parseInt($("#every-"+id).val(),10);
        if(!(days[1]>=2&&days[1]<=128)) {showerror(_("Error: Interval days must be between 2 and 128."));return;}
        days[0]=parseInt($("#starting-"+id).val(),10);
        if(!(days[0]>=0&&days[0]<days[1])) {showerror(_("Error: Starting in days wrong."));return;}
    } else if ($("#days_week-"+id).is(":checked")) {
        j |= (0<<4);
        daysin = $("#d-"+id).val();
        daysin = (daysin === null) ? [] : parseIntArray(daysin);
        for(i=0;i<7;i++) {
            if($.inArray(i,daysin) !== -1) {
                days[0] |= (1<<i);
            }
        }
        if (days[0] === 0) {
            showerror(_("Error: You have not selected any days of the week."));
            return;
        }
    }

    // Set program start time type
    if ($("#stype_repeat-"+id).is(":checked")) {
        j |= (0<<6);

        var time = $("#start_1-"+id).val().split(":");
        start[0] = parseInt(time[0])*60+parseInt(time[1]);
        start[1] = parseInt($("#repeat-"+id).val());
        start[2] = parseInt($("#interval-"+id).val()/60);
    } else if ($("#stype_set-"+id).is(":checked")) {
        j |= (1<<6);
        var times = $("[id^='start_'][id$='-"+id+"']");

        times.each(function(a,b){
            var time = b.value.split(":");

            if ((time[0] === "" || time[1] === "") || (a > 0 && !$("#ust_"+(a+1)).is(":checked"))) {
                time = -1;
            } else {
                time = parseInt(time[0])*60+parseInt(time[1]);
            }
            start[a] = time;
        });
    }

    var sel = $("[id^=station_][id$=-"+id+"]"),
        runTimes = [];

    sel.each(function(a,b){
        var dur = parseInt(b.value);
        if (parseInt(dur) > 0) {
            station_selected = 1;
        }
        runTimes.push(dur);
    });

    program[0] = j;
    program[1] = days[0];
    program[2] = days[1];
    program[3] = start;
    program[4] = runTimes;

    name = $("#name-"+id).val();
    url = "&v="+JSON.stringify(program)+"&name="+encodeURIComponent(name);

    if(station_selected===0) {
        showerror(_("Error: You have not selected any stations."));
        return;
    }

    $.mobile.loading("show");
    if (id === "new") {
        send_to_os("/cp?pw=&pid=-1"+url).done(function(){
            $.mobile.loading("hide");
            update_controller_programs(function(){
                $.mobile.document.one("pageshow",function(){
                    showerror(_("Program added successfully"));
                });
                goBack();
            });
        });
    } else {
        send_to_os("/cp?pw=&pid="+id+url).done(function(){
            $.mobile.loading("hide");
            update_controller_programs(function(){
                update_program_header();
                $("#program-"+id).find(".program-name").text(name);
            });
            showerror(_("Program has been updated"));
        });
    }
}

function raindelay(delay) {
    $.mobile.loading("show");
    send_to_os("/cv?pw=&rd="+delay).done(function(){
        $.mobile.loading("hide");
        showLoading("#footer-running");
        $.when(
            update_controller_settings(),
            update_controller_status()
        ).then(check_status);
        showerror(_("Rain delay has been successfully set"));
    });
    return false;
}

// Export and Import functions
function getExportMethod() {
    var popup = $(
        "<div data-role='popup'>"+
            "<div class='ui-bar ui-bar-a'>"+_("Select Export Method")+"</div>" +
            "<div data-role='controlgroup' class='tight'>" +
                "<a class='ui-btn hidden fileMethod'>"+_("File")+"</a>" +
                "<a class='ui-btn pasteMethod'>"+_("Email")+"</a>" +
                "<a class='ui-btn localMethod'>"+_("Internal (within app)")+"</a>" +
            "</div>" +
        "</div>"),
        obj = encodeURIComponent(JSON.stringify(controller)),
        subject = "Sprinklers Data Export on "+dateToString(new Date());

    if (isFileCapable) {
        popup.find(".fileMethod").removeClass("hidden").attr({
            href: "data:text/json;charset=utf-8," + obj,
            download: "backup.json"
        }).on("click",function(){
            popup.popup("close");
        });
    }

    popup.find(".pasteMethod").attr("href","mailto:?subject="+encodeURIComponent(subject)+"&body="+obj).on("click",function(){
        popup.popup("close");
    });

    popup.find(".localMethod").on("click",function(){
        popup.popup("close");
        storage.set({"backup":JSON.stringify(controller)},function(){
            showerror(_("Backup saved on this device"));
        });
    });

    popup.one("popupafterclose", function(){
        popup.popup("destroy").remove();
    }).enhanceWithin();

    $(".ui-page-active").append(popup);

    popup.popup({history: false, positionTo: $("#sprinklers-settings").find(".export_config")}).popup("open");
}

function getImportMethod(localData){
    var getPaste = function(){
            var popup = $(
                "<div data-role='popup' data-overlay-theme='b' id='paste_config'>"+
                    "<p class='ui-bar'>" +
                        "<textarea class='textarea' rows='10' placeholder='"+_("Paste your backup here")+"'></textarea>" +
                        "<button data-mini='true' data-theme='b'>"+_("Import")+"</button>" +
                    "</p>" +
                "</div>"
            );

            popup.find("button").on("click",function(){
                var data = popup.find("textarea").val();

                if (data === "") {
                    return;
                }

                try{
                    data=JSON.parse($.trim(data));
                    popup.popup("close");
                    import_config(data);
                }catch(err){
                    popup.find("textarea").val("");
                    showerror(_("Unable to read the configuration file. Please check the file and try again."));
                }
            });

            popup.one("popupafterclose", function(){
                popup.popup("destroy").remove();
            }).enhanceWithin();

            $(".ui-page-active").append(popup);

            popup.popup({history: false, positionTo: "window"}).popup("open");

            return false;
        },
        popup = $(
            "<div data-role='popup'>"+
                "<div class='ui-bar ui-bar-a'>"+_("Select Import Method")+"</div>" +
                "<div data-role='controlgroup' class='tight'>" +
                    "<button class='hidden fileMethod'>"+_("File")+"</button>" +
                    "<button class='pasteMethod'>"+_("Email (copy/paste)")+"</button>" +
                    "<button class='hidden localMethod'>"+_("Internal (within app)")+"</button>" +
                "</div>" +
            "</div>");

    if (isFileCapable) {
        popup.find(".fileMethod").removeClass("hidden").on("click",function(){
            popup.popup("close");
            var input = $("<input type='file' id='configInput' data-role='none' style='visibility:hidden;position:absolute;top:-50px;left:-50px'/>").on("change",function(){
                    var config = this.files[0],
                        reader = new FileReader();

                    if (typeof config !== "object") {
                        return;
                    }

                    reader.onload = function(e){
                        try{
                            var obj=JSON.parse($.trim(e.target.result));
                            import_config(obj);
                        }catch(err){
                            showerror(_("Unable to read the configuration file. Please check the file and try again."));
                        }
                    };

                    reader.readAsText(config);
                });

            input.appendTo("#sprinklers-settings");
            input.click();
            return false;
        });
    } else {
        // Handle local storage being unavailable and present paste dialog immediately
        if (!localData) {
            getPaste();
            return;
        }
    }

    popup.find(".pasteMethod").on("click",function(){
        popup.popup("close");
        getPaste();
        return false;
    });

    if (localData) {
        popup.find(".localMethod").removeClass("hidden").on("click",function(){
            popup.popup("close");
            import_config(JSON.parse(localData));
            return false;
        });
    }

    popup.one("popupafterclose", function(){
        popup.popup("destroy").remove();
    }).enhanceWithin();

    $(".ui-page-active").append(popup);

    popup.popup({history: false, positionTo: $("#sprinklers-settings").find(".import_config")}).popup("open");
}

function import_config(data) {
    var piNames = {1:"tz",2:"ntp",12:"htp",13:"htp2",14:"ar",15:"nbrd",16:"seq",17:"sdt",18:"mas",19:"mton",20:"mtoff",21:"urs",22:"rst",23:"wl",25:"ipas",30:"rlp","lg":"lg",31:"uwt"},
        keyIndex = {"tz":1,"ntp":2,"dhcp":3,"hp0":12,"hp1":13,"ar":14,"ext":15,"seq":16,"sdt":17,"mas":18,"mton":19,"mtof":20,"urs":21,"rso":22,"wl":23,"ipas":25,"devid":26,"rlp":30,"lg":"lg","uwt":31,"ntp1":32,"ntp2":33,"ntp3":34,"ntp4":35};

    if (typeof data !== "object" || !data.settings) {
        showerror(_("Invalid configuration"));
        return;
    }

    areYouSure(_("Are you sure you want to restore the configuration?"), "", function() {
        $.mobile.loading("show");

        var cs = "/cs?pw=",
            co = "/co?pw=",
            cp_start = "/cp?pw=",
            isPi = isOSPi(),
            i, key, option, station;

        for (i in data.options) {
            if (data.options.hasOwnProperty(i) && keyIndex.hasOwnProperty(i)) {
                key = keyIndex[i];
                if ($.inArray(key, [2,14,16,21,22,25]) !== -1 && data.options[i] === 0) {
                    continue;
                }
                if (key === 3) {
                    if (checkOSVersion(210) && controller.options.dhcp === 1) {
                        co += "&o3=1";
                    }
                    continue;
                }
                if (isPi) {
                    key = piNames[key];
                    if (key === undefined) {
                        continue;
                    }
                } else {
                    key = key;
                }
                if (checkOSVersion(208) === true && typeof data.options[i] === "string") {
                    option = data.options[i].replace(/\s/g,"_");
                } else {
                    option = data.options[i];
                }
                co += "&o"+key+"="+option;
            }
        }
        co += "&"+(isPi?"o":"")+"loc="+data.settings.loc;

        for (i=0; i<data.stations.snames.length; i++) {
            if (checkOSVersion(208) === true) {
                station = data.stations.snames[i].replace(/\s/g,"_");
            } else {
                station = data.stations.snames[i];
            }
            cs += "&s"+i+"="+station;
        }

        for (i=0; i<data.stations.masop.length; i++) {
            cs += "&m"+i+"="+data.stations.masop[i];
        }

        if (typeof data.stations.ignore_rain === "object") {
            for (i=0; i<data.stations.ignore_rain.length; i++) {
                cs += "&i"+i+"="+data.stations.ignore_rain[i];
            }
        }

        $.when(
            send_to_os(co),
            send_to_os(cs),
            send_to_os("/dp?pw=&pid=-1"),
            $.each(data.programs.pd,function (i,prog) {
                var name = "";

                // Handle data from firmware 2.1+ being imported to OSPi
                if (isPi && typeof data.options.fwv === "number" && data.options.fwv >= 210) {
                    showerror(_("Program data is newer than the device firmware and cannot be imported"));
                    return false;
                }

                // Handle data from firmware 2.1+ being imported to a firmware prior to 2.1
                if (!isPi && typeof data.options.fwv === "number" && data.options.fwv >= 210 && !checkOSVersion(210)) {
                    showerror(_("Program data is newer than the device firmware and cannot be imported"));
                    return false;
                }

                // Handle data from firmware 2.1+ being imported to a 2.1+ device
                // The firmware does not accept program name inside the program array and must be submitted seperately
                if (!isPi && typeof data.options.fwv === "number" && data.options.fwv >= 210 && checkOSVersion(210)) {
                    name = "&name="+prog[5];

                    // Truncate the program name off the array
                    prog = prog.slice(0,5);
                }

                // Handle data from firmware prior to 2.1 being imported to a 2.1+ device
                if (!isPi && typeof data.options.fwv === "number" && data.options.fwv < 210 && checkOSVersion(210)) {
                    var program = read_program183(prog),
                        total = (prog.length - 7),
                        allDur = [],
                        j=0,
                        bits, n, s;

                    // Set enable/disable bit for program
                    j |= (program.en<<0);

                    // Set program restrictions
                    if (program.is_even) {
                        j |= (2<<2);
                    } else if (program.is_odd) {
                        j |= (1<<2);
                    } else {
                        j |= (0<<2);
                    }

                    // Set program type
                    if (program.is_interval) {
                        j |= (3<<4);
                    } else {
                        j |= (0<<4);
                    }

                    // Set start time type (repeating)
                    j |= (0<<6);

                    // Save bits to program data
                    prog[0] = j;

                    // Using the total number of stations, migrate the duration into each station
                    for (n=0; n < total; n++) {
                        bits = prog[7+n];
                        for (s=0; s < 8; s++) {
                            allDur.push((bits&(1<<s)) ? program.duration : 0);
                        }
                    }

                    // Set the start time, interval time, and repeat count
                    prog[3] = [program.start,parseInt((program.end-program.start)/program.interval),program.interval,0];

                    // Change the duration from the previous int to the new array
                    prog[4] = allDur;

                    // Truncate the station enable/disable flags
                    prog = prog.slice(0,5);

                    name = "&name="+_("Program")+" "+(i+1);
                }

                send_to_os(cp_start+"&pid=-1&v="+JSON.stringify(prog)+name);
            })
        ).then(
            function(){
                update_controller(
                    function(){
                        $.mobile.loading("hide");
                        showerror(_("Backup restored to your device"));
                        update_weather();
                        goHome();
                    },
                    function(){
                        $.mobile.loading("hide");
                        network_fail();
                    }
                );
            },
            function(){
                $.mobile.loading("hide");
                showerror(_("Unable to import configuration."));
            }
        );
    });
}

// About page
function show_about() {
    var page = $("<div data-role='page' id='about'>" +
            "<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false'>" +
                "<a href='javascript:void(0);' class='ui-btn ui-corner-all ui-shadow ui-btn-left ui-btn-b ui-toolbar-back-btn ui-icon-carat-l ui-btn-icon-left' data-rel='back'>"+_("Back")+"</a>" +
                "<h3>"+_("About")+"</h3>" +
            "</div>" +
            "<div class='ui-content' role='main'>" +
                "<ul data-role='listview' data-inset='true'>" +
                    "<li>" +
                        "<p>"+_("User manual for OpenSprinkler is available at")+" <a class='iab' target='_blank' href='https://opensprinkler.com/wp-content/uploads/2014/10/os_fw210_manual.pdf'>https://opensprinkler.com/user-manual/</a></p>" +
                    "</li>" +
                "</ul>" +
                "<ul data-role='listview' data-inset='true'>" +
                    "<li>" +
                        "<p>"+_("This is open source software: source code and changelog for this application can be found at")+" <a class='iab' target='_blank' href='https://github.com/salbahra/Sprinklers/'>https://github.com/salbahra/Sprinklers/</a></p>" +
                        "<p>"+_("Language localization is crowdsourced using Get Localization available at")+" <a class='iab' target='_blank' href='http://www.getlocalization.com/Sprinklers/'>http://www.getlocalization.com/Sprinklers/</a></p>" +
                    "</li>" +
                "</ul>" +
                "<p class='smaller'>" +
                    _("App Version")+": 1.2.3" +
                    "<br>" +
                    _("Firmware")+": "+getOSVersion() +
                "</p>" +
            "</div>" +
        "</div>");

    page.one("pagehide",function(){
        page.remove();
    });

    $("#about").remove();
    page.appendTo("body");
}

// OpenSprinkler controller methods
function isRunning() {
    for (var i=0; i<controller.status.length; i++) {
        if (controller.status[i] > 0) {
            return i;
        }
    }

    return -1;
}

function stopStations(callback){
    $.mobile.loading("show");

    // It can take up to a second before stations actually stop
    send_to_os("/cv?pw=&rsn=1").done(function(){
        setTimeout(function(){
            $.mobile.loading("hide");
            callback();
        },1000);
    });
}

// OpenSprinkler feature detection functions
function isOSPi() {
    if (controller && typeof controller.options.fwv === "string" && controller.options.fwv.search(/ospi/i) !== -1) {
        return true;
    }
    return false;
}

function checkWeatherPlugin() {
    var weather_settings = $(".weather_settings"),
        weather_provider = $(".show-providers");

    curr_wa = [];
    weather_settings.hide();
    if (isOSPi()) {
        storage.get("provider",function(data){
            send_to_os("/wj?pw=","json").done(function(results){
                var provider = results.weather_provider;

                // Check if the OSPi has valid weather provider data
                if (typeof provider === "string" && (provider === "yahoo" || provider === "wunderground")) {
                    if (data.provider !== provider) {
                        storage.set({
                            "provider": provider,
                            "wapikey": results.wapikey
                        });

                        // Update the weather based on this information
                        update_weather();
                    }

                    // Hide the weather provider option when the OSPi provides it
                    weather_provider.hide();
                }

                if (typeof results.auto_delay === "string") {
                    curr_wa = results;
                    weather_settings.css("display","");
                }
            });
        });
    } else {
        if (checkOSVersion(210)) {
            // Hide the weather provider option when the OSPi provides it
            weather_provider.hide();
        } else {
            weather_provider.css("display","");
        }
    }
}

function checkOSPiVersion(check) {
    var ver;

    if (isOSPi()) {
        ver = controller.options.fwv.split("-")[0];
        if (ver !== check) {
            ver = ver.split(".");
            check = check.split(".");
            return versionCompare(ver,check);
        } else {
            return true;
        }
    } else {
        return false;
    }
}

function checkOSVersion(check) {
    if (isOSPi()) {
        return false;
    } else {
        if (check === controller.options.fwv) {
            return true;
        } else {
            return versionCompare(controller.options.fwv.toString().split(""),check.toString().split(""));
        }
    }
}

function versionCompare(ver,check) {
    // Returns false when check < ver and 1 when check > ver

    var max = Math.max(ver.length, check.length),
        result;

    while (ver.length < max) {
        ver.push(0);
    }

    while (check.length < max) {
        check.push(0);
    }

    for (var i=0; i<max; i++) {
        result = Math.max(-1, Math.min(1, ver[i] - check[i]));
        if (result !== 0) {
            break;
        }
    }

    if (result === -1) {
        result = false;
    }

    return result;
}

function getOSVersion(fwv) {
    if (!fwv && typeof controller.options === "object") {
        fwv = controller.options.fwv;
    }
    if (typeof fwv === "string" && fwv.search(/ospi/i) !== -1) {
        return fwv;
    } else {
        return (fwv/100>>0)+"."+((fwv/10>>0)%10)+"."+(fwv%10);
    }
}

// Accessory functions for jQuery Mobile
function areYouSure(text1, text2, callback) {
    $("#sure").popup("destroy").remove();

    var popup = $(
        "<div data-role='popup' data-overlay-theme='b' id='sure'>"+
            "<h3 class='sure-1 center'>"+text1+"</h3>"+
            "<p class='sure-2 center'>"+text2+"</p>"+
            "<a class='sure-do ui-btn ui-btn-b ui-corner-all ui-shadow' href='#'>"+_("Yes")+"</a>"+
            "<a class='sure-dont ui-btn ui-corner-all ui-shadow' href='#'>"+_("No")+"</a>"+
        "</div>"
    );

    //Bind buttons
    popup.find(".sure-do").one("click.sure", function() {
        $("#sure").popup("close");
        callback();
        return false;
    });
    popup.find(".sure-dont").one("click.sure", function() {
        $("#sure").popup("close");
        return false;
    });

    popup.one("popupafterclose", function(){
        $(this).popup("destroy").remove();
    }).enhanceWithin();

    $(".ui-page-active").append(popup);

    $("#sure").popup({history: false, positionTo: "window"}).popup("open");
}

function showIPRequest(opt){
    var defaults = {
            title: _("Enter IP Address"),
            ip: [0,0,0,0],
            showBack: true,
            callback: function(){}
        };

    opt = $.extend({}, defaults, opt);

    $("#ipInput").popup("destroy").remove();

    var popup = $("<div data-role='popup' id='ipInput' data-theme='a' data-overlay-theme='b'>" +
            "<div data-role='header' data-theme='b'>" +
                "<h1>"+opt.title+"</h1>" +
            "</div>" +
            "<div class='ui-content'>" +
                "<span>" +
                    "<fieldset class='ui-grid-c incr'>" +
                        "<div class='ui-block-a'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
                        "<div class='ui-block-b'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
                        "<div class='ui-block-c'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
                        "<div class='ui-block-d'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
                    "</fieldset>" +
                    "<div class='ui-grid-c inputs'>" +
                        "<div class='ui-block-a'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='"+opt.ip[0]+"'></div>" +
                        "<div class='ui-block-b'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='"+opt.ip[1]+"'></div>" +
                        "<div class='ui-block-c'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='"+opt.ip[2]+"'></div>" +
                        "<div class='ui-block-d'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='"+opt.ip[3]+"'></div>" +
                    "</div>" +
                    "<fieldset class='ui-grid-c decr'>" +
                        "<div class='ui-block-a'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
                        "<div class='ui-block-b'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
                        "<div class='ui-block-c'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
                        "<div class='ui-block-d'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
                    "</fieldset>" +
                "</span>" +
                (opt.showBack ? "<button class='submit' data-theme='b'>"+_("Submit")+"</button>" : "") +
            "</div>" +
        "</div>"),
        changeValue = function(pos,dir){
            var input = popup.find(".inputs input").eq(pos),
                val = parseInt(input.val());

            if ((dir === -1 && val === 0) || (dir === 1 && val >= 255)) {
                return;
            }

            input.val(val+dir);
            opt.callback(getIP());
        },
        getIP = function(){
            return $.makeArray(popup.find(".ip_addr").map(function(){return parseInt($(this).val());}));
        };

    popup.find("button.submit").on("click",function(){
        opt.callback(getIP());
        popup.popup("destroy").remove();
    });

    popup.on("focus","input[type='number']",function(){
        this.value = "";
    }).on("blur","input[type='number']",function(){
        if (this.value === "") {
            this.value = "0";
        }
    });

    holdButton(popup.find(".incr").children(),function(e){
        var pos = $(e.currentTarget).index();
        changeValue(pos,1);
        return false;
    });

    holdButton(popup.find(".decr").children(),function(e){
        var pos = $(e.currentTarget).index();
        changeValue(pos,-1);
        return false;
    });

    $(".ui-page-active").append(popup);

    popup
    .css("max-width","350px")
    .popup({
        history: false,
        "positionTo": "window"
    })
    .one("popupafterclose",function(){
        opt.callback(getIP());
        $(this).popup("destroy").remove();
    })
    .enhanceWithin().popup("open");
}

function showDurationBox(opt) {
    var defaults = {
            seconds: 0,
            title: _("Duration"),
            granularity: 0,
            preventCompression: false,
            showBack: true,
            callback: function(){}
        };

    opt = $.extend({}, defaults, opt);

    $("#durationBox").popup("destroy").remove();

    var keys = ["days","hours","minutes","seconds"],
        text = [_("Days"),_("Hours"),_("Minutes"),_("Seconds")],
        conv = [86400,3600,60,1],
        max = [0,23,59,59],
        total = 4 - opt.granularity,
        start = 0,
        arr = sec2dhms(opt.seconds),
        i;

    opt.seconds = parseInt(opt.seconds);

    if (!opt.preventCompression && (checkOSVersion(210) && opt.maximum > 64800)) {
        opt.maximum = 64800;
    }

    if (opt.maximum) {
        for (i=conv.length-1; i>=0; i--) {
            if (opt.maximum < conv[i]) {
                start = i+1;
                total = (conv.length - start) - opt.granularity;
                break;
            }
        }
    }

    var incrbts = "<fieldset class='ui-grid-"+String.fromCharCode(95+(total))+" incr'>",
        inputs = "<div class='ui-grid-"+String.fromCharCode(95+(total))+" inputs'>",
        decrbts = "<fieldset class='ui-grid-"+String.fromCharCode(95+(total))+" decr'>",
        popup = $("<div data-role='popup' id='durationBox' data-theme='a' data-overlay-theme='b'>" +
            "<div data-role='header' data-theme='b'>" +
                "<h1>"+opt.title+"</h1>" +
            "</div>" +
            "<div class='ui-content'>" +
                "<span>" +
                "</span>" +
                (opt.showBack ? "<button class='submit' data-theme='b'>"+_("Submit")+"</button>" : "") +
            "</div>" +
        "</div>"),
        changeValue = function(pos,dir){
            var input = popup.find(".inputs input").eq(pos),
                apos = pos+start,
                val = parseInt(input.val());

            if (input.prop("disabled")) {
                return;
            }

            if ((dir === -1 && val === 0) || (dir === 1 && (getValue() + conv[apos]) > opt.maximum)) {
                return;
            }

            // Increment next time field on current max
            if (dir === 1 && (max[apos] !== 0 && pos !== 0 && val >= max[apos])) {
                input.val(0);
                input = popup.find(".inputs input").eq(pos-1);
                val = parseInt(input.val());
            }

            input.val(val+dir);
            opt.callback(getValue());

            if (!opt.preventCompression && checkOSVersion(210)) {
                var state = (dir === 1) ? true : false;

                if (dir === 1) {
                    if (getValue() >= 60) {
                        toggleInput("seconds",state);
                    }
                    if (getValue() >= 10800) {
                        toggleInput("minutes",state);
                    }
                } else if (dir === -1) {
                    if (getValue() < 60) {
                        toggleInput("seconds",state);
                    } else if (getValue() < 10800) {
                        toggleInput("minutes",state);
                    }
                }
            }
        },
        getValue = function() {
            return dhms2sec({
                "days": parseInt(popup.find(".days").val()) || 0,
                "hours": parseInt(popup.find(".hours").val()) || 0,
                "minutes": parseInt(popup.find(".minutes").val()) || 0,
                "seconds": parseInt(popup.find(".seconds").val()) || 0
            });
        },
        toggleInput = function(field,state) {
            popup.find("."+field).toggleClass("ui-state-disabled",state).prop("disabled",state).val(function(){
                if (state) {
                    return 0;
                } else {
                    return this.value;
                }
            }).parent(".ui-input-text").toggleClass("ui-state-disabled",state);
        };

    for (i=start; i<conv.length - opt.granularity; i++) {
        incrbts += "<div "+((total > 1) ? "class='ui-block-"+String.fromCharCode(97+i-start)+"'" : "")+"><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>";
        inputs += "<div "+((total > 1) ? "class='ui-block-"+String.fromCharCode(97+i-start)+"'" : "")+"><label class='center'>"+_(text[i])+"</label><input data-wrapper-class='pad_buttons' class='"+keys[i]+"' type='number' pattern='[0-9]*' value='"+arr[keys[i]]+"'></div>";
        decrbts += "<div "+((total > 1) ? "class='ui-block-"+String.fromCharCode(97+i-start)+"'" : "")+"><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>";
    }

    incrbts += "</fieldset>";
    inputs += "</div>";
    decrbts += "</fieldset>";

    popup.find("span").prepend(incrbts+inputs+decrbts);

    popup.find("button.submit").on("click",function(){
        opt.callback(getValue());
        popup.popup("destroy").remove();
    });

    if (!opt.preventCompression && checkOSVersion(210)) {
        if (opt.seconds >= 60) {
            toggleInput("seconds",true);
        }

        if (opt.seconds >= 10800) {
            toggleInput("minutes",true);
        }
    }

    popup.on("focus","input[type='number']",function(){
        this.value = "";
    }).on("blur","input[type='number']",function(){
        if (this.value === "") {
            this.value = "0";
        }
    });

    holdButton(popup.find(".incr").children(),function(e){
        var pos = $(e.currentTarget).index();
        changeValue(pos,1);
        return false;
    });

    holdButton(popup.find(".decr").children(),function(e){
        var pos = $(e.currentTarget).index();
        changeValue(pos,-1);
        return false;
    });

    $(".ui-page-active").append(popup);

    popup
    .css("max-width","350px")
    .popup({
        history: false,
        "positionTo": "window"
    })
    .one("popupafterclose",function(){
        opt.callback(getValue());
        $(this).popup("destroy").remove();
    })
    .enhanceWithin().popup("open");
}

function showSingleDurationInput(opt) {
    $("#singleDuration").popup("destroy").remove();
    var defaults = {
        data: 0,
        title: _("Duration"),
        minimum: 0,
        label: "",
        updateOnChange: true,
        showBack: true,
        callback: function(){}
    };

    opt = $.extend({}, defaults, opt);

    var popup = $("<div data-role='popup' id='singleDuration' data-theme='a' data-overlay-theme='b'>" +
            "<div data-role='header' data-theme='b'>" +
                "<h1>"+opt.title+"</h1>" +
            "</div>" +
            "<div class='ui-content'>" +
                (opt.helptext ? "<p class='pad-top rain-desc center smaller'>"+opt.helptext+"</p>" : "") +
                "<label class='center'>"+opt.label+"</label>" +
                "<div class='input_with_buttons'>" +
                    "<button class='decr ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
                    "<input type='number' pattern='[0-9]*' value='"+opt.data+"'>" +
                    "<button class='incr ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
                "</div>" +
                (opt.updateOnChange && !opt.showBack ? "" : "<input type='submit' data-theme='b' value='"+_("Submit")+"'>") +
            "</div>" +
        "</div>"),
        input = popup.find("input"),
        changeValue = function(dir){
            var val = parseInt(input.val());

            if ((dir === -1 && val === opt.minimum) || (dir === 1 && val === opt.maximum)) {
                return;
            }

            input.val(val+dir);
            if (opt.updateOnChange) {
                opt.callback(val+dir);
            }
        };

    holdButton(popup.find(".incr"),function(){
        changeValue(1);
        return false;
    });
    holdButton(popup.find(".decr"),function(){
        changeValue(-1);
        return false;
    });

    popup.find("input[type='number']").on("focus",function(){
        this.value = "";
    }).on("blur",function(){
        if (this.value === "") {
            this.value = "0";
        }
    });

    popup.find("input[type='submit']").on("click",function(){
        opt.callback(input.val());
        popup.popup("destroy").remove();
    });

    $(".ui-page-active").append(popup);

    popup
    .popup({
        history: false,
        "positionTo": "window"
    })
    .one("popupafterclose",function(){
        if (opt.updateOnChange) {
            opt.callback(input.val());
        }
        popup.popup("destroy").remove();
    })
    .enhanceWithin().popup("open");
}

function showDateTimeInput(timestamp,callback) {
    $("#datetimeInput").popup("destroy").remove();

    if (!(timestamp instanceof Date)) {
        timestamp = new Date(timestamp*1000);
        timestamp.setMinutes(timestamp.getMinutes()-timestamp.getTimezoneOffset());
    }

    callback = callback || function(){};

    var keys = ["Month","Date","FullYear","Hours","Minutes"],
        monthNames = [_("Jan"),_("Feb"),_("Mar"),_("Apr"),_("May"),_("Jun"),_("Jul"),_("Aug"),_("Sep"),_("Oct"),_("Nov"),_("Dec")],
        popup = $("<div data-role='popup' id='datetimeInput' data-theme='a' data-overlay-theme='b'>" +
            "<div data-role='header' data-theme='b'>" +
                "<h1>"+_("Enter Date/Time")+"</h1>" +
            "</div>" +
            "<div class='ui-content'>" +
            "</div>" +
        "</div>"),
        changeValue = function(pos,dir){
            timestamp["setUTC"+pos](timestamp["getUTC"+pos]() + dir);
            callback(new Date(timestamp.getTime()));
            updateContent();
        },
        updateContent = function() {
            var incrbts = "<fieldset class='ui-grid-d incr'>",
                inputs = "<div class='ui-grid-d inputs'>",
                decrbts = "<fieldset class='ui-grid-d decr'>",
                val, mark, i;

            for (i=0; i<5; i++) {
                val = timestamp["getUTC"+keys[i]]();
                mark = "";

                if (keys[i] === "Month") {
                    val = "<p class='center'>"+monthNames[val]+"</p>";
                } else if (keys[i] === "Date") {
                    val = "<p class='center'>"+val+",</p>";
                } else if (keys[i] === "Hours") {
                    val = "<p style='width:90%;display:inline-block' class='center'>"+val+"</p><p style='display:inline-block'>:</p>";
                } else {
                    val = "<p class='center'>"+val+"</p>";
                }

                incrbts += "<div class='ui-block-"+String.fromCharCode(97+i)+"'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>";
                inputs += "<div id='"+keys[i]+"' class='ui-block-"+String.fromCharCode(97+i)+"'>"+val+"</div>";
                decrbts += "<div class='ui-block-"+String.fromCharCode(97+i)+"'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>";
            }

            incrbts += "</fieldset>";
            inputs += "</div>";
            decrbts += "</fieldset>";

            popup.find(".ui-content").html("<span>"+incrbts+inputs+decrbts+"</span>").enhanceWithin();

            popup.find(".incr").children().on("vclick",function(){
                var pos = $(this).index();
                changeValue(popup.find(".inputs").children().eq(pos).attr("id"),1);
                return false;
            });

            popup.find(".decr").children().on("vclick",function(){
                var pos = $(this).index();
                changeValue(popup.find(".inputs").children().eq(pos).attr("id"),-1);
                return false;
            });
    };

    updateContent();

    $(".ui-page-active").append(popup);

    popup
    .css("width","280px")
    .popup({
        history: false,
        "positionTo": "window"
    })
    .one("popupafterclose",function(){
        callback(timestamp);
        popup.popup("destroy").remove();
    })
    .enhanceWithin().popup("open");
}

function changePage(toPage,opts) {
    opts = opts || {};
    if (toPage.indexOf("#") !== 0) {
        toPage = "#"+toPage;
    }

    $.mobile.pageContainer.pagecontainer("change",toPage,opts);
}

// Close the panel before page transition to avoid bug in jQM 1.4+
function changeFromPanel(page) {
    var $panel = $("#sprinklers-settings");
    $panel.one("panelclose", function(){
        changePage("#"+page);
    });
    $panel.panel("close");
}

function showTooltip(x, y, contents, color) {
    $("#tooltip").remove();
    $("<div id='tooltip'>" + contents + "</div>").css( {
        position: "absolute",
        display: "none",
        top: y + 5,
        left: x + 5,
        padding: "2px",
        "text-shadow": "none",
        "background-color": color,
        color: colorContrast(color),
        opacity: 0.80
    }).appendTo("body").fadeIn(200);
}

function colorContrast(c) {
    //http://www.w3.org/TR/AERT#color-contrast
    var rgb = c.match(/rgb\((\d+),(\d+),(\d+)\)/),
        o = Math.round(((parseInt(rgb[1]) * 299) + (parseInt(rgb[2]) * 587) + (parseInt(rgb[3]) * 114)) /1000);

    return (o > 125) ? "black" : "white";
}

// Show loading indicator within element(s)
function showLoading(ele) {
    ele = (typeof ele === "string") ? $(ele) : ele;
    ele.off("click").html("<p class='ui-icon ui-icon-loading mini-load'></p>");
}

function goHome() {
    // Transition to home page after succesful load
    if ($.mobile.pageContainer.pagecontainer("getActivePage").attr("id") !== "sprinklers") {
        $.mobile.document.one("pageshow",function(){
            // Allow future transitions to properly animate
            delete $.mobile.navigate.history.getActive().transition;
        });
        changePage("#sprinklers",{
            "firstLoad": true,
            "showLoading": false,
            "transition": "none"
        });
    }
}

function goBack() {
    var page = $(".ui-page-active").attr("id"),
        managerStart = (page === "site-control" && $.isEmptyObject(controller)),
        popup = $(".ui-popup-active");

    if (popup.length) {
        popup.find("[data-role='popup']").popup("close");
        return;
    }

    if (page === "sprinklers" || page === "start" || managerStart) {
        try {
            navigator.app.exitApp();
        } catch(err) {}
    } else {
        if (isChromeApp) {
            var url = $.mobile.navigate.history.getPrev().url;

            if (url.slice(0,1) !== "#") {
                return;
            }

            changePage(url);
            $.mobile.document.one("pagehide",function(){
                $.mobile.navigate.history.activeIndex -= 2;
            });
        } else {
            $.mobile.back();
        }
    }
}

// show error message
function showerror(msg,dur) {
    dur = dur || 2500;

    clearTimeout(errorTimeout);

    $.mobile.loading("show", {
        text: msg,
        textVisible: true,
        textonly: true,
        theme: "b"
    });

    // hide after delay
    errorTimeout = setTimeout(function(){$.mobile.loading("hide");},dur);
}

// Accessory functions
function fixInputClick(page) {
    // Handle Fast Click quirks
    if (!FastClick.notNeeded(document.body)) {
        page.find("input[type='checkbox']:not([data-role='flipswitch'])").addClass("needsclick");
        page.find(".ui-collapsible-heading-toggle").on("click",function(){
            var heading = $(this);

            setTimeout(function(){
                heading.removeClass("ui-btn-active");
            },100);
        });
        page.find(".ui-select > .ui-btn").each(function(a,b){
            var ele = $(b),
                id = ele.attr("id");

            ele.attr("data-rel","popup");
            ele.attr("href","#"+id.slice(0,-6)+"listbox");
        });
    }
}

// Bind buttons to allow push and hold effects
function holdButton(target,callback) {
    var intervalId;

    target.on("tap",callback).on("taphold",function(e){
        intervalId = setInterval(function(){
            callback(e);
        }, 100);
    }).on("vmouseup vmouseout vmousecancel touchend",function(){
        clearInterval(intervalId);
    }).on("touchmove",function(e){
        e.preventDefault();
    });
}

// Insert style string into the DOM
function insertStyle(style) {
    var a=document.createElement("style");
    a.innerHTML=style;
    document.head.appendChild(a);
}

// Convert all elements in array to integer
function parseIntArray(arr) {
    for(var i=0; i<arr.length; i++) {arr[i] = +arr[i];}
    return arr;
}

// Convert seconds into (HH:)MM:SS format. HH is only reported if greater than 0.
function sec2hms(diff) {
    var str = "";
    var hours = Math.max(0, parseInt( diff / 3600 ) % 24);
    var minutes = Math.max(0, parseInt( diff / 60 ) % 60);
    var seconds = diff % 60;
    if (hours) {
        str += pad(hours)+":";
    }
    return str+pad(minutes)+":"+pad(seconds);
}

// Convert seconds into array of days, hours, minutes and seconds.
function sec2dhms(diff) {
    return {
        "days": Math.max(0, parseInt(diff / 86400)),
        "hours": Math.max(0, parseInt(diff % 86400 / 3600)),
        "minutes": Math.max(0, parseInt((diff % 86400) % 3600 / 60)),
        "seconds": Math.max(0, parseInt((diff % 86400) % 3600 % 60))
    };
}

function dhms2str(arr) {
    var str = "";
    if (arr.days) {
        str += arr.days+_("d")+" ";
    }
    if (arr.hours) {
        str += arr.hours+_("h")+" ";
    }
    if (arr.minutes) {
        str += arr.minutes+_("m")+" ";
    }
    if (arr.seconds) {
        str += arr.seconds+_("s")+" ";
    }
    if (str === "") {
        str = "0"+_("s");
    }
    return str.trim();
}

// Convert days, hours, minutes and seconds array into seconds (int).
function dhms2sec(arr) {
    return parseInt((arr.days*86400)+(arr.hours*3600)+(arr.minutes*60)+arr.seconds);
}

// Generate export link for JSON data
function exportObj(ele,obj,subject) {
    obj = encodeURIComponent(JSON.stringify(obj));

    if (isFileCapable) {
        $(ele).attr({
            href: "data:text/json;charset=utf-8," + obj,
            download: "backup.json"
        });
    } else {
        subject = subject || "Sprinklers Data Export on "+dateToString(new Date());
        $(ele).attr("href","mailto:?subject="+encodeURIComponent(subject)+"&body="+obj);
    }
}

// Return day of the week
function getDayName(day,type) {
    var ldays = [_("Sunday"),_("Monday"),_("Tuesday"),_("Wednesday"),_("Thursday"),_("Friday"),_("Saturday")],
        sdays = [_("Sun"),_("Mon"),_("Tue"),_("Wed"),_("Thu"),_("Fri"),_("Sat")];

    if (type === "short") {
        return sdays[day.getDay()];
    } else {
        return ldays[day.getDay()];
    }
}

// Add ability to unique sort arrays
function getUnique(inputArray) {
    var outputArray = [];
    for (var i = 0; i < inputArray.length; i++) {
        if (($.inArray(inputArray[i], outputArray)) === -1) {
            outputArray.push(inputArray[i]);
        }
    }
    return outputArray;
}

// pad a single digit with a leading zero
function pad(number) {
    var r = String(number);
    if ( r.length === 1 ) {
        r = "0" + r;
    }
    return r;
}

//Localization functions
function _(key) {
    //Translate item (key) based on currently defined language
    if (typeof language === "object" && language.hasOwnProperty(key)) {
        var trans = language[key];
        return trans ? trans : key;
    } else {
        //If English
        return key;
    }
}

function set_lang() {
    //Update all static elements to the current language
    $("[data-translate]").text(function() {
        var el = $(this),
            txt = el.data("translate");

        if (el.is("input[type='submit']")) {
            el.val(_(txt));
            // Update button for jQuery Mobile
            if (el.parent("div.ui-btn").length > 0) {
                el.button("refresh");
            }
        } else {
            return _(txt);
        }
    });
    $(".ui-toolbar-back-btn").text(_("Back"));

    check_curr_lang();
}

function update_lang(lang) {
    var prefix = "";

    //Empty out the current language (English is provided as the key)
    language = {};

    if (typeof lang === "undefined") {
        storage.get("lang",function(data){
            //Identify the current browser's locale
            var locale = data.lang || navigator.language || navigator.browserLanguage || navigator.systemLanguage || navigator.userLanguage || "en";

            update_lang(locale.substring(0,2));
        });
        return;
    }

    storage.set({"lang":lang});

    if (lang === "en") {
        set_lang();
        return;
    }

    if (curr_local) {
        prefix = $.mobile.path.parseUrl($("head").find("script").eq(0).attr("src")).hrefNoHash.slice(0,-10);
    }

    $.getJSON(prefix+"locale/"+lang+".js",function(store){
        language = store.messages;
        set_lang();
    }).fail(set_lang);
}

function languageSelect() {
    $("#localization").popup("destroy").remove();

    var popup = "<div data-role='popup' data-overlay-theme='b' id='localization' data-corners='false'>" +
                "<ul data-inset='true' data-role='listview' id='lang' data-corners='false'>" +
                "<li data-role='list-divider' data-theme='b' class='center' data-translate='Localization'>"+_("Localization")+"</li>",
        codes = {af: _("Afrikaans"), am: _("Amharic"), zh: _("Chinese"), cs: _("Czech"), nl: _("Dutch"), en: _("English"), fr: _("French"), de: _("German"), he: _("Hebrew"), hu: _("Hungarian"), it: _("Italian"), mn: _("Mongolian"), no: _("Norwegian"), pl: _("Polish"), pt: _("Portuguese"), sk: _("Slovak"), sl: _("Slovenian"), es: _("Spanish")};

    $.each(codes,function(key,name){
        popup += "<li><a href='#' data-translate='"+name+"' data-lang-code='"+key+"'>"+name+"</a></li>";
    });

    popup += "</ul></div>";

    popup = $(popup);

    popup.find("a").on("click",function(){
        var link = $(this),
            lang = link.data("lang-code");

        update_lang(lang);
    });

    $(".ui-page-active").append(popup);

    popup
    .popup({
        history: false,
        "positionTo": "window"
    })
    .one("popupafterclose",function(){
        popup.popup("destroy").remove();
    })
    .enhanceWithin().popup("open");
}

function check_curr_lang() {
    storage.get("lang",function(data){
        var popup = $("#localization");

        popup.find("a").each(function(a,b){
            var item = $(b);
            if (item.data("lang-code") === data.lang) {
                item.removeClass("ui-icon-carat-r").addClass("ui-icon-check");
            } else {
                item.removeClass("ui-icon-check").addClass("ui-icon-carat-r");
            }
        });

        popup.find("li.ui-last-child").removeClass("ui-last-child");
    });
}

function dateToString(date,toUTC) {
    var lang = $("#localization").find(".ui-icon-check").data("langCode"),
        dayNames = [_("Sun"),_("Mon"),_("Tue"),_("Wed"),_("Thr"),_("Fri"),_("Sat")],
        monthNames = [_("Jan"),_("Feb"),_("Mar"),_("Apr"),_("May"),_("Jun"),_("Jul"),_("Aug"),_("Sep"),_("Oct"),_("Nov"),_("Dec")];

    toUTC = (toUTC === false) ? false : true;

    if (toUTC) {
        date.setMinutes(date.getMinutes()+date.getTimezoneOffset());
    }

    if (lang === "de") {
        return pad(date.getDate())+"."+pad(date.getMonth())+"."+date.getFullYear()+" "+pad(date.getHours())+":"+pad(date.getMinutes())+":"+pad(date.getSeconds());
    }

    return dayNames[date.getDay()]+", "+pad(date.getDate())+" "+monthNames[date.getMonth()]+" "+date.getFullYear()+" "+pad(date.getHours())+":"+pad(date.getMinutes())+":"+pad(date.getSeconds());
}
